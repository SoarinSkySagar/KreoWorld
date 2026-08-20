# Tower Worlds — design

**Date:** 2026-08-20
**Status:** approved in brainstorm, not yet implemented
**Supersedes:** CLAUDE.md §10 (multiverse framing), §11 (progression gate), §14 (two-token economy details)

Reframes the game from "each player defends their own universe" to an SAO-style
floor-climbing MMORPG across chain-backed worlds. Combat, encounters, maps and HUD
are unchanged. What changes is the world model, progression, and where AttestCoin
sits.

---

## 1. Verified protocol constraints

Everything below was checked against live docs on 2026-08-20, not assumed.

**Supported source chains** (`docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments.md`):

| Environment | Chain | chainKey |
|---|---|---|
| CC3 Testnet | Ethereum Sepolia | 1 |
| CC3 Testnet | Ethereum Mainnet | 3 |
| CC3 Mainnet | Ethereum Mainnet | 1 |

EVM only. No Bitcoin, no Solana — not supported, not listed as planned. Decoding is
`EvmV1Decoder` / `EncodingVersion.V1`, so a non-EVM chain is a protocol-level
encoding change, not a config entry.

**Readability is what ships today.** AttestCoin is transaction-inclusion proving, not
message passing. There is no send side: the source chain emits an ordinary event, and
a contract on Creditcoin later proves that transaction was included in a block belonging
to an attested chain, then decodes the receipt itself.

**Writability is not available.** Verbatim from the spec:

> "Writability is undergoing 3rd party testing and audits. Once the writability feature
> is mature and released on Creditcoin testnet, additional details will be available."

Not on testnet, not on mainnet, no SDK, no precompile. Its designed mechanism, for the
roadmap section: outbox → attestor signatures → ⅔+1 quorum → relayer delivery → inbox
contract validates and routes. Nothing in this design depends on it.

**Two rules that follow, and constrain everything below:**

1. **The precompile proves inclusion, not success.** The ASC must check `status == 1`.
2. **Only player-signed events are worth proving.** If the game server authors a record,
   proving it establishes only that the server said so — an L1 round trip that gains no
   trust, because the author is the party being trusted. This kills any design that
   stores server-written game progress on a source chain, and it holds regardless of
   whether writability ships.

---

## 2. World model

**A world is a chain.** Worlds are keyed by `chainKey`; the registry is
`getSupportedChains()` resolved at runtime. Never hardcode chainKey (CLAUDE.md §4).

**Demo reality:** only Sepolia is usable — a second live world on chainKey 3 would mean
demo players spending real mainnet ETH. Two worlds ship, both backed by Sepolia contract
sets, so a world's identity is:

```
World = (chainKey, forgeAddress, elixirTokenAddress, weaponNftAddress)
```

This must be stated plainly in the pitch: architecturally a world is a chain; for the
demo two worlds share Sepolia because that is what testnet supports. Each becomes a
true separate chain the day AttestCoin adds one, with no code change beyond the registry.

**Each world is its own tower.** Worlds do not share floors — only players.

---

## 3. Tower and progression

Floor 1 of world 1 is the existing content: `town-main`, `town-b`, `town-c`,
`road-west`, `road-east`, `road-north`, and the island.

- **Towns** are the safe ring. **Roads** are the wilds; encounter rules unchanged
  (highways only — CLAUDE.md §16).
- **The island** is the sanctuary. It holds the **Forge** (the existing Pump interior)
  and, beyond it, the **boss room**. The forge is always reachable and never gated —
  gating it behind the boss would deadlock the loop that arms you to fight the boss.
  The island already has a canonical no-spawn rule; this gives it a reason.
- **Floors open by defeating the floor boss.** Pure game logic. No proof in the loop,
  so attestation latency never touches a fight.

**Deferred:** a high-level player entering a fresh world's Floor 1 trivialises it.
Needs an answer before world 2 opens; likely shapes are content scaled to world-floor,
or a level cap tied to floors cleared in that world. Not solved here.

---

## 4. Multiplayer

Shared zones, solo boss. Colyseus rooms sharded by `(worldId, floor)` carry presence
and movement for towns and roads. Boss fights are single-player instances. The existing
single-actor combat engine is untouched — no multi-actor turn order, no shared boss HP.

---

## 5. The three provable loops

Each is a player-signed source-chain event. Build order is strict: loop 1 must be
complete and demoable before loop 2 starts.

### Loop 1 — Forge (the core seam)

```
earn elixir in-game (free-to-play, no crypto required)
  → claim to chain: mint elixir on this world's chain          [player signs]
  → call forge() on this world's Forge contract                [player signs]
     └─ ONE transaction: burns the elixir, mints the weapon NFT to the caller,
        and emits
        WeaponForged(address indexed from, uint256 elixirSpent,
                     uint256 indexed tokenId, uint16 weaponType)
  → worker proves inclusion to the ASC on Creditcoin
  → ASC: verify → require(status == 1) → replay-guard (chainKey, blockHeight, txIndex)
         → decode → credit
  → weapon enters the player's Creditcoin armoury, origin = chainKey of the proof
```

**Spend, then prove the spend.** The weapon is not granted by the game — it is granted
because a burn provably happened. Preserves mint-then-spend (CLAUDE.md §11): elixir is
minted on-chain before it can be spent, and the proved event carries `from` + `value`.

**The NFT genuinely exists on the world's chain.** Forging is one transaction that burns
and mints together, so there is no window where the player paid and owns nothing, and no
second signature to chase. `tokenId` is the real NFT; `weaponType` selects which weapon
from the catalogue. Loop 3 re-attests ownership of that `tokenId`, which is only
meaningful because the NFT is real — if the weapon existed solely on Creditcoin there
would be nothing to re-attest and no source-chain identity seam (CLAUDE.md §10).

Because characters have no innate power and every weapon comes from a proven forge,
AttestCoin is on the critical path to all combat power **without gating a single door**.
Pitch line: *you cannot swing a sword in this game that wasn't proven to exist.*

**Weapons never move between chains.** The armoury is Creditcoin state, identical in
every world, so weapons travel with the player because they were never in a world to
begin with. Origin is not written metadata — it is which chain the proof came from, so
provenance is inseparable from the evidence the weapon exists. "A world only issues its
own weapons" is therefore structural, not a rule we enforce.

Origin affects behaviour: a `chainKey → ability-variant` table in
`game/combat/weapons.ts`. Pure, unit-testable, no engine change.

### Loop 2 — Deposit on-ramp

Real crypto deposited on Sepolia, proven, credited as project token. One source contract,
one ASC branch, same worker, same proof ladder in the UI. Gives the "real value flows in
and is proven" beat.

### Loop 3 — Ownership re-attestation

**Supersedes the earlier "accept staleness for the demo" decision.** A weapon's claim
expires and must be re-proven to stay usable. Fixes the stale-armoury hole (proven once,
then sold on the source chain) and produces steady diegetic proof throughput instead of
one burst at acquisition.

Ties to lore: an unproven holding has no provenance, which is precisely what defines
The Rescinded.

---

## 6. What travels, what stays

| Travels with the player | Stays in the world |
|---|---|
| Character — level, identity (Creditcoin) | Elixir — that world's ERC20, on its own chain |
| Armoury — weapons (Creditcoin, proven from origin chains) | World progress — floors cleared (Creditcoin, per-world partition) |

You arrive in a new world with your name, your level and your weapons — and nothing to
spend. You earn there.

**The restriction is the feature.** An elixir that moved freely between worlds would
collapse the per-world economy into one market and reduce "travel for a world's unique
weapon" to a shopping trip. Separate ERC20s on separate chains with no bridge enforce
that separation by nature rather than by a rule we have to defend.

**Where the separation actually comes from.** Not from chain boundaries — both demo
worlds run on Sepolia (§2) — but from the forge contracts: **world 1's forge accepts
only world 1's elixir.** That is contract-level and holds no matter who holds the
tokens, which is the property that matters.

Currency is freely transferable *between players* (§8), so a secondary market in
world currencies can form: a player may buy world-2 elixir from someone who earned it
there. That is a market, not a leak — the supply still originates from play in the
world that issued it, and no amount of world-1 elixir can be spent at world-2's forge.

Do not claim cross-world separation is "enforced by physics" while both worlds share a
chain. It is enforced by the forge, which is a contract we wrote and must keep correct.

---

## 7. Data ownership

Live game state cannot live on an L1: ~12s blocks, gas per action, and per §1 rule 2 a
server-authored record proves nothing anyway.

| Data | Lives on | Notes |
|---|---|---|
| Character, level, inventory, armoury | Creditcoin | the chain the game runs on |
| World progress (floors cleared) | Creditcoin, partitioned per world | own namespace/contract per `worldId` |
| Elixir balance | that world's source chain | real ERC20 |
| Weapon NFTs | their origin chain | never move |
| Project token | Creditcoin | native, credited by the ASC |
| Movement, combat, presence | game server + Colyseus | never on-chain, never trusted from the client |

"Each world has its own ledger" is literally true — the ledgers all live on the chain we
control, which is fast, ours, and the one the game runs on.

---

## 8. Economy

**Elixir** — per-world ERC20 on that world's chain. Earned free in-game, minted at a
batched claim step, burned at the forge.

**Transferable between players; never between worlds.** Elixir is an ordinary ERC20 —
players can send, trade, and settle stalls in it. What it cannot do is cross worlds:
each world issues its own currency, and each world's forge accepts only its own
(§6). BUILD_PLAN item 8's "player shop stalls" can therefore settle in elixir.

Accepted consequence: a farm-and-sell market is possible, since the earn loop is
free-to-play and the token transfers. Not mitigated here.

**Project token** — Creditcoin-native, freely transferable. Credited by the ASC on the
deposit on-ramp. The market currency.

---

## 9. Lore

The tower replaces the multiverse-per-player framing. `Player.universeName` becomes a
reference to the player's current world.

**The Rescinded** (CLAUDE.md §16) survive unchanged and get sharper: an order struck
from every ledger, whose holdings have no provenance and whose deeds cannot be attested.
This now explains a game rule diegetically — **you cannot loot their weapons into your
armoury, because there is no proof they exist.**

**Cheating, stated honestly** (per CLAUDE.md §10 — never pitch as detecting cheaters):
a player can edit their save to level 99 with every weapon. They cannot produce a forge
proof, because a burn that did not happen has no proof. In-world, holdings without
provenance is exactly the Rescinded condition. The cheater does not beat the game; they
join the antagonists. Cheating is available and worthless.

---

## 10. Service layer changes

The mock layer is the spine (BUILD_PLAN §"The one rule"). These are cheap now and
expensive after Phase 2, which is why they land before more UI is built.

**Changed:**
- `Player.universeName` → world reference keyed by `worldId`
- **`WorldBar` is deleted**, along with `getWorldBar()` and `getStoredProgress()`.
  `universeHealth` has no meaning once progression is not protocol-gated, and
  `storedProgress` duplicated `ElixirBalance.earned`. `StatusBars` reads
  `ElixirBalance` directly for the at-risk bar (CLAUDE.md §16 — a loss forfeits a
  share of `elixir.earned` and must never touch `elixir.onChain`) and `getTower()`
  for floor position. One source of truth per number.
- `ProofTicket.barDelta` → what the proof credited (weapon / token / attestation)
- `getEncounterTable(area)` → `getEncounterTable(area, floor)`
- weapon type gains `originWorld`

**New:**
- `listWorlds()`, `getCurrentWorld()`, `travelTo(worldId)`
- `getTower(worldId)` — floors cleared, current floor
- `forgeWeapon(...)`, `depositValue(...)`, `reattestWeapon(weaponId)`
- `getNearbyPlayers()` — presence

**Unchanged and reusable:** `ProofStatus` (`pending → proving → verified → rewarded →
failed`) is protocol-shaped, not reward-shaped. The existing `PumpPanel` proof ladder
survives the reframe intact — the Pump becomes the Forge, same mint → spend → prove UI,
same latency UX.

---

## 11. Revised Phase-1 remainder

Items 1–6 are complete. This reframe rewrites what is left.

**7. Protocol & economy screens**
- Reframe `PumpPanel` → Forge panel (small; ladder and states survive)
- Deposit / on-ramp screen — new (loop 2)
- Re-attestation UI — new (loop 3)
- Shop builder + agent chat — still unbuilt; `listShops()` has seed data and zero consumers
- Swap screen — still unbuilt

**8. Multiplayer presentation**
- Fake presence across towns *and* roads, not just the hub
- Player stalls (settling in project token, per §8 assumption)

**9. Meta screens**
- **World select** — new; replaces character/universe select
- **Tower / floor screen** — new; no current equivalent
- Leaderboard, season — `getLeaderboard()` and `getSeason()` have seed data, zero consumers

**10. Polish**
- Audio — entirely absent (no files, no engine, no playback code)
- Loading and error states beyond what the HUD covers

**New map work:** boss room interior, and the forge/boss-door split on the island.
Everything else is re-labelling — no map is re-authored.

---

## 12. Open and deferred

- Elixir soulbound — assumption in §8, needs confirmation
- Level scaling across worlds — §3
- World 2 content — currently a reskin of Floor 1 unless authored
- Carried from CLAUDE.md §15: season mechanics, reward numbers, one-vs-many shops,
  bar drain and caps, bounties

---

## 13. Roadmap (writability)

When writability ships, two things this design deliberately does without become possible:

- **Cash-out** — project token → real crypto on a source chain (CLAUDE.md §10's named
  roadmap item)
- **True cross-world asset movement** — burn on world A, message out, mint on world B

This design is not a workaround that writability replaces. It is readability doing the
part it is good at, with a specific, named next step.
