import { PhaserGame } from "@/components/game/PhaserGame";

/**
 * Test route for the second city (south + east exits). Not linked from
 * anywhere in the game — cities are standalone and not connected to each
 * other; this route exists purely to preview/verify this map in isolation.
 */
export default function City1() {
  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-[#0b0e1a]">
      <PhaserGame className="h-full w-full" mapKey="town-b" />
    </main>
  );
}
