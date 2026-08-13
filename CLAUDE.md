# CLAUDE.md — AttestCoin Open-World Game

Guidance for Claude Code on this project: a top-down, GBA-Pokémon-style open-world game
built on the **AttestCoin Protocol** (the cross-chain interoperability layer hosted on
Creditcoin). Read this fully before writing contracts, SDK code, workers, or game code.

- **Sections 0–8** are the AttestCoin Protocol reference (naming, SDK, networks, contract patterns). Consult before touching anything on-chain.
- **Sections 10–14** are this game's architecture, the mock-layer discipline, and the invariants that keep the protocol load-bearing.
- Build phases and timeline live in `BUILD_PLAN.md`. Frontend is built completely first (on mocks), then backend/contracts, then integration.

---

## 0. Critical naming caveat (read first)

- **USC (Universal Smart Contract) was renamed to "AttestCoin Protocol."** The concepts are identical.
- **Repos, the npm package, and some in-code identifiers were NOT renamed.** So you will legitimately see all of these and they are correct:
  - npm package: `@gluwa/usc-sdk`
  - examples repo: `gluwa/usc-testnet-bridge-examples`
  - in Solidity: `INativeQueryVerifier`, `NativeQueryVerifierLib` — the **Block Prover Precompile** was previously called the *Native Query Verifier*. Same thing.
  - `USCMinter.sol` / `ASCMinter` / `SimpleMinterASC` all refer to the same example ASC.
- Do **not** "fix" these names to match the new branding. They are the real API surface.
- **ASC** = *AttestCoin Smart Contract*: a contract on Creditcoin that consumes AttestCoin Readability/Writability.

---

## 1. Mental model

AttestCoin lets a contract on **Creditcoin** act on data that provably happened on a
**source chain** (e.g. Ethereum / Sepolia), without a traditional bridge. It is a
**general-purpose read layer**, not just a token bridge.

Two transactions are always involved:

1. **Source-chain tx** (signed by the end user) — calls a source contract that emits an event.
2. **Creditcoin tx** (usually sent by an off-chain worker) — submits proofs to the ASC, which verifies them synchronously and runs business logic in the same tx.

A **transaction inclusion proof** = two parts:

| Part | Proves |
|------|--------|
| **Merkle proof** | The tx is included in a specific block's transaction tree |
| **Continuity proof** | That block belongs to a sequence anchored to an attestation recorded on Creditcoin |

Flow end-to-end:

```
user → source contract (emit event)
     → wait for block attestation on Creditcoin (minutes, automatic)
     → Proof Builder service generates Merkle + continuity proofs
     → worker calls ASC on Creditcoin
     → ASC calls Block Prover Precompile (0x..FD2) to verify synchronously
     → ASC validates tx status + contents, runs business logic (e.g. mint)
```

---

## 2. The three moving parts to build

1. **Source-chain contract (Solidity, on Ethereum/Sepolia):** minimal. Do required asset logic (burn/lock), then emit a specific, unambiguous event with all data the ASC needs.
2. **ASC (Solidity, on Creditcoin):** verify proofs via the precompile, enforce replay protection, check receipt status, decode event data, run business logic.
3. **Off-chain worker (TypeScript + `@gluwa/usc-sdk`):** watch source events, wait for attestation, fetch proofs, call the ASC.

Optional **frontend** (Next.js 15 App Router): only signs the source-chain tx; the worker handles everything after.

---

## 3. SDK: `@gluwa/usc-sdk`

- TypeScript/JS SDK. **Peer dependency: `ethers` v6.** Do not write ethers v5 syntax.
- Install: `npm install @gluwa/usc-sdk ethers`

Namespace imports (this is the real shape — keep it):

```ts
import { chainInfo, blockProver, proofProvider } from '@gluwa/usc-sdk';
import { EncodingVersion } from '@gluwa/usc-sdk/encoding';
```

Key classes:

| Class | Path | Purpose |
|-------|------|---------|
| `PrecompileChainInfoProvider` | `chainInfo.PrecompileChainInfoProvider` | Query supported source chains + their `chainKey` |
| `ProofBuilder` | `proofProvider.service.ProofBuilder` | Fetch pre-computed proofs from the hosted Proof Builder API (**preferred**) |
| `RawProofBuilder` | `proofProvider.raw.RawProofBuilder` | Compute proofs locally from source RPCs (advanced) |
| `SimpleBlockProvider` | `proofProvider.raw.blockProvider.SimpleBlockProvider` | Block source for `RawProofBuilder` |
| `PrecompileBlockProver` | `blockProver.PrecompileBlockProver` | Submit/verify proofs against the on-chain precompile |

`ProofBuilder` and `RawProofBuilder` both implement the same `ProofProvider` interface and
produce identical output — swappable without changing downstream code. Default to `ProofBuilder`.

### Canonical worker snippet

```ts
import { JsonRpcProvider } from 'ethers';
import { chainInfo, blockProver, proofProvider } from '@gluwa/usc-sdk';

const sourceProvider = new JsonRpcProvider(process.env.SOURCE_RPC_URL!);       // e.g. Sepolia
const creditcoinProvider = new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL!); // CC3 testnet

const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
const prover = new blockProver.PrecompileBlockProver(creditcoinProvider);

// chainKey is Creditcoin-internal — NOT the EVM chainId. Resolve it, don't hardcode blindly.
const supportedChains = await chainInfoProvider.getSupportedChains();
// e.g. [{ chainKey: 1, chainId: 11155111, chainName: 'Ethereum Sepolia', chainEncoding: 1 }, ...]
const chainKey = 1;

const proofBuilder = new proofProvider.service.ProofBuilder(
  chainKey,
  process.env.PROOF_BUILDER_URL!, // e.g. https://prover.cc3-testnet.creditcoin.network
  5000,                           // request timeout ms (optional, default 5000)
);

const tx = await sourceProvider.getTransaction(txHash);
await proofBuilder.waitUntilHeightAttested(chainKey, tx!.blockNumber!); // polls ~15s, throws after ~15m

const result = await proofBuilder.getProof(txHash);
if (!result.success || !result.data) throw new Error(`Proof failed: ${result.error}`);

const { chainKey: ck, headerNumber, txBytes, merkleProof, continuityProof } = result.data;
const verified = await prover.verifySingle(ck, headerNumber, txBytes, merkleProof, continuityProof);
```

`getProof` returns `{ chainKey, headerNumber, txHash, txBytes, merkleProof, continuityProof, cached }`.

### Batching

- Use `getBatchProof([...txHashes])` + `prover.verifyBatch(...)`.
- All txs in a batch share one continuity proof (cheaper on-chain).
- **Limits:** `MAX_BATCH_SIZE = 10` proofs, and all txs must fall within `MAX_BATCH_RANGE = 1000` blocks.
- For batch verification you must flatten `batchData.merkleProofs` into parallel arrays (`headers[]`, `txBytesArr[]`, `merkleProofs[]`) before calling `verifyBatch`.

### Raw / offline mode (only when explicitly needed)

```ts
const blockProvider = new proofProvider.raw.blockProvider.SimpleBlockProvider(sourceProvider);
const rawGenerator = new proofProvider.raw.RawProofBuilder(
  chainKey, blockProvider, chainInfoProvider, EncodingVersion.V1,
);
const result = await rawGenerator.getProof(txHash);
```

Use only for custom indexers / offline computation. Otherwise prefer the hosted `ProofBuilder`.

---

## 4. Networks & addresses

**Resolve `chainKey` via `getSupportedChains()` at runtime.** Never assume `chainKey === chainId`.

### CC3 Testnet (use this for development)

| Thing | Value |
|-------|-------|
| Creditcoin RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| Proof Builder API | `https://prover.cc3-testnet.creditcoin.network` (also `https://proof-gen-api.cc3-testnet.creditcoin.network/`) |
| ASC Dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` |
| Decoder contract | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| ChainInfo Precompile | `0x0000000000000000000000000000000000000fd3` |
| BlockProver Precompile | `0x0000000000000000000000000000000000000FD2` |

Supported testnet source chains: Ethereum **Sepolia** → `chainKey 1`; Ethereum **Mainnet** → `chainKey 3`.

### CC3 Mainnet (production only, when explicitly ready)

| Thing | Value |
|-------|-------|
| Proof Builder API | `https://proofbuilder.cc3-mainnet-usc.creditcoin.network/` |
| ASC Dashboard | `https://dashboard.cc3-mainnet-usc.creditcoin.network/` |
| Decoder contract | `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C` |
| ChainInfo Precompile | `0x0000000000000000000000000000000000000fd3` |
| BlockProver Precompile | `0x0000000000000000000000000000000000000FD2` |

Supported mainnet source chains: Ethereum **Mainnet** → `chainKey 1`.

> Precompile addresses are the same across environments; **chainKey mappings differ** (Sepolia is `1` on testnet, Mainnet is `1` on mainnet but `3` on testnet). Always resolve at runtime and keep RPC/prover URLs in env vars.

Never commit RPC keys. Use `.env` (`SOURCE_RPC_URL`, `CREDITCOIN_RPC_URL`, `PROOF_BUILDER_URL`, worker private key).

---

## 5. Solidity — source chain contract

Keep it **minimal**. Do the asset movement, emit one specific event, done.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    address public constant BURN_ADDRESS = address(1); // 0x...01

    /// Emitted when tokens are burned for bridging.
    event TokensBurnedForBridging(address indexed from, uint256 value);

    constructor() ERC20("Burn Test", "TEST") { _mint(msg.sender, 1_000_000 ether); }

    function burn(uint256 amount) external returns (bool) {
        _transfer(msg.sender, BURN_ADDRESS, amount);
        emit TokensBurnedForBridging(msg.sender, amount);
        return true;
    }
}
```

Rules for source contracts:
- **One source contract per dApp** emits all AttestCoin-relevant events (single address for the worker to watch).
- **Unambiguous, uniquely-named events** per action (`LoanInitiated`, `LoanRepaid`, `TokensBurnedForBridging`) — do **not** trigger cross-chain logic off generic `Transfer` events.
- **Put every field the ASC needs in the event** (`from`, `value`, etc.). If it's not in the event, Creditcoin can't act on it.
- Use `indexed` params (max 3) for efficient worker filtering.
- Push business logic/state to Creditcoin, not the source chain.

---

## 6. Solidity — ASC (on Creditcoin)

Canonical pattern (from `USCMinter.sol` / `SimpleMinterASC`):

1. Receive proofs + `encodedTransaction` from the worker.
2. Compute a unique tx key (`chainKey`, `blockHeight`, `transactionIndex`) and enforce **replay protection** (`processedQueries` mapping).
3. Call the **Block Prover Precompile** at `0x..FD2` via `verify()` / `verifyAndEmit()` to verify Merkle + continuity proofs synchronously (reverts on failure).
4. **Validate transaction contents** — this step is security-critical (see below).
5. Run business logic in the same tx.

```solidity
function mintFromQuery(
    uint64 chainKey,
    uint64 blockHeight,
    bytes calldata encodedTransaction,
    bytes32 merkleRoot,
    INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
    bytes32 lowerEndpointDigest,
    bytes32[] calldata continuityRoots
) external returns (bool success);
```

`VERIFIER` is the immutable precompile ref (`NativeQueryVerifierLib.getVerifier()`), verified via
`VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof)`.
Proofs are rebuilt into `INativeQueryVerifier.MerkleProof { root, siblings }` and
`INativeQueryVerifier.ContinuityProof { lowerEndpointDigest, roots }`.

### ⚠️ Non-negotiable ASC security rules

- **The precompile only proves inclusion, NOT success.** It confirms the tx is in a block and that block is part of the confirmed source chain. It does **not** check whether the tx succeeded.
  → The ASC **MUST** check the receipt `status` field: `status == 1` (`0x1`) = success. Reject otherwise.
- **Replay protection is mandatory.** Mark each `(chainKey, blockHeight, transactionIndex)` processed before/after verification; reject duplicates.
- **Decode selectively** with `EvmV1Decoder` (`getTransactionType`, `decodeReceiptFields`, `getLogsByEventSignature`, `decodeCommonTxFields`) — validate tx type, then receipt status, then the specific event/log you care about. Don't trust unfiltered logs.
- Validate the event actually matches your intended action (e.g. burn *from* the expected sender, correct sink address) before acting.

Business logic may live in the ASC itself (simple case) or in a separate dApp contract the ASC calls after verification (complex case). Both are valid.

---

## 7. Off-chain worker (TypeScript)

Responsibilities: monitor source events → wait for attestation → generate proofs → call ASC → confirm.
The user only ever signs the source-chain tx.

Robustness is the whole point — a naive worker is not acceptable. Implement:
- **Persistent record of in-flight events** so a restart doesn't drop them.
- **Catch-up on missed events** after downtime (scan from last processed block).
- **Idempotency / dedup** of ASC calls per event (ASC has replay protection, but don't rely on it alone — wasted gas + reverts).
- **Multiple source RPC endpoints** for redundancy.
- **Retries with backoff** on attestation-not-ready, proof-builder downtime, and ASC call failures.

`waitUntilHeightAttested` polls the prover cache (~15s interval, ~15m timeout by default) and resolves
once the attestation is present — listen via the Proof Builder service, not directly on-chain, to avoid timing races.

---

## 8. Reference / examples

- Examples repo: `https://github.com/gluwa/usc-testnet-bridge-examples` (see `hello-bridge`).
- Example ASC: `contracts/sol/USCMinter.sol` in that repo.
- SDK: `https://www.npmjs.com/package/@gluwa/usc-sdk`
- Docs: `https://docs.creditcoin.org/attestcoin-protocol` (append `.md` to any page URL for Markdown; full index at `https://docs.creditcoin.org/llms.txt`).
- Tutorials: Hello Bridge → Custom Contract Bridging → Bridge Off-chain Worker → Cross-Chain Loan dApp.

> Doc code is educational, **not production-ready**. The example minter was intentionally left simplified; production designs split minting across multiple contracts.

---

## 9. Preferences & conventions for this repo

- **Contracts:** Solidity `^0.8.20`+, OpenZeppelin for ERC standards, Hardhat or Foundry. Source contract on Sepolia, ASC on CC3 testnet.
- **SDK/worker code:** TypeScript, **ethers v6 only**, strict mode. Wrap proof/verify calls in typed try/catch and surface `result.error`.
- **Frontend (if built):** Next.js 15 App Router, wallet connect for the source-chain tx only; the worker is a separate service (never ship the worker key to the client).
- **Secrets:** all RPC URLs, prover URLs, and worker keys in env vars — never hardcoded, never committed.
- **Default to testnet** in all examples and scripts; require an explicit flag/env to target mainnet.
- Don't rename USC→AttestCoin in package names, imports, or the `NativeQueryVerifier` interface.

---

## 10. The game — concept & how the protocol is load-bearing

Top-down 2D (GBA-Pokémon style) open-world game. Lore: each player defends *their own
universe* whose "elixir" is corrupted; the world advances only on real, proven contributions.

**The core honest framing:** AttestCoin is NOT an anti-cheat referee — it cannot see the game
server or the DB. It is **mandatory throughput**: progress requires a real source-chain event
to exist, and a cheater editing game state produces no such event. Cheating is *allowed but
pointless*. Never pitch it as "detecting cheaters."

Three seams where the protocol is genuinely load-bearing, all **readability** (source → Creditcoin):

1. **Identity** — attack-loadout NFTs live on the source chain; proving ownership/composition gates power.
2. **Progression (main gate)** — earned elixir is minted on-chain, then **spent/burned**; proving that spend advances the player's universe bar and mints project tokens.
3. **Value on-ramp (optional)** — real crypto deposited on Sepolia, proven, credited as project tokens.

Cash-*out* to real crypto is **writability** — roadmap only, never a demo dependency.

## 11. Non-negotiable invariants (bake in from the first commit)

- **Mint-then-spend:** earned elixir must be minted as a real Sepolia token *before* it can be spent/proved. The **on-chain token balance is source of truth, not the DB.** If the DB authorizes the spend, the cheat gate leaks — do not build the earn loop as pure DB and bolt chain on later.
- **The proved event is a real source-chain spend**, carrying `from` + `value`, so the ASC can credit correctly and replay-protect per event. Server-side "mission complete" is NOT provable — don't gate progress on it.
- **ASC guards (in the first draft):** verify via precompile `0x..FD2` → `require(status == 1)` → replay-protect per `(chainKey, blockHeight, txIndex)` → decode → credit. Three lines now; painful to retrofit.
- **Readability-only for the demo.** Real value flows in and is proven; cash-out is roadmap.
- **`chainKey` ≠ EVM `chainId`** — resolve at runtime (see §4).
- Attestation takes **minutes** — nothing real-time may depend on a fresh proof. Design bar-drain tempo and the Pump's `pending` UX around this latency.

## 12. Tech stack & layout

- **Frontend:** Next.js 15 (App Router) shell with **Phaser 3 + TypeScript** embedded for the game canvas. Maps authored in **Tiled**. Wallet connect + Pump UI live in the Next.js shell.
- **Multiplayer:** **Colyseus** authoritative rooms — only for the central hub. The three cities are single-player (no netcode). Async fallback if netcode fights you.
- **State:** **Postgres**, owned by an authoritative game server. Client is never trusted.
- **On-chain:** source contracts on **Sepolia** (elixir mint/spend token, attack-loadout NFTs, optional deposit); **ASC on Creditcoin CC3 testnet**.
- **Worker:** Node + `@gluwa/usc-sdk` + ethers v6 (see §3/§7) bridging Sepolia events → ASC.
- **Agent shops:** shopkeeper NPCs are **off-chain LLM** services (player prompt as persona + constrained action set). Only ownership/config + token settlement are on-chain. "On-chain agent" is not literal — don't imply LLM inference runs on-chain.

## 13. The mock service layer (the spine of the whole build)

The frontend is built **completely before** any backend exists, so it must run entirely on a
**mock service layer**: one module of typed interfaces returning fake/in-memory data. Every UI
component calls these interfaces and **never assumes where data comes from**.

- Backend phase implements these interfaces for real; integration swaps the implementation (ideally one switch, not a rewrite).
- This is also how the **web2-vs-contract-vs-chain split is deferred** — the UI calls `submitProof()`; whether that resolves to a contract, worker, or node endpoint is a backend-phase decision the UI never sees.
- **Never let a component reach a data source directly.** That turns integration into a rewrite and breaks the frontend-first order.

Illustrative interfaces (extend as needed): `getPlayer()`, `getLoadout()`, `getElixirBalance()`,
`claimElixirToChain()`, `submitSpendProof(txHash)`, `getWorldBar()`, `getStoredProgress()`,
`getTokenBalance()`, `listShops()`, `getLeaderboard()`, `getSeason()`.

## 14. Two-token economy

- **Elixir** — earned in-game free-to-play, minted on Sepolia at a batched "claim to chain" step, then **spent/burned** (the provable event). Free to the player; real on-chain at the moment it matters.
- **Project token** — Creditcoin-native in-game currency; earned by playing, spent on items/services, credited by the ASC on a proven spend, optionally buyable via the proven on-ramp.

## 15. Deferred — decide during build, don't hardcode around these

Season/carnival mechanics · reward/token numbers · how loadout NFTs are first acquired · one vs
many shops · spend-on-things vs spend-to-void · cities 2 & 3 content · bar drain rate & caps ·
achievement-style bounties (roadmap vs v1). When you must assume one to proceed, isolate the
assumption behind the mock layer so it's swappable.
