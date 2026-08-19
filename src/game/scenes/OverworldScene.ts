import * as Phaser from "phaser";
import { TILE, type Facing } from "../constants";
import { applyCameraZoom } from "../camera";
import { Player } from "../entities/Player";
import type { RoomKey } from "../rooms";
import { DEFAULT_MAP, MAPS, type Gate, type MapKey } from "../maps";
import { InteractionManager } from "../interaction/InteractionManager";
import { populateArea } from "../interaction/populateArea";
import { MAP_INTERACTIONS } from "../data/interactions";
import { Enemy } from "../entities/Enemy";
import { isEncounterMap, rollEncounters } from "../combat/encounters";
import { gameService } from "@/lib/services";
import type { BattleResultKind } from "@/lib/services/types";

interface EnterData {
  mapKey?: MapKey;
  spawnX?: number;
  spawnY?: number;
  /** Set when arriving through a gate: which side of THIS map we walked in from. */
  arriveGate?: Gate["side"];
}

/** Ground texture key per map, so several maps can share the texture cache. */
export const groundKey = (mapKey: MapKey) => `ground:${mapKey}`;

/**
 * A standalone city. The ground layer (grass + autotiled gravel paths + pond
 * shorelines) is a single baked image per city; houses, fences, trees, flowers,
 * water and exit gates come from that city's layout JSON (see
 * scripts/build-city.py). The camera follows the player (world scrolls, player
 * stays centered). Doors warp to InteriorScene; re-entering the overworld
 * carries `mapKey` so the player returns to the same city they left, never a
 * different one — cities are not connected to each other.
 */
export class OverworldScene extends Phaser.Scene {
  /** Facing the player should have on first arrival, walking IN from a given gate. */
  private static readonly FACE_INTO: Record<Gate["side"], Facing> = {
    N: "down",
    S: "up",
    W: "right",
    E: "left",
  };

  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private exits!: Phaser.Physics.Arcade.StaticGroup;
  private interactions!: InteractionManager;
  /** Hostiles standing on this map. Empty everywhere except the highways. */
  private enemies: Enemy[] = [];
  private transitioning = false;
  /** True while a battle owns the screen, so the overworld stops reacting. */
  private inBattle = false;
  /** False until create() has finished building this map; gates update(). */
  private ready = false;
  private mapKey: MapKey = DEFAULT_MAP;
  private layout = MAPS[DEFAULT_MAP];
  private spawn: EnterData = {};

  constructor() {
    super("OverworldScene");
  }

  init(data: EnterData): void {
    this.mapKey = data?.mapKey ?? (this.registry.get("initialMapKey") as MapKey) ?? DEFAULT_MAP;
    this.layout = MAPS[this.mapKey];
    this.spawn = data ?? {};
    this.transitioning = false;
    this.inBattle = false;
    this.ready = false;
  }

  create(): void {
    this.solids = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.exits = this.physics.add.staticGroup();

    this.buildGround();
    this.buildWater();
    this.buildBorderCollision();
    this.buildHousesAndDecor();
    this.buildExitGates();

    const { x: px, y: py, facing } = this.resolveSpawn();
    this.player = new Player(this, px, py, facing);
    this.physics.add.collider(this.player.sprite, this.solids);
    this.physics.add.overlap(this.player.sprite, this.doors, (_p, zone) => {
      const warp = (zone as Phaser.GameObjects.Zone).getData("warp");
      this.enterHouse(warp);
    });
    this.physics.add.overlap(this.player.sprite, this.exits, (_p, zone) => {
      const gate = (zone as Phaser.GameObjects.Zone).getData("gate") as Gate;
      this.travel(gate);
    });

    this.interactions = new InteractionManager(this, this.player);
    populateArea(this, this.interactions, MAP_INTERACTIONS[this.mapKey] ?? {}, this.solids);
    void this.spawnEnemies();

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 1, 1);
    cam.setRoundPixels(true);
    applyCameraZoom(this);
    cam.fadeIn(300);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this),
    );

    this.input.keyboard!.on("keydown-M", this.openWorldMap, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard!.off("keydown-M", this.openWorldMap, this);
      this.events.off("battle:ended");
      for (const enemy of this.enemies) enemy.destroy();
      this.enemies = [];
    });

    this.ready = true;
  }

  private onResize = () => applyCameraZoom(this);

  private openWorldMap(): void {
    if (this.transitioning || this.inBattle || this.interactions.busy) return;
    this.scene.pause();
    this.scene.launch("WorldMapScene", { currentMapKey: this.mapKey });
  }

  update(): void {
    // Phaser keeps ticking update() around a scene restart, when create() has
    // not rebuilt the player yet and the old sprite's body is already gone.
    // Skip those frames rather than touching a destroyed object.
    if (!this.ready) return;
    this.player.update();
    this.interactions.update();
    this.checkEncounters();
  }

  // --- encounters ---------------------------------------------------------------

  /**
   * Roll a fresh set of hostiles for this map. Only the highways spawn them —
   * the towns and the Pump island are clean, which is what makes stepping onto a
   * road feel like a choice. Rolled on every entry, so walking a road twice
   * gives you a different set.
   */
  private async spawnEnemies(): Promise<void> {
    this.enemies = [];
    if (!isEncounterMap(this.mapKey)) return;

    const table = await gameService.getEncounterTable(this.mapKey);
    // The scene can be torn down while the table is in flight (the player walked
    // straight through); don't build sprites into a dead scene.
    if (!this.ready || !this.scene.isActive()) return;

    for (const placement of rollEncounters(this.mapKey, table)) {
      this.enemies.push(new Enemy(this, placement));
    }

    // The battle scene tells us how it went; a beaten enemy is removed so the
    // road visibly empties as you clear it.
    this.events.off("battle:ended");
    this.events.on(
      "battle:ended",
      ({ instanceId, result }: { instanceId: string; result: BattleResultKind }) => {
        this.inBattle = false;
        this.cameras.main.fadeIn(220);
        const enemy = this.enemies.find((e) => e.placement.instanceId === instanceId);
        if (!enemy) return;
        if (result === "won") {
          enemy.retire(this);
        } else {
          // Survived or ran: the enemy stays, so back off before it reaches you
          // again. Nudge the player clear so the trigger doesn't fire instantly.
          this.pushPlayerAway(enemy);
        }
      },
    );
  }

  /** Distance check per frame; walking within about a tile starts the fight. */
  private checkEncounters(): void {
    if (this.inBattle || this.transitioning || this.enemies.length === 0) return;
    const { x, y } = this.player.sprite;
    for (const enemy of this.enemies) {
      if (enemy.update(x, y)) {
        this.startBattle(enemy);
        return;
      }
    }
  }

  private startBattle(enemy: Enemy): void {
    if (this.inBattle || this.interactions.busy) return;
    this.inBattle = true;
    this.player.sprite.setVelocity(0, 0);
    this.scene.pause();
    this.scene.launch("BattleScene", {
      spec: enemy.placement.spec,
      returnTo: "OverworldScene",
      instanceId: enemy.placement.instanceId,
    });
  }

  /**
   * Shove the player a couple of tiles back from an enemy they did not beat, so
   * returning to the overworld does not immediately re-trigger the same fight.
   */
  private pushPlayerAway(enemy: Enemy): void {
    const sprite = this.player.sprite;
    const dx = sprite.x - enemy.sprite.x;
    const dy = sprite.y - enemy.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const push = TILE * 3;
    sprite.setPosition(sprite.x + (dx / len) * push, sprite.y + (dy / len) * push);
  }

  // --- builders ---------------------------------------------------------------

  private buildGround(): void {
    const { width: W, height: H } = this.layout;
    // Grass base extends well past the map so no void shows while the camera
    // keeps the player centered; the baked ground (with roads/ponds) sits on top.
    const pad = 24;
    this.add
      .tileSprite(-pad * TILE, -pad * TILE, (W + pad * 2) * TILE, (H + pad * 2) * TILE, this.layout.backdrop)
      .setOrigin(0, 0)
      .setDepth(-2000);
    this.add.image(0, 0, groundKey(this.mapKey)).setOrigin(0, 0).setDepth(-1000);
  }

  /**
   * Where the player stands (and which way they face) on entering this map:
   * returning from a house uses the stored spot; arriving through a gate puts
   * them just inside that gate facing inward; a cold start uses the map's own
   * entrance. Keeping all three in one place avoids the spawn drifting out of
   * sync with the gate that was actually used.
   */
  private resolveSpawn(): { x: number; y: number; facing: Facing } {
    if (this.spawn.spawnX !== undefined && this.spawn.spawnY !== undefined) {
      return { x: this.spawn.spawnX, y: this.spawn.spawnY, facing: "up" };
    }
    const side = this.spawn.arriveGate;
    if (side) {
      const gate = this.layout.gates.find((g) => g.side === side);
      if (gate) {
        const { width: W, height: H, border: B } = this.layout;
        const centre = (gate.start + gate.length / 2) * TILE;
        // One tile inside the border so we're clear of the gate zone itself,
        // otherwise the arrival overlap would immediately fire again.
        const inset = (B + 1) * TILE;
        const pos =
          side === "N" ? { x: centre, y: inset }
          : side === "S" ? { x: centre, y: H * TILE - inset }
          : side === "W" ? { x: inset, y: centre }
          : { x: W * TILE - inset, y: centre };
        return { ...pos, facing: OverworldScene.FACE_INTO[side] };
      }
    }
    return {
      x: this.layout.entrance.x,
      y: this.layout.entrance.y,
      facing: OverworldScene.FACE_INTO[this.layout.entranceSide],
    };
  }

  /** Trigger zones filling each linked gate's opening; walking in travels. */
  private buildExitGates(): void {
    const { width: W, height: H } = this.layout;
    for (const gate of this.layout.gates) {
      if (!gate.to) continue; // unlinked gate = dead end
      const span = gate.length * TILE;
      const thickness = TILE;
      let x: number, y: number, w: number, h: number;
      if (gate.side === "N" || gate.side === "S") {
        x = gate.start * TILE;
        w = span;
        h = thickness;
        y = gate.side === "N" ? 0 : H * TILE - thickness;
      } else {
        y = gate.start * TILE;
        h = span;
        w = thickness;
        x = gate.side === "W" ? 0 : W * TILE - thickness;
      }
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      zone.setData("gate", gate);
      this.exits.add(zone);
    }
  }

  /** Fade out and hand off to the linked map, arriving at its matching gate. */
  private travel(gate: Gate): void {
    if (this.transitioning || !gate.to || !gate.toGate) return;
    this.transitioning = true;
    this.player.sprite.setVelocity(0, 0);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("OverworldScene", { mapKey: gate.to, arriveGate: gate.toGate });
    });
  }

  private buildWater(): void {
    if (!this.anims.exists("water")) {
      this.anims.create({
        key: "water",
        frames: this.anims.generateFrameNumbers("water_anim", { start: 0, end: 13 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    // Every pond cell animates; each is also solid (can't walk into water).
    for (const [x, y] of this.layout.waterInterior) {
      this.add.sprite(x * TILE, y * TILE, "water_anim").setOrigin(0, 0).setDepth(-900).play("water");
      this.solidTiles(x, y, 1, 1);
    }
  }

  /**
   * Solid forest ring around the whole map, with a rectangular opening carved
   * out for each configured gate. Generic over any combination of N/S/E/W
   * gates (at most one per side in practice), so every city — regardless of
   * which sides its exits are on — reuses the same logic.
   */
  private buildBorderCollision(): void {
    const { width: W, height: H, border: B, gates } = this.layout;
    const gateOn = (side: Gate["side"]) => gates.find((g) => g.side === side);

    const n = gateOn("N");
    if (n) {
      this.solidTiles(0, 0, n.start, B);
      this.solidTiles(n.start + n.length, 0, W - (n.start + n.length), B);
    } else {
      this.solidTiles(0, 0, W, B);
    }

    const s = gateOn("S");
    if (s) {
      this.solidTiles(0, H - B, s.start, B);
      this.solidTiles(s.start + s.length, H - B, W - (s.start + s.length), B);
    } else {
      this.solidTiles(0, H - B, W, B);
    }

    const w = gateOn("W");
    if (w) {
      this.solidTiles(0, 0, B, w.start);
      this.solidTiles(0, w.start + w.length, B, H - (w.start + w.length));
    } else {
      this.solidTiles(0, 0, B, H);
    }

    const e = gateOn("E");
    if (e) {
      this.solidTiles(W - B, 0, B, e.start);
      this.solidTiles(W - B, e.start + e.length, B, H - (e.start + e.length));
    } else {
      this.solidTiles(W - B, 0, B, H);
    }
  }

  private buildHousesAndDecor(): void {
    for (const h of this.layout.houses) {
      this.place(h.tex, h.left, h.bottom, h.w);
      this.solidTiles(h.left, h.bottom - 3, h.w, 4);
      // Door trigger on the spur tile just below the house (through the fence gap).
      const zoneRow = h.bottom + 1;
      const zone = this.add.zone((h.door + 0.5) * TILE, (zoneRow + 0.5) * TILE, TILE, TILE);
      this.physics.add.existing(zone, true);
      zone.setData("warp", {
        room: h.room as RoomKey,
        returnX: (h.door + 0.5) * TILE,
        returnY: (h.bottom + 3) * TILE,
      });
      this.doors.add(zone);
    }

    for (const d of this.layout.decor) {
      this.place(d.tex, d.left, d.bottom, d.w);
      if (!d.solid) continue;
      if (d.tex.startsWith("tree")) this.solidTiles(d.left, d.bottom, d.w, 1);
      else if (d.tex === "hedge") this.solidTiles(d.left, d.bottom - 1, d.w, 2);
      else this.solidTiles(d.left, d.bottom, 1, 1);
    }
  }

  // --- helpers ----------------------------------------------------------------

  private place(tex: string, left: number, bottomRow: number, wTiles: number): void {
    const x = (left + wTiles / 2) * TILE;
    const y = (bottomRow + 1) * TILE;
    this.add.image(x, y, tex).setOrigin(0.5, 1).setDepth(y);
  }

  private solidTiles(col: number, row: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    const zone = this.add.zone(col * TILE, row * TILE, w * TILE, h * TILE).setOrigin(0, 0);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  }

  private enterHouse(warp: { room: RoomKey; returnX: number; returnY: number }): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.sprite.setVelocity(0, 0);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("InteriorScene", {
        mapKey: this.mapKey,
        roomKey: warp.room,
        title: warp.room,
        returnX: warp.returnX,
        returnY: warp.returnY,
      });
    });
  }
}
