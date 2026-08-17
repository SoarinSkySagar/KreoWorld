"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Balances } from "./Balances";
import { InventoryPanel } from "./InventoryPanel";
import { LoadoutPanel } from "./LoadoutPanel";
import { PumpPanel } from "./PumpPanel";
import { StatusBars } from "./StatusBars";
import { PROOF_STEPS, stepIndex } from "./proofSteps";

/** How often to re-check proofs in flight. The real wait is minutes, so this is cheap. */
const POLL_MS = 1500;

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
  const { player, worldBar, elixir, token, error, overlay, proofs, hydrate, toggleOverlay, pollProofs } =
    useGameStore();

  // Proofs are tracked here rather than in the Pump panel: attestation takes
  // minutes, and the player is meant to close the terminal and keep playing
  // while it runs.
  const inFlight = proofs.find((t) => t.status !== "rewarded" && t.status !== "failed");
  useEffect(() => {
    if (!inFlight) return;
    const id = setInterval(() => void pollProofs(), POLL_MS);
    return () => clearInterval(id);
  }, [inFlight, pollProofs]);

  // Panels are opened from the keyboard first — this is a game, and the player's
  // hands are already on the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "l") toggleOverlay("loadout");
      else if (key === "i") toggleOverlay("inventory");
      // The Pump has no hotkey on purpose: it is a place you walk to, opened by
      // its terminal (or by the in-flight proof indicator).
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

          {inFlight && (
            <button
              type="button"
              onClick={() => toggleOverlay("pump")}
              className="pointer-events-auto flex items-center gap-2.5 self-start rounded-lg text-xs text-hud-mute transition-colors hover:text-hud-bone focus-visible:outline-1 focus-visible:outline-hud-proven"
            >
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-hud-unproven" />
              <span className="uppercase tracking-[0.14em]">
                {PROOF_STEPS[Math.max(0, stepIndex(inFlight.status))].title}
              </span>
            </button>
          )}

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
      {overlay === "pump" && <PumpPanel />}
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
