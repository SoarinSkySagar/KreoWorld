"use client";

import type { WorldBar } from "@/lib/services/types";

/**
 * The two persistent bars, and the one place the game's central rule is visible
 * at a glance: the universe bar is solid ink because it only moves on a proven
 * spend, while stored progress is hatched because it has not been proven yet and
 * so does not count for anything. They are deliberately not the same object
 * rendered twice.
 */
export function StatusBars({ bar }: { bar: WorldBar | null }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Bar
        label="Universe"
        value={bar?.universeHealth ?? null}
        state="proven"
      />
      <Bar
        label="Stored"
        value={bar?.storedProgress ?? null}
        state="unproven"
      />
    </div>
  );
}

function Bar({
  label,
  value,
  state,
}: {
  label: string;
  value: number | null;
  state: "proven" | "unproven";
}) {
  const proven = state === "proven";
  const pct = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="flex items-center gap-3.5">
      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
        {label}
      </span>

      <div
        role="meter"
        aria-label={`${label}, ${state}`}
        aria-valuenow={value ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        className="hud-ticks relative h-4 w-56 overflow-hidden rounded-full border border-hud-edge bg-hud-ink sm:w-80"
      >
        {value !== null && (
          <div
            className={
              proven
                ? "absolute inset-y-0 left-0 bg-hud-proven shadow-[0_0_6px_var(--color-hud-proven)]"
                : "hud-hatch absolute inset-y-0 left-0 opacity-90"
            }
            style={{ width: `${pct}%` }}
          />
        )}
        {/* The unproven bar gets a dashed leading edge — nothing has been committed there yet. */}
        {value !== null && !proven && pct > 0 && (
          <div
            className="absolute inset-y-0 w-px border-l border-dashed border-hud-unproven"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>

      <span className="w-7 text-right font-mono text-base tabular-nums text-hud-bone">
        {value === null ? "—" : Math.round(value)}
      </span>
      <span
        className={`font-mono text-xs uppercase tracking-[0.14em] ${
          proven ? "text-hud-proven" : "text-hud-unproven"
        }`}
      >
        {proven ? "proven" : "unproven"}
      </span>
    </div>
  );
}
