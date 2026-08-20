import { describe, expect, it } from "vitest";
import { ENEMIES } from "./enemies";
import {
  ENCOUNTER_MAPS,
  SPAWNS_PER_ROAD,
  isEncounterMap,
  pickWeighted,
  rollEncounters,
} from "./encounters";
import { MAPS, type MapKey } from "../maps";

/** Deterministic pseudo-random, so placements are reproducible in assertions. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const ROADS = [...ENCOUNTER_MAPS];

describe("ENCOUNTER_MAPS", () => {
  it("covers the three highways and nothing else", () => {
    expect([...ENCOUNTER_MAPS].sort()).toEqual(["road-east", "road-north", "road-west"]);
  });

  it("leaves the towns and the Anchor island clean", () => {
    for (const key of ["town-main", "town-b", "town-c", "pump"] as MapKey[]) {
      expect(isEncounterMap(key)).toBe(false);
      expect(rollEncounters(key, ENEMIES, lcg(1))).toEqual([]);
    }
  });
});

describe("rollEncounters", () => {
  it("fills a road with the requested number of enemies", () => {
    for (const road of ROADS) {
      expect(rollEncounters(road, ENEMIES, lcg(7))).toHaveLength(SPAWNS_PER_ROAD);
    }
  });

  it("returns nothing when the table is empty rather than inventing an enemy", () => {
    expect(rollEncounters("road-west", [], lcg(3))).toEqual([]);
  });

  it("places every enemy on a road tile, inside the walkable border", () => {
    for (const road of ROADS) {
      const layout = MAPS[road];
      const onRoad = (col: number, row: number) =>
        layout.roads.some(([c, r, w, h]) => col >= c && col < c + w && row >= r && row < r + h);
      for (const p of rollEncounters(road, ENEMIES, lcg(11))) {
        expect(onRoad(p.col, p.row)).toBe(true);
        expect(p.col).toBeGreaterThanOrEqual(layout.border);
        expect(p.row).toBeGreaterThanOrEqual(layout.border);
        expect(p.col).toBeLessThan(layout.width - layout.border);
        expect(p.row).toBeLessThan(layout.height - layout.border);
      }
    }
  });

  it("keeps every spawn clear of the gates, so arrivals are never ambushed", () => {
    for (const road of ROADS) {
      const { width: W, height: H, gates } = MAPS[road];
      for (const p of rollEncounters(road, ENEMIES, lcg(23))) {
        for (const g of gates) {
          const mid = g.start + g.length / 2;
          const gate =
            g.side === "N" ? { col: mid, row: 0 }
            : g.side === "S" ? { col: mid, row: H }
            : g.side === "W" ? { col: 0, row: mid }
            : { col: W, row: mid };
          expect(Math.hypot(p.col - gate.col, p.row - gate.row)).toBeGreaterThanOrEqual(7);
        }
      }
    }
  });

  it("spaces spawns apart so they read as separate threats", () => {
    for (const road of ROADS) {
      const placed = rollEncounters(road, ENEMIES, lcg(31));
      for (let i = 0; i < placed.length; i += 1) {
        for (let j = i + 1; j < placed.length; j += 1) {
          const d = Math.hypot(placed[i].col - placed[j].col, placed[i].row - placed[j].row);
          expect(d).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it("gives every spawn a unique instance id, even for repeated enemies", () => {
    const placed = rollEncounters("road-north", [ENEMIES[0]], lcg(41));
    expect(new Set(placed.map((p) => p.instanceId)).size).toBe(placed.length);
  });

  it("rolls a different set each time the road is entered", () => {
    const a = rollEncounters("road-west", ENEMIES, lcg(1));
    const b = rollEncounters("road-west", ENEMIES, lcg(2));
    const key = (ps: typeof a) => ps.map((p) => `${p.spec.id}@${p.col},${p.row}`).join("|");
    expect(key(a)).not.toBe(key(b));
  });
});

describe("pickWeighted", () => {
  it("favours high-weight entries without ever excluding low-weight ones", () => {
    const rng = lcg(97);
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i += 1) {
      const spec = pickWeighted(ENEMIES, rng);
      counts.set(spec.id, (counts.get(spec.id) ?? 0) + 1);
    }
    // Every enemy must remain reachable — the sprite is the only warning you get.
    for (const e of ENEMIES) expect(counts.get(e.id) ?? 0).toBeGreaterThan(0);
    // …but the heaviest should not turn up as often as the lightest.
    const heaviest = [...ENEMIES].sort((a, b) => b.spawnWeight - a.spawnWeight)[0];
    const rarest = [...ENEMIES].sort((a, b) => a.spawnWeight - b.spawnWeight)[0];
    expect(counts.get(heaviest.id)!).toBeGreaterThan(counts.get(rarest.id)!);
  });

  it("keeps every enemy's weight positive, so nothing is silently unspawnable", () => {
    for (const e of ENEMIES) expect(e.spawnWeight).toBeGreaterThan(0);
  });

  it("falls back to a uniform pick rather than throwing when all weights are zero", () => {
    const zeroed = ENEMIES.slice(0, 3).map((e) => ({ ...e, spawnWeight: 0 }));
    expect(() => pickWeighted(zeroed, lcg(5))).not.toThrow();
    expect(zeroed).toContainEqual(pickWeighted(zeroed, lcg(5)));
  });
});
