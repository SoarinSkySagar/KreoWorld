import townMain from "./town-main.json";
import townB from "./town-b.json";
import townC from "./town-c.json";

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
  gates: Gate[];
  entrance: { x: number; y: number };
  houses: HouseDef[];
  roads: number[][];
  spurs: number[][];
  ponds: number[][];
  waterInterior: number[][];
  decor: DecorDef[];
}

/** Route-agnostic map identifiers. `/` = town-main, `/city1` = town-b, `/city2` = town-c. */
export type MapKey = "town-main" | "town-b" | "town-c";

export const MAPS: Record<MapKey, CityLayout> = {
  "town-main": townMain as CityLayout,
  "town-b": townB as CityLayout,
  "town-c": townC as CityLayout,
};

export const DEFAULT_MAP: MapKey = "town-main";
