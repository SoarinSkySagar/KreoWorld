import { GameShell } from "@/components/game/GameShell";

/**
 * Root route boots straight into the full-screen game — no menu, no landing.
 * The canvas fills the viewport and the HUD layers over it.
 */
export default function Home() {
  return <GameShell />;
}
