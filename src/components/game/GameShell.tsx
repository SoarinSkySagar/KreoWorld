import { PhaserGame } from "./PhaserGame";
import { Hud } from "@/components/hud/Hud";
import { DEFAULT_MAP, type MapKey } from "@/game/maps";

/**
 * The full-screen game: canvas plus the persistent HUD layered over it. Every
 * route renders this rather than mounting the canvas directly, so the HUD can
 * never drift out of sync between entry points.
 */
export function GameShell({ mapKey = DEFAULT_MAP }: { mapKey?: MapKey }) {
  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-hud-ink">
      <PhaserGame className="h-full w-full" mapKey={mapKey} />
      <Hud />
    </main>
  );
}
