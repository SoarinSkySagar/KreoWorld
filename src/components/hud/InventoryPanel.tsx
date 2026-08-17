"use client";

import { useEffect, useState } from "react";
import { gameService } from "@/lib/services";
import type { InventoryItem } from "@/lib/services/types";
import { OverlayPanel } from "./OverlayPanel";

/** What the player is carrying. Ordinary game state — nothing here is on a chain. */
export function InventoryPanel() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
              </div>
              <span className="shrink-0 font-mono text-base tabular-nums text-hud-mute">
                ×{item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </OverlayPanel>
  );
}
