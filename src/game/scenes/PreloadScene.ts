import * as Phaser from "phaser";
import { preloadPlayer } from "../entities/Player";
import { preloadNpcs } from "../entities/Npc";
import { DEFAULT_MAP, MAPS, type MapKey } from "../maps";
import { groundKey } from "./OverworldScene";

const WORLD = [
  "grass", "water", "path", "tree_a", "tree_b", "tree_c", "hedge",
  "house_red", "house_red_wide", "house_green", "house_blue", "flower", "bush", "rock",
  "fence_tl", "fence_tm", "fence_tr", "fence_l", "fence_r", "fence_bl", "fence_bm", "fence_br",
];

const INTERIOR = [
  "floor_cream", "floor_wood", "floor_gray", "wall_top", "wall_base",
  "bed", "sofa", "chair", "stools", "rug", "shelf", "counter", "tv", "plant", "dresser",
];

/**
 * Loads every shared texture, plus the one city's ground image this game
 * instance is showing (set into the registry by PhaserGame before boot; each
 * route only ever runs one city, so only its ground is fetched). Hands off to
 * the overworld once loading completes.
 */
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
    preloadNpcs(this);
    // Every map's ground image is loaded up front — all seven together are
    // ~270KB, far cheaper than the alternative: loading on demand meant
    // OverworldScene.create() had to bail out mid-transition and rebuild
    // asynchronously, which left the camera faded to black and `update()`
    // running against a destroyed player. Keep this eager and simple.
    for (const key of Object.keys(MAPS) as MapKey[]) {
      this.load.image(groundKey(key), `/assets/maps/${key}_ground.png`);
    }
    this.load.spritesheet("water_anim", "/assets/world/water_anim.png", { frameWidth: 16, frameHeight: 16 });
    WORLD.forEach((k) => this.load.image(k, `/assets/world/${k}.png`));
    INTERIOR.forEach((k) => this.load.image(k, `/assets/interior/${k}.png`));
  }

  create(): void {
    const mapKey = (this.registry.get("initialMapKey") as MapKey) ?? DEFAULT_MAP;
    this.scene.start("OverworldScene", { mapKey });
  }
}
