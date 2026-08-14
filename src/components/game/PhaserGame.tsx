"use client";

import { useEffect, useRef } from "react";
import type * as Phaser from "phaser";
import { useGameStore } from "@/lib/store/gameStore";
import { cn } from "@/lib/utils";

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
 */
export function PhaserGame({ className }: { className?: string }) {
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
      gameRef.current = new PhaserLib.Game(createGameConfig(containerRef.current));
    }

    void boot();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [hydrate]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full w-full overflow-hidden [&>canvas]:mx-auto [&>canvas]:block",
        className,
      )}
      aria-label="Game canvas"
      role="img"
    />
  );
}
