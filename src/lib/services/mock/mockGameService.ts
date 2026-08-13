/**
 * In-memory implementation of GameService for the frontend-first phase.
 *
 * It intentionally *simulates* the real system's shape so UI built against it
 * behaves correctly once the real backend lands:
 *  - every call is async with a little latency;
 *  - `claimElixirToChain` enforces mint-then-spend (moves earned → onChain);
 *  - `submitSpendProof` returns a ticket that advances through the real proof
 *    lifecycle over time (pending → proving → verified → rewarded), so the Pump
 *    UX is designed against genuine attestation-style latency, not an instant
 *    resolve.
 *
 * Nothing here is persisted; state resets on reload.
 */

import type { GameService } from "../gameService";
import type {
  ClaimResult,
  ElixirBalance,
  LeaderboardEntry,
  Loadout,
  Player,
  ProofStatus,
  ProofTicket,
  Season,
  Shop,
  TokenBalance,
  TxHash,
  WorldBar,
} from "../types";
import {
  seedElixir,
  seedLeaderboard,
  seedLoadout,
  seedPlayer,
  seedSeason,
  seedShops,
  seedToken,
  seedWorldBar,
} from "./mockData";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/** How long each mock proof stays in a given status (ms). Tuned short for dev;
 *  the real attestation wait is minutes — the UX must not assume this speed. */
const PROOF_STEP_MS = 2500;

// Mutable session state.
const state = {
  player: structuredClone(seedPlayer),
  worldBar: structuredClone(seedWorldBar),
  elixir: structuredClone(seedElixir),
  token: structuredClone(seedToken),
  loadout: structuredClone(seedLoadout),
  shops: structuredClone(seedShops),
  leaderboard: structuredClone(seedLeaderboard),
  season: structuredClone(seedSeason),
  tickets: new Map<string, ProofTicket>(),
};

let ticketSeq = 0;

/** Drive a ticket forward on a timer, mutating economy state on `rewarded`. */
function scheduleProofLifecycle(ticket: ProofTicket): void {
  const steps: ProofStatus[] = ["proving", "verified", "rewarded"];
  steps.forEach((status, i) => {
    setTimeout(() => {
      const t = state.tickets.get(ticket.id);
      if (!t || t.status === "failed") return;
      t.status = status;
      if (status === "rewarded") {
        state.token.projectToken += t.reward;
        state.worldBar.universeHealth = clamp(state.worldBar.universeHealth + t.barDelta);
        state.worldBar.storedProgress = clamp(state.worldBar.storedProgress - t.barDelta / 2);
      }
    }, PROOF_STEP_MS * (i + 1));
  });
}

export const mockGameService: GameService = {
  async getPlayer(): Promise<Player> {
    await delay(120);
    return structuredClone(state.player);
  },

  async getWorldBar(): Promise<WorldBar> {
    await delay(120);
    return structuredClone(state.worldBar);
  },

  async getStoredProgress(): Promise<number> {
    await delay(80);
    return state.worldBar.storedProgress;
  },

  async getElixirBalance(): Promise<ElixirBalance> {
    await delay(120);
    return structuredClone(state.elixir);
  },

  async getTokenBalance(): Promise<TokenBalance> {
    await delay(120);
    return structuredClone(state.token);
  },

  async claimElixirToChain(amount: number): Promise<ClaimResult> {
    await delay(200);
    if (amount <= 0 || amount > state.elixir.earned) {
      return { status: "failed", txHash: null, amount, error: "Insufficient earned elixir." };
    }
    // Simulate the mint landing on Sepolia: earned → onChain.
    await delay(600);
    state.elixir.earned -= amount;
    state.elixir.onChain += amount;
    const txHash = `0x${(ticketSeq++).toString(16).padStart(64, "0")}` as TxHash;
    return { status: "minted", txHash, amount };
  },

  async submitSpendProof(txHash: TxHash): Promise<ProofTicket> {
    await delay(200);
    const id = `ticket-${ticketSeq++}`;
    const ticket: ProofTicket = {
      id,
      txHash,
      status: "pending",
      reward: 100,
      barDelta: 8,
    };
    state.tickets.set(id, structuredClone(ticket));
    // Move from `pending` into the active lifecycle after a short "attestation".
    setTimeout(() => {
      const t = state.tickets.get(id);
      if (t && t.status === "pending") scheduleProofLifecycle(t);
    }, PROOF_STEP_MS);
    return structuredClone(ticket);
  },

  async getProofStatus(ticketId: string): Promise<ProofTicket> {
    await delay(80);
    const t = state.tickets.get(ticketId);
    if (!t) throw new Error(`Unknown proof ticket: ${ticketId}`);
    return structuredClone(t);
  },

  async getLoadout(): Promise<Loadout> {
    await delay(120);
    return structuredClone(state.loadout);
  },

  async listShops(): Promise<Shop[]> {
    await delay(150);
    return structuredClone(state.shops);
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await delay(150);
    return structuredClone(state.leaderboard);
  },

  async getSeason(): Promise<Season> {
    await delay(120);
    return structuredClone(state.season);
  },
};
