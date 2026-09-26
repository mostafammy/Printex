import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const contents = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match?.[1] || process.env[match[1] ]) continue;
    process.env[match[1]] = match[2]?.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
} catch {
  // CI provides environment variables directly.
}
