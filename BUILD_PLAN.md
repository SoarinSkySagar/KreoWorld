# BUILD_PLAN.md — AttestCoin Open-World Game

High-level, phase-ordered build plan. Frontend is built **completely** first (against
mocks), then backend/contracts, then integration. ~23-day timebox.

---

## The one rule that makes frontend-first actually work

The frontend must be built against a **mock service layer** — a single module of typed
interfaces (`getPlayer()`, `getElixirBalance()`, `getLoadout()`, `submitProof(txHash)`,
`getWorldBar()`, `listShops()`, `getLeaderboard()`, …) that today return fake/in-memory data.

Everything in the UI calls these interfaces and **never** assumes where the data comes from.
Then:

- **Backend phase** = implement those interfaces for real.
- **Integration phase** = swap the mock implementation for the real one. Ideally a one-line switch, not a rewrite.

This is also what lets you defer the web2-vs-contract-vs-which-chain decision: the frontend
talks to `submitProof()`, and *whether that's a smart contract, a worker, or a node endpoint*
is a backend-phase decision the UI never sees. **If you hardcode data sources into components,
integration becomes a rewrite and the whole workflow fails.** Build the seam first.

---

## The one risk this order creates (and its mitigation)

Frontend-first means the **AttestCoin proof loop — the thing that wins the hackathon — gets
built and tested LAST**, landing in the phase with the least buffer. That's backwards from a
risk standpoint.

**Mitigation:** during the frontend phase, in parallel, do a throwaway **protocol spike** —
a bare Node script (no game) that runs the full loop once: Sepolia event → `@gluwa/usc-sdk`
prove → ASC verify on CC3 testnet. It proves the scariest unknown is solvable and teaches you
the real shape of `submitProof()` before you design its interface. Retire protocol risk early
even though its *game* integration comes late. Keep it out of the game codebase — it's a
learning spike, thrown away.

---

## PHASE 1 — Frontend (everything, on mocks) · ~9 days

Ordered by dependency. Each item assumes the mock layer already exists.

1. **Scaffold + mock service layer.** Next.js 15 (App Router) shell with Phaser 3 embedded in
   a canvas. Define the mock/stub interface module *first* — this is the spine everything
   else calls. Fake data, in-memory.
2. **Movement vertical slice.** One throwaway placeholder map: character walks, tile collision,
   camera follows. Proves the engine works before you invest in art. Nothing fancy.
3. **Art pipeline + world content.** (Long pole — start sourcing art on day 1, in parallel.)
   Assemble CC0/licensed tilesets + character sprites (itch.io / Kenney / LPC) in **Tiled**.
   Build the real world: **three cities + connecting roads + central hub**, exported from Tiled.
   Map and graphics are the same workstream here — you place art tiles to make maps.
4. **World interaction systems.** Warps/doors between maps, building interiors, NPC placement,
   dialogue system, interactable objects, trigger zones. Turns walkable maps into a *world*.
   (The Pump, gyms, and shops are all interactables — build the generic system once.)
5. **Combat scene.** ✅ Done. Visible road encounters (highways only) + a Phaser `BattleScene` with
   turn-based, type-chart resolution driven by weapon NFTs. Rules live in a pure, unit-tested
   `game/combat/engine.ts`. Feeds `elixir.earned` (mocked, via `gameService.resolveBattle`).
   See CLAUDE.md §16.
6. **HUD & persistent UI.** The **two bars** (stored-progress + universe-health), the
   **loadout screen** (attack-NFT slots, switchable), inventory, token balances. Always-on layer.
7. **Protocol & economy screens** (all on stubs). The **Elixir Pump / prover center** UI —
   submit-tx-hash flow with `pending → verified → rewarded` states (design the pending state
   carefully; attestation latency lives here later). Wallet-connect UI. Shop builder + agent
   chat UI. Swap/on-ramp screen.
8. **Multiplayer hub presentation.** Stub other-player presence (fake avatars) and player shop
   stalls so the hub *reads* as multiplayer with zero netcode. Real sync is backend/integration.
9. **Meta screens.** Character/universe select (multiverse naming + dialogue flavor), season
   leaderboard, carnival event UI.
10. **Polish pass.** Scene transitions, audio, feedback/juice, loading & error states.

**Exit criterion:** the entire game is clickable and walkable end-to-end on fake data — every
screen exists, nothing is real. You never have to touch UI again.

---

## PHASE 2 — Backend / contracts (most decisions happen here) · ~7 days

The web2-vs-contract split and chain choice are **decided at the top of this phase**, not now.

1. **The split decision (first task).** Walk every interface in the Phase-1 mock layer and
   classify each into one of three buckets:
   - **Source-chain event + proof** — must be trustless/cross-chain (the spend-to-prove loop,
     on-chain identity). This is where AttestCoin is load-bearing.
   - **Creditcoin-native contract** — on-chain but doesn't need a cross-chain proof.
   - **Web2 (node + Postgres)** — everything that's just game state (movement, combat results,
     season standings, shop configs, dialogue). Default here unless there's a reason not to.
   Output: a one-page "what lives where" map. This unblocks the rest of the phase.
2. **Chain/env lock.** Confirm source chain (Sepolia) + Creditcoin CC3 testnet; record RPCs,
   precompile addresses, resolve `chainKey` at runtime (see CLAUDE.md — it is NOT the EVM chainId).
3. **Source-chain contracts (Sepolia).** Elixir token with the **mint-then-spend** invariant
   (earned elixir is minted on-chain before it can be spent); the **spend/burn event**
   (`from`, `value`); **weapon-loadout NFTs** (class, element, rarity, ability); optional deposit
   contract for the swap on-ramp.
4. **ASC on Creditcoin (CC3).** Verify via Block Prover Precompile `0x..FD2`, **require receipt
   status == 1**, **replay protection** per `(chainKey, blockHeight, txIndex)`, decode the spend
   event, credit project tokens + advance the universe bar. (These three guards go in the first
   draft — cheap now, painful to retrofit.)
5. **Web2 game server.** Real implementations of the mock interfaces: auth, player state,
   movement persistence, combat resolution, elixir earning, balances, leaderboard, shop configs.
   Postgres schema. Authoritative — the client is never trusted.
6. **The worker.** Node + `@gluwa/usc-sdk` + ethers v6: watch Sepolia spend events → wait for
   attestation → fetch proof → call ASC. (Shape already sketched in CLAUDE.md.)
7. **Multiplayer server.** Colyseus authoritative rooms for the hub (real presence, shop stalls).
8. **Agent service.** Off-chain LLM for shopkeeper NPCs — player prompt as persona + a
   constrained action set. (On-chain part is only ownership/config + token settlement.)

**Keep the whole demo readability-only:** real value flows *in* and gets proved (Sepolia →
Creditcoin). Cash-*out* to real crypto is writability — roadmap, never a demo dependency.

**Exit criterion:** every mock interface has a real backing implementation, tested in isolation.

---

## PHASE 3 — Integration (swap mocks for real) · ~5 days

Ordered so a **playable fallback exists early** and the highest-value protocol loop is proven
before buffer runs out.

1. **Wire web2 → frontend.** Replace all DB-backed stubs. Now the game is fully playable end to
   end **with no chain yet** — auth, movement, combat, earning, balances, leaderboard, hub.
   *This is your safety net:* even if the on-chain loop fights you, you have a demoable game.
2. **Wire wallet + on-chain identity.** Connect wallet; read weapon-loadout NFTs from Sepolia —
   they set both the player's attack stat and the moves available in battle.
3. **Wire the proof loop (the money shot).** earn → claim (mint on Sepolia) → spend → worker
   proves → ASC credits → universe bar visibly rises on screen. Test the full readability path
   hard. This is the beat judges see — prioritize it right after step 1.
4. **Wire multiplayer hub.** Swap stubbed presence for real Colyseus. (Async fallback ready if
   netcode fights you.)
5. **Wire agent shops.** Real LLM shopkeepers + token settlement.
6. **Harden.** Latency/pending UX, retries, proof/ASC error handling, replay edge cases.
7. **Demo prep.** Rehearse the two-minute loop; **record a backup demo video** (never live-only);
   write the pitch, including the one honest line on how AttestCoin is load-bearing.

---

## Rough day budget

| Phase | Days | Notes |
|-------|------|-------|
| Frontend (on mocks) | ~9 | + art sourcing and the protocol spike run in parallel from day 1 |
| Backend / contracts | ~7 | split decision is the first task here |
| Integration | ~5 | playable-no-chain by step 1; proof loop by step 3 |
| Buffer | ~2 | do not spend on new features |

**Hard gate:** fully playable (web2-wired, no chain) **by ~day 18**, proof loop working
**by ~day 20**, leaving real buffer. The frontend-first order pushes the demoable moment late —
the protocol spike (early) and the playable-no-chain fallback (integration step 1) are what keep
that from being fatal.

## Decide-during-build (explicitly deferred — don't hardcode around these)

Season/carnival mechanics · reward/token numbers · how weapon NFTs are first acquired · one vs
many shops · Reading-B spend-sinks (spend on *things* vs spend-to-void) · cities 2 & 3 content ·
bar drain rate & caps · achievement-style bounties (roadmap vs v1).
