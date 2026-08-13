/**
 * Domain types for the AttestCoin open-world game.
 *
 * These describe the *shape* of game data as the UI consumes it. They are
 * deliberately transport-agnostic: nothing here says whether a value comes from
 * Postgres, a Creditcoin contract, or a source-chain proof. That split is a
 * backend-phase decision (see BUILD_PLAN.md §Phase 2). The UI only ever sees
 * these types via the GameService interface.
 */

export type Address = `0x${string}`;
export type TxHash = `0x${string}`;

// ---------------------------------------------------------------------------
// Player & world
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  /** Display handle. */
  name: string;
  /** The player's personal universe (lore: each player defends their own). */
  universeName: string;
  level: number;
  /** Optional connected source-chain wallet (source-chain tx only). */
  walletAddress: Address | null;
  avatarKey: string;
}

/**
 * The two persistent HUD bars.
 * - `storedProgress`: unspent, earned-but-not-yet-proven momentum (0..100).
 * - `universeHealth`: the world-health bar that only rises on proven spends and
 *   drains over time (0..100). See BUILD_PLAN.md — drain tempo is deferred.
 */
export interface WorldBar {
  storedProgress: number;
  universeHealth: number;
}

// ---------------------------------------------------------------------------
// Economy — two-token model (see CLAUDE.md §14)
// ---------------------------------------------------------------------------

/**
 * Elixir follows the mint-then-spend invariant: `earned` is free-to-play,
 * in-game momentum; `onChain` is the portion minted as a real Sepolia token and
 * therefore spendable/provable. On-chain balance is the source of truth.
 */
export interface ElixirBalance {
  /** Earned in-game, not yet claimed to chain (DB-side, not provable). */
  earned: number;
  /** Minted on Sepolia and spendable — the only balance a spend can draw from. */
  onChain: number;
}

/** Creditcoin-native in-game currency, credited by the ASC on a proven spend. */
export interface TokenBalance {
  projectToken: number;
}

// ---------------------------------------------------------------------------
// Identity — attack-loadout NFTs (source-chain owned)
// ---------------------------------------------------------------------------

export type Element = "fire" | "water" | "earth" | "air" | "void";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface AttackNFT {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  /** Contribution to the player's power when equipped. */
  power: number;
  /** Sprite/art key resolved by the frontend asset pipeline. */
  spriteKey: string;
}

export interface Loadout {
  maxSlots: number;
  /** Equipped attacks by slot; `null` is an empty slot. */
  slots: (AttackNFT | null)[];
  /** Owned-but-unequipped attacks. */
  bench: AttackNFT[];
}

// ---------------------------------------------------------------------------
// Shops (agent shopkeepers) & meta
// ---------------------------------------------------------------------------

export interface ShopItem {
  id: string;
  name: string;
  /** Price in project token. */
  price: number;
  spriteKey: string;
}

export interface Shop {
  id: string;
  name: string;
  /** Player-authored persona prompt driving the off-chain LLM shopkeeper. */
  keeperPersona: string;
  ownerId: string;
  items: ShopItem[];
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  universeName: string;
  score: number;
}

export interface Season {
  id: string;
  name: string;
  /** ISO timestamp when the season ends. */
  endsAt: string;
  carnivalActive: boolean;
}

// ---------------------------------------------------------------------------
// Proof lifecycle — the cross-chain readability loop
// ---------------------------------------------------------------------------

/**
 * Status of a claim (elixir minted to Sepolia). Batched "claim to chain" step.
 */
export type ClaimStatus = "submitting" | "minting" | "minted" | "failed";

export interface ClaimResult {
  status: ClaimStatus;
  /** Sepolia tx that minted the elixir, once available. */
  txHash: TxHash | null;
  /** Amount moved from `earned` to `onChain`. */
  amount: number;
  error?: string;
}

/**
 * Lifecycle of a spend proof, mirroring the real worker path:
 * source-chain spend → wait for attestation (minutes) → proof built → ASC
 * verifies & credits. The `pending` window is where attestation latency lives —
 * design the Pump UX around it (BUILD_PLAN.md §Phase 1.7).
 */
export type ProofStatus =
  | "pending" // waiting for source-chain attestation on Creditcoin
  | "proving" // proof builder generating merkle + continuity proofs
  | "verified" // ASC verified inclusion + receipt status
  | "rewarded" // business logic ran: bar advanced, project token credited
  | "failed";

export interface ProofTicket {
  id: string;
  /** The source-chain spend tx being proved. */
  txHash: TxHash;
  status: ProofStatus;
  /** Project token credited once `rewarded`. */
  reward: number;
  /** How much this spend advanced `universeHealth`, once `rewarded`. */
  barDelta: number;
  error?: string;
}
