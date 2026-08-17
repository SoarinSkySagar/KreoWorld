import * as Phaser from "phaser";
import { uiRect } from "../camera";

/** One page of dialogue. `speaker` omitted renders an unattributed line (signs, narration). */
export interface DialogueLine {
  speaker?: string;
  text: string;
}

const BOX_H = 44;
const MARGIN = 6;
const PAD = 5;
const TYPE_MS = 18;

/**
 * GBA-style text box pinned to the bottom of the screen. Drawn in game pixels
 * (see `uiRect`) so it zooms with the pixel art instead of floating above it at
 * screen resolution. Lines type out; advancing mid-type completes the page
 * instantly, which is the interaction every player expects from this genre.
 */
export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Text;

  private lines: DialogueLine[] = [];
  private index = 0;
  private typing?: Phaser.Time.TimerEvent;
  private onClose?: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = scene.add.rectangle(0, 0, 10, BOX_H, 0x0b1020, 0.94).setOrigin(0, 0).setStrokeStyle(1, 0x6ee7ff);
    this.nameText = scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "8px", color: "#6ee7ff" });
    this.bodyText = scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "8px", color: "#e8f1ff" });
    this.caret = scene.add.text(0, 0, "▾", { fontFamily: "monospace", fontSize: "8px", color: "#6ee7ff" });

    this.container = scene.add
      .container(0, 0, [this.panel, this.nameText, this.bodyText, this.caret])
      .setScrollFactor(0)
      .setDepth(300000)
      .setVisible(false);

    this.layout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.typing?.remove();
    });
  }

  get isOpen(): boolean {
    return this.container.visible;
  }

  open(lines: DialogueLine[], onClose?: () => void): void {
    if (lines.length === 0) return;
    this.lines = lines;
    this.index = 0;
    this.onClose = onClose;
    this.container.setVisible(true);
    this.layout();
    this.showPage();
  }

  /** Complete the typing animation, or move to the next page / close. */
  advance(): void {
    if (!this.isOpen) return;
    if (this.typing) {
      this.typing.remove();
      this.typing = undefined;
      this.bodyText.setText(this.lines[this.index].text);
      this.caret.setVisible(true);
      return;
    }
    this.index += 1;
    if (this.index >= this.lines.length) {
      this.close();
      return;
    }
    this.showPage();
  }

  close(): void {
    this.typing?.remove();
    this.typing = undefined;
    this.container.setVisible(false);
    const done = this.onClose;
    this.onClose = undefined;
    done?.();
  }

  private showPage(): void {
    const line = this.lines[this.index];
    this.nameText.setText(line.speaker ?? "");
    this.bodyText.setText("");
    this.caret.setVisible(false);

    let shown = 0;
    this.typing = this.scene.time.addEvent({
      delay: TYPE_MS,
      repeat: line.text.length - 1,
      callback: () => {
        shown += 1;
        this.bodyText.setText(line.text.slice(0, shown));
        if (shown < line.text.length) return;
        this.typing = undefined;
        this.caret.setVisible(true);
      },
    });
  }

  /** Re-place and re-rasterise against the current viewport and zoom. */
  private layout = (): void => {
    const view = uiRect(this.scene);
    const zoom = this.scene.cameras.main.zoom;
    const width = view.w - MARGIN * 2;

    this.container.setPosition(view.x + MARGIN, view.y + view.h - MARGIN - BOX_H);
    this.panel.setSize(width, BOX_H);

    this.nameText.setPosition(PAD, PAD);
    this.bodyText.setPosition(PAD, PAD + 11);
    this.bodyText.setWordWrapWidth(width - PAD * 2);
    this.caret.setPosition(width - PAD - 6, BOX_H - PAD - 8);

    // Text is rasterised at 8 game px; matching the canvas resolution to the
    // camera zoom keeps it sharp instead of upscaled and soft.
    for (const t of [this.nameText, this.bodyText, this.caret]) t.setResolution(zoom);
  };
}
