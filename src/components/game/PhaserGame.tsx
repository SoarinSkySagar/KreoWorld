"use client";

import { useEffect, useRef } from "react";
import type * as Phaser from "phaser";
import { useGameStore } from "@/lib/store/gameStore";
import { cn } from "@/lib/utils";
import { DEFAULT_MAP, type MapKey } from "@/game/maps";

/**
 * Mounts the Phaser game into a DOM node and tears it down cleanly.
 *
 * Key correctness points:
 *  - Phaser and the game config are `import()`-ed inside the effect, so the
 *    engine (which needs `window`) never runs during SSR.
 *  - A guard + cancellation flag makes this safe under React 19 StrictMode's
 *    double-mount in dev (create once, destroy on real unmount).
 *  - The store is hydrated from the mock service before/while the scene boots,
 *    so scenes can read player/world data from the shared bridge.
 *  - `mapKey` selects which (unconnected) city this game instance shows;
 *    PreloadScene reads it back out of the registry to load only that city's
 *    assets. Passed once at boot — not a live-updating prop.
 */
export function PhaserGame({ className, mapKey = DEFAULT_MAP }: { className?: string; mapKey?: MapKey }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const hydrate = useGameStore((s) => s.hydrate);

  useEffect(() => {
    let cancelled = false;

    // Load HUD/world snapshot into the shared store before the scene reads it.
    void hydrate();

    async function boot() {
      if (gameRef.current || !containerRef.current) return;
      const [PhaserLib, { createGameConfig }] = await Promise.all([
        import("phaser"),
        import("@/game/config"),
      ]);
      if (cancelled || !containerRef.current) return;
      const game = new PhaserLib.Game(createGameConfig(containerRef.current));
      game.registry.set("initialMapKey", mapKey);
      gameRef.current = game;
      // Dev-only handle so the running game can be driven from the console or a
      // headless browser (jump to a map, force an encounter). Never in a build.
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __game?: Phaser.Game }).__game = game;
      }
    }

    void boot();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapKey is a boot-time choice, not reactive
  }, [hydrate]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full w-full overflow-hidden [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full",
        className,
      )}
      aria-label="Game canvas"
      role="img"
    />
  );
}
