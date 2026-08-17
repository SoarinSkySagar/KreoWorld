/** Shared game constants. Source art is 16px; characters are 16x32. */
export const TILE = 16;

/** Player walk speed in world pixels/second. */
export const PLAYER_SPEED = 82;

/** Sprint speed (Shift held) and how much faster the walk animation plays. */
export const PLAYER_RUN_SPEED = 156;
export const RUN_ANIM_TIME_SCALE = 1.7;

/** Character spritesheet frame size (Adam_run: 24 frames of 16x32). */
export const CHAR_FRAME = { frameWidth: 16, frameHeight: 32 } as const;

export type Facing = "down" | "up" | "left" | "right";

/**
 * Run-strip frame layout: 6 frames per direction. The two profile groups read as
 * mirror images; in-engine testing showed the 0-5 group is RIGHT-facing and the
 * 12-17 group is LEFT-facing (up 6-11, down 18-23).
 */
export const WALK_RANGE: Record<Facing, [number, number]> = {
  right: [0, 5],
  up: [6, 11],
  left: [12, 17],
  down: [18, 23],
};

/** Idle = first frame of each direction's run group. */
export const IDLE_FRAME: Record<Facing, number> = {
  right: 0,
  up: 6,
  left: 12,
  down: 18,
};

/** Approx. vertical tiles visible; drives zoom so it never reads "too zoomed out". */
export const TARGET_TILES_TALL = 12;

/** NPC idle strips are 4 frames of 16x32 — one per direction, same order as the run groups. */
export const NPC_IDLE_FRAME: Record<Facing, number> = {
  right: 0,
  up: 1,
  left: 2,
  down: 3,
};

/** How close (world px, feet-to-anchor) the player must be to interact. */
export const INTERACT_REACH = 24;
