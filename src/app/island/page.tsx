import { GameShell } from "@/components/game/GameShell";

/**
 * Test route for the central hub ("the Pump") — a small island in a moat,
 * reached by bridges from three sides, with one large building at its centre.
 * Not linked from anywhere in the game yet; standalone for preview/verification.
 */
export default function Island() {
  return <GameShell mapKey="pump" />;
}
