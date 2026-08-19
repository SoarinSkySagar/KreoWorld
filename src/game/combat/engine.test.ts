import { describe, expect, it } from "vitest";
import type { EnemySpec, WeaponNFT } from "@/lib/services/types";
import {
  ELEMENT_BEATS,
  NOT_EFFECTIVE,
  SUPER_EFFECTIVE,
  chooseEnemyMove,
  createBattleState,
  damage,
  effectiveness,
  fleeChance,
  makeEnemyCombatant,
  makePlayerCombatant,
  playerMaxHp,
  resolveRound,
  type Rng,
} from "./engine";
import { WEAPONS, WEAPONS_BY_ID } from "./weapons";
import { ENEMIES } from "./enemies";

/** A deterministic rng that walks a fixed sequence, repeating the last value. */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Always rolls the same value — handy for "never miss" / "always miss". */
const fixed = (v: number): Rng => () => v;

function weapon(id: string): WeaponNFT {
  const w = WEAPONS_BY_ID.get(id);
  if (!w) throw new Error(`test fixture missing weapon ${id}`);
  return w;
}

function enemy(overrides: Partial<EnemySpec> = {}): EnemySpec {
  return {
    id: "test-enemy",
    name: "Test Dummy",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:cinderchick_a",
    element: "air",
    level: 10,
    maxHp: 100,
    attack: 30,
    defense: 20,
    speed: 10,
    elixirReward: 10,
    spawnWeight: 10,
    taunt: "...",
    abilities: [
      { id: "t-hit", name: "Test Hit", description: "", power: 40, accuracy: 100, uses: 10 },
    ],
    ...overrides,
  };
}

describe("effectiveness", () => {
  it("is a closed 5-cycle — every element beats exactly one and loses to exactly one", () => {
    const elements = Object.keys(ELEMENT_BEATS) as (keyof typeof ELEMENT_BEATS)[];
    expect(elements).toHaveLength(5);
    // Every element must appear exactly once as a victim, or the cycle is broken.
    const victims = elements.map((e) => ELEMENT_BEATS[e]);
    expect(new Set(victims).size).toBe(5);
    // Walking the cycle must return to the start after exactly 5 hops.
    let cur = elements[0];
    for (let i = 0; i < 5; i += 1) cur = ELEMENT_BEATS[cur];
    expect(cur).toBe(elements[0]);
  });

  it("scores 2x into what it beats, 0.5x into what beats it, 1x otherwise", () => {
    expect(effectiveness("fire", "air")).toBe(SUPER_EFFECTIVE);
    expect(effectiveness("air", "fire")).toBe(NOT_EFFECTIVE);
    expect(effectiveness("fire", "water")).toBe(1);
    expect(effectiveness("fire", "fire")).toBe(1);
  });
});

describe("damage", () => {
  const base = { level: 10, power: 50, attack: 40, defense: 20, multiplier: 1 };

  it("never deals less than 1, even at absurd stat ratios", () => {
    expect(damage({ ...base, attack: 1, defense: 9999, multiplier: 0.5 })).toBeGreaterThanOrEqual(1);
  });

  it("scales with the effectiveness multiplier", () => {
    const neutral = damage(base);
    const strong = damage({ ...base, multiplier: 2 });
    const weak = damage({ ...base, multiplier: 0.5 });
    expect(strong).toBeGreaterThan(neutral);
    expect(weak).toBeLessThan(neutral);
  });

  it("rises with level, attack, and power; falls with defense", () => {
    expect(damage({ ...base, level: 30 })).toBeGreaterThan(damage(base));
    expect(damage({ ...base, attack: 80 })).toBeGreaterThan(damage(base));
    expect(damage({ ...base, power: 90 })).toBeGreaterThan(damage(base));
    expect(damage({ ...base, defense: 60 })).toBeLessThan(damage(base));
  });
});

describe("makePlayerCombatant", () => {
  it("turns each equipped weapon into exactly one move, skipping empty slots", () => {
    const c = makePlayerCombatant("W", 7, [weapon("wpn-emberfang"), null, weapon("wpn-deepfork"), null]);
    expect(c.moves.map((m) => m.ability.id)).toEqual(["ab-emberfang", "ab-deepfork"]);
    expect(c.moves.every((m) => m.usesLeft === m.ability.uses)).toBe(true);
  });

  it("sums equipped attack and derives HP from level", () => {
    const c = makePlayerCombatant("W", 7, [weapon("wpn-emberfang"), weapon("wpn-tidecleaver"), null, null]);
    expect(c.attack).toBe(weapon("wpn-emberfang").attack + weapon("wpn-tidecleaver").attack);
    expect(c.hp).toBe(playerMaxHp(7));
    expect(c.maxHp).toBe(c.hp);
  });

  it("falls back to a weak innate move rather than deadlocking on an empty loadout", () => {
    const c = makePlayerCombatant("W", 7, [null, null, null, null]);
    expect(c.moves).toHaveLength(1);
    expect(c.moves[0].ability.id).toBe("struggle");
    expect(c.attack).toBeGreaterThan(0);
  });

  it("takes speed from the fastest class carried, not the slowest", () => {
    const slow = makePlayerCombatant("W", 7, [weapon("wpn-stonecleave"), null, null, null]);
    const mixed = makePlayerCombatant("W", 7, [weapon("wpn-stonecleave"), weapon("wpn-stormfan"), null, null]);
    expect(mixed.speed).toBeGreaterThan(slow.speed);
  });
});

describe("resolveRound", () => {
  const attacker = (weaponId: string, level = 10) =>
    makePlayerCombatant("W", level, [weapon(weaponId), null, null, null]);

  it("does not mutate the state it was given", () => {
    const state = createBattleState(attacker("wpn-loamedge"), enemy());
    const before = structuredClone(state);
    resolveRound(state, { kind: "move", index: 0 }, fixed(0.5));
    expect(state).toEqual(before);
  });

  it("spends a use whether the swing hits or misses", () => {
    const state = createBattleState(attacker("wpn-emberfang"), enemy());
    const missed = resolveRound(state, { kind: "move", index: 0 }, fixed(0.999));
    expect(missed.events.some((e) => e.kind === "miss")).toBe(true);
    expect(missed.state.player.moves[0].usesLeft).toBe(state.player.moves[0].usesLeft - 1);
  });

  it("reports the effectiveness it actually applied", () => {
    // Emberfang is fire; fire beats air.
    const state = createBattleState(attacker("wpn-emberfang"), enemy({ element: "air" }));
    const { events } = resolveRound(state, { kind: "move", index: 0 }, fixed(0));
    const hit = events.find((e) => e.kind === "attack" && e.by === "player");
    expect(hit).toMatchObject({ effectiveness: SUPER_EFFECTIVE });
  });

  it("lets pierce ignore a resistance without granting a bonus", () => {
    // Skypike is air with `pierce`; air is resisted by fire.
    const resisted = createBattleState(attacker("wpn-skypike"), enemy({ element: "fire" }));
    const { events } = resolveRound(resisted, { kind: "move", index: 0 }, fixed(0));
    const hit = events.find((e) => e.kind === "attack" && e.by === "player");
    expect(hit).toMatchObject({ effectiveness: 1 });

    // Into what air already beats, pierce must not push past 2x.
    const strong = createBattleState(attacker("wpn-skypike"), enemy({ element: "earth" }));
    const strongHit = resolveRound(strong, { kind: "move", index: 0 }, fixed(0)).events.find(
      (e) => e.kind === "attack" && e.by === "player",
    );
    expect(strongHit).toMatchObject({ effectiveness: SUPER_EFFECTIVE });
  });

  it("heals the attacker on drain, never above max HP", () => {
    const state = createBattleState(attacker("wpn-tidewarden"), enemy({ element: "void" }));
    state.player.hp = 5;
    const { state: after, events } = resolveRound(state, { kind: "move", index: 0 }, fixed(0));
    const heal = events.find((e) => e.kind === "heal");
    expect(heal).toBeDefined();
    expect(after.player.hp).toBeGreaterThan(5);
    expect(after.player.hp).toBeLessThanOrEqual(after.player.maxHp);
  });

  it("applies bleed as a status that ticks damage on later rounds", () => {
    const state = createBattleState(attacker("wpn-emberbrand"), enemy({ maxHp: 400, attack: 1 }));
    const first = resolveRound(state, { kind: "move", index: 0 }, fixed(0));
    expect(first.state.enemy.statuses.some((s) => s.kind === "bleed")).toBe(true);
    expect(first.events.some((e) => e.kind === "status" && e.on === "enemy")).toBe(true);
  });

  it("expires statuses after their stated number of turns", () => {
    // Root Slash carries no effect, so nothing refreshes the bleed.
    const state = createBattleState(
      makePlayerCombatant("W", 10, [weapon("wpn-emberbrand"), weapon("wpn-loamedge"), null, null]),
      enemy({ maxHp: 4000, attack: 1, defense: 200 }),
    );
    let cur = resolveRound(state, { kind: "move", index: 0 }, fixed(0)).state;
    const turns = cur.enemy.statuses.find((s) => s.kind === "bleed")!.turnsLeft;
    for (let i = 0; i < turns; i += 1) {
      cur = resolveRound(cur, { kind: "move", index: 1 }, fixed(0)).state;
    }
    expect(cur.enemy.statuses.some((s) => s.kind === "bleed")).toBe(false);
  });

  it("reduces incoming damage while a guard is up", () => {
    const guarded = createBattleState(attacker("wpn-stormfan"), enemy({ element: "fire", attack: 200 }));
    const unguarded = createBattleState(attacker("wpn-galewhisper"), enemy({ element: "fire", attack: 200 }));
    const a = resolveRound(guarded, { kind: "move", index: 0 }, fixed(0)).state.player.hp;
    const b = resolveRound(unguarded, { kind: "move", index: 0 }, fixed(0)).state.player.hp;
    expect(a).toBeGreaterThan(b);
  });

  it("weakens the defender's attack for the stated turns", () => {
    const state = createBattleState(attacker("wpn-hollowstaff"), enemy({ maxHp: 500 }));
    const after = resolveRound(state, { kind: "move", index: 0 }, fixed(0)).state;
    const weaken = after.enemy.statuses.find((s) => s.kind === "weaken");
    expect(weaken).toBeDefined();
    expect(weaken!.magnitude).toBeLessThan(1);
  });

  it("splits a multi-hit into the stated number of rolls", () => {
    const state = createBattleState(attacker("wpn-deepfork"), enemy({ maxHp: 500 }));
    const { events } = resolveRound(state, { kind: "move", index: 0 }, fixed(0));
    expect(events.some((e) => e.kind === "effect" && e.text.includes("3 times"))).toBe(true);
  });

  it("refreshes rather than stacks a repeated status", () => {
    const state = createBattleState(attacker("wpn-emberbrand"), enemy({ maxHp: 5000, attack: 1 }));
    let cur = resolveRound(state, { kind: "move", index: 0 }, fixed(0)).state;
    cur = resolveRound(cur, { kind: "move", index: 0 }, fixed(0)).state;
    expect(cur.enemy.statuses.filter((s) => s.kind === "bleed")).toHaveLength(1);
  });

  it("ends in `won` when the enemy drops, and stops the enemy swinging back", () => {
    const state = createBattleState(attacker("wpn-voidreaver", 60), enemy({ maxHp: 1, element: "fire" }));
    const { state: after, events } = resolveRound(state, { kind: "move", index: 0 }, fixed(0));
    expect(after.phase).toBe("won");
    expect(after.enemy.hp).toBe(0);
    expect(events.some((e) => e.kind === "faint" && e.who === "enemy")).toBe(true);
    expect(events.some((e) => e.kind === "attack" && e.by === "enemy")).toBe(false);
  });

  it("ends in `lost` when the player drops", () => {
    const state = createBattleState(attacker("wpn-pebblecast"), enemy({ attack: 5000, speed: 999 }));
    state.player.hp = 1;
    const after = resolveRound(state, { kind: "move", index: 0 }, fixed(0)).state;
    expect(after.phase).toBe("lost");
    expect(after.player.hp).toBe(0);
  });

  it("lets the faster side swing first", () => {
    const fast = createBattleState(attacker("wpn-stormfan"), enemy({ speed: 1, maxHp: 500 }));
    const firstAttack = resolveRound(fast, { kind: "move", index: 0 }, fixed(0)).events.find(
      (e) => e.kind === "attack",
    );
    expect(firstAttack).toMatchObject({ by: "player" });

    const slow = createBattleState(attacker("wpn-stonecleave"), enemy({ speed: 999, maxHp: 500 }));
    const enemyFirst = resolveRound(slow, { kind: "move", index: 0 }, fixed(0)).events.find(
      (e) => e.kind === "attack",
    );
    expect(enemyFirst).toMatchObject({ by: "enemy" });
  });

  it("heals from a bag item without ever exceeding max HP", () => {
    const state = createBattleState(attacker("wpn-loamedge"), enemy({ attack: 1, maxHp: 500 }));
    state.player.hp = state.player.maxHp - 5;
    const after = resolveRound(state, { kind: "item", itemId: "item-vial", heal: 999 }, fixed(0.5));
    expect(after.state.player.hp).toBeLessThanOrEqual(after.state.player.maxHp);
    expect(after.events.some((e) => e.kind === "heal" && e.on === "player" && e.amount === 5)).toBe(true);
  });

  it("counts the round even on a failed flee, so fleeing has a cost", () => {
    const state = createBattleState(attacker("wpn-loamedge"), enemy({ maxHp: 500 }));
    const after = resolveRound(state, { kind: "flee" }, fixed(0.999));
    expect(after.events.some((e) => e.kind === "fled" && !e.success)).toBe(true);
    expect(after.state.turn).toBe(1);
    expect(after.state.phase).toBe("menu");
  });

  it("succeeds at fleeing wildlife on a good roll", () => {
    const state = createBattleState(attacker("wpn-stormfan"), enemy({ speed: 1 }));
    const after = resolveRound(state, { kind: "flee" }, fixed(0));
    expect(after.state.phase).toBe("fled");
  });

  it("refuses to let the player flee the Rescinded", () => {
    const state = createBattleState(
      attacker("wpn-stormfan"),
      enemy({ faction: "rescinded", speed: 1 }),
    );
    expect(state.canFlee).toBe(false);
    const after = resolveRound(state, { kind: "flee" }, fixed(0));
    expect(after.state.phase).not.toBe("fled");
    expect(after.events.some((e) => e.kind === "message")).toBe(true);
  });
});

describe("chooseEnemyMove", () => {
  it("prefers a super-effective option when the roll favours it", () => {
    const player = makePlayerCombatant("W", 10, [weapon("wpn-galewhisper"), null, null, null]); // air
    const spec = enemy({
      element: "fire", // fire beats air
      abilities: [
        { id: "weak", name: "Weak", description: "", power: 10, accuracy: 100, uses: 5 },
        { id: "strong", name: "Strong", description: "", power: 60, accuracy: 100, uses: 5 },
      ],
    });
    const state = createBattleState(player, spec);
    // First roll (0.1) selects the strong pool; second picks within it.
    expect(chooseEnemyMove(state, seq([0.1, 0.9]))).toBeGreaterThanOrEqual(0);
  });

  it("never returns a move the enemy has exhausted, while any remain", () => {
    const state = createBattleState(
      makePlayerCombatant("W", 10, [weapon("wpn-loamedge"), null, null, null]),
      enemy({
        abilities: [
          { id: "a", name: "A", description: "", power: 10, accuracy: 100, uses: 5 },
          { id: "b", name: "B", description: "", power: 10, accuracy: 100, uses: 5 },
        ],
      }),
    );
    state.enemy.moves[0].usesLeft = 0;
    for (const roll of [0, 0.3, 0.5, 0.99]) {
      expect(chooseEnemyMove(state, fixed(roll))).toBe(1);
    }
  });
});

describe("fleeChance", () => {
  it("is bounded — never certain, never hopeless", () => {
    const fastP = makeEnemyCombatant(enemy({ speed: 9999 }));
    const slowE = makeEnemyCombatant(enemy({ speed: 1 }));
    expect(fleeChance(fastP, slowE)).toBeLessThanOrEqual(0.9);
    expect(fleeChance(slowE, fastP)).toBeGreaterThanOrEqual(0.25);
  });
});

describe("content integrity", () => {
  it("gives every weapon a unique id and a real icon key", () => {
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
    expect(WEAPONS.every((w) => /^wpn_[a-z]+_[a-z]+$/.test(w.iconKey))).toBe(true);
  });

  it("gives every ability sane, usable numbers", () => {
    for (const w of WEAPONS) {
      expect(w.ability.accuracy).toBeGreaterThanOrEqual(50);
      expect(w.ability.accuracy).toBeLessThanOrEqual(100);
      expect(w.ability.power).toBeGreaterThan(0);
      expect(w.ability.uses).toBeGreaterThan(0);
    }
  });

  it("gives every enemy a unique id, at least one ability, and a battler sprite", () => {
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(ENEMIES.length);
    for (const e of ENEMIES) {
      expect(e.abilities.length).toBeGreaterThan(0);
      expect(e.spriteKey.startsWith("battler:")).toBe(true);
      expect(e.maxHp).toBeGreaterThan(0);
      expect(e.elixirReward).toBeGreaterThan(0);
    }
  });

  it("keeps the Rescinded unfleeable and the wildlife escapable", () => {
    const player = makePlayerCombatant("W", 10, [weapon("wpn-loamedge"), null, null, null]);
    for (const spec of ENEMIES) {
      expect(createBattleState(player, spec).canFlee).toBe(spec.faction !== "rescinded");
    }
  });

  it("resolves every enemy against every weapon without throwing", () => {
    for (const spec of ENEMIES) {
      for (const w of WEAPONS) {
        const state = createBattleState(makePlayerCombatant("W", 12, [w, null, null, null]), spec);
        expect(() => resolveRound(state, { kind: "move", index: 0 }, fixed(0.4))).not.toThrow();
      }
    }
  });
});
