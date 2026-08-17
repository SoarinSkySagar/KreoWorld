import type { ProofStatus } from "@/lib/services/types";

/**
 * The four stages a spend passes through, in order, with the plain-language
 * explanation of each. The wait is real — attestation takes minutes — so the UI
 * names what is happening instead of showing an unexplained spinner. Wording
 * here mirrors the actual protocol path (CLAUDE.md §1).
 */
export const PROOF_STEPS = [
  {
    status: "pending",
    title: "Waiting for attestation",
    detail: "The block holding your spend has to be attested on Creditcoin first.",
  },
  {
    status: "proving",
    title: "Building the proof",
    detail: "Generating the inclusion proof for your transaction.",
  },
  {
    status: "verified",
    title: "Verified on Creditcoin",
    detail: "The contract confirmed your transaction was included and succeeded.",
  },
  {
    status: "rewarded",
    title: "Rewarded",
    detail: "Your universe advanced and project token was credited.",
  },
] as const satisfies readonly { status: ProofStatus; title: string; detail: string }[];

/** How far along a ticket is. `failed` returns -1 — it left the ladder. */
export function stepIndex(status: ProofStatus): number {
  return PROOF_STEPS.findIndex((s) => s.status === status);
}
