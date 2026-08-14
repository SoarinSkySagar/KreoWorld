import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

/** Internal render resolution — GBA-ish. The canvas scales up to fit its parent
 *  while preserving aspect ratio (Scale.FIT), so art stays crisp and pixel-art. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 320;

/**
 * Builds the Phaser game config bound to a specific parent element. Called only
 * on the client (inside PhaserGame's effect), so Phaser never loads during SSR.
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#0b0e1a",
    pixelArt: true, // crisp scaling for GBA-style tiles/sprites
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene],
  };
}
