import * as Phaser from "phaser";

/** Bar colours, GBA-style: green until it hurts, amber when it should worry you, red at the end. */
const BAR_HIGH = 0x5fd97a;
const BAR_MID = 0xffc94a;
const BAR_LOW = 0xff5f6d;

const PANEL_FILL = 0x0b1020;
const PANEL_EDGE = 0x6ee7ff;

export interface HealthPanelOptions {
  /** Show `hp/maxHp` numerically. True for the player, false for the enemy — as in the genre. */
  showNumbers: boolean;
  width: number;
}

/**
 * The name / level / HP box that sits beside each combatant. Drawn in game
 * pixels so it scales with the pixel art rather than floating over it at screen
 * resolution — the same rule `DialogueBox` follows.
 */
export class HealthPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly numbers?: Phaser.GameObjects.Text;
  private readonly barWidth: number;
  private current: number;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    title: string,
    level: number,
    private readonly maxHp: number,
    opts: HealthPanelOptions,
  ) {
    const pad = 5;
    const height = opts.showNumbers ? 36 : 30;
    this.barWidth = opts.width - pad * 2;
    this.current = maxHp;

    const panel = scene.add
      .rectangle(0, 0, opts.width, height, PANEL_FILL, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_EDGE);

    const nameText = scene.add
      .text(pad, pad - 1, name, { fontFamily: "monospace", fontSize: "8px", color: "#e8f1ff" })
      .setResolution(scene.cameras.main.zoom);

    const levelText = scene.add
      .text(opts.width - pad, pad - 1, `Lv${level}`, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#6ee7ff",
      })
      .setOrigin(1, 0)
      .setResolution(scene.cameras.main.zoom);

    const titleText = scene.add
      .text(pad, pad + 8, title, { fontFamily: "monospace", fontSize: "7px", color: "#7c8aa0" })
      .setResolution(scene.cameras.main.zoom);

    const barY = pad + 18;
    const barTrack = scene.add
      .rectangle(pad, barY, this.barWidth, 4, 0x1c2438)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x39435c);
    this.barFill = scene.add.rectangle(pad, barY, this.barWidth, 4, BAR_HIGH).setOrigin(0, 0);

    const parts: Phaser.GameObjects.GameObject[] = [
      panel,
      nameText,
      levelText,
      titleText,
      barTrack,
      this.barFill,
    ];

    if (opts.showNumbers) {
      this.numbers = scene.add
        .text(opts.width - pad, barY + 6, `${maxHp}/${maxHp}`, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#e8f1ff",
        })
        .setOrigin(1, 0)
        .setResolution(scene.cameras.main.zoom);
      parts.push(this.numbers);
    }

    this.container = scene.add.container(x, y, parts).setDepth(400000);
  }

  /**
   * Animate the bar down (or up) to `hp`. Returns a promise that settles when
   * the bar finishes moving, so the scene can wait for it before the next
   * message — a bar that snaps instantly reads as a bug, not a hit.
   */
  setHp(hp: number): Promise<void> {
    const target = Phaser.Math.Clamp(hp, 0, this.maxHp);
    const from = this.current;
    this.current = target;
    if (from === target) return Promise.resolve();

    return new Promise((resolve) => {
      const proxy = { v: from };
      this.scene.tweens.add({
        targets: proxy,
        v: target,
        duration: Math.min(700, 180 + Math.abs(from - target) * 8),
        ease: "Sine.easeOut",
        onUpdate: () => this.render(proxy.v),
        onComplete: () => {
          this.render(target);
          resolve();
        },
      });
    });
  }

  private render(hp: number): void {
    const ratio = Phaser.Math.Clamp(hp / this.maxHp, 0, 1);
    this.barFill.width = Math.max(ratio > 0 ? 1 : 0, Math.round(this.barWidth * ratio));
    this.barFill.fillColor = ratio > 0.5 ? BAR_HIGH : ratio > 0.2 ? BAR_MID : BAR_LOW;
    this.numbers?.setText(`${Math.ceil(hp)}/${this.maxHp}`);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
