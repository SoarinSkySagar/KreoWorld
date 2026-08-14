import * as Phaser from "phaser";
import { gameStore } from "@/lib/store/gameStore";

/**
 * Placeholder boot scene for item #1 — proves the engine is embedded, fills the
 * viewport, and that the React<->Phaser bridge is wired. The real movement/world
 * scenes replace this in BUILD_PLAN.md §Phase 1.2+. It renders a faint grid and a
 * pulsing marker, echoing the player's universe name pulled from the shared store.
 *
 * Because the game uses Scale.RESIZE, the scene rebuilds its layout whenever the
 * window changes size.
 */
export class BootScene extends Phaser.Scene {
  private marker?: Phaser.GameObjects.Arc;

  constructor() {
    super("BootScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b0e1a");
    this.build();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.build, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.build, this);
    });
  }

  /** (Re)draw everything against the current viewport size. */
  private build(): void {
    this.children.removeAll();

    const width = this.scale.width;
    const height = this.scale.height;

    // Faint grid so the canvas reads as "world space", not a blank rect.
    this.add
      .grid(width / 2, height / 2, width, height, 32, 32, 0x000000, 0, 0x1b2036, 0.6)
      .setDepth(0);

    this.marker = this.add.circle(width / 2, height / 2, 12, 0x6ee7ff).setDepth(1);

    const player = gameStore.getState().player;
    const universe = player?.universeName ?? "unbound universe";

    this.add
      .text(width / 2, height / 2 + 48, `booting: ${universe}`, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.add
      .text(width / 2, 24, "AttestCoin — engine online", {
        fontFamily: "monospace",
        fontSize: "13px",
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
