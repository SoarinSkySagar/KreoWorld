/**
 * The React <-> Phaser state bridge.
 *
 * Both the DOM UI (HUD, bars, menus) and the Phaser scenes read/write this
 * single store, so neither owns the other. React components subscribe with the
 * `useGameStore` hook; Phaser scenes (outside React) use `gameStore` directly
 * via `getState()` / `subscribe()`.
 *
 * The store loads its data through `gameService` — it never fabricates data or
 * reaches a backend itself, preserving the mock-layer seam.
 */

import { create } from "zustand";
import { gameService } from "@/lib/services";
import type { ElixirBalance, Player, TokenBalance, WorldBar } from "@/lib/services/types";

/** Full-screen DOM panels layered over the canvas. Only one is open at a time. */
export type OverlayKey = "loadout" | "inventory";

interface GameState {
  player: Player | null;
  worldBar: WorldBar | null;
  elixir: ElixirBalance | null;
  token: TokenBalance | null;
  loading: boolean;
  error: string | null;
  /** Which DOM panel currently owns the screen, if any. */
  overlay: OverlayKey | null;

  /** Pull the core HUD snapshot from the service. Safe to call repeatedly. */
  hydrate: () => Promise<void>;
  /** Local optimistic bar update (e.g. drain tick); real values come from hydrate. */
  setWorldBar: (bar: WorldBar) => void;
  /** Open a panel, or close the open one by passing the key it is already showing. */
  toggleOverlay: (key: OverlayKey) => void;
  closeOverlay: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  worldBar: null,
  elixir: null,
  token: null,
  loading: false,
  error: null,
  overlay: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [player, worldBar, elixir, token] = await Promise.all([
        gameService.getPlayer(),
        gameService.getWorldBar(),
        gameService.getElixirBalance(),
        gameService.getTokenBalance(),
      ]);
      set({ player, worldBar, elixir, token, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to load game state." });
    }
  },

  setWorldBar: (worldBar) => set({ worldBar }),

  toggleOverlay: (key) => set((s) => ({ overlay: s.overlay === key ? null : key })),
  closeOverlay: () => set({ overlay: null }),
}));

/** Non-hook handle for use inside Phaser scenes (outside the React tree). */
export const gameStore = useGameStore;
