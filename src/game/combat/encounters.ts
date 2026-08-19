/**
 * Where enemies stand. This is the one part of combat that is client geometry
 * rather than game data: *which* enemies can appear comes from the service
 * (`getEncounterTable`), but the tiles they occupy are derived from the map
 * layout the client already has.
 *
 * Enemies only ever appear on the highways. Towns and the Pump island are safe,
 * which is what makes stepping onto a road feel like a decision.
 */

import type { EnemySpec } from "@/lib/services/types";
import { MAPS, type MapKey } from "../maps";

/** The only maps that spawn enemies. Everything else is deliberately clean. */
export const ENCOUNTER_MAPS: ReadonlySet<MapKey> = new Set<MapKey>([
  "road-west",
  "road-east",
  "road-north",
]);

export const isEncounterMap = (mapKey: MapKey): boolean => ENCOUNTER_MAPS.has(mapKey);

/** How many enemies a road carries at once. */
export const SPAWNS_PER_ROAD = 5;
/** Tiles of clearance around every gate, so nothing ambushes you on arrival. */
const GATE_CLEARANCE = 7;
/** Minimum tiles between two spawns, so they read as separate threats. */
const SPAWN_SPACING = 5;

export interface EnemyPlacement {
  /** Unique per spawn, so a defeated enemy can be removed without ambiguity. */
  instanceId: string;
  spec: EnemySpec;
  col: number;
  row: number;
}

/** Tile centres of every gate opening on this map — the spots to keep clear. */
function gateCentres(mapKey: MapKey): { col: number; row: number }[] {
  const { width: W, height: H, gates } = MAPS[mapKey];
  return gates.map((g) => {
    const mid = g.start + g.length / 2;
    if (g.side === "N") return { col: mid, row: 0 };
    if (g.side === "S") return { col: mid, row: H };
    if (g.side === "W") return { col: 0, row: mid };
    return { col: W, row: mid };
  });
}

/**
 * Candidate tiles: the road surface itself. Standing on the road is the point —
 * you see them ahead of you and choose whether to walk up, rather than being
 * jumped by something hidden in the treeline.
 */
function roadTiles(mapKey: MapKey): { col: number; row: number }[] {
  const { roads, border: B, width: W, height: H } = MAPS[mapKey];
  const tiles: { col: number; row: number }[] = [];
  for (const [col, row, w, h] of roads) {
    for (let c = col; c < col + w; c += 1) {
      for (let r = row; r < row + h; r += 1) {
        // Never inside the solid border ring.
        if (c < B || r < B || c >= W - B || r >= H - B) continue;
        tiles.push({ col: c, row: r });
      }
    }
  }
  return tiles;
}

const dist = (a: { col: number; row: number }, b: { col: number; row: number }) =>
  Math.hypot(a.col - b.col, a.row - b.row);

/**
 * Pick one enemy by `spawnWeight`. Every enemy remains reachable on every road
 * — the point of the design is that the sprite is your only warning — but the
 * heavies are rare, so a starting player meeting a warlord is a story rather
 * than the default outcome.
 */
export function pickWeighted(table: EnemySpec[], rng: () => number): EnemySpec {
  const total = table.reduce((sum, e) => sum + Math.max(0, e.spawnWeight), 0);
  if (total <= 0) return table[Math.floor(rng() * table.length) % table.length];
  let roll = rng() * total;
  for (const spec of table) {
    roll -= Math.max(0, spec.spawnWeight);
    if (roll <= 0) return spec;
  }
  return table[table.length - 1];
}

/**
 * Roll a fresh set of enemies for one road. Called every time the player enters
 * — walking a road twice gives you a different set, which is what "they appear
 * on entering the road region" means.
 *
 * `table` is whatever the service says can appear here; picking is uniform, so
 * any tier can turn up anywhere and the sprite is your only warning.
 */
export function rollEncounters(
  mapKey: MapKey,
  table: EnemySpec[],
  rng: () => number = Math.random,
  count = SPAWNS_PER_ROAD,
): EnemyPlacement[] {
  // Guarded here as well as in the service: towns have `roads` arrays too, so a
  // caller passing a town key would otherwise get enemies on the high street.
  // "Highways only" is a rule of the world, not a detail of one call site.
  if (!isEncounterMap(mapKey) || table.length === 0) return [];
  const candidates = roadTiles(mapKey);
  const gates = gateCentres(mapKey);
  const placed: EnemyPlacement[] = [];

  // Shuffle candidates once, then take the first tiles that satisfy the spacing
  // rules — cheaper and more even than rejection-sampling the same tile twice.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const tile of candidates) {
    if (placed.length >= count) break;
    if (gates.some((g) => dist(tile, g) < GATE_CLEARANCE)) continue;
    if (placed.some((p) => dist(tile, p) < SPAWN_SPACING)) continue;
    const spec = pickWeighted(table, rng);
    placed.push({
      instanceId: `${mapKey}:${spec.id}:${placed.length}:${Math.floor(rng() * 1e6)}`,
      spec,
      col: tile.col,
      row: tile.row,
    });
  }
  return placed;
}
