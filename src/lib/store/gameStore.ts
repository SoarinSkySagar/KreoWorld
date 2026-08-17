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
import type {
  ClaimResult,
  ElixirBalance,
  Player,
  ProofTicket,
  TokenBalance,
  TxHash,
  WorldBar,
} from "@/lib/services/types";

/** Full-screen DOM panels layered over the canvas. Only one is open at a time. */
export type OverlayKey = "loadout" | "inventory" | "pump";

/** A proof that has finished moving — nothing left to poll for. */
const isSettled = (t: ProofTicket) => t.status === "rewarded" || t.status === "failed";

interface GameState {
  player: Player | null;
  worldBar: WorldBar | null;
  elixir: ElixirBalance | null;
  token: TokenBalance | null;
  loading: boolean;
  error: string | null;
  /** Which DOM panel currently owns the screen, if any. */
  overlay: OverlayKey | null;
  /**
   * Proofs submitted this session, newest first. Tracked here rather than in the
   * Pump panel because attestation takes minutes: the player is expected to
   * close the panel and keep playing while it runs.
   */
  proofs: ProofTicket[];

  /** Pull the core HUD snapshot from the service. Safe to call repeatedly. */
  hydrate: () => Promise<void>;
  /** Local optimistic bar update (e.g. drain tick); real values come from hydrate. */
  setWorldBar: (bar: WorldBar) => void;
  /** Open a panel, or close the open one by passing the key it is already showing. */
  toggleOverlay: (key: OverlayKey) => void;
  closeOverlay: () => void;

  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  /** Mint earned elixir on the source chain so it becomes spendable. */
  claimToChain: (amount: number) => Promise<ClaimResult>;
  /** Hand a source-chain spend to the prover and start tracking it. */
  submitProof: (txHash: TxHash) => Promise<void>;
  /** Advance every unsettled proof. Called on a timer by the HUD. */
  pollProofs: () => Promise<void>;
  hasPendingProofs: () => boolean;
}

export const useGameStore = create<GameState>((set, get) => ({
  player: null,
  worldBar: null,
  elixir: null,
  token: null,
  loading: false,
  error: null,
  overlay: null,
  proofs: [],

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

  connectWallet: async () => {
    set({ player: await gameService.connectWallet() });
  },

  disconnectWallet: async () => {
    set({ player: await gameService.disconnectWallet() });
  },

  claimToChain: async (amount) => {
    const result = await gameService.claimElixirToChain(amount);
    // The mint moved value between the two elixir balances; re-read rather than
    // patching locally, so the on-chain balance stays the source of truth.
    if (result.status === "minted") await get().hydrate();
    return result;
  },

  submitProof: async (txHash) => {
    const ticket = await gameService.submitSpendProof(txHash);
    set((s) => ({ proofs: [ticket, ...s.proofs] }));
  },

  pollProofs: async () => {
    const unsettled = get().proofs.filter((t) => !isSettled(t));
    if (unsettled.length === 0) return;

    const updated = await Promise.all(
      unsettled.map((t) => gameService.getProofStatus(t.id).catch(() => t)),
    );
    const byId = new Map(updated.map((t) => [t.id, t]));
    set((s) => ({ proofs: s.proofs.map((t) => byId.get(t.id) ?? t) }));

    // A reward credits token and moves the universe bar — refresh so the HUD
    // shows it happening, which is the whole payoff of the loop.
    const justRewarded = updated.some(
      (t) => t.status === "rewarded" && unsettled.find((u) => u.id === t.id)?.status !== "rewarded",
    );
    if (justRewarded) await get().hydrate();
  },

  hasPendingProofs: () => get().proofs.some((t) => !isSettled(t)),
}));

/** Non-hook handle for use inside Phaser scenes (outside the React tree). */
export const gameStore = useGameStore;
