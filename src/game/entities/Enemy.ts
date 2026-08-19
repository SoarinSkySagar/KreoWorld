import * as Phaser from "phaser";
import { TILE } from "../constants";
import type { EnemyPlacement } from "../combat/encounters";
import { BATTLER_KEYS } from "../combat/enemies";

/**
 * Battler art is trimmed to its opaque pixels (see scripts/extract-assets.py),
 * so source height is a real measure of how big a creature is. Scale against a
 * reference rather than normalising every sprite to one height — a Null Engine
 * should tower over a Cinderchick — but clamp the result so nothing blocks the
 * road entirely.
 */
const REFERENCE_SRC_HEIGHT = 48;
const REFERENCE_TILES_TALL = 2.1;
const MIN_TILES_TALL = 1.5;
const MAX_TILES_TALL = 3.1;
/** Within this many world pixels a `!` appears over the enemy. */
export const NOTICE_RANGE = 56;
/** Within this many world pixels the fight starts. Roughly one tile — you choose to close it. */
export const ENGAGE_RANGE = 18;

/**
 * A hostile standing on the road. It never chases: it idles where it spawned,
 * flags itself when you get near, and only starts a fight when you walk into
 * it. That is the whole point — the encounter is something you decide to have,
 * not something that happens to you.
 *
 * Battler art is a single static frame (no walk cycle), so the idle is a slow
 * vertical bob rather than an animation.
 */
export class Enemy {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly placement: EnemyPlacement;
  /** True once this enemy has been fought, so it stops triggering. */
  defeated = false;

  private readonly notice: Phaser.GameObjects.Text;
  private readonly bob: Phaser.Tweens.Tween;
  private noticed = false;
  /** Where the enemy actually stands. Fixed, so the idle bob can't jitter the trigger range. */
  private readonly anchorX: number;
  private readonly anchorY: number;

  constructor(scene: Phaser.Scene, placement: EnemyPlacement) {
    this.placement = placement;
    const x = (placement.col + 0.5) * TILE;
    const y = (placement.row + 1) * TILE;
    this.anchorX = x;
    this.anchorY = y;

    this.sprite = scene.add
      .sprite(x, y, placement.spec.spriteKey)
      // Feet-anchored, like every other world object, so depth sorting against
      // trees and the player just works.
      .setOrigin(0.5, 1)
      .setDepth(y);

    const scale = (REFERENCE_TILES_TALL * TILE) / REFERENCE_SRC_HEIGHT;
    const tall = Phaser.Math.Clamp(
      (this.sprite.height * scale) / TILE,
      MIN_TILES_TALL,
      MAX_TILES_TALL,
    );
    this.sprite.setScale((tall * TILE) / this.sprite.height);

    this.notice = scene.add
      .text(x, y - this.sprite.displayHeight - 2, "!", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ff5f6d",
        backgroundColor: "#0b1020",
        padding: { x: 2, y: 0 },
      })
      .setOrigin(0.5, 1)
      .setDepth(y + 1)
      .setResolution(scene.cameras.main.zoom)
      .setVisible(false);

    this.bob = scene.tweens.add({
      targets: this.sprite,
      y: y - 1.5,
      duration: 900 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Show or hide the `!` based on distance. Returns true when the player has
   * closed to engagement range and the fight should start.
   */
  update(playerX: number, playerY: number): boolean {
    if (this.defeated) return false;
    const d = Phaser.Math.Distance.Between(playerX, playerY, this.anchorX, this.anchorY);
    const near = d < NOTICE_RANGE;
    if (near !== this.noticed) {
      this.noticed = near;
      this.notice.setVisible(near);
    }
    return d < ENGAGE_RANGE;
  }

  /** Fade out and remove — used when the enemy is beaten. */
  retire(scene: Phaser.Scene): void {
    this.defeated = true;
    this.notice.setVisible(false);
    this.bob.stop();
    scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      y: this.sprite.y - 6,
      duration: 320,
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    this.bob.stop();
    this.sprite.destroy();
    this.notice.destroy();
  }
}

/** Load every battler texture the roster references. Call in a scene's preload. */
export function preloadBattlers(scene: Phaser.Scene): void {
  for (const key of BATTLER_KEYS) {
    // Keys are `battler:<name>` and map 1:1 to public/assets/battlers/<name>.png.
    const file = key.slice("battler:".length);
    scene.load.image(key, `/assets/battlers/${file}.png`);
  }
}
