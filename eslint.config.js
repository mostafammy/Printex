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
  // --- Files module: relax strict type-checked rules for Prisma dynamic imports ---
  {
    files: [
      "src/app/api/files/**/*.ts",
      "src/server/files/**/*.ts",
      "src/server/core/storage/**/*.ts",
      "src/components/files/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
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
    // Nothing outside `src/server/auth/**` (and this project's own tests,
    // which deliberately unit-test auth's internal modules in isolation —
    // see tests/unit/authorize.test.ts, tests/integration/getActor.test.ts,
    // etc.) may deep-import its internals — the only legal public surface
    // for application code is the barrel export at `src/server/auth/index.ts`
    // (contracts/auth.md, contracts/audit.md, T036).
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/auth/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/auth/**", "!~/server/auth", "!~/server/auth/index"],
              message:
                "Import from the public barrel `~/server/auth` (src/server/auth/index.ts) instead of reaching into its internals (contracts/auth.md, contracts/audit.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Nothing outside `src/server/orders/**` (and tests/**, same exemption as
    // auth above) may deep-import its internals — the only legal public
    // surface for application code is the barrel export at
    // `src/server/orders/index.ts` (specs/011-orders-reception/data-model.md
    // "Module boundary").
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/orders/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/orders/**", "!~/server/orders", "!~/server/orders/index"],
              message:
                "Import from the public barrel `~/server/orders` (src/server/orders/index.ts) instead of reaching into its internals (specs/011-orders-reception/data-model.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Nothing outside `src/server/designers/**` (and tests/**, same exemption
    // as orders above) may deep-import its internals — the only legal public
    // surface for application code is the barrel export at
    // `src/server/designers/index.ts` (specs/012-designer-assignment-timers/
    // plan.md "Structure Decision").
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/designers/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/designers/**", "!~/server/designers", "!~/server/designers/index"],
              message:
                "Import from the public barrel `~/server/designers` (src/server/designers/index.ts) instead of reaching into its internals (specs/012-designer-assignment-timers/plan.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Nothing outside `src/server/review/**` (and tests/**, same exemption
    // as orders/designers above) may deep-import its internals — the only
    // legal public surface for application code is the barrel export at
    // `src/server/review/index.ts` (specs/013-review-rework/plan.md
    // "Structure Decision").
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/review/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/review/**", "!~/server/review", "!~/server/review/index"],
              message:
                "Import from the public barrel `~/server/review` (src/server/review/index.ts) instead of reaching into its internals (specs/013-review-rework/plan.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Nothing outside `src/server/production/**` (and tests/**, same
    // exemption as orders/designers/review above) may deep-import its
    // internals — the only legal public surface for application code is the
    // barrel export at `src/server/production/index.ts`
    // (specs/014-production/plan.md "Structure Decision").
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/production/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/production/**", "!~/server/production", "!~/server/production/index"],
              message:
                "Import from the public barrel `~/server/production` (src/server/production/index.ts) instead of reaching into its internals (specs/014-production/plan.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // Module-boundary rule, THREE barrels, ONE rule entry (T088):
    //   - Nothing outside `src/server/pricing/**` (and tests/**) may
    //     deep-import pricing internals; application code uses the pricing
    //     barrel.
    //   - Nothing outside `src/server/notifications/**` (and tests/**) may
    //     deep-import notifications internals; application code uses the
    //     notifications barrel.
    //   - Nothing outside `src/server/changes/**` (and tests/**) may
    //     deep-import its internals; application code uses the changes barrel
    //     (specs/016-change-control/contracts/change-control.md).
    // They share this block because ESLint flat config REPLACES a rule's
    // options per file instead of merging them — a second block that also
    // set `no-restricted-imports` would leave only whichever block comes
    // last in the array enforced and silently disable every other barrel
    // rule. Pattern style is unchanged from the original pricing rule: the
    // `!` exclusions keep each bare barrel import legal.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "src/server/pricing/**",
      "src/server/notifications/**",
      "src/server/changes/**",
      "tests/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/pricing/**", "!~/server/pricing", "!~/server/pricing/index"],
              message:
                "Import from the public barrel `~/server/pricing` instead of reaching into pricing internals.",
            },
            {
              group: [
                "~/server/notifications/**",
                "!~/server/notifications",
                "!~/server/notifications/index",
              ],
              message:
                "Import from the public barrel `~/server/notifications` instead of reaching into notifications internals.",
            },
            {
              group: [
                "~/server/changes/**",
                "!~/server/changes",
                "!~/server/changes/index",
              ],
              message:
                "Import from public barrel `~/server/changes` (src/server/changes/index.ts) instead reaching into its internals (specs/016-change-control/contracts/change-control.md).",
            },
          ],
        },
      ],
    },
  },
  // --- 017 Press Floor Board architectural boundaries (T002, plan.md S4, R1) ---
  {
    // Nothing outside `src/server/board/**` (and tests/**) may deep-import
    // board internals; application code uses the board barrel.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/board/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/board/**", "!~/server/board", "!~/server/board/index"],
              message:
                "Import from the public barrel `~/server/board` (src/server/board/index.ts) instead of reaching into its internals.",
            },
          ],
        },
      ],
    },
  },
  {
    // src/lib/board/** is a pure OOP engine (no React, DOM globals, components, or server logic)
    files: ["src/lib/board/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "src/lib/board is a pure engine and must not import react." },
            { name: "react-dom", message: "src/lib/board is a pure engine and must not import react-dom." },
            { name: "next", message: "src/lib/board is a pure engine and must not import next." },
          ],
          patterns: [
            {
              group: ["next/**"],
              message: "src/lib/board is a pure engine and must not import next/*.",
            },
            {
              group: ["~/components/**", "**/components/**"],
              message: "src/lib/board must not import components.",
            },
            {
              group: ["~/server/!(board)/**", "~/server/*", "!~/server/board", "!~/server/board/**"],
              message: "src/lib/board must not import src/server/**.",
            },
            {
              group: ["~/server/board/**", "~/server/board"],
              allowTypeImports: true,
              message: "src/lib/board may only import types from src/server/board.",
            },
          ],
        },
      ],
    },
  },
  {
    // Components in 017 board and shell must not import src/server/** directly (only import type allowed)
    files: [
      "src/components/board/**/*.ts",
      "src/components/board/**/*.tsx",
      "src/components/shell/**/*.ts",
      "src/components/shell/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/server/**", "**/server/**"],
              allowTypeImports: true,
              message:
                "Components must not import src/server/** except as type imports. Use server actions or board controller instead.",
            },
          ],
        },
      ],
    },
  },
  // --- 017 Metric Limits (T003, plan.md S1) ---
  {
    files: [
      "src/lib/board/**/*.ts",
      "src/server/board/**/*.ts",
      "src/components/board/**/*.ts",
      "src/components/board/**/*.tsx",
      "src/components/shell/**/*.ts",
      "src/components/shell/**/*.tsx",
    ],
    rules: {
      "max-lines": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 8],
      "max-params": ["error", 3],
      "max-depth": ["error", 3],
    },
  },
  {
    files: [
      "src/components/board/**/*.tsx",
      "src/components/shell/**/*.tsx",
    ],
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // (c) `core` functions return `Result<T, DomainError>` and never throw
    // (plan.md §5.2, §5.3) — except:
    // 1. `StorageAdapter` *implementations* under `src/server/core/storage/**`,
    //    which are Ports per contracts/storage.md and are allowed to throw/reject
    //    as their own contract; callers inside `core` catch and convert those
    //    rejections to `Result` at the call site, not the adapter itself.
    // 2. `src/server/core/aspects/**` (contracts/aspects.md §1) — transaction-boundary
    //    adapter: must reject to roll back; public entry points still return a Result.
    files: ["src/server/core/**/*.ts", "src/server/core/**/*.tsx"],
    ignores: ["src/server/core/storage/**", "src/server/core/aspects/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement",
          message:
            "src/server/core/** must not throw — return Result<T, DomainError> instead (plan.md §5.3). StorageAdapter implementations under src/server/core/storage/** and aspect engine adapters under src/server/core/aspects/** are exempt.",
        },
      ],
    },
  },
  {
    files: [
      "src/app/api/customers/**/*.ts",
      "src/components/customers/special-pricing-tab.tsx",
      "src/server/pricing/customer-rules.ts",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  // --- RTL logical-properties rule (research.md §10, SC-007) -----------------
  // Tailwind 4 ships CSS-based config (no `tailwind.config.js`), which most
  // published versions of `eslint-plugin-tailwindcss` still assume — it does
  // not have a clean v4 story, so this hand-rolls a rule the same way the
  // module-boundary rules above do: `no-restricted-syntax` selectors,
  // scoped to files that actually contain JSX/Tailwind classes
  // (`src/**/*.tsx`, `src/**/*.jsx` — covers src/app/** today and any future
  // UI code under src/components/** etc.), not the whole repo.
  //
  // Physical-direction utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`,
  // `right-`) break in RTL (constitution IX, FR-013) — logical-property
  // equivalents (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) must be used
  // instead. Matches both plain string class values
  // (`className="ml-2"`) and template-literal class values
  // (`className={`ml-2 ${x}`}`), including Tailwind variants
  // (`hover:ml-2`, `sm:-mr-4`).
  {
    files: ["src/**/*.tsx", "src/**/*.jsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(className|class)$/] Literal[value=/(^|[\\s\"'])-?(ml|mr|pl|pr)-|(^|[\\s\"'])-?(left|right)-/]",
          message:
            "Physical-direction Tailwind class (ml-/mr-/pl-/pr-/left-/right-) breaks RTL layouts — use the logical-property equivalent instead (ms-/me-/ps-/pe-/start-/end-, research.md §10, SC-007).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(className|class)$/] TemplateElement[value.raw=/(^|[\\s\"'])-?(ml|mr|pl|pr)-|(^|[\\s\"'])-?(left|right)-/]",
          message:
            "Physical-direction Tailwind class (ml-/mr-/pl-/pr-/left-/right-) breaks RTL layouts — use the logical-property equivalent instead (ms-/me-/ps-/pe-/start-/end-, research.md §10, SC-007).",
        },
      ],
    },
  },
);
