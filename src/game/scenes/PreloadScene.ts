import * as Phaser from "phaser";
import { preloadPlayer } from "../entities/Player";

const WORLD = [
  "grass", "path", "tree_a", "tree_b", "tree_c", "hedge",
  "house_red", "house_red_wide", "house_green", "house_blue", "flower", "bush", "rock",
  "fence_tl", "fence_tm", "fence_tr", "fence_l", "fence_r", "fence_bl", "fence_bm", "fence_br",
];

const INTERIOR = [
  "floor_cream", "floor_wood", "floor_gray", "wall_top", "wall_base",
  "bed", "sofa", "chair", "stools", "rug", "shelf", "counter", "tv", "plant", "dresser",
];

/** Loads every texture once, then hands off to the overworld. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    // Simple loading readout on the dark canvas.
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, "loading world…", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#6ee7ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.load.on("progress", (p: number) => label.setText(`loading world… ${Math.round(p * 100)}%`));

    preloadPlayer(this);
    this.load.image("city1_ground", "/assets/maps/city1_ground.png");
    this.load.spritesheet("water_anim", "/assets/world/water_anim.png", { frameWidth: 16, frameHeight: 16 });
    WORLD.forEach((k) => this.load.image(k, `/assets/world/${k}.png`));
    INTERIOR.forEach((k) => this.load.image(k, `/assets/interior/${k}.png`));
  }

  create(): void {
    this.scene.start("OverworldScene");
  }
}
