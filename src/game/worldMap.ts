import { MAPS, type MapKey } from "./maps";
import { getFloor, mapLabel } from "./floors";

export type WorldMapNodeKind = "city" | "hub" | "road";

export interface WorldMapNode {
  /** Normalized position (0..1) on the abstract world-map canvas. */
  x: number;
  y: number;
  label: string;
  kind: WorldMapNodeKind;
}

/**
 * Where each map sits on the schematic world-map overlay (see WorldMapScene).
 * Purely presentational — mirrors the triangle-with-center-hub topology the
 * gates already encode (town-main bottom, town-b/town-c top corners, pump
 * hub in the middle, road nodes between them).
 */
const BASE_NODES: Record<MapKey, WorldMapNode> = {
  "town-main": { x: 0.5, y: 0.86, label: "", kind: "city" },
  "town-b": { x: 0.15, y: 0.14, label: "", kind: "city" },
  "town-c": { x: 0.85, y: 0.14, label: "", kind: "city" },
  pump: { x: 0.5, y: 0.5, label: "", kind: "hub" },
  "road-west": { x: 0.28, y: 0.55, label: "", kind: "road" },
  "road-east": { x: 0.72, y: 0.55, label: "", kind: "road" },
  "road-north": { x: 0.5, y: 0.15, label: "", kind: "road" },
};

/**
 * The schematic as it reads on a given floor. Floors share map files, so this
 * is where a floor's identity actually lives: its city names, and whether the
 * triangle points up or down. Mirroring is a y-flip — floor 1's two-above /
 * one-below becomes floor 2's one-above / two-below with no new geometry.
 */
export function worldMapNodes(floor: number): Record<MapKey, WorldMapNode> {
  const { mirrored } = getFloor(floor);
  const out = {} as Record<MapKey, WorldMapNode>;
  for (const [key, node] of Object.entries(BASE_NODES) as [MapKey, WorldMapNode][]) {
    out[key] = {
      ...node,
      y: mirrored ? 1 - node.y : node.y,
      label: mapLabel(key, floor),
    };
  }
  return out;
}

/** One entry per connected map pair, deduped, derived from the real gate graph. */
export interface WorldMapEdge {
  a: MapKey;
  b: MapKey;
}

/**
 * Derives the road connections straight from `gates[].to` in the live map
 * registry, so the overlay can never drift out of sync with the actual
 * inter-map gate topology.
 */
export function computeWorldMapEdges(): WorldMapEdge[] {
  const seen = new Set<string>();
  const edges: WorldMapEdge[] = [];
  for (const [key, layout] of Object.entries(MAPS) as [MapKey, (typeof MAPS)[MapKey]][]) {
    for (const gate of layout.gates) {
      if (!gate.to) continue;
      const pairKey = [key, gate.to].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      edges.push({ a: key, b: gate.to });
    }
  }
  return edges;
}
