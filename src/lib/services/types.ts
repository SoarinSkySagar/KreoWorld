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

/**
 * Identifies one area of the world ("road-west", "town-main"). Kept as a plain
 * string rather than importing the Phaser map union: this layer must not depend
 * on the rendering engine, and a real backend will key areas the same way.
 */
export type MapAreaKey = string;

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
// Identity — weapon-loadout NFTs (source-chain owned)
// ---------------------------------------------------------------------------

/**
 * Characters have no innate powers. Everything a player can do in a fight comes
 * from a weapon they own, so the loadout IS the moveset: the four equipped
 * weapons are the four options under FIGHT.
 */
export type Element = "fire" | "water" | "earth" | "air" | "void";
export type Rarity = "common" | "rare" | "epic" | "legendary";

/**
 * Class decides a weapon's *role* — its stat curve and which ability archetypes
 * it can carry. Element decides effectiveness (see `ELEMENT_BEATS`). Two axes,
 * but only one of them is a multiplier, so damage stays readable.
 */
export type WeaponClass = "sword" | "axe" | "staff" | "trident" | "fan" | "slingshot";

/** The extra thing an ability does beyond raw damage — the "unique" in unique ability. */
export type AbilityEffect =
  /** Heal the attacker for `ratio` of the damage dealt. */
  | { kind: "drain"; ratio: number }
  /** Damage over time on the defender. */
  | { kind: "bleed"; damage: number; turns: number }
  /** Cut damage the attacker takes on the opponent's next turn by `amount` (0..1). */
  | { kind: "guard"; amount: number }
  /** Scale the defender's attack by `factor` (<1) for `turns`. */
  | { kind: "weaken"; factor: number; turns: number }
  /** Split the hit into `hits` smaller ones, each rolled separately. */
  | { kind: "multi"; hits: number }
  /** Ignore elemental resistance (never resolves below x1). */
  | { kind: "pierce" };

export interface WeaponAbility {
  id: string;
  name: string;
  /** One line, shown in the loadout screen and when the ability fires. */
  description: string;
  /** Base power feeding the damage formula. */
  power: number;
  /** 0..100. Rolled before damage; a miss still costs the turn. */
  accuracy: number;
  /** Times it can be used per battle (PP). Refreshed each encounter. */
  uses: number;
  effect?: AbilityEffect;
}

export interface WeaponNFT {
  id: string;
  name: string;
  weaponClass: WeaponClass;
  element: Element;
  rarity: Rarity;
  /** Static contribution to the wielder's attack stat while equipped. */
  attack: number;
  /** The one ability this weapon grants. Equipping it is what adds the move. */
  ability: WeaponAbility;
  /** Sprite key resolved by the frontend asset pipeline (public/assets/weapons). */
  iconKey: string;
}

export interface Loadout {
  maxSlots: number;
  /** Equipped weapons by slot; `null` is an empty slot. Also the battle moveset. */
  slots: (WeaponNFT | null)[];
  /** Owned-but-unequipped weapons. */
  bench: WeaponNFT[];
}

// ---------------------------------------------------------------------------
// Combat — enemies, encounters, and battle outcomes
// ---------------------------------------------------------------------------

/**
 * Which side of the world an enemy belongs to. Both fight the same way; the
 * split is lore and presentation (see `EnemySpec.title`).
 * - `rescinded`: the evil order — humanoid, armed, one livery.
 * - `blightspawn`: elixir-corrupted fauna the Rescinded herd onto the roads.
 */
export type EnemyFaction = "rescinded" | "blightspawn";

/**
 * One enemy the player can meet. Stats and identity come through the service so
 * a real backend can own them later; only where it stands on the map is client
 * geometry.
 */
export interface EnemySpec {
  id: string;
  name: string;
  /** Rank or epithet shown under the name in battle ("Rescinded Marshal"). */
  title: string;
  faction: EnemyFaction;
  /** Texture key under public/assets/battlers. */
  spriteKey: string;
  element: Element;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  /** What it attacks with. Rescinded carry real weapons; blightspawn have innate ones. */
  abilities: WeaponAbility[];
  /** Elixir awarded on a win. */
  elixirReward: number;
  /**
   * Relative likelihood of this enemy being rolled. Any enemy can appear on any
   * highway — the sprite is your only warning — but a warlord turning up as
   * often as a chick would make the roads a lottery, so the heavies are rare.
   */
  spawnWeight: number;
  /** One line spoken when the encounter opens. */
  taunt: string;
}

/** How a battle ended, as reported by the battle scene. */
export type BattleResultKind = "won" | "lost" | "fled";

export interface BattleOutcome {
  enemyId: string;
  result: BattleResultKind;
  /** Player HP remaining, for flavour and future scoring. */
  hpRemaining: number;
  turnsTaken: number;
}

/**
 * What the battle actually cost or paid. The client reports the outcome; the
 * service decides the numbers — it never accepts a reward the client computed
 * (CLAUDE.md §12: the client is never trusted).
 */
export interface BattleReward {
  /** Added to `elixir.earned` — the unbanked side. Never mints on-chain value. */
  elixirEarned: number;
  /** Deducted from `elixir.earned` on a loss. Never touches `onChain`. */
  elixirLost: number;
  /** One line summarising the settlement, shown on the result screen. */
  message: string;
}

// ---------------------------------------------------------------------------
// Inventory — consumables and keepsakes the player carries
// ---------------------------------------------------------------------------

/**
 * Carried items. Unlike weapon NFTs these are ordinary game state, not
 * source-chain identity — which is exactly why the split lives behind
 * GameService and not in the UI.
 */
export interface InventoryItem {
  id: string;
  name: string;
  /** One line on what it does, shown beneath the name. */
  description: string;
  count: number;
  spriteKey: string;
  /** Set on items usable from BAG during a fight; absent means it is not usable there. */
  battleUse?: { kind: "heal"; amount: number };
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
