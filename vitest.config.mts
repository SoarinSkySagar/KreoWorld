import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests cover the pure game logic only — the combat engine and encounter
 * placement. Anything touching Phaser or the DOM is deliberately out of scope;
 * those are exercised by running the game.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
