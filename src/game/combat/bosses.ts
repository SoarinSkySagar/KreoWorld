/**
 * Floor bosses.
 *
 * A boss is what holds a floor's stair: `TowerState.floorsCleared` only ever
 * moves when one of these falls, which is what makes the climb something you
 * earn rather than something the seed handed you. Every world runs the same
 * tower, so a boss is keyed by floor, not by world — and beating Floor 1 in one
 * world does nothing for Floor 1 in the next, because progress is per-world.
 *
 * Bosses are built from the ordinary bestiary rather than authored from scratch:
 * same battler art, same ability system, same engine. What makes them bosses is
 * that they are placed rather than rolled — they are deliberately NOT in
 * `ENEMIES`, so `rollEncounters` can never put one on a road.
 */

import type { EnemySpec } from "@/lib/services/types";
import { ENEMIES_BY_ID } from "./enemies";

interface BossDef {
  /** Bestiary entry to build from. */
  base: string;
  name: string;
  title: string;
  taunt: string;
  /** Multiplier on the base's combat stats and payout. */
  scale: number;
}

const BOSS_DEFS: Record<number, BossDef> = {
  1: {
    base: "enemy-gilded-warden",
    name: "Warden of the Low Ring",
    title: "Holds the First Stair",
    taunt: '"Nothing goes up from here that I have not counted."',
    scale: 1.25,
  },
  2: {
    base: "enemy-null-engine",
    name: "The Turned Engine",
    title: "Holds the Second Stair",
    taunt: "It has no face to read. The floor plates go quiet under it.",
    scale: 1.35,
  },
};

function buildBoss(floor: number, def: BossDef): EnemySpec {
  const base = ENEMIES_BY_ID.get(def.base);
  if (!base) throw new Error(`Floor ${floor} boss references unknown enemy: ${def.base}`);
  const s = def.scale;
  return {
    ...structuredClone(base),
    id: `boss-floor-${floor}`,
    name: def.name,
    title: def.title,
    taunt: def.taunt,
    level: Math.round(base.level * s),
    maxHp: Math.round(base.maxHp * s),
    attack: Math.round(base.attack * s),
    defense: Math.round(base.defense * s),
    elixirReward: Math.round(base.elixirReward * s),
    // Never rolled. A boss is walked up to, not stumbled into.
    spawnWeight: 0,
  };
}

export const FLOOR_BOSSES: Record<number, EnemySpec> = Object.fromEntries(
  Object.entries(BOSS_DEFS).map(([floor, def]) => [Number(floor), buildBoss(Number(floor), def)]),
);

export const BOSSES_BY_ID = new Map(
  Object.values(FLOOR_BOSSES).map((b) => [b.id, b]),
);

/** The boss holding `floor`'s stair, or null if that floor has none authored. */
export const bossForFloor = (floor: number): EnemySpec | null => FLOOR_BOSSES[floor] ?? null;

/** Which floor this boss holds, or null if the id is not a boss at all. */
export function floorOfBoss(enemyId: string): number | null {
  for (const [floor, boss] of Object.entries(FLOOR_BOSSES)) {
    if (boss.id === enemyId) return Number(floor);
  }
  return null;
}
