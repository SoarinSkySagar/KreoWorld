import { PhaserGame } from "@/components/game/PhaserGame";

/**
 * The game screen — the Next.js shell that hosts the Phaser canvas. For item #1
 * it's just a framed canvas; the HUD, bars, and menus (BUILD_PLAN.md §Phase 1.6)
 * layer on top of this shell later.
 */
export default function PlayPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-[#070912] p-4 text-slate-200">
      <div className="flex w-full max-w-4xl items-center justify-between px-1">
        <h1 className="font-mono text-sm tracking-widest text-slate-400 uppercase">
          AttestCoin · Open World
        </h1>
        <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 font-mono text-[11px] text-slate-400">
          item&nbsp;#1 · engine + mock spine
        </span>
      </div>

      {/* Canvas frame. Aspect ratio matches the internal render resolution. */}
      <div className="aspect-[3/2] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-800 bg-[#0b0e1a] shadow-2xl shadow-black/50 ring-1 ring-white/5">
        <PhaserGame />
      </div>

      <p className="max-w-4xl px-1 text-center font-mono text-[11px] text-slate-600">
        placeholder boot scene · movement slice is next (Phase&nbsp;1.2)
      </p>
    </main>
  );
}
