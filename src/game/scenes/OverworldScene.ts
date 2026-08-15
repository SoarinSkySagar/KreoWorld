import * as Phaser from "phaser";
import { TILE } from "../constants";
import { applyCameraZoom } from "../camera";
import { Player } from "../entities/Player";
import type { RoomKey } from "../rooms";
import { DEFAULT_MAP, MAPS, type Gate, type MapKey } from "../maps";
import { gameStore } from "@/lib/store/gameStore";

interface EnterData {
  mapKey?: MapKey;
  spawnX?: number;
  spawnY?: number;
}

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
  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private transitioning = false;
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
  }

  create(): void {
    this.solids = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();

    this.buildGround();
    this.buildWater();
    this.buildBorderCollision();
    this.buildHousesAndDecor();

    const px = this.spawn.spawnX ?? this.layout.entrance.x;
    const py = this.spawn.spawnY ?? this.layout.entrance.y;
    this.player = new Player(this, px, py, "up");
    this.physics.add.collider(this.player.sprite, this.solids);
    this.physics.add.overlap(this.player.sprite, this.doors, (_p, zone) => {
      const warp = (zone as Phaser.GameObjects.Zone).getData("warp");
      this.enterHouse(warp);
    });

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 1, 1);
    cam.setRoundPixels(true);
    applyCameraZoom(this);
    cam.fadeIn(300);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this),
    );

    this.showBanner();
  }

  private onResize = () => applyCameraZoom(this);

  update(): void {
    this.player.update();
  }

  // --- builders ---------------------------------------------------------------

  private buildGround(): void {
    const { width: W, height: H } = this.layout;
    // Grass base extends well past the map so no void shows while the camera
    // keeps the player centered; the baked ground (with roads/ponds) sits on top.
    const pad = 24;
    this.add
      .tileSprite(-pad * TILE, -pad * TILE, (W + pad * 2) * TILE, (H + pad * 2) * TILE, "grass")
      .setOrigin(0, 0)
      .setDepth(-2000);
    this.add.image(0, 0, "cityGround").setOrigin(0, 0).setDepth(-1000);
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

  private showBanner(): void {
    const universe = gameStore.getState().player?.universeName ?? "Aleph-Null";
    const banner = this.add
      .text(this.scale.width / 2, 24, universe, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#6ee7ff",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(200000);
    this.tweens.add({ targets: banner, alpha: 0, delay: 2200, duration: 800, onComplete: () => banner.destroy() });
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
