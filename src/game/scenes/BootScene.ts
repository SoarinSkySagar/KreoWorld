import * as Phaser from "phaser";
import { gameStore } from "@/lib/store/gameStore";

/**
 * Placeholder boot scene for item #1 — proves the engine is embedded and the
 * React<->Phaser bridge is wired. The real movement/world scenes replace this in
 * BUILD_PLAN.md §Phase 1.2+. It renders a simple pulsing marker and echoes the
 * player's universe name pulled from the shared store (no game logic yet).
 */
export class BootScene extends Phaser.Scene {
  private marker?: Phaser.GameObjects.Arc;

  constructor() {
    super("BootScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#0b0e1a");

    // Faint grid so the canvas reads as "world space", not a blank rect.
    const grid = this.add.grid(width / 2, height / 2, width, height, 32, 32, 0x000000, 0, 0x1b2036, 0.6);
    grid.setDepth(0);

    this.marker = this.add.circle(width / 2, height / 2, 10, 0x6ee7ff).setDepth(1);

    const player = gameStore.getState().player;
    const universe = player?.universeName ?? "unbound universe";

    this.add
      .text(width / 2, height / 2 + 40, `booting: ${universe}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.add
      .text(width / 2, 20, "AttestCoin — engine online", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#3d4a6b",
      })
      .setOrigin(0.5, 0)
      .setDepth(1);
  }

  update(time: number): void {
    if (this.marker) {
      // Gentle pulse to confirm the render loop is running.
      const s = 1 + Math.sin(time / 300) * 0.25;
      this.marker.setScale(s);
    }
  }
}
