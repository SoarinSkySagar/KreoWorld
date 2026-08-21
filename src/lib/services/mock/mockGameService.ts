/**
 * In-memory implementation of GameService for the frontend-first phase.
 *
 * It intentionally *simulates* the real system's shape so UI built against it
 * behaves correctly once the real backend lands:
 *  - every call is async with a little latency;
 *  - `claimElixirToChain` enforces mint-then-spend (moves earned → onChain);
 *  - the three provable loops (forge, deposit, re-attest) all return a ticket
 *    that advances through the real proof lifecycle over time
 *    (pending → proving → verified → rewarded), so the UX is designed against
 *    genuine attestation-style latency rather than an instant resolve;
 *  - currency and tower progress are held per world, because they never cross;
 *    the player, the armoury and the project token are global, because they
 *    live on Creditcoin.
 *
 * Nothing here is persisted; state resets on reload.
 */

import { ENEMIES, ENEMIES_BY_ID } from "@/game/combat/enemies";
import { BOSSES_BY_ID, bossForFloor, floorOfBoss } from "@/game/combat/bosses";
import { ENCOUNTER_MAPS } from "@/game/combat/encounters";
import { ATTESTATION_TTL_MS, mintWeapon } from "@/game/combat/weapons";
import { canReachFloor, getFloor } from "@/game/floors";
import type { GameService } from "../gameService";
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
  ProofStatus,
  ProofTicket,
  Season,
  Shop,
  TokenBalance,
  TowerState,
  TxHash,
  World,
  WorldId,
} from "../types";
import {
  seedElixir,
  seedForgeOptions,
  seedInventory,
  seedLeaderboard,
  seedLoadout,
  seedPeers,
  seedPlayer,
  seedSeason,
  seedShops,
  seedToken,
  seedTowers,
  seedWorlds,
  WORLD_FORGE_RATE,
} from "./mockData";

/** Areas that spawn enemies, as plain keys — the service never imports map types. */
const ENCOUNTER_AREAS: ReadonlySet<string> = ENCOUNTER_MAPS;

/** Share of *unbanked* elixir a loss costs. Minted balance is never touched. */
const LOSS_RATE = 0.25;

/** How much harder each floor above the first runs. */
const FLOOR_SCALING = 0.35;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** How long each mock proof stays in a given status (ms). Tuned short for dev;
 *  the real attestation wait is minutes — the UX must not assume this speed. */
const PROOF_STEP_MS = 2500;

/** Per-world state: currency and tower progress never cross worlds. */
interface WorldState {
  elixir: ElixirBalance;
  tower: TowerState;
}

// Mutable session state.
const state = {
  player: structuredClone(seedPlayer),
  worlds: structuredClone(seedWorlds),
  byWorld: Object.fromEntries(
    seedWorlds.map((w): [WorldId, WorldState] => [
      w.id,
      {
        // Only the home world starts with a balance; you arrive elsewhere broke.
        elixir:
          w.id === seedPlayer.worldId
            ? structuredClone(seedElixir)
            : { earned: 0, onChain: 0 },
        tower: structuredClone(seedTowers[w.id]),
      },
    ]),
  ) as Record<WorldId, WorldState>,
  // Creditcoin-native, so it follows the player across worlds.
  token: structuredClone(seedToken),
  // The armoury lives on Creditcoin: weapons travel because they were never in
  // a world to begin with.
  loadout: structuredClone(seedLoadout),
  inventory: structuredClone(seedInventory),
  forgeOptions: structuredClone(seedForgeOptions),
  peers: structuredClone(seedPeers),
  shops: structuredClone(seedShops),
  leaderboard: structuredClone(seedLeaderboard),
  season: structuredClone(seedSeason),
  tickets: new Map<string, ProofTicket>(),
};

let seq = 0;
const nextId = () => ++seq;

const here = (): WorldState => state.byWorld[state.player.worldId];
const worldById = (id: WorldId): World => {
  const w = state.worlds.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown world: ${id}`);
  return w;
};

/**
 * This world's forge sheet. Same catalogue everywhere — the worlds are meant to
 * be the same place twice — but each world prices its own metal, and what comes
 * out carries that world's origin (see ORIGIN_VARIANT).
 */
const forgeOptionsFor = (worldId: WorldId): ForgeOption[] => {
  const rate = WORLD_FORGE_RATE[worldId] ?? 1;
  return state.forgeOptions.map((o) => ({ ...o, cost: Math.round(o.cost * rate) }));
};

const fakeTxHash = (): TxHash =>
  `0x${nextId().toString(16).padStart(64, "0")}` as TxHash;

/** Every owned weapon, equipped or benched. The armoury is one collection. */
const allOwned = () => [
  ...state.loadout.slots.filter((w) => w !== null),
  ...state.loadout.bench,
];

/**
 * Drive a ticket forward on a timer, applying its credit on `rewarded`.
 *
 * The credit is applied *here*, at the end of the proof, and nowhere else —
 * that is the whole invariant: you do not get the weapon because the game said
 * so, you get it because a burn was proven.
 */
function scheduleProofLifecycle(ticket: ProofTicket, apply: () => void): void {
  const steps: ProofStatus[] = ["proving", "verified", "rewarded"];
  steps.forEach((status, i) => {
    setTimeout(() => {
      const t = state.tickets.get(ticket.id);
      if (!t || t.status === "failed") return;
      t.status = status;
      if (status === "rewarded") apply();
    }, PROOF_STEP_MS * (i + 1));
  });
}

/** Create a pending ticket and start it moving after a simulated attestation. */
function openTicket(worldId: WorldId, apply: (t: ProofTicket) => void): ProofTicket {
  const id = `ticket-${nextId()}`;
  const ticket: ProofTicket = {
    id,
    txHash: fakeTxHash(),
    status: "pending",
    worldId,
    credited: null,
  };
  state.tickets.set(id, ticket);
  setTimeout(() => {
    const t = state.tickets.get(id);
    if (t && t.status === "pending") scheduleProofLifecycle(t, () => apply(t));
  }, PROOF_STEP_MS);
  return structuredClone(ticket);
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

  async listWorlds(): Promise<World[]> {
    await delay(120);
    return structuredClone(state.worlds);
  },

  async getCurrentWorld(): Promise<World> {
    await delay(90);
    return structuredClone(worldById(state.player.worldId));
  },

  async travelTo(worldId: WorldId): Promise<Player> {
    await delay(400);
    const world = worldById(worldId);
    if (world.status !== "open") {
      throw new Error(`${world.name} is closed to travellers.`);
    }
    // Only the character moves. Currency and tower progress stay behind, which
    // is why they are keyed per world rather than held on the player.
    state.player.worldId = worldId;
    return structuredClone(state.player);
  },

  async getTower(worldId: WorldId): Promise<TowerState> {
    await delay(100);
    const ws = state.byWorld[worldId];
    if (!ws) throw new Error(`Unknown world: ${worldId}`);
    return structuredClone(ws.tower);
  },

  async moveToFloor(floor: number): Promise<TowerState> {
    await delay(260);
    const { tower } = here();
    if (floor === tower.currentFloor) return structuredClone(tower);
    if (!canReachFloor(floor, tower.floorsCleared, tower.totalFloors)) {
      // Say why rather than clamping: the stair is a real thing in the world and
      // a player is owed a reason it will not take them.
      throw new Error(
        floor > tower.currentFloor
          ? `Floor ${floor} is not open yet — clear Floor ${tower.floorsCleared + 1} first.`
          : `There is no Floor ${floor} beneath you.`,
      );
    }
    getFloor(floor); // throws if the floor was never authored
    tower.currentFloor = floor;
    return structuredClone(tower);
  },

  async getNearbyPlayers(): Promise<PresencePeer[]> {
    await delay(120);
    // Stubbed presence — real sync is a backend/integration concern. Scoped to
    // the current world: crossing over leaves the people behind.
    return structuredClone(state.peers[state.player.worldId] ?? []);
  },

  async getElixirBalance(): Promise<ElixirBalance> {
    await delay(120);
    return structuredClone(here().elixir);
  },

  async getTokenBalance(): Promise<TokenBalance> {
    await delay(120);
    return structuredClone(state.token);
  },

  async claimElixirToChain(amount: number): Promise<ClaimResult> {
    await delay(200);
    const { elixir } = here();
    if (amount <= 0 || amount > elixir.earned) {
      return { status: "failed", txHash: null, amount, error: "Insufficient earned elixir." };
    }
    // Simulate the mint landing on this world's chain: earned → onChain.
    await delay(600);
    elixir.earned -= amount;
    elixir.onChain += amount;
    return { status: "minted", txHash: fakeTxHash(), amount };
  },

  async listForgeOptions(): Promise<ForgeOption[]> {
    await delay(140);
    // A world can only issue weapons of its own origin, so this is scoped to
    // wherever the player is standing — including its prices, which are part of
    // what makes one forge worth the crossing and another not.
    return forgeOptionsFor(state.player.worldId);
  },

  async forgeWeapon(weaponType: string): Promise<ProofTicket> {
    await delay(220);
    const option = forgeOptionsFor(state.player.worldId).find((o) => o.weaponType === weaponType);
    if (!option) throw new Error(`This world's forge cannot make: ${weaponType}`);

    const worldId = state.player.worldId;
    const { elixir } = here();
    if (elixir.onChain < option.cost) {
      throw new Error(
        `Forging ${option.name} costs ${option.cost} on-chain elixir; you have ${elixir.onChain}. Claim more to chain first.`,
      );
    }

    // The burn happens now, in one source-chain transaction that also mints the
    // NFT. The weapon only reaches the armoury when that tx is proven.
    elixir.onChain -= option.cost;

    return openTicket(worldId, (t) => {
      const weapon = mintWeapon(
        weaponType,
        worldId,
        `owned-${nextId()}`,
        String(2000 + seq),
      );
      state.loadout.bench.push(weapon);
      t.credited = { kind: "weapon", weaponId: weapon.id, weaponName: weapon.name };
    });
  },

  async depositValue(amount: number): Promise<ProofTicket> {
    await delay(220);
    if (amount <= 0) throw new Error("Deposit must be greater than zero.");
    const credited = Math.round(amount * 100);
    return openTicket(state.player.worldId, (t) => {
      state.token.projectToken += credited;
      t.credited = { kind: "token", amount: credited };
    });
  },

  async reattestWeapon(weaponId: string): Promise<ProofTicket> {
    await delay(200);
    const weapon = allOwned().find((w) => w.id === weaponId);
    if (!weapon) throw new Error(`Not in your armoury: ${weaponId}`);
    return openTicket(weapon.originWorldId, (t) => {
      // Re-proving ownership resets the claim's clock. Until this lands the
      // weapon is unusable — an unproven holding has no provenance.
      const live = allOwned().find((w) => w.id === weaponId);
      if (live) {
        const now = Date.now();
        live.attestation = {
          lastProvenAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ATTESTATION_TTL_MS).toISOString(),
        };
      }
      t.credited = { kind: "attestation", weaponId, weaponName: weapon.name };
    });
  },

  async getProofStatus(ticketId: string): Promise<ProofTicket> {
    await delay(80);
    const t = state.tickets.get(ticketId);
    if (!t) throw new Error(`Unknown proof ticket: ${ticketId}`);
    return structuredClone(t);
  },

  async listProofTickets(): Promise<ProofTicket[]> {
    await delay(100);
    return structuredClone([...state.tickets.values()].reverse());
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

  async getEncounterTable(area: MapAreaKey, floor: number): Promise<EnemySpec[]> {
    await delay(90);
    // Any tier can turn up on any highway — the sprite is the only warning you
    // get. Higher floors run the same bestiary harder rather than a new one, so
    // adding a floor costs no content.
    if (!ENCOUNTER_AREAS.has(area)) return [];
    const scale = 1 + FLOOR_SCALING * Math.max(0, floor - 1);
    if (scale === 1) return structuredClone(ENEMIES);
    return ENEMIES.map((e) => ({
      ...structuredClone(e),
      level: Math.round(e.level * scale),
      maxHp: Math.round(e.maxHp * scale),
      attack: Math.round(e.attack * scale),
      defense: Math.round(e.defense * scale),
      elixirReward: Math.round(e.elixirReward * scale),
    }));
  },

  async getFloorBoss(floor: number): Promise<EnemySpec | null> {
    await delay(90);
    const boss = bossForFloor(floor);
    return boss ? structuredClone(boss) : null;
  },

  async resolveBattle(outcome: BattleOutcome): Promise<BattleReward> {
    await delay(200);
    const spec = ENEMIES_BY_ID.get(outcome.enemyId) ?? BOSSES_BY_ID.get(outcome.enemyId);
    if (!spec) throw new Error(`Unknown enemy: ${outcome.enemyId}`);
    const world = here();
    const { elixir } = world;

    // Whether this was a boss is decided here, from the enemy's identity — not
    // from a flag the client sent. The client reports what happened; the service
    // decides what it was worth (CLAUDE.md §12).
    const bossFloor = floorOfBoss(outcome.enemyId);
    if (bossFloor !== null && outcome.result === "won") {
      // The only place floorsCleared ever moves. Clearing a floor you had
      // already cleared cannot lower it, and it never reaches past the floor
      // actually fought on.
      world.tower.floorsCleared = Math.max(world.tower.floorsCleared, bossFloor);
      elixir.earned += spec.elixirReward;
      return {
        elixirEarned: spec.elixirReward,
        elixirLost: 0,
        message:
          `${spec.name} falls. The stair past Floor ${bossFloor} is yours. ` +
          `+${spec.elixirReward} elixir.`,
      };
    }

    if (outcome.result === "won") {
      // Wins pay into `earned` only — the unbanked side. Nothing here mints
      // on-chain value: a weapon still requires a proven burn (design spec §5),
      // and this is the input to that loop.
      const bonus = outcome.hpRemaining > 0 && outcome.turnsTaken <= 3 ? Math.round(spec.elixirReward * 0.2) : 0;
      elixir.earned += spec.elixirReward + bonus;
      return {
        elixirEarned: spec.elixirReward + bonus,
        elixirLost: 0,
        message: bonus > 0
          ? `${spec.name} falls. +${spec.elixirReward} elixir, +${bonus} for the clean kill.`
          : `${spec.name} falls. +${spec.elixirReward} elixir.`,
      };
    }

    if (outcome.result === "lost") {
      // A loss costs unbanked elixir only. Anything already minted on-chain is
      // real value the game has no business burning — bank it before you risk it.
      const lost = Math.floor(elixir.earned * LOSS_RATE);
      elixir.earned -= lost;
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
    return structuredClone(state.shops[state.player.worldId] ?? []);
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await delay(150);
    // Standings never pool across worlds — a climb here is worth nothing next door.
    return structuredClone(state.leaderboard[state.player.worldId] ?? []);
  },

  async getSeason(): Promise<Season> {
    await delay(120);
    return structuredClone(state.season);
  },
};
