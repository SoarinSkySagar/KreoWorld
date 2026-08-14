import * as Phaser from "phaser";
import { PreloadScene } from "./scenes/PreloadScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { InteriorScene } from "./scenes/InteriorScene";

/**
 * Builds the Phaser game config bound to a specific parent element. Called only
 * on the client (inside PhaserGame's effect), so Phaser never loads during SSR.
 *
 * The game fills its parent (which fills the viewport) via Scale.RESIZE — the
 * canvas has no fixed internal resolution and no letterboxing; the world viewport
 * simply matches the window. Scenes must lay out against `this.scale.width/height`
 * and react to the `resize` event.
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#0b0e1a",
    pixelArt: true, // crisp scaling for GBA-style tiles/sprites
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%",
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [PreloadScene, OverworldScene, InteriorScene],
  };
}
