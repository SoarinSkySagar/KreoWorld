import * as Phaser from "phaser";
import { TILE } from "../constants";
import { applyCameraZoom, uiRect } from "../camera";
import { Player } from "../entities/Player";
import { ROOMS, RoomKey } from "../rooms";
import { InteractionManager } from "../interaction/InteractionManager";
import { populateArea } from "../interaction/populateArea";
import { ROOM_INTERACTIONS } from "../data/interactions";
import type { MapKey } from "../maps";
import { gameService } from "@/lib/services";
import { gameStore } from "@/lib/store/gameStore";
import type { BattleResultKind, EnemySpec } from "@/lib/services/types";

interface InteriorData {
  mapKey: MapKey;
  roomKey: RoomKey;
  title: string;
  returnX: number;
  returnY: number;
}

/**
 * Generic interior scene (Pokémon-style): entering a house switches to this
 * scene, which builds a walled room from the room spec and furnishes it. Walking
 * onto the doormat warps back to the exact overworld spot outside the house.
 */
export class InteriorScene extends Phaser.Scene {
  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private exitZone!: Phaser.GameObjects.Zone;
  private interactions!: InteractionManager;
  private entry!: InteriorData;
  private transitioning = false;
  /** False until create() has finished building the room; gates update(). */
  private ready = false;
  /** True while the boss fight owns the screen, so the room stops reacting. */
  private inBattle = false;

  constructor() {
    super("InteriorScene");
  }

  init(data: InteriorData): void {
    this.entry = data;
    this.transitioning = false;
    this.ready = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05060a");
    this.solids = this.physics.add.staticGroup();

    const spec = ROOMS[this.entry.roomKey];
    const totalW = spec.cols + 2;
    const totalH = spec.rows + 3;
    const floorX0 = TILE; // one wall column on the left
    const floorY0 = 2 * TILE; // two wall rows on top

    // Floor.
    this.add
      .tileSprite(floorX0, floorY0, spec.cols * TILE, spec.rows * TILE, spec.floor)
      .setOrigin(0, 0)
      .setDepth(-1000);

    // Walls (visual): top is a 2-tile band (trim + baseboard); sides & bottom 1 tile.
    this.add.tileSprite(0, 0, totalW * TILE, TILE, "wall_top").setOrigin(0, 0).setDepth(-500);
    this.add.tileSprite(0, TILE, totalW * TILE, TILE, "wall_base").setOrigin(0, 0).setDepth(-500);
    this.add.tileSprite(0, 2 * TILE, TILE, (spec.rows + 1) * TILE, "wall_base").setOrigin(0, 0).setDepth(-500);
    this.add
      .tileSprite((spec.cols + 1) * TILE, 2 * TILE, TILE, (spec.rows + 1) * TILE, "wall_base")
      .setOrigin(0, 0)
      .setDepth(-500);
    this.add
      .tileSprite(0, (spec.rows + 2) * TILE, totalW * TILE, TILE, "wall_base")
      .setOrigin(0, 0)
      .setDepth(-500);

    // Walls (collision).
    this.solidTiles(0, 0, totalW, 2);
    this.solidTiles(0, spec.rows + 2, totalW, 1);
    this.solidTiles(0, 0, 1, totalH);
    this.solidTiles(spec.cols + 1, 0, 1, totalH);

    // Furniture (depth-sorted by its bottom edge).
    for (const f of spec.furniture) {
      const px = floorX0 + f.col * TILE;
      const py = floorY0 + f.row * TILE;
      const img = this.add.image(px, py, f.tex).setOrigin(0, 0);
      img.setDepth(py + img.height);
      if (f.solid) {
        this.solidTiles(1 + f.col, 2 + f.row, Math.round(img.width / TILE), Math.round(img.height / TILE));
      }
    }

    // Exit doormat at bottom-centre of the floor.
    const exitCol = Math.floor(spec.cols / 2);
    const exitRow = spec.rows - 1;
    this.add
      .tileSprite(floorX0 + exitCol * TILE, floorY0 + exitRow * TILE, TILE, TILE, "path")
      .setOrigin(0, 0)
      .setDepth(-999);
    this.exitZone = this.add.zone(
      floorX0 + (exitCol + 0.5) * TILE,
      floorY0 + (exitRow + 0.5) * TILE,
      TILE,
      TILE,
    );
    this.physics.add.existing(this.exitZone, true);

    // Player spawns one tile above the doormat, facing the exit.
    const spawnX = floorX0 + (exitCol + 0.5) * TILE;
    const spawnY = floorY0 + exitRow * TILE; // feet at bottom of the tile above
    this.player = new Player(this, spawnX, spawnY, "down");
    this.physics.add.collider(this.player.sprite, this.solids);
    this.physics.add.overlap(this.player.sprite, this.exitZone, () => this.exit());

    this.interactions = new InteractionManager(this, this.player);
    populateArea(
      this,
      this.interactions,
      ROOM_INTERACTIONS[this.entry.roomKey] ?? {},
      this.solids,
      floorX0,
      floorY0,
    );

    // Camera: follow + a slightly tighter zoom for the enclosed room.
    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 1, 1);
    cam.setRoundPixels(true);
    applyCameraZoom(this, 9);
    cam.fadeIn(250);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this),
    );

    // The chamber past the Anchor. Only the island has one, and it is the only
    // thing in the game that moves `floorsCleared`.
    if (this.entry.roomKey === "pump") this.addBossChamber(floorX0, floorY0);

    this.showTitle(spec.title);
    this.ready = true;
  }

  /**
   * The way into the boss chamber.
   *
   * Registered here rather than authored as an ordinary prop because it has to
   * branch on live tower state before it says anything: a floor you have already
   * cleared should not offer the fight again, and a floor with no boss authored
   * should say so plainly instead of failing silently.
   */
  private addBossChamber(originX: number, originY: number): void {
    this.interactions.add({
      x: originX + (10 + 0.5) * TILE,
      y: originY + (6 + 1) * TILE,
      label: "The chamber",
      run: async (ctx) => {
        const tower = gameStore.getState().tower;
        const floor = tower?.currentFloor ?? 1;

        if (tower && tower.floorsCleared >= floor) {
          ctx.say([
            { text: "The chamber past the Anchor is open and quiet." },
            { text: `Whatever held Floor ${floor}'s stair is not here any more.` },
          ]);
          return;
        }

        const boss = await gameService.getFloorBoss(floor);
        if (!this.scene.isActive()) return;

        if (!boss) {
          ctx.say([
            { text: "The chamber past the Anchor is sealed flat." },
            { text: "Nothing holds this floor. There is nothing above it to hold." },
          ]);
          return;
        }

        ctx.say(
          [
            { text: "The door past the Anchor is not locked. It is simply held." },
            { text: `${boss.name} — ${boss.title}.` },
            { text: boss.taunt },
          ],
          () => this.startBossFight(boss),
        );
      },
    });
  }

  private startBossFight(boss: EnemySpec): void {
    if (this.inBattle) return;
    this.inBattle = true;
    this.player.sprite.setVelocity(0, 0);

    this.events.off("battle:ended");
    this.events.on("battle:ended", ({ result }: { result: BattleResultKind }) => {
      this.inBattle = false;
      this.cameras.main.fadeIn(220);
      // A win advanced `floorsCleared` service-side; re-read so the HUD and the
      // stair both see it without the player having to leave the room.
      if (result === "won") void gameStore.getState().hydrate();
    });

    this.scene.pause();
    this.scene.launch("BattleScene", {
      spec: boss,
      returnTo: "InteriorScene",
      instanceId: boss.id,
    });
  }

  private onResize = () => applyCameraZoom(this, 9);

  update(): void {
    // See OverworldScene.update — skip frames around a scene restart.
    if (!this.ready || this.inBattle) return;
    this.player.update();
    this.interactions.update();
  }

  private solidTiles(col: number, row: number, w: number, h: number): void {
    const zone = this.add.zone(col * TILE, row * TILE, w * TILE, h * TILE).setOrigin(0, 0);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  }

  private showTitle(title: string): void {
    const view = uiRect(this);
    const banner = this.add
      .text(view.x + view.w / 2, view.y + 8, title, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6ee7ff",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setResolution(this.cameras.main.zoom)
      .setDepth(200000);
    this.tweens.add({ targets: banner, alpha: 0, delay: 2000, duration: 800, onComplete: () => banner.destroy() });
  }

  private exit(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.sprite.setVelocity(0, 0);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("OverworldScene", {
        mapKey: this.entry.mapKey,
        spawnX: this.entry.returnX,
        spawnY: this.entry.returnY,
      });
    });
  }
}
