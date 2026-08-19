/**
 * Seed data for the mock GameService. In-memory only — mutated by mock methods
 * during a session and reset on reload. None of these values are load-bearing;
 * reward numbers, bar tempo, etc. are explicitly deferred (BUILD_PLAN.md §Decide
 * -during-build). Kept here so tuning them never touches UI code.
 */

import { WEAPONS_BY_ID } from "@/game/combat/weapons";
import type {
  ElixirBalance,
  InventoryItem,
  LeaderboardEntry,
  Player,
  Season,
  Shop,
  TokenBalance,
  WeaponNFT,
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

/**
 * The starting arsenal. Characters have no innate powers — these five weapons
 * are the only reason the player can do anything in a fight, and the four
 * equipped ones are literally the four options under FIGHT.
 *
 * How weapons are first acquired is still deferred (CLAUDE.md §15), so for now
 * the player simply starts with a spread: one of each class role, so every
 * archetype is reachable without a shop existing yet.
 */
const startingWeapons: WeaponNFT[] = [
  "wpn-emberfang",
  "wpn-tidecleaver",
  "wpn-stonecleave",
  "wpn-zephyrrod",
  "wpn-deepfork",
  "wpn-pebblecast",
].map((id) => {
  const weapon = WEAPONS_BY_ID.get(id);
  if (!weapon) throw new Error(`Seed loadout references unknown weapon: ${id}`);
  return weapon;
});

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
    description: "Slows the drain while you are away from your universe.",
    count: 1,
    spriteKey: "item-charm",
    battleUse: { kind: "heal", amount: 90 },
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
