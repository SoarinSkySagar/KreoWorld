/**
 * The combat rules — pure functions, zero Phaser. `BattleScene` is a renderer
 * over this module, which is what makes the maths testable: a wrong coefficient
 * here is invisible on screen until it quietly ruins every fight.
 *
 * Damage follows the familiar handheld-RPG shape:
 *
 *   dmg = ((2·L/5 + 2) · power · atk / (def · 50) + 2) · effectiveness · spread
 *
 * so level and stats matter without any single term running away.
 */

import type { Element, EnemySpec, WeaponNFT } from "@/lib/services/types";
import { CLASS_PROFILE } from "./weapons";
import type {
  BattleEvent,
  BattleMove,
  BattleState,
  Combatant,
  PlayerAction,
  StatusEffect,
  TurnResult,
} from "./types";

/**
 * The effectiveness cycle: each element beats exactly one other and is beaten by
 * exactly one. A pentagram rather than a table — there is nothing to memorise,
 * which matters when the moveset changes every time you re-equip.
 */
export const ELEMENT_BEATS: Record<Element, Element> = {
  fire: "air",
  air: "earth",
  earth: "water",
  water: "void",
  void: "fire",
};

export const SUPER_EFFECTIVE = 2;
export const NOT_EFFECTIVE = 0.5;

/** Damage multiplier for `attacker` hitting `defender`. */
export function effectiveness(attacker: Element, defender: Element): number {
  if (ELEMENT_BEATS[attacker] === defender) return SUPER_EFFECTIVE;
  if (ELEMENT_BEATS[defender] === attacker) return NOT_EFFECTIVE;
  return 1;
}

/** A random source, injectable so tests are deterministic. */
export type Rng = () => number;

/** Damage spread, the usual 85–100% band. */
const spread = (rng: Rng) => 0.85 + rng() * 0.15;

export interface DamageInput {
  level: number;
  power: number;
  attack: number;
  defense: number;
  multiplier: number;
}

/** The raw formula, before status modifiers. Always at least 1 on a hit. */
export function damage({ level, power, attack, defense, multiplier }: DamageInput): number {
  const base = ((2 * level) / 5 + 2) * power * (attack / Math.max(1, defense * 50)) + 2;
  return Math.max(1, Math.round(base * multiplier));
}

// --- state construction -------------------------------------------------------

/** Player HP curve. Deliberately generous: fights should last long enough to read. */
export const playerMaxHp = (level: number) => 44 + level * 6;
/** Player defense curve; weapons contribute attack only, so defense tracks level. */
export const playerDefense = (level: number) => 10 + level * 2;

/**
 * Build the player side from what they have equipped. Empty slots are skipped —
 * a player with no weapons still gets `struggle` so a battle can never deadlock.
 */
export function makePlayerCombatant(
  name: string,
  level: number,
  slots: (WeaponNFT | null)[],
): Combatant {
  const weapons = slots.filter((w): w is WeaponNFT => w !== null);
  const moves: BattleMove[] = weapons.map((weapon) => ({
    ability: weapon.ability,
    element: weapon.element,
    weapon,
    usesLeft: weapon.ability.uses,
  }));

  // Speed comes from the fastest thing you carry — a fan in the bag makes you
  // quick even when you swing the axe, which is what "class is a role" means.
  const speed = weapons.reduce(
    (best, w) => Math.max(best, Math.round(14 * CLASS_PROFILE[w.weaponClass].speed)),
    10,
  );
  const attack = weapons.reduce((sum, w) => sum + w.attack, 0);

  return {
    name,
    title: "your universe",
    level,
    hp: playerMaxHp(level),
    maxHp: playerMaxHp(level),
    attack: Math.max(10, attack),
    defense: playerDefense(level),
    speed,
    element: weapons[0]?.element ?? "void",
    moves: moves.length > 0 ? moves : [STRUGGLE],
    statuses: [],
  };
}

/** The fallback move for an empty loadout. Weak on purpose — go equip something. */
const STRUGGLE: BattleMove = {
  ability: {
    id: "struggle",
    name: "Bare Hands",
    description: "Nothing equipped. It shows.",
    power: 12,
    accuracy: 95,
    uses: 99,
  },
  element: "void",
  usesLeft: 99,
};

export function makeEnemyCombatant(spec: EnemySpec): Combatant {
  return {
    name: spec.name,
    title: spec.title,
    level: spec.level,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    attack: spec.attack,
    defense: spec.defense,
    speed: spec.speed,
    element: spec.element,
    moves: spec.abilities.map((ability) => ({
      ability,
      element: spec.element,
      usesLeft: ability.uses,
    })),
    statuses: [],
  };
}

export function createBattleState(player: Combatant, spec: EnemySpec): BattleState {
  return {
    player,
    enemy: makeEnemyCombatant(spec),
    phase: "intro",
    turn: 0,
    enemySpec: spec,
    // The Rescinded came for you specifically; the wildlife has no such grudge.
    canFlee: spec.faction !== "rescinded",
  };
}

// --- resolution ---------------------------------------------------------------

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Sum of active guard reductions on a combatant, capped so nothing is immune. */
function guardOf(c: Combatant): number {
  const total = c.statuses
    .filter((s) => s.kind === "guard")
    .reduce((sum, s) => sum + s.magnitude, 0);
  return Math.min(0.75, total);
}

/** Product of active weaken factors on a combatant. */
function weakenOf(c: Combatant): number {
  return c.statuses
    .filter((s) => s.kind === "weaken")
    .reduce((factor, s) => factor * s.magnitude, 1);
}

function addStatus(c: Combatant, status: StatusEffect): void {
  const existing = c.statuses.find((s) => s.kind === status.kind);
  // Re-applying refreshes rather than stacking, so a spammed move can't lock the
  // fight up. Magnitude takes the stronger of the two.
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft, status.turnsLeft);
    existing.magnitude =
      status.kind === "weaken"
        ? Math.min(existing.magnitude, status.magnitude)
        : Math.max(existing.magnitude, status.magnitude);
    return;
  }
  c.statuses.push(status);
}

/**
 * One combatant swings once. Mutates `attacker`/`defender` (both already cloned
 * by `resolveRound`) and appends what happened to `events`.
 */
function performMove(
  side: "player" | "enemy",
  attacker: Combatant,
  defender: Combatant,
  move: BattleMove,
  events: BattleEvent[],
  rng: Rng,
): void {
  const { ability } = move;
  move.usesLeft = Math.max(0, move.usesLeft - 1);

  if (rng() * 100 >= ability.accuracy) {
    events.push({ kind: "miss", by: side, move: ability.name });
    return;
  }

  const effect = ability.effect;
  let eff = effectiveness(move.element, defender.element);
  // Pierce refuses to resolve below neutral; it never turns a resisted hit into
  // a super-effective one.
  if (effect?.kind === "pierce" && eff < 1) eff = 1;

  const atk = attacker.attack * weakenOf(attacker);
  const hits = effect?.kind === "multi" ? effect.hits : 1;
  // A multi-hit trades burst for consistency: the same total power, split.
  const perHitPower = ability.power / hits;

  let dealt = 0;
  for (let i = 0; i < hits; i += 1) {
    const raw = damage({
      level: attacker.level,
      power: perHitPower,
      attack: atk,
      defense: defender.defense,
      multiplier: eff * spread(rng),
    });
    const afterGuard = Math.max(1, Math.round(raw * (1 - guardOf(defender))));
    dealt += afterGuard;
  }
  defender.hp = Math.max(0, defender.hp - dealt);
  events.push({ kind: "attack", by: side, move: ability.name, damage: dealt, effectiveness: eff });

  if (!effect) return;
  const other = side === "player" ? "enemy" : "player";
  switch (effect.kind) {
    case "drain": {
      const healed = Math.max(1, Math.round(dealt * effect.ratio));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
      events.push({ kind: "heal", on: side, amount: healed });
      break;
    }
    case "bleed":
      addStatus(defender, { kind: "bleed", magnitude: effect.damage, turnsLeft: effect.turns });
      events.push({ kind: "effect", by: side, effect, text: `${defender.name} is bleeding elixir.` });
      break;
    case "guard":
      addStatus(attacker, { kind: "guard", magnitude: effect.amount, turnsLeft: 1 });
      events.push({ kind: "effect", by: side, effect, text: `${attacker.name} braces behind the guard.` });
      break;
    case "weaken":
      addStatus(defender, { kind: "weaken", magnitude: effect.factor, turnsLeft: effect.turns });
      events.push({ kind: "effect", by: side, effect, text: `${defender.name}'s strength wanes.` });
      break;
    case "multi":
      events.push({ kind: "effect", by: side, effect, text: `Hit ${hits} times!` });
      break;
    case "pierce":
      events.push({ kind: "effect", by: side, effect, text: "It cuts straight through." });
      break;
  }
  void other;
}

/** Tick bleed damage and expire statuses at the end of a round. */
function tickStatuses(c: Combatant, who: "player" | "enemy", events: BattleEvent[]): void {
  for (const status of c.statuses) {
    if (status.kind === "bleed" && c.hp > 0) {
      const dmg = Math.max(1, status.magnitude);
      c.hp = Math.max(0, c.hp - dmg);
      events.push({ kind: "status", on: who, text: `${c.name} loses elixir to the wound.`, damage: dmg });
    }
    status.turnsLeft -= 1;
  }
  c.statuses = c.statuses.filter((s) => s.turnsLeft > 0);
}

/** The enemy's move choice. Prefers a super-effective option it still has uses for. */
export function chooseEnemyMove(state: BattleState, rng: Rng): number {
  const usable = state.enemy.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.usesLeft > 0);
  if (usable.length === 0) return 0;
  const strong = usable.filter(
    ({ m }) => effectiveness(m.element, state.player.element) > 1,
  );
  const pool = strong.length > 0 && rng() < 0.7 ? strong : usable;
  return pool[Math.floor(rng() * pool.length) % pool.length].i;
}

/** Flee chance, the classic speed ratio, floored and capped so it is never certain. */
export function fleeChance(player: Combatant, enemy: Combatant): number {
  return Math.min(0.9, Math.max(0.25, (player.speed / Math.max(1, enemy.speed)) * 0.5));
}

/**
 * Resolve one full round: the player's action, then the enemy's (order by
 * speed), then status ticks. Returns a new state — the input is never mutated,
 * so the scene can keep the previous state around to animate from.
 */
export function resolveRound(prev: BattleState, action: PlayerAction, rng: Rng): TurnResult {
  const state = clone(prev);
  const events: BattleEvent[] = [];
  state.phase = "resolving";

  if (action.kind === "flee") {
    if (!state.canFlee) {
      events.push({ kind: "message", text: `${state.enemy.name} blocks the road. There is no way past.` });
    } else if (rng() < fleeChance(state.player, state.enemy)) {
      events.push({ kind: "fled", success: true });
      state.phase = "fled";
      return { state, events };
    } else {
      events.push({ kind: "fled", success: false });
    }
  }

  if (action.kind === "item") {
    const healed = Math.min(action.heal, state.player.maxHp - state.player.hp);
    state.player.hp += healed;
    events.push({ kind: "heal", on: "player", amount: healed });
  }

  const playerMove = action.kind === "move" ? state.player.moves[action.index] : undefined;
  const enemyMove = state.enemy.moves[chooseEnemyMove(state, rng)];
  // Ties go to the player — the side taking the action should feel responsive.
  const playerFirst = !playerMove || state.player.speed >= state.enemy.speed;

  const swingPlayer = () => {
    if (!playerMove || state.enemy.hp <= 0 || state.player.hp <= 0) return;
    performMove("player", state.player, state.enemy, playerMove, events, rng);
  };
  const swingEnemy = () => {
    if (state.enemy.hp <= 0 || state.player.hp <= 0) return;
    performMove("enemy", state.enemy, state.player, enemyMove, events, rng);
  };

  if (playerFirst) {
    swingPlayer();
    swingEnemy();
  } else {
    swingEnemy();
    swingPlayer();
  }

  if (state.enemy.hp > 0 && state.player.hp > 0) {
    tickStatuses(state.enemy, "enemy", events);
    tickStatuses(state.player, "player", events);
  }

  state.turn += 1;
  if (state.enemy.hp <= 0) {
    events.push({ kind: "faint", who: "enemy" });
    state.phase = "won";
  } else if (state.player.hp <= 0) {
    events.push({ kind: "faint", who: "player" });
    state.phase = "lost";
  } else {
    state.phase = "menu";
  }
  return { state, events };
}
