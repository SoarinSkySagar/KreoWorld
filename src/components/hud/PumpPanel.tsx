"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import type { TxHash } from "@/lib/services/types";
import { OverlayPanel } from "./OverlayPanel";
import { ProofTrail } from "./ProofTrail";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const fmt = (n: number) => n.toLocaleString("en-US");
const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * The Elixir Pump — where the game's one rule is actually enforced.
 *
 * Two steps, in this order and no other: mint what you earned onto the source
 * chain, then prove a spend of it. Nothing here advances your universe on its
 * own say-so; only a proven source-chain transaction does that, which is why
 * the claim step exists at all (CLAUDE.md §11, mint-then-spend).
 */
export function PumpPanel() {
  const { player, elixir, proofs, connectWallet, disconnectWallet, claimToChain, submitProof } =
    useGameStore();

  return (
    <OverlayPanel title="Elixir Pump" hint="Esc · close">
      <div className="flex flex-col gap-8">
        <Wallet
          address={player?.walletAddress ?? null}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
        />
        <Claim
          earned={elixir?.earned ?? 0}
          onChain={elixir?.onChain ?? 0}
          walletConnected={Boolean(player?.walletAddress)}
          onClaim={claimToChain}
        />
        <Prove
          walletConnected={Boolean(player?.walletAddress)}
          onSubmit={submitProof}
          proofs={proofs}
        />
      </div>
    </OverlayPanel>
  );
}

// --- wallet -----------------------------------------------------------------

function Wallet({
  address,
  onConnect,
  onDisconnect,
}: {
  address: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Heading>Wallet</Heading>
        <p className="font-mono text-sm text-hud-bone">
          {address ? shortAddress(address) : "Not connected"}
        </p>
        <p className="font-mono text-xs text-hud-mute">Signs source-chain transactions only.</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(address ? onDisconnect : onConnect)}
        className={
          address
            ? "rounded-lg border border-hud-edge px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-mute transition-colors hover:text-hud-bone disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-hud-proven"
            : "rounded-lg border border-hud-proven px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven transition-colors hover:bg-hud-proven/10 disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-hud-proven"
        }
      >
        {busy ? "Working…" : address ? "Disconnect" : "Connect wallet"}
      </button>
    </section>
  );
}

// --- claim ------------------------------------------------------------------

function Claim({
  earned,
  onChain,
  walletConnected,
  onClaim,
}: {
  earned: number;
  onChain: number;
  walletConnected: boolean;
  onClaim: (amount: number) => Promise<{ status: string; txHash: string | null; error?: string }>;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= earned;
  const blocked = !walletConnected || earned === 0;

  const claim = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await onClaim(parsed);
      if (result.status === "minted") {
        setNote({ tone: "good", text: `Minted ${fmt(parsed)} elixir on the source chain.` });
        setAmount("");
      } else {
        setNote({ tone: "bad", text: result.error ?? "The mint did not go through." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <Heading>Claim to chain</Heading>
      <p className="mb-3 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
        Elixir has to exist on the source chain before it can be spent. This is the step that mints
        it — <span className="text-hud-unproven">{fmt(earned)} earned</span> waiting,{" "}
        <span className="text-hud-proven">{fmt(onChain)} on chain</span>.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={earned}
          value={amount}
          disabled={blocked || busy}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          aria-label="Amount of elixir to mint"
          className="w-36 rounded-lg border border-hud-edge bg-hud-ink px-3 py-2 font-mono text-sm text-hud-bone placeholder:text-hud-mute disabled:opacity-50 focus-visible:border-hud-proven focus-visible:outline-none"
        />
        <button
          type="button"
          disabled={blocked || busy || !valid}
          onClick={claim}
          className="rounded-lg border border-hud-unproven px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-unproven transition-colors hover:bg-hud-unproven/10 disabled:opacity-40 focus-visible:outline-1 focus-visible:outline-hud-proven"
        >
          {busy ? "Minting…" : "Claim to chain"}
        </button>
        {earned > 0 && !blocked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAmount(String(earned))}
            className="rounded-lg font-mono text-xs uppercase tracking-[0.14em] text-hud-mute transition-colors hover:text-hud-bone disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-hud-proven"
          >
            All
          </button>
        )}
      </div>

      {blocked && (
        <p className="mt-2 font-mono text-xs text-hud-mute">
          {walletConnected ? "Nothing earned to mint yet." : "Connect a wallet to mint."}
        </p>
      )}
      {note && (
        <p
          className={`mt-2 font-mono text-xs ${
            note.tone === "good" ? "text-hud-proven" : "text-hud-corrupt"
          }`}
        >
          {note.text}
        </p>
      )}
    </section>
  );
}

// --- prove ------------------------------------------------------------------

function Prove({
  walletConnected,
  onSubmit,
  proofs,
}: {
  walletConnected: boolean;
  onSubmit: (txHash: TxHash) => Promise<void>;
  proofs: ReturnType<typeof useGameStore.getState>["proofs"];
}) {
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!TX_HASH.test(hash.trim())) {
      setError("That is not a transaction hash. It should be 0x followed by 64 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(hash.trim() as TxHash);
      setHash("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "The prover would not take that transaction.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <Heading>Prove a spend</Heading>
      <p className="mb-3 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
        Paste the source-chain transaction that spent your elixir. Proving it is the only thing that
        moves your universe.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={hash}
          disabled={!walletConnected || busy}
          onChange={(e) => setHash(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="0x…"
          aria-label="Source-chain transaction hash"
          className="min-w-0 flex-1 rounded-lg border border-hud-edge bg-hud-ink px-3 py-2 font-mono text-sm text-hud-bone placeholder:text-hud-mute disabled:opacity-50 focus-visible:border-hud-proven focus-visible:outline-none"
        />
        <button
          type="button"
          disabled={!walletConnected || busy || hash.trim() === ""}
          onClick={submit}
          className="rounded-lg border border-hud-proven px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven transition-colors hover:bg-hud-proven/10 disabled:opacity-40 focus-visible:outline-1 focus-visible:outline-hud-proven"
        >
          {busy ? "Sending…" : "Prove spend"}
        </button>
      </div>

      {!walletConnected && (
        <p className="mt-2 font-mono text-xs text-hud-mute">Connect a wallet to prove a spend.</p>
      )}
      {error && <p className="mt-2 font-mono text-xs text-hud-corrupt">{error}</p>}

      {proofs.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {proofs.map((ticket) => (
            <ProofTrail key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">
      {children}
    </h3>
  );
}
