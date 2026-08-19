"use client";

import { useCallback, useEffect, useState } from "react";
import { gameService } from "@/lib/services";
import type { Element, Loadout, WeaponClass, WeaponNFT } from "@/lib/services/types";
import { OverlayPanel } from "./OverlayPanel";

/** Muted element tints — enough to tell weapons apart, not enough to shout. */
const ELEMENT_TINT: Record<Element, string> = {
  fire: "#e0653f",
  water: "#4aa3d8",
  earth: "#8a9b52",
  air: "#b9c6d6",
  void: "#a06bd0",
};

/** What each element beats. Shown inline so the chart never has to be memorised. */
const BEATS: Record<Element, Element> = {
  fire: "air",
  air: "earth",
  earth: "water",
  water: "void",
  void: "fire",
};

/** One-word role per class, so the second axis reads without a legend. */
const CLASS_ROLE: Record<WeaponClass, string> = {
  sword: "balanced",
  axe: "heavy",
  staff: "ability-led",
  trident: "repeating",
  fan: "defensive",
  slingshot: "unerring",
};

/**
 * Equip screen. Weapons are NFTs held on the source chain, so this panel reads
 * ownership and arranges it — it never invents a weapon.
 *
 * The four equipped weapons are also the four moves available under FIGHT, so
 * this is the moveset editor as much as it is the stat screen. Pick a slot, then
 * pick a weapon for it; clearing a slot returns the weapon to the bench.
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

  const equip = useCallback(async (slotIndex: number, weaponId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      setLoadout(await gameService.equipWeapon(slotIndex, weaponId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "That weapon could not be equipped.");
    } finally {
      setBusy(false);
    }
  }, []);

  const attack = loadout?.slots.reduce((sum, s) => sum + (s?.attack ?? 0), 0) ?? 0;

  return (
    <OverlayPanel title="Loadout" hint="L · close">
      <p className="mb-6 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
        You have no powers of your own — only what you carry. Your weapons are held on the
        source chain; equipping arranges what you already own. The four in your slots are also
        your four moves in a fight.
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
              attack <span className="text-base tabular-nums text-hud-bone">{attack}</span>
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {loadout.slots.map((slot, i) => (
              <Slot
                key={i}
                index={i}
                weapon={slot}
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
              {loadout.bench.map((weapon) => (
                <li key={weapon.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => equip(selected, weapon.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-hud-edge bg-hud-ink px-4 py-3 text-left transition-colors hover:border-hud-proven disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-hud-proven"
                  >
                    <WeaponLabel weapon={weapon} />
                    <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
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
  weapon,
  selected,
  busy,
  onSelect,
  onClear,
}: {
  index: number;
  weapon: WeaponNFT | null;
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
          {weapon ? (
            <WeaponLabel weapon={weapon} />
          ) : (
            <span className="font-mono text-sm text-hud-mute">Empty</span>
          )}
        </div>
      </button>

      {weapon && (
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

function WeaponLabel({ weapon }: { weapon: WeaponNFT }) {
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      {/* The NFT's own art — the same icon the battle menu shows. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/weapons/${weapon.iconKey}.png`}
        alt=""
        width={32}
        height={32}
        className="mt-0.5 size-8 shrink-0 [image-rendering:pixelated]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: ELEMENT_TINT[weapon.element] }}
          />
          <span className="truncate font-mono text-sm text-hud-bone">{weapon.name}</span>
        </span>
        <span className="mt-0.5 block font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
          {weapon.weaponClass} · {CLASS_ROLE[weapon.weaponClass]} · atk {weapon.attack}
        </span>
        <span className="mt-1 block font-mono text-xs text-hud-mute">
          <span style={{ color: ELEMENT_TINT[weapon.element] }}>{weapon.ability.name}</span>
          {" — "}
          {weapon.ability.description}
        </span>
        <span className="mt-0.5 block font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
          pow {weapon.ability.power} · acc {weapon.ability.accuracy}% · {weapon.ability.uses} uses ·
          strong vs {BEATS[weapon.element]}
        </span>
      </span>
    </span>
  );
}
