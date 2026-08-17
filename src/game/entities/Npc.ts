import * as Phaser from "phaser";
import { NPC_IDLE_FRAME, TILE, type Facing } from "../constants";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { DialogueLine } from "../ui/DialogueBox";

/** Idle-only character sheets available to NPCs (4 frames, one per direction). */
export type NpcSheet = "alex" | "amelia" | "bob";

/** Placement of one NPC, in tiles. Authored as data — see `game/data/interactions.ts`. */
export interface NpcSpec {
  sheet: NpcSheet;
  name: string;
  /** Tile column / row of the tile the NPC stands on. */
  col: number;
  row: number;
  facing?: Facing;
  lines: string[];
}

/**
 * A standing character the player can talk to. NPCs never move — they exist to
 * carry dialogue and make a map feel inhabited — so a 4-frame idle strip is all
 * they need. Each one is solid, so the player bumps into it rather than walking
 * through.
 */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Blocking footprint — a static zone on the NPC's tile, as used for every other solid. */
  readonly solid: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, spec: NpcSpec, originX = 0, originY = 0) {
    const x = originX + (spec.col + 0.5) * TILE;
    const y = originY + (spec.row + 1) * TILE;

    this.sprite = scene.add
      .sprite(x, y, `npc:${spec.sheet}`, NPC_IDLE_FRAME[spec.facing ?? "down"])
      .setOrigin(0.5, 1)
      .setDepth(y);

    this.solid = scene.add.zone(originX + spec.col * TILE, originY + spec.row * TILE, TILE, TILE).setOrigin(0, 0);
    scene.physics.add.existing(this.solid, true);
  }

  /** Register this NPC's dialogue with the scene's interaction system. */
  register(interactions: InteractionManager, spec: NpcSpec): void {
    const lines: DialogueLine[] = spec.lines.map((text) => ({ speaker: spec.name, text }));
    interactions.add({
      x: this.sprite.x,
      y: this.sprite.y,
      label: spec.name,
      run: (ctx) => ctx.say(lines),
    });
  }
}

/** Load the NPC idle strips. Call in a scene's preload. */
export function preloadNpcs(scene: Phaser.Scene): void {
  for (const sheet of ["alex", "amelia", "bob"] as NpcSheet[]) {
    scene.load.spritesheet(`npc:${sheet}`, `/assets/sprites/${sheet}_idle.png`, {
      frameWidth: 16,
      frameHeight: 32,
    });
  }
}
