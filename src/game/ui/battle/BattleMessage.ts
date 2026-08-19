import * as Phaser from "phaser";

const TYPE_MS = 16;

/**
 * The battle text box. Unlike `DialogueBox` it is promise-based rather than
 * keypress-driven: combat narrates a queue of events, and the scene needs to
 * `await` each line before advancing the state machine.
 *
 * Lines auto-advance after a short hold so a fight has rhythm; pressing confirm
 * completes the current line immediately, which is the interaction everyone
 * expects from the genre.
 */
export class BattleMessage {
  private readonly text: Phaser.GameObjects.Text;
  private typing?: Phaser.Time.TimerEvent;
  private hold?: Phaser.Time.TimerEvent;
  private resolveCurrent?: () => void;
  /** The line currently being typed, so `skip()` can jump straight to its end. */
  private currentLine = "";

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
  ) {
    this.text = scene.add
      .text(x, y, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#e8f1ff",
        lineSpacing: 2,
      })
      .setWordWrapWidth(width)
      .setDepth(400001)
      .setResolution(scene.cameras.main.zoom);
  }

  /** Type one line out, hold it, then resolve. `linger` scales the post-type pause. */
  show(line: string, linger = 1): Promise<void> {
    this.cancel();
    return new Promise((resolve) => {
      this.resolveCurrent = resolve;
      this.currentLine = line;
      this.text.setText("");
      let shown = 0;
      this.typing = this.scene.time.addEvent({
        delay: TYPE_MS,
        repeat: line.length - 1,
        callback: () => {
          shown += 1;
          this.text.setText(line.slice(0, shown));
          if (shown < line.length) return;
          this.typing = undefined;
          this.hold = this.scene.time.delayedCall(420 * linger, () => this.finish());
        },
      });
    });
  }

  /** Put a line up and leave it there — used for the standing "What will you do?" prompt. */
  set(line: string): void {
    this.cancel();
    this.text.setText(line);
  }

  /**
   * Skip ahead: finish typing if mid-line, otherwise resolve the hold. Wired to
   * the confirm key so an impatient player is never made to wait.
   */
  skip(): void {
    if (this.typing) {
      this.typing.remove();
      this.typing = undefined;
      this.text.setText(this.currentLine);
      this.hold = this.scene.time.delayedCall(120, () => this.finish());
      return;
    }
    if (this.hold) this.finish();
  }

  private finish(): void {
    this.hold?.remove();
    this.hold = undefined;
    const done = this.resolveCurrent;
    this.resolveCurrent = undefined;
    done?.();
  }

  private cancel(): void {
    this.typing?.remove();
    this.typing = undefined;
    this.hold?.remove();
    this.hold = undefined;
  }

  destroy(): void {
    this.cancel();
    this.text.destroy();
  }
}
