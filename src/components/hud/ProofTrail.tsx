"use client";

import type { ProofTicket } from "@/lib/services/types";
import { PROOF_STEPS, stepIndex } from "./proofSteps";

const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/**
 * One submitted spend, shown as the ladder it actually climbs. Every stage stays
 * on screen with its own explanation, so a player looking at a stalled-seeming
 * screen can see which real step is taking the time rather than assuming the
 * game hung.
 */
export function ProofTrail({ ticket }: { ticket: ProofTicket }) {
  const current = stepIndex(ticket.status);
  const failed = ticket.status === "failed";
  const complete = ticket.status === "rewarded";
  const settled = complete || failed;

  return (
    <li className="rounded-xl border border-hud-edge bg-hud-ink p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="truncate font-mono text-xs text-hud-mute" title={ticket.txHash}>
          {shortHash(ticket.txHash)}
        </span>
        {ticket.status === "rewarded" && (
          <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-hud-proven">
            +{ticket.reward} token · +{ticket.barDelta} universe
          </span>
        )}
      </div>

      {failed ? (
        <p className="font-mono text-sm text-hud-corrupt">
          {ticket.error ?? "This spend could not be proven. Check the transaction and try again."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {PROOF_STEPS.map((step, i) => {
            // Once rewarded the ladder is finished — the last rung is a result,
            // not something still happening.
            const done = complete || i < current;
            const active = !complete && i === current;
            return (
              <li key={step.status} className="flex gap-3">
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    done
                      ? "bg-hud-proven"
                      : active
                        ? "animate-pulse bg-hud-unproven"
                        : "bg-hud-edge"
                  }`}
                />
                <span className="min-w-0">
                  <span
                    className={`block font-mono text-sm ${
                      done || active ? "text-hud-bone" : "text-hud-mute"
                    }`}
                  >
                    {step.title}
                  </span>
                  {(active || (complete && i === current)) && (
                    <span className="block font-mono text-xs leading-relaxed text-hud-mute">
                      {step.detail}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {!settled && (
        <p className="mt-3 border-t border-hud-edge pt-3 font-mono text-xs leading-relaxed text-hud-mute">
          This takes a few minutes. Close the terminal and keep playing — it keeps running without
          you.
        </p>
      )}
    </li>
  );
}
