"use client";

import type { ElixirBalance, TokenBalance } from "@/lib/services/types";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Balance readout. Elixir is shown as two numbers, not one total, because the
 * split is the rule players have to learn: only the on-chain half can be spent
 * and proven. Same colour language as the bars — amber is not yet real, cyan is.
 */
export function Balances({
  elixir,
  token,
}: {
  elixir: ElixirBalance | null;
  token: TokenBalance | null;
}) {
  return (
    <div className="flex items-start gap-7">
      <Readout label="Elixir">
        <span className="text-hud-unproven" title="Earned in play. Not on chain, so it cannot be spent yet.">
          {elixir ? fmt(elixir.earned) : "—"}
        </span>
        <span className="mx-1 text-hud-mute">/</span>
        <span className="text-hud-proven" title="Minted on chain. This is the half you can spend and prove.">
          {elixir ? fmt(elixir.onChain) : "—"}
        </span>
      </Readout>

      <Readout label="Token">
        <span className="text-hud-bone" title="Project token, credited when a spend is proven.">
          {token ? fmt(token.projectToken) : "—"}
        </span>
      </Readout>
    </div>
  );
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-hud-mute">{label}</span>
      <span className="font-mono text-lg tabular-nums">{children}</span>
    </div>
  );
}
