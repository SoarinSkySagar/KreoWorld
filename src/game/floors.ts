/**
 * Floors of a world's tower.
 *
 * Every floor reuses the same seven map files — the geometry is identical, so a
 * new floor costs a data entry, not a new tileset. What changes per floor is the
 * naming and the schematic layout: floor 1 is a triangle with two cities above
 * and one below, floor 2 turns it over (two below, one above). The island sits
 * at the centre of every floor and is the gate between them.
 *
 * Floors open by defeating the floor boss (design spec §3). No proof is involved
 * — attestation latency never touches a fight.
 */

import type { MapKey } from "./maps";

export interface FloorDef {
  floor: number;
  /** Shown on the world map and the ascent gate. */
  name: string;
  /** Per-floor names for the three cities. Keyed by the reused map file. */
  cityNames: Record<"town-main" | "town-b" | "town-c", string>;
  /**
   * Flip the schematic vertically. Floor 1 puts two cities above and one below;
   * mirroring turns that over, which is the whole visual difference between
   * floors that share map files.
   */
  mirrored: boolean;
  /** One line spoken by the ascent gate when you arrive on this floor. */
  arrival: string;
}

export const FLOORS: Record<number, FloorDef> = {
  1: {
    floor: 1,
    name: "The Low Ring",
    cityNames: { "town-main": "Ashfen", "town-b": "Cairnhold", "town-c": "Sablewatch" },
    mirrored: false,
    arrival: "Floor One. Two holds above, one below, and the water between them.",
  },
  2: {
    floor: 2,
    name: "The Turned Ring",
    cityNames: { "town-main": "Greywater", "town-b": "Thornrest", "town-c": "Emberlot" },
    mirrored: true,
    arrival: "Floor Two. The same shape, turned over. One hold above, two below.",
  },
};

/** Highest floor with authored content. Above this the ascent gate is shut. */
export const TOP_FLOOR = 2;

export const isCityMap = (key: MapKey): key is "town-main" | "town-b" | "town-c" =>
  key === "town-main" || key === "town-b" || key === "town-c";

export function getFloor(floor: number): FloorDef {
  const def = FLOORS[floor];
  if (!def) throw new Error(`No such floor: ${floor}`);
  return def;
}

/**
 * Name of a map as it is known on a given floor. Roads and the island keep one
 * name everywhere; only the cities are renamed per floor.
 */
export function mapLabel(key: MapKey, floor: number): string {
  if (isCityMap(key)) return getFloor(floor).cityNames[key];
  if (key === "pump") return "The Anchor";
  return "";
}

/**
 * Which floors a climber can currently reach in a world.
 *
 * You may always go *down* to anything you have already been to, and *up* only
 * one floor past your highest clear — floors open by killing the floor boss, so
 * `floorsCleared + 1` is the frontier. A world you have never fought in is
 * therefore locked to floor 1 until its first boss falls.
 */
export function reachableFloors(floorsCleared: number, totalFloors: number): number[] {
  const top = Math.min(totalFloors, TOP_FLOOR, floorsCleared + 1);
  const out: number[] = [];
  for (let f = 1; f <= top; f++) if (FLOORS[f]) out.push(f);
  return out;
}

export const canReachFloor = (floor: number, floorsCleared: number, totalFloors: number): boolean =>
  reachableFloors(floorsCleared, totalFloors).includes(floor);

/**
 * What the stair says about the floor above. The island exists on every floor —
 * what changes is whether the stair beyond it leads anywhere yet.
 */
export function ascentStatus(
  floor: number,
  floorsCleared = floor,
): { open: boolean; line: string } {
  const next = floor + 1;
  if (!FLOORS[next]) {
    return {
      open: false,
      line:
        `The stair past Floor ${floor} is shut. Not sealed, not guarded — unbuilt. ` +
        `No clearing party has been that high.`,
    };
  }
  if (floorsCleared < floor) {
    return {
      open: false,
      line:
        `The way up is here, but Floor ${floor}'s boss still holds it. ` +
        `Clear this floor and the stair opens.`,
    };
  }
  return { open: true, line: `The stair to Floor ${next} stands open.` };
}

/** What the stair says about the floor below. */
export function descentStatus(floor: number): { open: boolean; line: string } {
  if (floor <= 1) {
    return { open: false, line: "This is the bottom. There is nothing under the Low Ring." };
  }
  return { open: true, line: `The stair back down to Floor ${floor - 1} is clear.` };
}
