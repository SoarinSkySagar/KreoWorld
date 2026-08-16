import townMain from "./town-main.json";
import townB from "./town-b.json";
import townC from "./town-c.json";
import pump from "./pump.json";
import roadWest from "./road-west.json";
import roadEast from "./road-east.json";
import roadNorth from "./road-north.json";

/**
 * All maps share this shape (see scripts/build-city.py). Each `gate` is a
 * border opening: for N/S gates, `start`/`length` span the X axis; for E/W
 * gates they span the Y axis. `OverworldScene.buildBorderCollision()` reads
 * this generically instead of assuming any particular exit configuration.
 */
export interface Gate {
  side: "N" | "S" | "E" | "W";
  start: number;
  length: number;
  /** Destination map key, if this gate leads somewhere (absent = dead end). */
  to?: MapKey;
  /** Which gate of the destination map the player arrives at. */
  toGate?: Gate["side"];
}

export interface HouseDef {
  tex: string;
  left: number;
  bottom: number;
  w: number;
  door: number;
  room: string;
}

export interface DecorDef {
  tex: string;
  left: number;
  bottom: number;
  w: number;
  solid: boolean;
}

export interface CityLayout {
  width: number;
  height: number;
  tile: number;
  border: number;
  /** Texture key for the far camera-safety backdrop beyond the map edge. */
  backdrop: string;
  /** Which gate the player spawns facing into, on first arrival. */
  entranceSide: Gate["side"];
  gates: Gate[];
  entrance: { x: number; y: number };
  houses: HouseDef[];
  roads: number[][];
  spurs: number[][];
  ponds: number[][];
  waterInterior: number[][];
  decor: DecorDef[];
}

/**
 * Map identifiers. The world forms a triangle: town-main at the bottom point,
 * town-b top-left, town-c top-right, joined by three roads, each of which also
 * branches inward to the pump island at the centre. Routes (`/`, `/city1`,
 * `/city2`, `/island`) are just entry points — every area is reachable on foot
 * from any other via the gates.
 */
export type MapKey =
  | "town-main"
  | "town-b"
  | "town-c"
  | "pump"
  | "road-west"
  | "road-east"
  | "road-north";

export const MAPS: Record<MapKey, CityLayout> = {
  "town-main": townMain as CityLayout,
  "town-b": townB as CityLayout,
  "town-c": townC as CityLayout,
  pump: pump as CityLayout,
  "road-west": roadWest as CityLayout,
  "road-east": roadEast as CityLayout,
  "road-north": roadNorth as CityLayout,
};

export const DEFAULT_MAP: MapKey = "town-main";
