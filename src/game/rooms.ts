/**
 * Data-driven interior definitions. Each enterable house on the overworld maps
 * to one room here; InteriorScene renders any of these generically. Coordinates
 * are in interior floor tiles (0,0 = top-left walkable tile). Extend freely —
 * adding a room is data, not code.
 */

export interface FurniturePlacement {
  tex: string;
  col: number;
  row: number;
  /** Blocks movement (walls always block; this is for furniture). */
  solid?: boolean;
}

export interface RoomSpec {
  title: string;
  /** Walkable floor size in tiles (walls are added around this). */
  cols: number;
  rows: number;
  floor: "floor_cream" | "floor_wood" | "floor_gray";
  furniture: FurniturePlacement[];
}

export type RoomKey = "home" | "shop" | "lounge" | "hall" | "pump";

export const ROOMS: Record<RoomKey, RoomSpec> = {
  home: {
    title: "Home",
    cols: 9,
    rows: 7,
    floor: "floor_wood",
    furniture: [
      { tex: "bed", col: 0, row: 0, solid: true },
      { tex: "dresser", col: 3, row: 0, solid: true },
      { tex: "tv", col: 5, row: 0, solid: true },
      { tex: "rug", col: 3, row: 3 },
      { tex: "plant", col: 7, row: 4, solid: true },
    ],
  },
  shop: {
    title: "General Store",
    cols: 9,
    rows: 7,
    floor: "floor_cream",
    furniture: [
      { tex: "shelf", col: 0, row: 0, solid: true },
      { tex: "shelf", col: 3, row: 0, solid: true },
      { tex: "shelf", col: 6, row: 0, solid: true },
      { tex: "counter", col: 2, row: 4, solid: true },
      { tex: "stools", col: 2, row: 3 },
      { tex: "stools", col: 4, row: 3 },
      { tex: "plant", col: 7, row: 4, solid: true },
    ],
  },
  lounge: {
    title: "Lounge",
    cols: 9,
    rows: 7,
    floor: "floor_gray",
    furniture: [
      { tex: "sofa", col: 1, row: 1, solid: true },
      { tex: "tv", col: 5, row: 0, solid: true },
      { tex: "rug", col: 3, row: 3 },
      { tex: "chair", col: 7, row: 3, solid: true },
      { tex: "plant", col: 0, row: 4, solid: true },
    ],
  },
  hall: {
    title: "Town Hall",
    cols: 11,
    rows: 8,
    floor: "floor_wood",
    furniture: [
      { tex: "counter", col: 3, row: 0, solid: true },
      { tex: "shelf", col: 0, row: 0, solid: true },
      { tex: "shelf", col: 8, row: 0, solid: true },
      { tex: "stools", col: 4, row: 3 },
      { tex: "stools", col: 6, row: 3 },
      { tex: "plant", col: 0, row: 5, solid: true },
      { tex: "plant", col: 9, row: 5, solid: true },
    ],
  },
  pump: {
    title: "The Anchor",
    cols: 13,
    rows: 9,
    floor: "floor_gray",
    furniture: [
      { tex: "shelf", col: 0, row: 0, solid: true },
      { tex: "shelf", col: 10, row: 0, solid: true },
      { tex: "tv", col: 5, row: 0, solid: true },
      { tex: "rug", col: 5, row: 2 },
      { tex: "counter", col: 4, row: 5, solid: true },
      { tex: "stools", col: 2, row: 6 },
      { tex: "stools", col: 9, row: 6 },
      { tex: "plant", col: 0, row: 6, solid: true },
      { tex: "plant", col: 11, row: 6, solid: true },
    ],
  },
};
