"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { ascentStatus, descentStatus, getFloor } from "@/game/floors";
import { OverlayPanel } from "./OverlayPanel";

/**
 * The stair. Both directions.
 *
 * Down is always open to a floor you have already stood on. Up is open only one
 * floor past your highest clear, because that is what clearing a floor *means* —
 * the boss holds the stair. A world you have never fought in stays on floor 1
 * until its first boss falls, which is why the climb cannot be carried across.
 */
export function AscentPanel() {
  const { tower, world, moveToFloor } = useGameStore();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!tower) return null;

  const floor = tower.currentFloor;
  const up = ascentStatus(floor, tower.floorsCleared);
  const down = descentStatus(floor);
  const def = getFloor(floor);

  const take = async (to: number) => {
    setBusy(to);
    setError(null);
    try {
      await moveToFloor(to);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "The stair will not take you.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <OverlayPanel title="The stair" hint="Esc · close">
      <div className="flex flex-col gap-7">
        <section>
          <p className="font-mono text-sm text-hud-bone">
            Floor {floor} — {def.name}
          </p>
          <p className="mt-1 font-mono text-xs text-hud-mute">
            {world?.name ?? "this world"} · {tower.floorsCleared} of {tower.totalFloors} cleared
          </p>
        </section>

        <Direction
          label={`Climb to Floor ${floor + 1}`}
          line={up.line}
          open={up.open}
          busy={busy === floor + 1}
          onGo={() => void take(floor + 1)}
        />

        <Direction
          // No "Floor 0" — at the bottom the direction has no destination to name.
          label={floor > 1 ? `Descend to Floor ${floor - 1}` : "Descend"}
          line={down.line}
          open={down.open}
          busy={busy === floor - 1}
          onGo={() => void take(floor - 1)}
        />

        {error && <p className="font-mono text-xs text-hud-corrupt">{error}</p>}
      </div>
    </OverlayPanel>
  );
}

function Direction({
  label,
  line,
  open,
  busy,
  onGo,
}: {
  label: string;
  line: string;
  open: boolean;
  busy: boolean;
  onGo: () => void;
}) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">{label}</h3>
        <p
          className={`mt-1 max-w-prose font-mono text-xs leading-relaxed ${
            open ? "text-hud-proven" : "text-hud-mute"
          }`}
        >
          {line}
        </p>
      </div>
      <button
        type="button"
        disabled={!open || busy}
        onClick={onGo}
        className="shrink-0 rounded-lg border border-hud-proven px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven transition-colors hover:bg-hud-proven/10 disabled:cursor-not-allowed disabled:border-hud-edge disabled:text-hud-mute focus-visible:outline-1 focus-visible:outline-hud-proven"
      >
        {busy ? "Climbing…" : open ? "Take it" : "Shut"}
      </button>
    </section>
  );
}
