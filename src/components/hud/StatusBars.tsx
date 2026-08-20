"use client";

import type { ElixirBalance, TowerState, World } from "@/lib/services/types";
import { getFloor } from "@/game/floors";

/**
 * The persistent bars, and the one place the game's central rule is visible at a
 * glance: banked elixir is solid ink because it has been minted on this world's
 * chain and is therefore real, spendable value; unbanked elixir is hatched
 * because it exists only in the game and a loss can take it. They are
 * deliberately not the same object rendered twice.
 *
 * Only banked elixir can be burned at the forge, so this readout is also the
 * answer to "can I forge yet?".
 */
export function StatusBars({
  elixir,
  tower,
  world,
}: {
  elixir: ElixirBalance | null;
  tower: TowerState | null;
  world: World | null;
}) {
  const total = elixir ? elixir.earned + elixir.onChain : 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="flex flex-col gap-2.5">
      <Bar
        label="Banked"
        amount={elixir?.onChain ?? null}
        pct={elixir ? pct(elixir.onChain) : 0}
        state="proven"
        symbol={world?.currencySymbol}
      />
      <Bar
        label="At risk"
        amount={elixir?.earned ?? null}
        pct={elixir ? pct(elixir.earned) : 0}
        state="unproven"
        symbol={world?.currencySymbol}
      />
      <FloorLine tower={tower} />
    </div>
  );
}

/** Where the player stands in this world's tower. Floors do not cross worlds. */
function FloorLine({ tower }: { tower: TowerState | null }) {
  if (!tower) {
    return (
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
        Floor —
      </span>
    );
  }
  const def = getFloor(tower.currentFloor);
  return (
    <span className="font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
      Floor {tower.currentFloor} · <span className="text-hud-bone">{def.name}</span>
      <span className="text-hud-mute"> · {tower.floorsCleared} cleared</span>
    </span>
  );
}

function Bar({
  label,
  amount,
  pct,
  state,
  symbol,
}: {
  label: string;
  amount: number | null;
  pct: number;
  state: "proven" | "unproven";
  symbol?: string;
}) {
  const proven = state === "proven";
  const width = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex items-center gap-3.5">
      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
        {label}
      </span>

      <div
        role="meter"
        aria-label={`${label} elixir, ${state}`}
        aria-valuenow={amount ?? undefined}
        aria-valuemin={0}
        className="hud-ticks relative h-4 w-56 overflow-hidden rounded-full border border-hud-edge bg-hud-ink sm:w-80"
      >
        {amount !== null && (
          <div
            className={
              proven
                ? "absolute inset-y-0 left-0 bg-hud-proven shadow-[0_0_6px_var(--color-hud-proven)]"
                : "hud-hatch absolute inset-y-0 left-0 opacity-90"
            }
            style={{ width: `${width}%` }}
          />
        )}
        {/* The unbanked bar gets a dashed leading edge — nothing there is committed yet. */}
        {amount !== null && !proven && width > 0 && (
          <div
            className="absolute inset-y-0 w-px border-l border-dashed border-hud-unproven"
            style={{ left: `${width}%` }}
          />
        )}
      </div>

      <span className="w-16 text-right font-mono text-base tabular-nums text-hud-bone">
        {amount === null ? "—" : Math.round(amount)}
      </span>
      <span
        className={`font-mono text-xs uppercase tracking-[0.14em] ${
          proven ? "text-hud-proven" : "text-hud-unproven"
        }`}
      >
        {proven ? (symbol ?? "on-chain") : "unbanked"}
      </span>
    </div>
  );
}
