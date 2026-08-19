/**
 * Battle-local types. These describe a fight *in progress* — they never leave
 * the client, which is why they live under `game/` and not in the service layer.
 * Only `BattleOutcome` (what happened) crosses back over the seam.
 */

import type {
  AbilityEffect,
  Element,
  EnemySpec,
  WeaponAbility,
  WeaponNFT,
} from "@/lib/services/types";

/** A status riding on one combatant, ticked down at the end of each round. */
export interface StatusEffect {
  kind: "bleed" | "guard" | "weaken";
  /** Bleed: damage per tick. Guard: 0..1 reduction. Weaken: attack multiplier. */
  magnitude: number;
  turnsLeft: number;
}

/** One side of the fight. Player and enemy use the same shape so the engine has one code path. */
export interface Combatant {
  name: string;
  title: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  /** The wielder's own element — used when an ability's own element is unset. */
  element: Element;
  /** Available moves, in menu order. */
  moves: BattleMove[];
  statuses: StatusEffect[];
}

/**
 * A move as the battle sees it: the ability plus the element it resolves at.
 * For the player that element comes from the weapon; for an enemy, from itself.
 */
export interface BattleMove {
  ability: WeaponAbility;
  element: Element;
  /** Present when the move comes from an equipped weapon (players only). */
  weapon?: WeaponNFT;
  /** Uses left this battle. Starts at `ability.uses`. */
  usesLeft: number;
}

export type BattlePhase = "intro" | "menu" | "resolving" | "won" | "lost" | "fled";

export interface BattleState {
  player: Combatant;
  enemy: Combatant;
  phase: BattlePhase;
  /** Completed rounds. A round is: both sides act (or one flees). */
  turn: number;
  /** The enemy this battle was rolled from, so the outcome can name it. */
  enemySpec: EnemySpec;
  /** Whether the player may still attempt to flee (the Rescinded do not let you). */
  canFlee: boolean;
}

/** One thing that happened, in the order it happened. The scene renders these as messages. */
export type BattleEvent =
  | { kind: "message"; text: string }
  | { kind: "attack"; by: "player" | "enemy"; move: string; damage: number; effectiveness: number }
  | { kind: "miss"; by: "player" | "enemy"; move: string }
  | { kind: "effect"; by: "player" | "enemy"; effect: AbilityEffect; text: string }
  | { kind: "status"; on: "player" | "enemy"; text: string; damage: number }
  | { kind: "heal"; on: "player" | "enemy"; amount: number }
  | { kind: "faint"; who: "player" | "enemy" }
  | { kind: "fled"; success: boolean };

/** The result of resolving one full round: the new state plus what to narrate. */
export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}

/** What the player chose to do this round. */
export type PlayerAction =
  | { kind: "move"; index: number }
  | { kind: "item"; itemId: string; heal: number }
  | { kind: "flee" };
