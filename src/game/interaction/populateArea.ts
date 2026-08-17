import * as Phaser from "phaser";
import { TILE } from "../constants";
import { Npc } from "../entities/Npc";
import { gameStore } from "@/lib/store/gameStore";
import type { AreaInteractions } from "../data/interactions";
import type { InteractionManager } from "./InteractionManager";

/**
 * Turn one area's authored interaction data into live objects. Shared by the
 * overworld and interiors so both get NPCs, props and trigger zones from the
 * same declaration — the only difference is the tile origin (interiors are
 * inset by their wall band).
 */
export function populateArea(
  scene: Phaser.Scene,
  interactions: InteractionManager,
  area: AreaInteractions,
  solids: Phaser.Physics.Arcade.StaticGroup,
  originX = 0,
  originY = 0,
): void {
  for (const spec of area.npcs ?? []) {
    const npc = new Npc(scene, spec, originX, originY);
    npc.register(interactions, spec);
    solids.add(npc.solid);
  }

  for (const obj of area.objects ?? []) {
    interactions.add({
      // Anchored to the tile's bottom edge so a player standing directly below
      // is within reach — a centre anchor sits exactly at the reach limit.
      x: originX + (obj.col + 0.5) * TILE,
      y: originY + (obj.row + 1) * TILE,
      label: obj.label,
      run: (ctx) =>
        ctx.say(
          obj.lines.map((text) => ({ text })),
          obj.opens ? () => gameStore.getState().toggleOverlay(obj.opens!) : undefined,
        ),
    });
  }

  for (const zone of area.zones ?? []) {
    interactions.addZone({
      x: originX + zone.col * TILE,
      y: originY + zone.row * TILE,
      w: zone.w * TILE,
      h: zone.h * TILE,
      once: zone.once,
      run: (ctx) => ctx.say(zone.lines.map((text) => ({ text }))),
    });
  }
}
