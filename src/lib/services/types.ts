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
// Worlds — a world IS a supported source chain (design spec §2)
// ---------------------------------------------------------------------------

/** Identifies one game world. */
export type WorldId = string;

/**
 * A world is backed by an AttestCoin-supported source chain: its currency and
 * its weapon NFTs live on that chain, and only proofs from that chain can
 * credit anything into it.
 *
 * The registry is resolved at runtime from the protocol's supported-chain list
 * — never hardcoded (CLAUDE.md §4: chainKey is NOT the EVM chainId).
 */
export interface World {
  id: WorldId;
  name: string;
  /** Creditcoin-internal key of the backing source chain. Not the EVM chainId. */
  chainKey: number;
  /** Human label for the backing chain, e.g. "Ethereum Sepolia". */
  chainName: string;
  /**
   * `locked` worlds are real and addressable but closed to players — a chain the
   * protocol supports that the deployment does not open (e.g. one that would
   * cost mainnet value to play).
   */
  status: "open" | "locked";
  /** Ticker of this world's own elixir ERC20. Each world issues its own. */
  currencySymbol: string;
  /** One line shown on the world-select screen. */
  tagline: string;
  /**
   * This world's own contracts on its backing chain.
   *
   * Two worlds may share a `chainKey` — on testnet they must, since Sepolia is
   * the only chain players can transact on freely. So a world's identity is the
   * contract set, not the chain alone, and cross-world separation comes from
   * the forge: **a world's forge accepts only its own elixir**. That holds
   * whoever holds the tokens, which chain separation alone would not.
   */
  contracts: {
    forge: Address;
    elixir: Address;
    weapons: Address;
  };
}

/**
 * Progress up one world's tower. Floors open by defeating the floor boss — no
 * proof is involved, so attestation latency never touches a fight.
 */
export interface TowerState {
  worldId: WorldId;
  /** Highest floor whose boss has fallen here. 0 = none cleared. */
  floorsCleared: number;
  /** Floor the player currently occupies. */
  currentFloor: number;
  /** Floors authored for this world. */
  totalFloors: number;
}

/** Another player visible in the same world and floor. Presentation only. */
export interface PresencePeer {
  playerId: string;
  name: string;
  avatarKey: string;
  area: MapAreaKey;
  col: number;
  row: number;
}

// ---------------------------------------------------------------------------
// Player & world
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  /** Display handle. */
  name: string;
  /** World the player currently occupies. Characters cross worlds; progress does not. */
  worldId: WorldId;
  /** Cross-world: the character lives on Creditcoin, so level follows the player. */
  level: number;
  /** Optional connected source-chain wallet (source-chain tx only). */
  walletAddress: Address | null;
  avatarKey: string;
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

/**
 * A weapon *design* in the catalogue — not an owned item. Worlds forge from
 * these; what a player owns is a `WeaponNFT` instance of one.
 */
export interface WeaponType {
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

/**
 * Freshness of the armoury's claim on a weapon.
 *
 * Ownership is proven once at the forge and cached on Creditcoin, which goes
 * stale if the NFT is later sold on its origin chain. Re-attestation closes
 * that: a lapsed claim is unusable until re-proven. Lore-wise an unproven
 * holding has no provenance, which is exactly what defines The Rescinded.
 */
export interface Attestation {
  /** ISO timestamp of the last proven ownership check. */
  lastProvenAt: string;
  /** ISO timestamp after which the claim lapses and the weapon cannot be used. */
  expiresAt: string;
}

/**
 * An owned weapon: a catalogue type forged in a specific world.
 *
 * The NFT itself never moves — it stays minted on its origin world's chain
 * forever. What travels with the player is this armoury entry, which lives on
 * Creditcoin and is therefore identical in every world. `originWorldId` is not
 * written metadata; it is which chain the crediting proof came from, so a
 * weapon's provenance is inseparable from the evidence it exists.
 */
export interface WeaponNFT extends Omit<WeaponType, "id"> {
  /** Unique id of this owned instance. Two forges of one type are two weapons. */
  id: string;
  /** Catalogue type this was forged from. */
  typeId: string;
  /** NFT tokenId on the origin world's chain. */
  tokenId: string;
  /** World that forged it. Determines its ability variant. */
  originWorldId: WorldId;
  attestation: Attestation;
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
  /**
   * Set on items usable from BAG out in the world.
   *
   * `travel` is the only way between worlds — there is no menu command for it.
   * Crossing is a thing you carry, which is why it reads as an object with a
   * history rather than a UI affordance.
   */
  worldUse?: { kind: "travel" };
  /** Key items are never consumed. Spending the only way home would strand you. */
  keyItem?: boolean;
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
  /** World the entry was scored in. Standings are per-world. */
  worldName: string;
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
 * design the forge UX around it (BUILD_PLAN.md §Phase 1.7).
 */
export type ProofStatus =
  | "pending" // waiting for source-chain attestation on Creditcoin
  | "proving" // proof builder generating merkle + continuity proofs
  | "verified" // ASC verified inclusion + receipt status
  | "rewarded" // business logic ran: bar advanced, project token credited
  | "failed";

/**
 * What a proof granted once it reached `rewarded`. Three loops feed the same
 * ladder, so the payload is a union rather than a number:
 * - `weapon`      — a forge burn: the weapon is now in the armoury.
 * - `token`       — a deposit on-ramp: project token credited.
 * - `attestation` — ownership re-proven: the claim's clock is reset.
 */
export type ProofCredit =
  | { kind: "weapon"; weaponId: string; weaponName: string }
  | { kind: "token"; amount: number }
  | { kind: "attestation"; weaponId: string; weaponName: string };

export interface ProofTicket {
  id: string;
  /** The source-chain tx being proved. */
  txHash: TxHash;
  status: ProofStatus;
  /** World whose chain the tx happened on. Only its own world can be credited. */
  worldId: WorldId;
  /** What the proof granted, once `rewarded`. Null until then. */
  credited: ProofCredit | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// The three provable loops (design spec §5)
// ---------------------------------------------------------------------------

/**
 * A weapon a world's forge can make. Forging is one player-signed transaction
 * that burns the elixir and mints the NFT together — there is no window where
 * the player has paid and owns nothing.
 */
export interface ForgeOption {
  /** Catalogue type id (`WeaponType.id`). */
  weaponType: string;
  name: string;
  iconKey: string;
  rarity: Rarity;
  /** Elixir burned to forge it, in this world's currency. */
  cost: number;
}
