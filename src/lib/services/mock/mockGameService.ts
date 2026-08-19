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

import { ENEMIES, ENEMIES_BY_ID } from "@/game/combat/enemies";
import { ENCOUNTER_MAPS } from "@/game/combat/encounters";
import type { GameService } from "../gameService";
import type {
  BattleOutcome,
  BattleReward,
  ClaimResult,
  ElixirBalance,
  EnemySpec,
  InventoryItem,
  LeaderboardEntry,
  Loadout,
  MapAreaKey,
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
  seedInventory,
  seedLeaderboard,
  seedLoadout,
  seedPlayer,
  seedSeason,
  seedShops,
  seedToken,
  seedWorldBar,
} from "./mockData";

/** Areas that spawn enemies, as plain keys — the service never imports map types. */
const ENCOUNTER_AREAS: ReadonlySet<string> = ENCOUNTER_MAPS;

/** Share of *unbanked* elixir a loss costs. Minted balance is never touched. */
const LOSS_RATE = 0.25;

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
  inventory: structuredClone(seedInventory),
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

  async connectWallet(): Promise<Player> {
    // Stands in for the wallet handshake; the real one prompts an extension.
    await delay(500);
    state.player.walletAddress = "0x8Ae4bC1f2D9e6a37C05B41f8dE2a7c9B3f014D6e";
    return structuredClone(state.player);
  },

  async disconnectWallet(): Promise<Player> {
    await delay(120);
    state.player.walletAddress = null;
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

  async equipWeapon(slotIndex: number, weaponId: string | null): Promise<Loadout> {
    await delay(140);
    const { loadout } = state;
    if (slotIndex < 0 || slotIndex >= loadout.maxSlots) {
      throw new Error(`No such loadout slot: ${slotIndex}`);
    }

    // Whatever is leaving the slot goes back to the bench, so nothing is ever
    // destroyed by a swap — these represent owned NFTs.
    const displaced = loadout.slots[slotIndex];
    if (displaced) loadout.bench.push(displaced);

    if (weaponId === null) {
      loadout.slots[slotIndex] = null;
      return structuredClone(loadout);
    }

    const benchIndex = loadout.bench.findIndex((w) => w.id === weaponId);
    if (benchIndex === -1) throw new Error(`Weapon not on the bench: ${weaponId}`);
    loadout.slots[slotIndex] = loadout.bench.splice(benchIndex, 1)[0];
    return structuredClone(loadout);
  },

  async getEncounterTable(area: MapAreaKey): Promise<EnemySpec[]> {
    await delay(90);
    // Any tier can turn up on any highway — the sprite is the only warning you
    // get. Keyed by area regardless, so a real backend can vary it later without
    // the caller changing.
    if (!ENCOUNTER_AREAS.has(area)) return [];
    return structuredClone(ENEMIES);
  },

  async resolveBattle(outcome: BattleOutcome): Promise<BattleReward> {
    await delay(200);
    const spec = ENEMIES_BY_ID.get(outcome.enemyId);
    if (!spec) throw new Error(`Unknown enemy: ${outcome.enemyId}`);

    if (outcome.result === "won") {
      // Wins pay into `earned` only — the unbanked side. Nothing here mints
      // on-chain value or moves the universe bar: progress still requires a
      // proven spend (CLAUDE.md §11), and this is the input to that loop.
      const bonus = outcome.hpRemaining > 0 && outcome.turnsTaken <= 3 ? Math.round(spec.elixirReward * 0.2) : 0;
      state.elixir.earned += spec.elixirReward + bonus;
      return {
        elixirEarned: spec.elixirReward + bonus,
        elixirLost: 0,
        message: bonus > 0
          ? `${spec.name} falls. +${spec.elixirReward} elixir, +${bonus} for the clean kill.`
          : `${spec.name} falls. +${spec.elixirReward} elixir.`,
      };
    }

    if (outcome.result === "lost") {
      // A loss costs unbanked elixir only. Anything already minted on Sepolia is
      // real value the game has no business burning — bank it before you risk it.
      const lost = Math.floor(state.elixir.earned * LOSS_RATE);
      state.elixir.earned -= lost;
      return {
        elixirEarned: 0,
        elixirLost: lost,
        message: lost > 0
          ? `${spec.name} takes ${lost} unbanked elixir off you. Your minted balance is untouched.`
          : `${spec.name} finds nothing unbanked to take.`,
      };
    }

    return { elixirEarned: 0, elixirLost: 0, message: "You break away down the road." };
  },

  async getInventory(): Promise<InventoryItem[]> {
    await delay(120);
    return structuredClone(state.inventory);
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
