import { PhaserGame } from "@/components/game/PhaserGame";

/**
 * Root route boots straight into the full-screen game — no menu, no landing.
 * The canvas fills the entire viewport; HUD/overlays (Phase 1.6) layer on top of
 * this same shell later as absolutely-positioned elements over the canvas.
 */
export default function Home() {
  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-[#0b0e1a]">
      <PhaserGame className="h-full w-full" />
    </main>
  );
}
