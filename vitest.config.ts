import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests hit a real remote Supabase Postgres instance over
    // the network — the default 5s timeout occasionally trips under normal
    // pooler latency, especially with several tests running in parallel.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // tsconfig.json sets `"jsx": "preserve"` for Next's own (SWC) compiler;
  // Vite/esbuild must transform JSX itself when Vitest imports .tsx files
  // (e.g. src/app/layout.tsx, src/app/(shell)/**) directly, since nothing
  // else in the Vitest pipeline runs Next's compiler.
  oxc: {
    jsx: { runtime: "automatic" },
  },
});
