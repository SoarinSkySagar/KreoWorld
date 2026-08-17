/**
 * Seed data for the mock GameService. In-memory only — mutated by mock methods
 * during a session and reset on reload. None of these values are load-bearing;
 * reward numbers, bar tempo, etc. are explicitly deferred (BUILD_PLAN.md §Decide
 * -during-build). Kept here so tuning them never touches UI code.
 */

import type {
  AttackNFT,
  ElixirBalance,
  InventoryItem,
  LeaderboardEntry,
  Player,
  Season,
  Shop,
  TokenBalance,
  WorldBar,
} from "../types";

export const seedPlayer: Player = {
  id: "player-1",
  name: "Wanderer",
  universeName: "Aleph-Null",
  level: 7,
  walletAddress: null,
  avatarKey: "hero-default",
};

export const seedWorldBar: WorldBar = {
  storedProgress: 42,
  universeHealth: 63,
};

export const seedElixir: ElixirBalance = {
  earned: 1250,
  onChain: 300,
};

export const seedToken: TokenBalance = {
  projectToken: 880,
};

const attacks: AttackNFT[] = [
  { id: "atk-ember", name: "Ember Lash", element: "fire", rarity: "rare", power: 34, spriteKey: "atk-ember" },
  { id: "atk-tide", name: "Tidecaller", element: "water", rarity: "epic", power: 51, spriteKey: "atk-tide" },
  { id: "atk-quake", name: "Fault Line", element: "earth", rarity: "common", power: 18, spriteKey: "atk-quake" },
  { id: "atk-gale", name: "Cutting Gale", element: "air", rarity: "rare", power: 29, spriteKey: "atk-gale" },
  { id: "atk-null", name: "Null Rift", element: "void", rarity: "legendary", power: 77, spriteKey: "atk-null" },
];

export const seedLoadout = {
  maxSlots: 4,
  slots: [attacks[1], attacks[0], null, null] as (AttackNFT | null)[],
  bench: [attacks[2], attacks[3], attacks[4]],
};

export const seedInventory: InventoryItem[] = [
  {
    id: "item-vial",
    name: "Elixir Vial",
    description: "Restores a little of what the corruption takes.",
    count: 3,
    spriteKey: "item-potion",
  },
  {
    id: "item-charm",
    name: "Ward Charm",
    description: "Slows the drain while you are away from your universe.",
    count: 1,
    spriteKey: "item-charm",
  },
  {
    id: "item-shard",
    name: "Attestation Shard",
    description: "A keepsake from your first proven spend.",
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

export const seedShops: Shop[] = [
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
];

export const seedLeaderboard: LeaderboardEntry[] = [
  { rank: 1, playerId: "player-9", playerName: "Vael", universeName: "Ninth Spiral", score: 9820 },
  { rank: 2, playerId: "player-4", playerName: "Ada", universeName: "Loom", score: 8710 },
  { rank: 3, playerId: "player-1", playerName: "Wanderer", universeName: "Aleph-Null", score: 8055 },
  { rank: 4, playerId: "player-7", playerName: "Koto", universeName: "Emberfall", score: 7440 },
  { rank: 5, playerId: "player-2", playerName: "Mara", universeName: "Driftwaste", score: 6990 },
];

export const seedSeason: Season = {
  id: "season-1",
  name: "Season of the Corrupted Elixir",
  endsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  carnivalActive: false,
};
