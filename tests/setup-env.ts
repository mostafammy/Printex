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

// jsdom has no ResizeObserver, but SubLane measures its scroll container
// with one on mount — without this every component test rendering a lane
// dies with `ReferenceError: ResizeObserver is not defined`.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {
      return undefined;
    }
    unobserve(): void {
      return undefined;
    }
    disconnect(): void {
      return undefined;
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}
