import * as Phaser from "phaser";
import { TILE } from "../constants";
import { applyCameraZoom, uiRect } from "../camera";
import { Player } from "../entities/Player";
import { ROOMS, RoomKey } from "../rooms";
import { InteractionManager } from "../interaction/InteractionManager";
import { populateArea } from "../interaction/populateArea";
import { ROOM_INTERACTIONS } from "../data/interactions";
import type { MapKey } from "../maps";

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

    this.showTitle(spec.title);
    this.ready = true;
  }

  private onResize = () => applyCameraZoom(this, 9);

  update(): void {
    // See OverworldScene.update — skip frames around a scene restart.
    if (!this.ready) return;
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
