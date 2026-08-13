/**
 * The single entry point for game data. EVERY UI component imports `gameService`
 * from here and nothing else — components never touch a mock, a contract, a
 * worker, or an RPC directly.
 *
 * This is the swap point (BUILD_PLAN.md §Phase 3.1): when real backends land,
 * flip the implementation assigned to `gameService` here — ideally one line,
 * not a rewrite. Consider a `NEXT_PUBLIC_SERVICE_IMPL` env switch to keep the
 * mock available for storybook/offline dev alongside the real one.
 */

import type { GameService } from "./gameService";
import { mockGameService } from "./mock/mockGameService";

export const gameService: GameService = mockGameService;

export type { GameService } from "./gameService";
export * from "./types";
