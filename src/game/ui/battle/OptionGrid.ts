import * as Phaser from "phaser";

export interface GridOption {
  label: string;
  /** Second line, e.g. "fire · 12/12" under a move name. */
  detail?: string;
  /** Weapon icon texture key, drawn left of the label when present. */
  iconKey?: string;
  /** Tint for the label — used to colour a move by element. */
  color?: string;
  /** Greyed out and unselectable (a move with no uses left). */
  disabled?: boolean;
}

/**
 * A keyboard-driven grid of choices with a blinking cursor — the FIGHT/BAG/RUN
 * root, the 2x2 move list, and the item list are all this component with
 * different contents.
 *
 * It owns navigation only. Confirming and cancelling are reported upward; the
 * scene decides what those mean, which keeps the menu ignorant of battle rules.
 */
export class OptionGrid {
  readonly container: Phaser.GameObjects.Container;

  private index = 0;
  private readonly cells: {
    label: Phaser.GameObjects.Text;
    detail?: Phaser.GameObjects.Text;
    icon?: Phaser.GameObjects.Image;
    option: GridOption;
  }[] = [];
  private readonly cursor: Phaser.GameObjects.Text;
  private readonly blink: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: GridOption[],
    private readonly columns: number,
    private readonly cellW: number,
    private readonly cellH: number,
  ) {
    const parts: Phaser.GameObjects.GameObject[] = [];

    options.forEach((option, i) => {
      const cx = (i % columns) * cellW;
      const cy = Math.floor(i / columns) * cellH;
      const colour = option.disabled ? "#4a5568" : (option.color ?? "#e8f1ff");
      let textX = cx + 8;

      let icon: Phaser.GameObjects.Image | undefined;
      if (option.iconKey && scene.textures.exists(option.iconKey)) {
        // Weapon icons are 32px; a quarter-scale draw sits neatly on one text line.
        icon = scene.add
          .image(cx + 8, cy + 4, option.iconKey)
          .setOrigin(0, 0)
          .setScale(0.34)
          .setAlpha(option.disabled ? 0.35 : 1);
        parts.push(icon);
        textX = cx + 21;
      }

      const label = scene.add
        .text(textX, cy + 1, option.label, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: colour,
        })
        .setResolution(scene.cameras.main.zoom);
      parts.push(label);

      let detail: Phaser.GameObjects.Text | undefined;
      if (option.detail) {
        detail = scene.add
          .text(textX, cy + 9, option.detail, {
            fontFamily: "monospace",
            fontSize: "7px",
            color: option.disabled ? "#3a4358" : "#7c8aa0",
          })
          .setResolution(scene.cameras.main.zoom);
        parts.push(detail);
      }

      this.cells.push({ label, detail, icon, option });
    });

    this.cursor = scene.add
      .text(0, 0, "▶", { fontFamily: "monospace", fontSize: "8px", color: "#6ee7ff" })
      .setResolution(scene.cameras.main.zoom);
    parts.push(this.cursor);

    this.container = scene.add.container(x, y, parts).setDepth(400000);
    this.blink = scene.tweens.add({
      targets: this.cursor,
      alpha: 0.25,
      duration: 420,
      yoyo: true,
      repeat: -1,
    });

    // Start on the first option that can actually be picked.
    const firstUsable = options.findIndex((o) => !o.disabled);
    this.index = firstUsable === -1 ? 0 : firstUsable;
    this.placeCursor();
  }

  get selectedIndex(): number {
    return this.index;
  }

  get selected(): GridOption {
    return this.options[this.index];
  }

  /** Move the cursor by one step. Skips disabled entries so the cursor never parks on a dead option. */
  move(dx: number, dy: number): void {
    const usable = this.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (usable.length === 0) return;

    const step = dx + dy * this.columns;
    if (step === 0) return;
    let next = this.index;
    // Walk in the requested direction until we land on something usable, giving
    // up after a full pass so an all-disabled grid can't spin forever.
    for (let guard = 0; guard < this.options.length; guard += 1) {
      next = Phaser.Math.Wrap(next + step, 0, this.options.length);
      if (!this.options[next].disabled) break;
    }
    this.index = next;
    this.placeCursor();
  }

  private placeCursor(): void {
    const cx = (this.index % this.columns) * this.cellW;
    const cy = Math.floor(this.index / this.columns) * this.cellH;
    this.cursor.setPosition(cx - 1, cy + 1);
    this.cells.forEach((cell, i) => {
      if (cell.option.disabled) return;
      cell.label.setColor(i === this.index ? "#ffffff" : (cell.option.color ?? "#e8f1ff"));
    });
  }

  destroy(): void {
    this.blink.stop();
    this.container.destroy(true);
  }
}
