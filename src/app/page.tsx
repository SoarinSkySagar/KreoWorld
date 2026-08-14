import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 bg-[#070912] p-8 text-slate-200">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-xs tracking-[0.3em] text-cyan-400/70 uppercase">
          AttestCoin Protocol
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Defend your universe.
        </h1>
        <p className="max-w-md text-balance text-sm text-slate-400">
          The elixir is corrupted. The world advances only on real, proven
          contributions — progress is proven, not claimed.
        </p>
      </div>

      <Link
        href="/play"
        className="rounded-lg bg-cyan-400 px-6 py-3 font-mono text-sm font-semibold tracking-wide text-slate-950 transition hover:bg-cyan-300"
      >
        Enter the world →
      </Link>

      <p className="font-mono text-[11px] text-slate-700">
        frontend-first build · running on the mock service layer
      </p>
    </main>
  );
}
