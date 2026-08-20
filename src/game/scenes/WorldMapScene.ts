import * as Phaser from "phaser";
import type { MapKey } from "../maps";
import { worldMapNodes, computeWorldMapEdges, type WorldMapNode, type WorldMapNodeKind } from "../worldMap";
import { getFloor } from "../floors";

interface WorldMapData {
  currentMapKey: MapKey;
  /** Which floor's schematic to draw. Floors share map files but not layout. */
  floor: number;
}

const NODE_RADIUS: Record<WorldMapNodeKind, number> = {
  city: 14,
  hub: 12,
  road: 5,
};

const NODE_COLOR: Record<WorldMapNodeKind, number> = {
  city: 0x6ee7ff,
  hub: 0xffd166,
  road: 0x4a5568,
};

/**
 * Pokémon-style world-map overlay, opened with M from OverworldScene (which
 * pauses underneath). Purely schematic: node positions and connecting roads
 * are laid out in ./worldMap.ts and derived from the real gate graph, not a
 * to-scale stitch of the actual maps. Shows only which map the player is
 * currently in, not a sub-position within it.
 */
export class WorldMapScene extends Phaser.Scene {
  private currentMapKey!: MapKey;
  private floor!: number;

  constructor() {
    super("WorldMapScene");
  }

  init(data: WorldMapData): void {
    this.currentMapKey = data.currentMapKey;
    this.floor = data.floor ?? 1;
  }

  create(): void {
    const { width: W, height: H } = this.scale;
    const margin = Math.min(W, H) * 0.15;
    const panelW = W - margin * 2;
    const panelH = H - margin * 2;
    const originX = margin;
    const originY = margin;
    const toScreen = (nx: number, ny: number) => ({ x: originX + nx * panelW, y: originY + ny * panelH });

    this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0, 0).setScrollFactor(0).setDepth(0);

    this.add
      .text(W / 2, originY - 28, `Floor ${this.floor} — ${getFloor(this.floor).name}`, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#6ee7ff",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(1);

    const nodes = worldMapNodes(this.floor);

    const graphics = this.add.graphics().setScrollFactor(0).setDepth(1);
    graphics.lineStyle(2, 0x4a5568, 0.9);
    for (const edge of computeWorldMapEdges()) {
      const a = toScreen(nodes[edge.a].x, nodes[edge.a].y);
      const b = toScreen(nodes[edge.b].x, nodes[edge.b].y);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }

    for (const [key, node] of Object.entries(nodes) as [MapKey, WorldMapNode][]) {
      const { x, y } = toScreen(node.x, node.y);
      const isCurrent = key === this.currentMapKey;

      if (isCurrent) {
        this.add
          .circle(x, y, NODE_RADIUS[node.kind] + 6, 0x6ee7ff, 0)
          .setStrokeStyle(2, 0x6ee7ff, 0.9)
          .setScrollFactor(0)
          .setDepth(1);
      }

      this.add
        .circle(x, y, NODE_RADIUS[node.kind], NODE_COLOR[node.kind])
        .setScrollFactor(0)
        .setDepth(2);

      if (node.label) {
        this.add
          .text(x, y + NODE_RADIUS[node.kind] + 6, node.label, {
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#e2e8f0",
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setDepth(2);
      }

      if (isCurrent) {
        const marker = this.add
          .triangle(x, y - NODE_RADIUS[node.kind] - 14, 0, 12, 12, 12, 6, 0, 0x6ee7ff)
          .setScrollFactor(0)
          .setDepth(3);
        this.tweens.add({ targets: marker, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
      }
    }

    this.add
      .text(W / 2, H - originY + 20, "M / Esc to close", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#94a3b8",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1);

    const close = () => {
      this.scene.stop();
      this.scene.resume("OverworldScene");
    };
    this.input.keyboard!.once("keydown-M", close);
    this.input.keyboard!.once("keydown-ESC", close);
  }
}
