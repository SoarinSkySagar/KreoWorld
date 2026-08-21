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
  ForgeOption,
  InventoryItem,
  LeaderboardEntry,
  Loadout,
  MapAreaKey,
  Player,
  PresencePeer,
  ProofTicket,
  Season,
  Shop,
  TokenBalance,
  TowerState,
  World,
  WorldId,
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

  // --- Worlds & towers ---
  /**
   * Every world the deployment knows about, open or locked. A world is backed
   * by an AttestCoin-supported source chain, so in a real implementation this
   * derives from `getSupportedChains()` rather than a content list.
   */
  listWorlds(): Promise<World[]>;
  getCurrentWorld(): Promise<World>;
  /**
   * Move the character to another world. Level and armoury come along (they
   * live on Creditcoin); currency and tower progress do not — each world keeps
   * its own. Rejects worlds that are not `open`.
   */
  travelTo(worldId: WorldId): Promise<Player>;
  /** Tower progress for one world. Floors open by killing the floor boss. */
  getTower(worldId: WorldId): Promise<TowerState>;
  /**
   * Take the stair, up or down, in the current world.
   *
   * Down is always allowed to a floor already reached; up only as far as one
   * past the highest clear, because a floor opens by defeating its boss. Throws
   * rather than clamping — a stair that silently puts you somewhere else is
   * worse than one that says no.
   */
  moveToFloor(floor: number): Promise<TowerState>;
  /** Presence of other players in the caller's current world and floor. */
  getNearbyPlayers(): Promise<PresencePeer[]>;

  // --- Economy ---
  getElixirBalance(): Promise<ElixirBalance>;
  getTokenBalance(): Promise<TokenBalance>;
  /**
   * Batched "claim to chain": mint `amount` of earned elixir as a real Sepolia
   * token so it becomes spendable (mint-then-spend invariant). Moves value from
   * `earned` → `onChain`.
   */
  claimElixirToChain(amount: number): Promise<ClaimResult>;

  // --- The three provable loops ---
  /** What the current world's forge can make, and what each costs. */
  listForgeOptions(): Promise<ForgeOption[]>;
  /**
   * Forge a weapon in the current world: one player-signed source-chain tx that
   * burns the elixir and mints the NFT, then gets proven to Creditcoin. Returns
   * a ticket starting at `pending` — the weapon only enters the armoury when
   * the proof reaches `rewarded`. You do not get the weapon because the game
   * says so; you get it because a burn provably happened.
   */
  forgeWeapon(weaponType: string): Promise<ProofTicket>;
  /** Deposit real source-chain value, proven, credited as project token. */
  depositValue(amount: number): Promise<ProofTicket>;
  /**
   * Re-prove ownership of a weapon whose attestation has lapsed or is close to
   * lapsing. Until it resolves the weapon stays unusable.
   */
  reattestWeapon(weaponId: string): Promise<ProofTicket>;
  /** Poll the current state of a proof ticket. */
  getProofStatus(ticketId: string): Promise<ProofTicket>;
  /** Every ticket this session, newest first — drives the proof trail. */
  listProofTickets(): Promise<ProofTicket[]>;

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
   * Which enemies may appear in `area` on `floor`. Identity, stats and levels live behind
   * the seam so a real backend can own them; only the tiles they stand on are
   * client geometry.
   */
  getEncounterTable(area: MapAreaKey, floor: number): Promise<EnemySpec[]>;
  /**
   * The boss holding `floor`'s stair in the current world, or null if that floor
   * has none authored. Bosses are placed, never rolled — they are the only thing
   * that moves `floorsCleared`.
   */
  getFloorBoss(floor: number): Promise<EnemySpec | null>;
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
