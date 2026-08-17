"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Balances } from "./Balances";
import { InventoryPanel } from "./InventoryPanel";
import { LoadoutPanel } from "./LoadoutPanel";
import { StatusBars } from "./StatusBars";

/**
 * The always-on layer over the game canvas.
 *
 * It lives in the top band on purpose: the bottom of the screen belongs to the
 * in-canvas dialogue box, and the middle belongs to the player. Everything here
 * is pointer-transparent except the controls, so clicks fall through to the game.
 *
 * All data comes from the store, which is fed by `gameService` — no component
 * here reaches a data source directly (BUILD_PLAN.md §"The one rule").
 */
export function Hud() {
  const { player, worldBar, elixir, token, error, overlay, hydrate, toggleOverlay } =
    useGameStore();

  // Panels are opened from the keyboard first — this is a game, and the player's
  // hands are already on the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "l") toggleOverlay("loadout");
      else if (key === "i") toggleOverlay("inventory");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleOverlay]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-mono">
      <div className="flex items-start justify-between gap-4 p-3 sm:p-4">
        {/* Both clusters sit on the same dark panel as the in-canvas dialogue box.
            Without a ground the HUD is unreadable over bright grass, and sharing
            the material makes the DOM and canvas layers read as one interface. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-hud-edge bg-hud-ink/85 px-5 py-4 backdrop-blur-[2px]">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-xl tracking-[0.08em] text-hud-bone">
              {player?.universeName ?? "…"}
            </h1>
            <span className="text-xs uppercase tracking-[0.18em] text-hud-mute">
              lv {player?.level ?? "—"}
            </span>
          </div>

          <StatusBars bar={worldBar} />

          {error && (
            <div className="pointer-events-auto flex items-center gap-2 text-xs text-hud-corrupt">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void hydrate()}
                className="uppercase tracking-[0.18em] underline underline-offset-2 hover:text-hud-bone focus-visible:outline-1 focus-visible:outline-hud-proven"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3.5 rounded-2xl border border-hud-edge bg-hud-ink/85 px-5 py-4 backdrop-blur-[2px]">
          <Balances elixir={elixir} token={token} />
          <div className="pointer-events-auto flex gap-2">
            <PanelKey letter="L" label="loadout" onClick={() => toggleOverlay("loadout")} />
            <PanelKey letter="I" label="bag" onClick={() => toggleOverlay("inventory")} />
          </div>
        </div>
      </div>

      {overlay === "loadout" && <LoadoutPanel />}
      {overlay === "inventory" && <InventoryPanel />}
    </div>
  );
}

/** Mirrors the in-canvas `E · Wren` prompt, so every hint in the game reads the same way. */
function PanelKey({
  letter,
  label,
  onClick,
}: {
  letter: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-hud-edge bg-hud-ink/70 px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-hud-mute transition-colors hover:border-hud-proven hover:text-hud-bone focus-visible:outline-1 focus-visible:outline-hud-proven"
    >
      <span className="text-hud-proven">{letter}</span> · {label}
    </button>
  );
}
