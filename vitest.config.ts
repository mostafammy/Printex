import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
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
    jsx: "automatic",
  },
});
