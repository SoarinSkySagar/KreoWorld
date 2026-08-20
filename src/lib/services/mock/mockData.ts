/**
 * Seed data for the mock GameService. In-memory only — mutated by mock methods
 * during a session and reset on reload. None of these values are load-bearing;
 * reward numbers, bar tempo, etc. are explicitly deferred (BUILD_PLAN.md §Decide
 * -during-build). Kept here so tuning them never touches UI code.
 */

import { WEAPONS, WEAPONS_BY_ID, mintWeapon } from "@/game/combat/weapons";
import { TOP_FLOOR } from "@/game/floors";
import type {
  ElixirBalance,
  ForgeOption,
  InventoryItem,
  LeaderboardEntry,
  Player,
  PresencePeer,
  Season,
  Shop,
  TokenBalance,
  TowerState,
  WeaponNFT,
  World,
} from "../types";

/**
 * The world registry. A world is a supported source chain, so a real
 * implementation derives this from `getSupportedChains()` — never a hardcoded
 * content list (CLAUDE.md §4).
 *
 * Only Sepolia is open: the other supported testnet chain is Ethereum mainnet,
 * and opening it would mean players spending real value to play. It stays
 * visible and locked, which is honest about why rather than pretending it
 * doesn't exist.
 */
export const seedWorlds: World[] = [
  {
    id: "world-aleph",
    name: "Aleph",
    chainKey: 1,
    chainName: "Ethereum Sepolia",
    status: "open",
    currencySymbol: "ALX",
    tagline: "The first world to keep a ledger. Everything here can be witnessed.",
    contracts: {
      forge: "0xA1e9F0000000000000000000000000000000F0r6",
      elixir: "0xA1e9F0000000000000000000000000000000E11x",
      weapons: "0xA1e9F00000000000000000000000000000000Wp7",
    },
  },
  {
    id: "world-mainland",
    name: "The Mainland",
    chainKey: 1,
    chainName: "Ethereum Sepolia",
    status: "open",
    currencySymbol: "MNX",
    tagline: "Older and heavier. Its forge asks more and gives back harder metal.",
    contracts: {
      forge: "0xB2a7d0000000000000000000000000000000F0r6",
      elixir: "0xB2a7d0000000000000000000000000000000E11x",
      weapons: "0xB2a7d00000000000000000000000000000000Wp7",
    },
  },
];

/**
 * How dear this world's forge is. The Mainland charges more and, via
 * `ORIGIN_VARIANT`, returns a heavier weapon — that trade is the reason to make
 * the crossing rather than forging everything at home.
 */
export const WORLD_FORGE_RATE: Record<string, number> = {
  "world-aleph": 1,
  "world-mainland": 1.4,
};

/** Tower progress per world. Floors open by killing the floor boss, not by proof. */
export const seedTowers: Record<string, TowerState> = {
  "world-aleph": {
    worldId: "world-aleph",
    floorsCleared: 1,
    currentFloor: 1,
    totalFloors: TOP_FLOOR,
  },
  // A world you have never entered has cleared nothing. Progress does not travel.
  "world-mainland": {
    worldId: "world-mainland",
    floorsCleared: 0,
    currentFloor: 1,
    totalFloors: TOP_FLOOR,
  },
};

export const seedPlayer: Player = {
  id: "player-1",
  name: "Wanderer",
  worldId: "world-aleph",
  level: 7,
  walletAddress: null,
  avatarKey: "hero-default",
};

export const seedElixir: ElixirBalance = {
  earned: 1250,
  onChain: 300,
};

export const seedToken: TokenBalance = {
  projectToken: 880,
};

/**
 * The starting arsenal, treated as already forged and proven in the home world.
 *
 * Every weapon a player owns arrived through a proven forge burn — these are
 * simply the ones that predate this session, so they carry a Sepolia origin and
 * a fresh attestation. Nothing here bypasses the loop; it stands in for having
 * already run it.
 */
const startingWeapons: WeaponNFT[] = [
  "wpn-emberfang",
  "wpn-tidecleaver",
  "wpn-stonecleave",
  "wpn-zephyrrod",
  "wpn-deepfork",
  "wpn-pebblecast",
].map((typeId, i) => {
  if (!WEAPONS_BY_ID.has(typeId)) throw new Error(`Seed loadout references unknown weapon: ${typeId}`);
  return mintWeapon(typeId, "world-aleph", `owned-${i + 1}`, String(1000 + i));
});

/**
 * What the forge can make. Cost scales off rarity — the numbers are explicitly
 * deferred (BUILD_PLAN §Decide-during-build), so they live here and never in UI.
 */
const RARITY_COST: Record<string, number> = { common: 120, rare: 260, epic: 520, legendary: 900 };

export const seedForgeOptions: ForgeOption[] = WEAPONS.map((w) => ({
  weaponType: w.id,
  name: w.name,
  iconKey: w.iconKey,
  rarity: w.rarity,
  cost: RARITY_COST[w.rarity] ?? 200,
}));

/**
 * Stubbed presence so a world reads as multiplayer with no netcode behind it.
 *
 * Keyed by world because presence is the one thing that is emphatically not
 * shared: you see the people standing in the world you are standing in, and
 * crossing over means leaving them behind.
 */
export const seedPeers: Record<string, PresencePeer[]> = {
  "world-aleph": [
    { playerId: "player-4", name: "Ada", avatarKey: "alex", area: "town-main", col: 12, row: 9 },
    { playerId: "player-7", name: "Koto", avatarKey: "bob", area: "town-main", col: 18, row: 14 },
    { playerId: "player-9", name: "Vael", avatarKey: "amelia", area: "pump", col: 7, row: 6 },
  ],
  "world-mainland": [
    { playerId: "player-12", name: "Sabre", avatarKey: "bob", area: "town-main", col: 9, row: 11 },
    { playerId: "player-15", name: "Ilm", avatarKey: "amelia", area: "pump", col: 10, row: 5 },
  ],
};

export const seedLoadout = {
  maxSlots: 4,
  slots: [
    startingWeapons[0],
    startingWeapons[1],
    startingWeapons[3],
    null,
  ] as (WeaponNFT | null)[],
  bench: [startingWeapons[2], startingWeapons[4], startingWeapons[5]],
};

export const seedInventory: InventoryItem[] = [
  {
    id: "item-vial",
    name: "Elixir Vial",
    description: "Restores a little of what the corruption takes.",
    count: 3,
    spriteKey: "item-potion",
    battleUse: { kind: "heal", amount: 40 },
  },
  {
    id: "item-charm",
    name: "Ward Charm",
    description: "Steadies the hand. Mends what a bad road takes out of you.",
    count: 1,
    spriteKey: "item-charm",
    battleUse: { kind: "heal", amount: 90 },
  },
  {
    id: "item-riftstone",
    name: "Riftstone",
    description:
      "Anchor-cut, and warm. Hold it on the island and another world resolves around you.",
    count: 1,
    spriteKey: "item-shard",
    worldUse: { kind: "travel" },
    keyItem: true,
  },
  {
    id: "item-shard",
    name: "Attestation Shard",
    description: "A keepsake from your first proven forge.",
    count: 2,
    spriteKey: "item-shard",
  },
  {
    id: "item-map",
    name: "Torn Sea Map",
    description: "Marks the bridges to the island. Mostly water damage.",
    count: 1,
    spriteKey: "item-map",
  },
];

/**
 * Shops stand in a world, not in the game. A stall keeps its stock and its
 * keeper where it was built, so crossing over means a different high street.
 */
export const seedShops: Record<string, Shop[]> = {
  "world-aleph": [
    {
      id: "shop-embermart",
      name: "Ember Mart",
      ownerId: "player-1",
      keeperPersona:
        "A cheerful pyromancer merchant who speaks in warm metaphors and never stops recommending fire wares.",
      items: [
        { id: "item-potion", name: "Elixir Vial", price: 40, spriteKey: "item-potion" },
        { id: "item-charm", name: "Ward Charm", price: 120, spriteKey: "item-charm" },
      ],
    },
    {
      id: "shop-driftwood",
      name: "Driftwood Exchange",
      ownerId: "player-2",
      keeperPersona:
        "A laconic old sailor who trades relics and answers mostly in one-line proverbs about the tide.",
      items: [{ id: "item-map", name: "Torn Sea Map", price: 200, spriteKey: "item-map" }],
    },
  ],
  "world-mainland": [
    {
      id: "shop-longhaul",
      name: "Longhaul Supply",
      ownerId: "player-12",
      keeperPersona:
        "A blunt quartermaster who has seen every kind of traveller and expects you to know what you want.",
      items: [{ id: "item-potion", name: "Elixir Vial", price: 65, spriteKey: "item-potion" }],
    },
  ],
};

/**
 * Standings, per world. A climb in one world is worth nothing in the next, so
 * these are never pooled — that is the same rule the towers follow.
 */
export const seedLeaderboard: Record<string, LeaderboardEntry[]> = {
  "world-aleph": [
    { rank: 1, playerId: "player-9", playerName: "Vael", worldName: "Aleph", score: 9820 },
    { rank: 2, playerId: "player-4", playerName: "Ada", worldName: "Aleph", score: 8710 },
    { rank: 3, playerId: "player-1", playerName: "Wanderer", worldName: "Aleph", score: 8055 },
    { rank: 4, playerId: "player-7", playerName: "Koto", worldName: "Aleph", score: 7440 },
    { rank: 5, playerId: "player-2", playerName: "Mara", worldName: "Aleph", score: 6990 },
  ],
  "world-mainland": [
    { rank: 1, playerId: "player-12", playerName: "Sabre", worldName: "The Mainland", score: 4310 },
    { rank: 2, playerId: "player-15", playerName: "Ilm", worldName: "The Mainland", score: 3880 },
    { rank: 3, playerId: "player-21", playerName: "Doryn", worldName: "The Mainland", score: 2140 },
  ],
};

export const seedSeason: Season = {
  id: "season-1",
  name: "Season of the Corrupted Elixir",
  endsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  carnivalActive: false,
};
