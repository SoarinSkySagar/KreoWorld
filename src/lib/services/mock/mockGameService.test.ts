import { describe, expect, it } from "vitest";
import { mockGameService as svc } from "./mockGameService";
import { ORIGIN_VARIANT } from "@/game/combat/weapons";

/**
 * Cross-world separation.
 *
 * The two worlds are deliberately the same place twice — same maps, same floors,
 * same weapon catalogue. That makes it very easy for something that is supposed
 * to be per-world to quietly become shared, and almost impossible to notice by
 * playing. These tests pin down exactly which side of the line each thing is on.
 *
 * Travels with the player (lives on Creditcoin): character, level, armoury,
 * project token. Stays behind (lives in the world): currency, tower progress,
 * standings, shops, presence.
 */
describe("cross-world separation", () => {
  const ALEPH = "world-aleph";
  const MAINLAND = "world-mainland";

  it("lists both worlds as open and distinct", async () => {
    const worlds = await svc.listWorlds();
    expect(worlds.map((w) => w.id)).toEqual([ALEPH, MAINLAND]);
    expect(worlds.every((w) => w.status === "open")).toBe(true);

    // Same chain in the demo config, so identity has to come from the contracts.
    // If these ever collide, one world's forge would accept the other's elixir.
    const [a, b] = worlds;
    expect(a.contracts.forge).not.toBe(b.contracts.forge);
    expect(a.contracts.elixir).not.toBe(b.contracts.elixir);
    expect(a.currencySymbol).not.toBe(b.currencySymbol);
  });

  it("keeps currency, tower progress, standings, shops and presence per world", async () => {
    // Start at home with a balance and a cleared floor.
    const homeElixir = await svc.getElixirBalance();
    const homeTower = await svc.getTower(ALEPH);
    const homeBoard = await svc.getLeaderboard();
    const homeShops = await svc.listShops();
    const homePeers = await svc.getNearbyPlayers();
    expect(homeElixir.onChain).toBeGreaterThan(0);
    expect(homeTower.floorsCleared).toBe(1);

    // What the player carries across.
    const armouryBefore = await svc.getLoadout();
    const tokenBefore = await svc.getTokenBalance();
    const levelBefore = (await svc.getPlayer()).level;

    await svc.travelTo(MAINLAND);
    expect((await svc.getPlayer()).worldId).toBe(MAINLAND);

    // --- left behind ---
    const awayElixir = await svc.getElixirBalance();
    expect(awayElixir).toEqual({ earned: 0, onChain: 0 });
    expect((await svc.getTower(MAINLAND)).floorsCleared).toBe(0);
    expect(await svc.getLeaderboard()).not.toEqual(homeBoard);
    expect(await svc.listShops()).not.toEqual(homeShops);
    expect(await svc.getNearbyPlayers()).not.toEqual(homePeers);

    // --- carried across ---
    expect(await svc.getLoadout()).toEqual(armouryBefore);
    expect(await svc.getTokenBalance()).toEqual(tokenBefore);
    expect((await svc.getPlayer()).level).toBe(levelBefore);

    // Going home finds the balance and the climb exactly where they were left.
    await svc.travelTo(ALEPH);
    expect(await svc.getElixirBalance()).toEqual(homeElixir);
    expect((await svc.getTower(ALEPH)).floorsCleared).toBe(homeTower.floorsCleared);
  }, 20_000);

  it("prices each world's forge in its own currency", async () => {
    const atHome = await svc.listForgeOptions();
    await svc.travelTo(MAINLAND);
    const away = await svc.listForgeOptions();
    await svc.travelTo(ALEPH);

    // Same catalogue in both worlds — the worlds are the same place twice.
    expect(away.map((o) => o.weaponType)).toEqual(atHome.map((o) => o.weaponType));
    // But not the same price, or there would be no reason to cross.
    expect(away[0].cost).toBeGreaterThan(atHome[0].cost);
  }, 20_000);

  it("refuses to forge with a balance the world does not recognise", async () => {
    await svc.travelTo(MAINLAND);
    const options = await svc.listForgeOptions();
    // The player is rich at home and broke here. A forge that accepted the other
    // world's elixir would make the whole per-world economy decorative.
    await expect(svc.forgeWeapon(options[0].weaponType)).rejects.toThrow(/on-chain elixir/);
    await svc.travelTo(ALEPH);
  }, 20_000);

  it("gives every world an origin variant, so no weapon is forged unattributed", async () => {
    const worlds = await svc.listWorlds();
    for (const w of worlds) {
      expect(ORIGIN_VARIANT[w.id], `no origin variant for ${w.id}`).toBeDefined();
    }
  });
});

/**
 * The stair, both ways.
 *
 * Floors share map files, so nothing on screen distinguishes floor 1 from floor
 * 2 — which makes it very easy for the stair to appear to work while actually
 * moving nothing. These tests assert on tower state rather than on the scene.
 */
describe("the stair", () => {
  const ALEPH = "world-aleph";
  const MAINLAND = "world-mainland";

  it("climbs and descends within the cleared frontier", async () => {
    expect((await svc.getTower(ALEPH)).currentFloor).toBe(1);

    // Aleph has one floor cleared, so floor 2 is the frontier and reachable.
    expect((await svc.moveToFloor(2)).currentFloor).toBe(2);
    // And back down again — the way you came is never shut behind you.
    expect((await svc.moveToFloor(1)).currentFloor).toBe(1);
  }, 20_000);

  it("refuses to climb past the highest clear, and says why", async () => {
    await svc.travelTo(MAINLAND);
    // Nothing cleared here, so the stair up is held by floor 1's boss.
    await expect(svc.moveToFloor(2)).rejects.toThrow(/not open yet/);
    expect((await svc.getTower(MAINLAND)).currentFloor).toBe(1);
    await svc.travelTo(ALEPH);
  }, 20_000);

  it("refuses to descend below the bottom", async () => {
    await expect(svc.moveToFloor(0)).rejects.toThrow(/no Floor 0/i);
    expect((await svc.getTower(ALEPH)).currentFloor).toBe(1);
  }, 20_000);

  it("keeps the floor you are on per world", async () => {
    await svc.moveToFloor(2);
    await svc.travelTo(MAINLAND);
    // The Mainland has its own tower; arriving there does not put you on floor 2.
    expect((await svc.getTower(MAINLAND)).currentFloor).toBe(1);
    await svc.travelTo(ALEPH);
    expect((await svc.getTower(ALEPH)).currentFloor).toBe(2);
    await svc.moveToFloor(1);
  }, 20_000);
});

/**
 * Floor bosses.
 *
 * `floorsCleared` has exactly one writer — a boss win — and everything about the
 * climb hangs off it. These run last in the file because they are the only tests
 * that move it, and the ones above assert on its seeded values.
 */
describe("floor bosses", () => {
  const ALEPH = "world-aleph";
  const MAINLAND = "world-mainland";

  it("keeps bosses out of the random encounter table", async () => {
    // A boss is walked up to, never stumbled into on a road.
    const boss = await svc.getFloorBoss(1);
    expect(boss).not.toBeNull();
    const table = await svc.getEncounterTable("road-west", 1);
    expect(table.some((e) => e.id === boss!.id)).toBe(false);
    expect(table.every((e) => e.spawnWeight > 0)).toBe(true);
  });

  it("has no boss on a floor that was never authored", async () => {
    expect(await svc.getFloorBoss(3)).toBeNull();
  });

  it("does not clear a floor on a loss, or on an ordinary win", async () => {
    await svc.travelTo(MAINLAND);
    const boss = (await svc.getFloorBoss(1))!;

    await svc.resolveBattle({ enemyId: boss.id, result: "lost", hpRemaining: 0, turnsTaken: 9 });
    expect((await svc.getTower(MAINLAND)).floorsCleared).toBe(0);

    await svc.resolveBattle({
      enemyId: "enemy-cinderchick",
      result: "won",
      hpRemaining: 40,
      turnsTaken: 4,
    });
    expect((await svc.getTower(MAINLAND)).floorsCleared).toBe(0);
    await svc.travelTo(ALEPH);
  }, 20_000);

  it("clears the floor on a boss win, and only in the world it was fought in", async () => {
    const alephBefore = (await svc.getTower(ALEPH)).floorsCleared;

    await svc.travelTo(MAINLAND);
    // Before: the stair up is held, so floor 2 is out of reach here.
    await expect(svc.moveToFloor(2)).rejects.toThrow(/not open yet/);

    const boss = (await svc.getFloorBoss(1))!;
    const reward = await svc.resolveBattle({
      enemyId: boss.id,
      result: "won",
      hpRemaining: 30,
      turnsTaken: 11,
    });
    expect(reward.elixirEarned).toBeGreaterThan(0);
    expect((await svc.getTower(MAINLAND)).floorsCleared).toBe(1);

    // After: the same stair now takes you.
    expect((await svc.moveToFloor(2)).currentFloor).toBe(2);
    await svc.moveToFloor(1);

    // The other world is untouched — a clear is not a passport.
    await svc.travelTo(ALEPH);
    expect((await svc.getTower(ALEPH)).floorsCleared).toBe(alephBefore);
  }, 20_000);
});
