import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default tseslint.config(
  {
    ignores: [".next"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  // --- Module boundary rules (plan.md §5.1, §5.3, §5.6) ---------------------
  // `src/server/core/**` is a framework-agnostic domain layer (hexagonal
  // architecture). These rules enforce, via `pnpm check`, the three
  // boundaries the design relies on instead of relying on review discipline
  // alone. Once `src/server/core/**` is actually populated (Phase 2+ of
  // specs/002-core-domain-shell/tasks.md), violations here fail CI.
  {
    // (a) `core` must not import from `src/app/**` or from any other
    // `src/server/<feature>/**` module — only from itself.
    files: ["src/server/core/**/*.ts", "src/server/core/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/app/**", "~/app"],
              message:
                "src/server/core/** is a framework-agnostic domain layer and must not import from src/app/** (plan.md §5.1).",
            },
            {
              group: ["~/server/*/**", "!~/server/core/**"],
              message:
                "src/server/core/** must not import from another src/server/<feature>/** module — only from itself. Two features talk to each other only via the frozen contract (plan.md §5.1).",
            },
          ],
        },
      ],
    },
  },
  {
    // (b) Nothing outside `src/server/core/**` may deep-import its
    // internals — the only legal public surface is the barrel export at
    // `src/server/core/index.ts` (plan.md §5.6). This barrel does not exist
    // yet; the rule is a no-op until it and its first deep-importable
    // internals land, then becomes enforced automatically.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/core/**", "!~/server/core", "!~/server/core/index"],
              message:
                "Import from the public barrel `~/server/core` (src/server/core/index.ts) instead of reaching into its internals (plan.md §5.6).",
            },
          ],
        },
      ],
    },
  },
  {
    // (c) `core` functions return `Result<T, DomainError>` and never throw
    // (plan.md §5.2, §5.3) — except `StorageAdapter` *implementations* under
    // `src/server/core/storage/**`, which are Ports per contracts/storage.md
    // and are allowed to throw/reject as their own contract; callers inside
    // `core` catch and convert those rejections to `Result` at the call
    // site, not the adapter itself.
    files: ["src/server/core/**/*.ts", "src/server/core/**/*.tsx"],
    ignores: ["src/server/core/storage/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement",
          message:
            "src/server/core/** must not throw — return Result<T, DomainError> instead (plan.md §5.3). StorageAdapter implementations under src/server/core/storage/** are exempt.",
        },
      ],
    },
  },
);
