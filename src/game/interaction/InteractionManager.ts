import * as Phaser from "phaser";
import { INTERACT_REACH, type Facing } from "../constants";
import { DialogueBox, type DialogueLine } from "../ui/DialogueBox";
import type { Player } from "../entities/Player";

/** Something the player walks up to and presses E on: an NPC, a sign, a machine. */
export interface InteractTarget {
  /** World position the player must stand near (an NPC's feet, a sign's face). */
  x: number;
  y: number;
  /** Shown in the floating hint bubble. */
  label: string;
  run: (ctx: InteractionManager) => void;
}

/** An area that fires as soon as the player walks into it — warps, ambushes, cutscenes. */
export interface TriggerZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fire only the first time it is entered this scene (default: fires on every entry). */
  once?: boolean;
  run: (ctx: InteractionManager) => void;
}

const FACING_VECTOR: Record<Facing, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * One generic system behind every "press E on the thing" in the game — NPCs,
 * signs, the Elixir Pump, gym doors, shop counters. Scenes register targets and
 * trigger zones; this owns the dialogue box, the hint bubble, and the rule that
 * the player must be close AND facing the target. Building this once means new
 * interactables are data, not new scene code.
 */
export class InteractionManager {
  readonly dialogue: DialogueBox;

  private readonly targets: InteractTarget[] = [];
  private readonly zones: TriggerZone[] = [];
  private readonly zoneOccupied = new Set<TriggerZone>();
  private readonly zoneSpent = new Set<TriggerZone>();
  private readonly hint: Phaser.GameObjects.Text;
  private active?: InteractTarget;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    this.dialogue = new DialogueBox(scene);

    this.hint = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#0b1020",
        backgroundColor: "#6ee7ff",
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(250000)
      .setResolution(scene.cameras.main.zoom)
      .setVisible(false);

    // Event-driven rather than polled: a key pressed and released inside one
    // frame never registers as "just down", which loses fast taps entirely.
    const kb = scene.input.keyboard!;
    kb.on("keydown-E", this.onPress, this);
    kb.on("keydown-SPACE", this.onPress, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off("keydown-E", this.onPress, this);
      kb.off("keydown-SPACE", this.onPress, this);
    });
  }

  /** Held keys auto-repeat; only the initial press should act, or dialogue self-advances. */
  private onPress = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (this.dialogue.isOpen) {
      this.dialogue.advance();
      return;
    }
    this.active?.run(this);
  };

  add(target: InteractTarget): void {
    this.targets.push(target);
  }

  addZone(zone: TriggerZone): void {
    this.zones.push(zone);
  }

  /** True while dialogue owns the screen — scenes should suppress their own input. */
  get busy(): boolean {
    return this.dialogue.isOpen;
  }

  /** Show dialogue, freezing the player until it closes. */
  say(lines: DialogueLine[], onClose?: () => void): void {
    this.player.setFrozen(true);
    this.hint.setVisible(false);
    this.dialogue.open(lines, () => {
      this.player.setFrozen(false);
      onClose?.();
    });
  }

  update(): void {
    if (this.dialogue.isOpen) {
      this.hint.setVisible(false);
      return;
    }

    this.checkZones();

    this.active = this.findTarget();
    if (this.active) {
      this.hint
        .setText(`E · ${this.active.label}`)
        .setPosition(this.active.x, this.active.y - 34)
        .setResolution(this.scene.cameras.main.zoom)
        .setVisible(true);
    } else {
      this.hint.setVisible(false);
    }
  }

  /** Nearest target that is within reach and on the side the player is facing. */
  private findTarget(): InteractTarget | undefined {
    const { x: px, y: py } = this.player.sprite;
    const dir = FACING_VECTOR[this.player.direction];

    let best: InteractTarget | undefined;
    let bestDist = Infinity;
    for (const t of this.targets) {
      const dx = t.x - px;
      const dy = t.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > INTERACT_REACH || dist >= bestDist) continue;
      // Facing test, skipped when practically on top of the target so a player
      // standing flush against it is never stuck unable to interact.
      if (dist > 8 && dx * dir.x + dy * dir.y <= 0) continue;
      best = t;
      bestDist = dist;
    }
    return best;
  }

  private checkZones(): void {
    const { x: px, y: py } = this.player.sprite;
    for (const z of this.zones) {
      const inside = px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h;
      if (!inside) {
        this.zoneOccupied.delete(z);
        continue;
      }
      // Only the transition into the zone fires; standing in it does not repeat.
      if (this.zoneOccupied.has(z)) continue;
      this.zoneOccupied.add(z);
      if (z.once) {
        if (this.zoneSpent.has(z)) continue;
        this.zoneSpent.add(z);
      }
      z.run(this);
      return;
    }
  }
}
