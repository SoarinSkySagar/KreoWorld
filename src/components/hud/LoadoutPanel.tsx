"use client";

import { useCallback, useEffect, useState } from "react";
import { gameService } from "@/lib/services";
import type { AttackNFT, Element, Loadout } from "@/lib/services/types";
import { OverlayPanel } from "./OverlayPanel";

/** Muted element tints — enough to tell attacks apart, not enough to shout. */
const ELEMENT_TINT: Record<Element, string> = {
  fire: "#e0653f",
  water: "#4aa3d8",
  earth: "#8a9b52",
  air: "#b9c6d6",
  void: "#a06bd0",
};

/**
 * Equip screen. Attacks are NFTs held on the source chain, so this panel reads
 * ownership and arranges it — it never invents an attack. Pick a slot, then pick
 * an attack for it; clearing a slot returns the attack to the bench.
 */
export function LoadoutPanel() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    gameService
      .getLoadout()
      .then((l) => {
        if (!live) return;
        setLoadout(l);
        const firstEmpty = l.slots.findIndex((s) => s === null);
        setSelected(firstEmpty === -1 ? 0 : firstEmpty);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not read your loadout."),
      );
    return () => {
      live = false;
    };
  }, []);

  const equip = useCallback(async (slotIndex: number, attackId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      setLoadout(await gameService.equipAttack(slotIndex, attackId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "That attack could not be equipped.");
    } finally {
      setBusy(false);
    }
  }, []);

  const power = loadout?.slots.reduce((sum, s) => sum + (s?.power ?? 0), 0) ?? 0;

  return (
    <OverlayPanel title="Loadout" hint="L · close">
      <p className="mb-6 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
        Your attacks are held on the source chain. Equipping arranges what you already own —
        pick a slot, then pick an attack for it.
      </p>

      {error && (
        <p className="mb-6 rounded-xl border border-hud-corrupt px-4 py-3 font-mono text-sm text-hud-corrupt">
          {error}
        </p>
      )}

      {!loadout ? (
        <p className="font-mono text-sm text-hud-mute">Reading loadout…</p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
              Equipped
            </h3>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
              power <span className="text-base tabular-nums text-hud-bone">{power}</span>
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {loadout.slots.map((slot, i) => (
              <Slot
                key={i}
                index={i}
                attack={slot}
                selected={selected === i}
                busy={busy}
                onSelect={() => setSelected(i)}
                onClear={() => equip(i, null)}
              />
            ))}
          </div>

          <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
            Bench
          </h3>
          {loadout.bench.length === 0 ? (
            <p className="font-mono text-sm text-hud-mute">Everything you own is equipped.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {loadout.bench.map((attack) => (
                <li key={attack.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => equip(selected, attack.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-hud-edge bg-hud-ink px-4 py-3 text-left transition-colors hover:border-hud-proven disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-hud-proven"
                  >
                    <AttackLabel attack={attack} />
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
                      to slot {selected + 1}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </OverlayPanel>
  );
}

function Slot({
  index,
  attack,
  selected,
  busy,
  onSelect,
  onClear,
}: {
  index: number;
  attack: AttackNFT | null;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={`flex min-h-32 flex-col justify-between rounded-xl border bg-hud-ink p-4 ${
        selected ? "border-hud-proven" : "border-hud-edge"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="text-left focus-visible:outline-1 focus-visible:outline-hud-proven"
        aria-pressed={selected}
      >
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
          Slot {index + 1}
        </span>
        <div className="mt-1.5">
          {attack ? (
            <AttackLabel attack={attack} />
          ) : (
            <span className="font-mono text-sm text-hud-mute">Empty</span>
          )}
        </div>
      </button>

      {attack && (
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="mt-3 self-start rounded-lg font-mono text-xs uppercase tracking-[0.14em] text-hud-mute transition-colors hover:text-hud-corrupt disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-hud-proven"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function AttackLabel({ attack }: { attack: AttackNFT }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-sm"
        style={{ backgroundColor: ELEMENT_TINT[attack.element] }}
      />
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm text-hud-bone">{attack.name}</span>
        <span className="block font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
          {attack.rarity} · {attack.power}
        </span>
      </span>
    </span>
  );
}
