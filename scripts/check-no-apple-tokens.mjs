#!/usr/bin/env node
/**
 * scripts/check-no-apple-tokens.mjs
 * CI token verification script asserting zero occurrences of `apple-` identifiers remain in `src/`.
 * (specs/017-press-floor-board/plan.md S6, contracts/ink-tokens.md §Removed from globals.css)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = join(process.cwd(), "src");
const FORBIDDEN_PATTERN = /\bapple-[a-zA-Z0-9_-]+/g;

function scanDir(dir, findings) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, findings);
    } else if (stat.isFile() && /\.(tsx?|jsx?|css|json)$/.test(entry)) {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.match(FORBIDDEN_PATTERN);
        if (matches) {
          findings.push({
            file: fullPath.replace(process.cwd() + "/", ""),
            line: i + 1,
            match: matches.join(", "),
            snippet: line.trim(),
          });
        }
      }
    }
  }
}

const findings = [];
scanDir(SRC_DIR, findings);

if (findings.length > 0) {
  console.error(`❌ Found ${findings.length} forbidden 'apple-*' token occurrence(s) in src/:`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} [${f.match}] -> ${f.snippet}`);
  }
  process.exit(1);
} else {
  console.log("✅ Zero 'apple-*' tokens found in src/. Verification passed!");
  process.exit(0);
}
