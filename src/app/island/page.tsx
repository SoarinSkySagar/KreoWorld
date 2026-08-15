import { PhaserGame } from "@/components/game/PhaserGame";

/**
 * Test route for the central hub ("the Pump") — a small island in a moat,
 * reached by bridges from three sides, with one large building at its centre.
 * Not linked from anywhere in the game yet; standalone for preview/verification.
 */
export default function Island() {
  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-[#0b0e1a]">
      <PhaserGame className="h-full w-full" mapKey="pump" />
    </main>
  );
}
