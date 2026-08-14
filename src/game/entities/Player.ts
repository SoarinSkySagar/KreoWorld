import * as Phaser from "phaser";
import {
  CHAR_FRAME,
  Facing,
  IDLE_FRAME,
  PLAYER_RUN_SPEED,
  PLAYER_SPEED,
  RUN_ANIM_TIME_SCALE,
  WALK_RANGE,
} from "../constants";

/**
 * The player avatar: an arcade-physics sprite with 4-direction walk animation.
 * Shared by the overworld and interior scenes. The camera follows this sprite,
 * so from the player's view the world scrolls while they stay centered; only the
 * walk animation conveys motion.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private facing: Facing = "down";
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private shiftKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, x: number, y: number, facing: Facing = "down") {
    Player.ensureAnimations(scene);

    this.sprite = scene.physics.add.sprite(x, y, "adam", IDLE_FRAME[facing]);
    // Feet-anchored origin makes y == the character's feet, which we use for
    // both placement and depth-sorting against trees/houses.
    this.sprite.setOrigin(0.5, 1);
    // Collision box is a small rectangle at the feet, not the whole 16x32 frame.
    this.sprite.body?.setSize(12, 8);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setOffset(2, 22);
    this.facing = facing;

    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as typeof this.wasd;
    this.shiftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  /** Define the 4 walk animations once per game (animations are global). */
  static ensureAnimations(scene: Phaser.Scene): void {
    (Object.keys(WALK_RANGE) as Facing[]).forEach((dir) => {
      const key = `walk-${dir}`;
      if (scene.anims.exists(key)) return;
      const [start, end] = WALK_RANGE[dir];
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers("adam", { start, end }),
        frameRate: 10,
        repeat: -1,
      });
    });
  }

  update(): void {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx = -1;
    else if (right) vx = 1;
    if (up) vy = -1;
    else if (down) vy = 1;

    // Normalise diagonals so speed is constant in all directions. Holding
    // Shift sprints: higher velocity plus faster animation playback (no
    // separate sprint sheet exists, so we speed up the same walk cycle).
    const running = this.shiftKey.isDown;
    const speed = running ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    const len = Math.hypot(vx, vy) || 1;
    this.sprite.setVelocity((vx / len) * speed, (vy / len) * speed);

    // Facing: horizontal wins on diagonals, matching classic top-down feel.
    if (vx < 0) this.facing = "left";
    else if (vx > 0) this.facing = "right";
    else if (vy < 0) this.facing = "up";
    else if (vy > 0) this.facing = "down";

    if (vx !== 0 || vy !== 0) {
      this.sprite.anims.play(`walk-${this.facing}`, true);
      this.sprite.anims.timeScale = running ? RUN_ANIM_TIME_SCALE : 1;
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(IDLE_FRAME[this.facing]);
    }

    // Depth-sort against world objects by feet position.
    this.sprite.setDepth(this.sprite.y);
  }
}

/** Load the character spritesheet. Call in a scene's preload. */
export function preloadPlayer(scene: Phaser.Scene): void {
  scene.load.spritesheet("adam", "/assets/sprites/adam_run.png", CHAR_FRAME);
}
