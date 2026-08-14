import * as Phaser from "phaser";
import { TILE } from "../constants";
import { applyCameraZoom } from "../camera";
import { Player } from "../entities/Player";
import type { RoomKey } from "../rooms";
import city1 from "../maps/city1.json";
import { gameStore } from "@/lib/store/gameStore";

const W = city1.width;
const H = city1.height;
const B = city1.border;
const AV = city1.avenue;

interface HouseDef {
  tex: string;
  left: number;
  bottom: number;
  w: number;
  door: number;
  room: string;
}
interface DecorDef {
  tex: string;
  left: number;
  bottom: number;
  w: number;
  solid: boolean;
}
interface SpawnData {
  spawnX?: number;
  spawnY?: number;
}

/**
 * The first city. The ground layer (grass + autotiled gravel paths + pond
 * shorelines) is a single baked image; houses, fences, trees, flowers and water
 * come from the layout JSON (see scripts/build-city.py). The camera follows the
 * player (world scrolls, player stays centered). Doors warp to InteriorScene.
 */
export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private transitioning = false;
  private spawn: SpawnData = {};

  constructor() {
    super("OverworldScene");
  }

  init(data: SpawnData): void {
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

    const px = this.spawn.spawnX ?? city1.entrance.x;
    const py = this.spawn.spawnY ?? city1.entrance.y;
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
    // Grass base extends well past the map so no void shows while the camera
    // keeps the player centered; the baked ground (with roads/ponds) sits on top.
    const pad = 24;
    this.add
      .tileSprite(-pad * TILE, -pad * TILE, (W + pad * 2) * TILE, (H + pad * 2) * TILE, "grass")
      .setOrigin(0, 0)
      .setDepth(-2000);
    this.add.image(0, 0, "city1_ground").setOrigin(0, 0).setDepth(-1000);
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
    for (const [x, y] of city1.waterInterior as number[][]) {
      this.add.sprite(x * TILE, y * TILE, "water_anim").setOrigin(0, 0).setDepth(-900).play("water");
      this.solidTiles(x, y, 1, 1);
    }
  }

  private buildBorderCollision(): void {
    // Solid forest ring with a gap for the avenue (entrance south / exit north).
    this.solidTiles(0, 0, AV[0] - 1, B);
    this.solidTiles(AV[1] + 2, 0, W - (AV[1] + 2), B);
    this.solidTiles(0, H - B, AV[0] - 1, B);
    this.solidTiles(AV[1] + 2, H - B, W - (AV[1] + 2), B);
    this.solidTiles(0, 0, B, H);
    this.solidTiles(W - B, 0, B, H);
  }

  private buildHousesAndDecor(): void {
    for (const h of city1.houses as HouseDef[]) {
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

    for (const d of city1.decor as DecorDef[]) {
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
        roomKey: warp.room,
        title: warp.room,
        returnX: warp.returnX,
        returnY: warp.returnY,
      });
    });
  }
}
