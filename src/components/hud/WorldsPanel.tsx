"use client";

import { useEffect, useState } from "react";
import { gameService } from "@/lib/services";
import { useGameStore } from "@/lib/store/gameStore";
import type { TowerState, World } from "@/lib/services/types";
import { ascentStatus, getFloor } from "@/game/floors";
import { OverlayPanel } from "./OverlayPanel";

/**
 * World select and the ascent gate.
 *
 * A world is a supported source chain, so this list is not a content menu — in a
 * real implementation it comes from the protocol's supported-chain list. That is
 * why a locked world still appears: it exists and is addressable, it is just not
 * open to players.
 *
 * What travels between worlds is the character and the armoury, both of which
 * live on Creditcoin. Currency and tower progress stay behind, because each
 * world keeps its own.
 */
export function WorldsPanel() {
  const { world: current, tower, travelTo } = useGameStore();
  const [worlds, setWorlds] = useState<World[] | null>(null);
  const [towers, setTowers] = useState<Record<string, TowerState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await gameService.listWorlds();
        if (!live) return;
        setWorlds(list);
        const entries = await Promise.all(
          list.map(async (w) => [w.id, await gameService.getTower(w.id)] as const),
        );
        if (live) setTowers(Object.fromEntries(entries));
      } catch {
        if (live) setWorlds([]);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const travel = async (w: World) => {
    setBusy(w.id);
    setError(null);
    try {
      await travelTo(w.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not travel.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <OverlayPanel title="Riftstone" hint="Esc · close">
      <div className="flex flex-col gap-8">
        <section>
          <p className="mb-4 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
            The stone shows you what is out there. Your name, your level and your armoury cross
            with you — they are kept on Creditcoin, not in any world. Your currency and your climb
            do not: each world issues its own, and a forge answers only to the elixir of the world
            it stands in. You arrive with everything you are and nothing you own.
          </p>

          {worlds === null ? (
            <p className="font-mono text-xs text-hud-mute">Reading the registry…</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {worlds.map((w) => (
                <WorldRow
                  key={w.id}
                  world={w}
                  tower={towers[w.id]}
                  isCurrent={w.id === current?.id}
                  busy={busy === w.id}
                  onTravel={() => void travel(w)}
                />
              ))}
            </ul>
          )}
          {error && <p className="mt-3 font-mono text-xs text-hud-corrupt">{error}</p>}
        </section>

        <Ascent tower={tower} />
      </div>
    </OverlayPanel>
  );
}

function WorldRow({
  world,
  tower,
  isCurrent,
  busy,
  onTravel,
}: {
  world: World;
  tower?: TowerState;
  isCurrent: boolean;
  busy: boolean;
  onTravel: () => void;
}) {
  const locked = world.status !== "open";

  return (
    <li
      className={`rounded-xl border p-4 ${
        isCurrent ? "border-hud-proven bg-hud-proven/5" : "border-hud-edge bg-hud-ink"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-base text-hud-bone">{world.name}</span>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
              {world.chainName}
            </span>
          </div>
          <p className="mt-1 max-w-prose font-mono text-xs leading-relaxed text-hud-mute">
            {world.tagline}
          </p>
          <p className="mt-1.5 font-mono text-xs text-hud-mute">
            currency <span className="text-hud-bone">{world.currencySymbol}</span>
            {tower && (
              <>
                {" · "}
                {tower.floorsCleared} of {tower.totalFloors} floors cleared
              </>
            )}
          </p>
        </div>

        {isCurrent ? (
          <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven">
            You are here
          </span>
        ) : (
          <button
            type="button"
            disabled={locked || busy}
            onClick={onTravel}
            title={locked ? "Closed to travellers." : undefined}
            className="shrink-0 rounded-lg border border-hud-proven px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven transition-colors hover:bg-hud-proven/10 disabled:cursor-not-allowed disabled:border-hud-edge disabled:text-hud-mute focus-visible:outline-1 focus-visible:outline-hud-proven"
          >
            {busy ? "Crossing…" : locked ? "Closed" : "Travel"}
          </button>
        )}
      </div>
    </li>
  );
}

/** The stair off this floor. The island exists on every floor; the stair may not. */
function Ascent({ tower }: { tower: TowerState | null }) {
  if (!tower) return null;
  const { open, line } = ascentStatus(tower.currentFloor, tower.floorsCleared);
  const def = getFloor(tower.currentFloor);

  return (
    <section>
      <h3 className="mb-1.5 font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
        The ascent
      </h3>
      <p className="font-mono text-sm text-hud-bone">
        Floor {tower.currentFloor} — {def.name}
      </p>
      <p
        className={`mt-1 max-w-prose font-mono text-xs leading-relaxed ${
          open ? "text-hud-proven" : "text-hud-mute"
        }`}
      >
        {line}
      </p>
    </section>
  );
}
