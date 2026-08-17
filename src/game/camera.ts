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

/**
 * The visible viewport expressed in the coordinates a `setScrollFactor(0)`
 * object must use. Such an object still passes through the camera transform, so
 * its screen position is `centre + (pos - centre) * zoom` — meaning UI placed at
 * raw screen pixels lands off-screen once the camera is zoomed. Positioning
 * against this rect keeps overlay UI on screen at any zoom, and keeps its units
 * in game pixels so it scales with the pixel art rather than fighting it.
 */
export function uiRect(scene: Phaser.Scene): { x: number; y: number; w: number; h: number } {
  const cam = scene.cameras.main;
  const w = cam.width / cam.zoom;
  const h = cam.height / cam.zoom;
  return { x: cam.width / 2 - w / 2, y: cam.height / 2 - h / 2, w, h };
}
