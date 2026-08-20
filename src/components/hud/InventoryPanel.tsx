"use client";

import { useEffect, useState } from "react";
import { gameService } from "@/lib/services";
import type { InventoryItem } from "@/lib/services/types";
import { useGameStore } from "@/lib/store/gameStore";
import { OverlayPanel } from "./OverlayPanel";

/** What the player is carrying. Ordinary game state — nothing here is on a chain. */
export function InventoryPanel() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toggleOverlay = useGameStore((s) => s.toggleOverlay);

  useEffect(() => {
    let live = true;
    gameService
      .getInventory()
      .then((i) => live && setItems(i))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not read your bag."),
      );
    return () => {
      live = false;
    };
  }, []);

  return (
    <OverlayPanel title="Bag" hint="I · close">
      {error && (
        <p className="rounded-xl border border-hud-corrupt px-4 py-3 font-mono text-sm text-hud-corrupt">
          {error}
        </p>
      )}

      {!error && !items && <p className="font-mono text-sm text-hud-mute">Opening bag…</p>}

      {items?.length === 0 && (
        <p className="font-mono text-sm text-hud-mute">
          Your bag is empty. Shopkeepers trade for project token.
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="divide-y divide-hud-edge">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-sm text-hud-bone">{item.name}</p>
                <p className="font-mono text-sm leading-relaxed text-hud-mute">
                  {item.description}
                </p>
                {item.keyItem && (
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-hud-mute/70">
                    key item · never spent
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {item.worldUse?.kind === "travel" && (
                  <button
                    type="button"
                    onClick={() => toggleOverlay("worlds")}
                    className="rounded-lg border border-hud-proven px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven transition-colors hover:bg-hud-proven/10 focus-visible:outline-1 focus-visible:outline-hud-proven"
                  >
                    Use
                  </button>
                )}
                <span className="font-mono text-base tabular-nums text-hud-mute">
                  {item.keyItem ? "—" : `×${item.count}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OverlayPanel>
  );
}
