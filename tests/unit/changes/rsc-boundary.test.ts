// tests/unit/changes/rsc-boundary.test.ts
// Verifies React Server Component bundling boundaries for client components.
// B1 blocker: No "use client" file in src/components may have a non-type (value) import from ~/server/**.

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function getTsxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function isUseClientFile(sourceFile: ts.SourceFile): boolean {
  if (sourceFile.statements.length === 0) return false;
  const firstStmt = sourceFile.statements[0];
  if (!firstStmt || !ts.isExpressionStatement(firstStmt)) return false;
  if (!ts.isStringLiteral(firstStmt.expression)) return false;
  return firstStmt.expression.text === "use client";
}

export function findNonTypeServerImports(sourceFile: ts.SourceFile): string[] {
  const violations: string[] = [];
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleName = ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : "";
      if (
        moduleName.startsWith("~/server") ||
        moduleName.startsWith("@/server") ||
        moduleName.includes("/server/")
      ) {
        // Enforce ONLY `import type` from ~/server/** in client components
        if (!stmt.importClause?.isTypeOnly) {
          violations.push(stmt.getText(sourceFile));
        }
      }
    }
  }
  return violations;
}

describe("RSC boundary: src/components client imports", () => {
  const componentsDir = path.resolve(process.cwd(), "src/components");
  const allTsxFiles = getTsxFiles(componentsDir);

  it("finds client components in src/components", () => {
    expect(allTsxFiles.length).toBeGreaterThan(0);
    const clientFiles = allTsxFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
      return isUseClientFile(sf);
    });
    expect(clientFiles.length).toBeGreaterThan(0);
    const relativePaths = clientFiles.map((p) => path.relative(componentsDir, p));
    expect(relativePaths).toContain("changes/direct-edit-spec-form.tsx");
  });

  it("ensures every 'use client' file in src/components has zero non-type imports from ~/server", () => {
    const failures: { file: string; violations: string[] }[] = [];

    for (const filePath of allTsxFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

      if (isUseClientFile(sf)) {
        const violations = findNonTypeServerImports(sf);
        if (violations.length > 0) {
          failures.push({
            file: path.relative(process.cwd(), filePath),
            violations,
          });
        }
      }
    }

    expect(
      failures,
      `Found "use client" components with non-type imports from ~/server:\n${failures
        .map((f) => `  ${f.file}: ${f.violations.join(", ")}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("correctly identifies non-type vs type imports from ~/server in test snippets", () => {
    const badCode = `
      "use client";
      import { specEditPolicy } from "~/server/changes";
      export function Foo() { return null; }
    `;
    const badSf = ts.createSourceFile("bad.tsx", badCode, ts.ScriptTarget.Latest, true);
    expect(isUseClientFile(badSf)).toBe(true);
    expect(findNonTypeServerImports(badSf)).toHaveLength(1);

    const goodCode = `
      "use client";
      import type { SpecEditPolicy } from "~/server/changes";
      export function Foo() { return null; }
    `;
    const goodSf = ts.createSourceFile("good.tsx", goodCode, ts.ScriptTarget.Latest, true);
    expect(isUseClientFile(goodSf)).toBe(true);
    expect(findNonTypeServerImports(goodSf)).toHaveLength(0);
  });
});
