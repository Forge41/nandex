import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Only the pure modules are tested here -- the mapping between LiveKit's text
 * streams and our transcript shape is logic with real edge cases and no DOM. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
