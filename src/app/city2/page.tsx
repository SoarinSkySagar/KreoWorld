import { GameShell } from "@/components/game/GameShell";

/**
 * Test route for the third city (south + west exits). Not linked from
 * anywhere in the game — cities are standalone and not connected to each
 * other; this route exists purely to preview/verify this map in isolation.
 */
export default function City2() {
  return <GameShell mapKey="town-c" />;
}
