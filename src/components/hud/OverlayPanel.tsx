"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store/gameStore";

/**
 * Shared chrome for the full-screen panels. Owns the behaviour that is easy to
 * forget and annoying to get wrong: Escape closes, the backdrop closes, focus
 * moves into the panel on open so keyboard users are not stranded behind it, and
 * the canvas underneath is dimmed rather than hidden so the player keeps their
 * bearings.
 */
export function OverlayPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const closeOverlay = useGameStore((s) => s.closeOverlay);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOverlay]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close panel"
        onClick={closeOverlay}
        className="absolute inset-0 cursor-default bg-hud-ink/80 backdrop-blur-[1px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hud-edge bg-hud-raised outline-none"
      >
        <header className="flex items-baseline justify-between border-b border-hud-edge px-7 py-4">
          <h2 className="font-mono text-sm uppercase tracking-[0.24em] text-hud-bone">{title}</h2>
          <button
            type="button"
            onClick={closeOverlay}
            className="rounded-lg font-mono text-xs uppercase tracking-[0.14em] text-hud-mute transition-colors hover:text-hud-bone focus-visible:text-hud-bone focus-visible:outline-1 focus-visible:outline-hud-proven"
          >
            {hint}
          </button>
        </header>

        <div className="overflow-y-auto px-7 py-6">{children}</div>
      </div>
    </div>
  );
}
