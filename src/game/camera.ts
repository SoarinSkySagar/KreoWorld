import * as Phaser from "phaser";
import { TILE, TARGET_TILES_TALL } from "./constants";

/**
 * Zoom the main camera so a roughly fixed number of tiles is visible vertically,
 * independent of window size. Integer zoom keeps pixel art crisp. Called on
 * create and on every resize.
 */
export function applyCameraZoom(scene: Phaser.Scene, targetTilesTall = TARGET_TILES_TALL): void {
  const z = Phaser.Math.Clamp(
    Math.round(scene.scale.height / (targetTilesTall * TILE)),
    3,
    7,
  );
  scene.cameras.main.setZoom(z);
}
