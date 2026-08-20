"use client";

import { useEffect, useState } from "react";
import { gameService } from "@/lib/services";
import { useGameStore } from "@/lib/store/gameStore";
import type { ForgeOption, World } from "@/lib/services/types";
import { OverlayPanel } from "./OverlayPanel";
import { ProofTrail } from "./ProofTrail";

const fmt = (n: number) => n.toLocaleString("en-US");
const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * The Forge — where the game's one rule is actually enforced.
 *
 * Three steps, in this order and no other: mint what you earned onto this
 * world's chain, burn it to forge a weapon, and wait for that burn to be proven.
 * The weapon does not arrive because the game says so; it arrives because a
 * source-chain transaction provably happened (design spec §5).
 *
 * A world can only issue weapons of its own origin, so what this panel offers
 * depends entirely on where the player is standing.
 */
export function ForgePanel() {
  const {
    player,
    world,
    elixir,
    proofs,
    connectWallet,
    disconnectWallet,
    claimToChain,
    forgeWeapon,
    depositValue,
  } = useGameStore();

  return (
    <OverlayPanel title={world ? `The Forge · ${world.name}` : "The Forge"} hint="Esc · close">
      <div className="flex flex-col gap-8">
        <Wallet
          address={player?.walletAddress ?? null}
          world={world}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
        />
        <Claim
          earned={elixir?.earned ?? 0}
          onChain={elixir?.onChain ?? 0}
          world={world}
          walletConnected={Boolean(player?.walletAddress)}
          onClaim={claimToChain}
        />
        <Forge
          onChain={elixir?.onChain ?? 0}
          world={world}
          walletConnected={Boolean(player?.walletAddress)}
          onForge={forgeWeapon}
        />
        <Deposit
          walletConnected={Boolean(player?.walletAddress)}
          onDeposit={depositValue}
        />

        {proofs.length > 0 && (
          <section>
            <Heading>In flight</Heading>
            <ul className="mt-2 flex flex-col gap-3">
              {proofs.map((ticket) => (
                <ProofTrail key={ticket.id} ticket={ticket} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </OverlayPanel>
  );
}

// --- wallet -----------------------------------------------------------------

function Wallet({
  address,
  world,
  onConnect,
  onDisconnect,
}: {
  address: string | null;
  world: World | null;
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
        <p className="font-mono text-xs text-hud-mute">
          Signs transactions on {world?.chainName ?? "this world's chain"} only.
        </p>
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
  world,
  walletConnected,
  onClaim,
}: {
  earned: number;
  onChain: number;
  world: World | null;
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
        setNote({ tone: "good", text: `Minted ${fmt(parsed)} elixir on ${world?.chainName ?? "chain"}.` });
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
        Elixir has to exist on this world&apos;s chain before it can be burned. This is the step
        that mints it — <span className="text-hud-unproven">{fmt(earned)} unbanked</span> waiting,{" "}
        <span className="text-hud-proven">
          {fmt(onChain)} {world?.currencySymbol ?? "on chain"}
        </span>
        .
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
          {walletConnected ? "Nothing unbanked to mint yet." : "Connect a wallet to mint."}
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

// --- forge ------------------------------------------------------------------

function Forge({
  onChain,
  world,
  walletConnected,
  onForge,
}: {
  onChain: number;
  world: World | null;
  walletConnected: boolean;
  onForge: (weaponType: string) => Promise<void>;
}) {
  const [options, setOptions] = useState<ForgeOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void gameService
      .listForgeOptions()
      .then((o) => live && setOptions(o))
      .catch(() => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [world?.id]);

  const forge = async (option: ForgeOption) => {
    setBusy(option.weaponType);
    setError(null);
    try {
      await onForge(option.weaponType);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "The forge would not take that.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <Heading>Forge a weapon</Heading>
      <p className="mb-3 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
        Burning elixir here mints the weapon on {world?.chainName ?? "this chain"} in the same
        transaction. It reaches your armoury when that burn is <em>proven</em>, not when you press
        the button. Weapons carry the world that made them, and they keep it wherever you take
        them.
      </p>

      {options === null ? (
        <p className="font-mono text-xs text-hud-mute">Reading the forge…</p>
      ) : options.length === 0 ? (
        <p className="font-mono text-xs text-hud-mute">This forge is cold.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {options.map((o) => {
            const affordable = onChain >= o.cost;
            const disabled = !walletConnected || !affordable || busy !== null;
            return (
              <li key={o.weaponType}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void forge(o)}
                  className="flex w-full flex-col gap-1 rounded-xl border border-hud-edge bg-hud-ink px-3 py-2.5 text-left transition-colors hover:border-hud-proven disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-1 focus-visible:outline-hud-proven"
                >
                  <span className="truncate font-mono text-sm text-hud-bone">{o.name}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-hud-mute">
                    {o.rarity}
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      affordable ? "text-hud-proven" : "text-hud-corrupt"
                    }`}
                  >
                    {busy === o.weaponType
                      ? "Burning…"
                      : `${fmt(o.cost)} ${world?.currencySymbol ?? ""}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!walletConnected && (
        <p className="mt-2 font-mono text-xs text-hud-mute">Connect a wallet to forge.</p>
      )}
      {error && <p className="mt-2 font-mono text-xs text-hud-corrupt">{error}</p>}
    </section>
  );
}

// --- deposit ----------------------------------------------------------------

function Deposit({
  walletConnected,
  onDeposit,
}: {
  walletConnected: boolean;
  onDeposit: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDeposit(parsed);
      setAmount("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "The deposit was refused.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <Heading>Deposit</Heading>
      <p className="mb-3 max-w-prose font-mono text-sm leading-relaxed text-hud-mute">
        Value deposited on the source chain, proven, and credited as project token. Real value
        flows in and is witnessed — the same ladder as everything else here.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={amount}
          disabled={!walletConnected || busy}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && void submit()}
          placeholder="0.00"
          aria-label="Amount to deposit"
          className="w-36 rounded-lg border border-hud-edge bg-hud-ink px-3 py-2 font-mono text-sm text-hud-bone placeholder:text-hud-mute disabled:opacity-50 focus-visible:border-hud-proven focus-visible:outline-none"
        />
        <button
          type="button"
          disabled={!walletConnected || busy || !valid}
          onClick={submit}
          className="rounded-lg border border-hud-proven px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven transition-colors hover:bg-hud-proven/10 disabled:opacity-40 focus-visible:outline-1 focus-visible:outline-hud-proven"
        >
          {busy ? "Sending…" : "Deposit"}
        </button>
      </div>

      {!walletConnected && (
        <p className="mt-2 font-mono text-xs text-hud-mute">Connect a wallet to deposit.</p>
      )}
      {error && <p className="mt-2 font-mono text-xs text-hud-corrupt">{error}</p>}
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
