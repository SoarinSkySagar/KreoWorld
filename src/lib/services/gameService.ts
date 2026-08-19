/**
 * The GameService interface — the spine of the whole build (BUILD_PLAN.md §"The
 * one rule"). Every UI component talks to this and NEVER assumes where the data
 * comes from.
 *
 * - Phase 1 (now): the only implementation is the in-memory mock.
 * - Phase 2: real implementations back each method (Postgres / Creditcoin
 *   contract / source-chain proof) — the split decision is made then.
 * - Phase 3: swap the mock for the real impl at `services/index.ts`. Ideally one
 *   line, not a rewrite.
 *
 * Every method is async and returns a Promise, mirroring real network/chain
 * latency so call sites don't change when the backing implementation does.
 */

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
  ProofTicket,
  Season,
  Shop,
  TokenBalance,
  TxHash,
  WorldBar,
} from "./types";

export interface GameService {
  // --- Player & world ---
  getPlayer(): Promise<Player>;
  /**
   * Attach a source-chain wallet. It only ever signs source-chain transactions —
   * nothing on Creditcoin is signed by the player (CLAUDE.md §9).
   */
  connectWallet(): Promise<Player>;
  disconnectWallet(): Promise<Player>;
  getWorldBar(): Promise<WorldBar>;
  /** Convenience read of the stored-progress bar alone. */
  getStoredProgress(): Promise<number>;

  // --- Economy ---
  getElixirBalance(): Promise<ElixirBalance>;
  getTokenBalance(): Promise<TokenBalance>;
  /**
   * Batched "claim to chain": mint `amount` of earned elixir as a real Sepolia
   * token so it becomes spendable (mint-then-spend invariant). Moves value from
   * `earned` → `onChain`.
   */
  claimElixirToChain(amount: number): Promise<ClaimResult>;
  /**
   * Submit a source-chain spend tx hash to be proven. Returns a ticket whose
   * status starts at `pending`; poll `getProofStatus` to watch it advance
   * through the attestation → proof → verify → reward lifecycle.
   */
  submitSpendProof(txHash: TxHash): Promise<ProofTicket>;
  /** Poll the current state of a proof ticket. */
  getProofStatus(ticketId: string): Promise<ProofTicket>;

  // --- Identity ---
  getLoadout(): Promise<Loadout>;
  /**
   * Equip `weaponId` into `slotIndex`, or pass `null` to clear the slot and
   * return whatever was there to the bench. Returns the resulting loadout so the
   * caller never has to reconstruct it locally.
   *
   * The four equipped weapons are also the four moves available in battle, so
   * this call is the moveset editor as much as it is the stat screen.
   */
  equipWeapon(slotIndex: number, weaponId: string | null): Promise<Loadout>;

  // --- Combat ---
  /**
   * Which enemies may appear in `area`. Identity, stats and levels live behind
   * the seam so a real backend can own them; only the tiles they stand on are
   * client geometry.
   */
  getEncounterTable(area: MapAreaKey): Promise<EnemySpec[]>;
  /**
   * Settle a finished battle. The client reports *what happened*; the service
   * decides what it paid or cost. A client-computed reward is never accepted
   * (CLAUDE.md §12 — the client is never trusted).
   */
  resolveBattle(outcome: BattleOutcome): Promise<BattleReward>;

  // --- Inventory ---
  getInventory(): Promise<InventoryItem[]>;

  // --- Shops & meta ---
  listShops(): Promise<Shop[]>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getSeason(): Promise<Season>;
}
