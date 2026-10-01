// Unit tests for the demo-tool summary parser and mode routing.
//
// The parser is the only pure logic in the demo path, and it is the thing that
// silently breaks if the script's summary shape changes: a parse failure would
// surface to an admin as "the database may be unchanged" right after a
// destructive TRUNCATE, which is the worst possible moment to be vague.

import { describe, it, expect } from "vitest";
import { parseDemoSummary } from "~/server/admin/demo";

const SENTINEL = "::PRINTEX-DEMO-SUMMARY::";

describe("parseDemoSummary", () => {
  it("returns null when the script printed no summary line", () => {
    expect(parseDemoSummary("✓ Truncate completed.\n")).toBeNull();
    expect(parseDemoSummary("")).toBeNull();
  });

  it("ignores human-facing console output around the summary line", () => {
    const stdout = [
      "=================================================",
      "🧹 STARTING OPERATIONAL DATA PURGE",
      "=================================================",
      "✓ Truncate completed.",
      `${SENTINEL}{"mode":"purge-transactional","before":{"orders":48},"after":{"orders":0},"durationMs":900}`,
      "",
    ].join("\n");

    const result = parseDemoSummary(stdout);

    expect(result).not.toBeNull();
    expect(result?.action).toBe("purge");
    expect(result?.before).toEqual({ orders: 48 });
    expect(result?.after).toEqual({ orders: 0 });
    expect(result?.durationMs).toBe(900);
  });

  it("maps purge-transactional to the purge action", () => {
    const line = `${SENTINEL}{"mode":"purge-transactional","after":{}}`;
    expect(parseDemoSummary(line)?.action).toBe("purge");
  });

  it("maps the reseed mode to the reseed action", () => {
    const line = `${SENTINEL}{"mode":"reseed","after":{"orders":48}}`;
    expect(parseDemoSummary(line)?.action).toBe("reseed");
  });

  it("returns null on malformed JSON instead of throwing", () => {
    // Throwing here would surface as an unhandled rejection in the server action
    // and lose the actual script output that explains what went wrong.
    expect(parseDemoSummary(`${SENTINEL}{not json`)).toBeNull();
  });

  it("tolerates a summary missing optional fields", () => {
    const result = parseDemoSummary(`${SENTINEL}{"mode":"reseed"}`);

    expect(result?.before).toBeNull();
    expect(result?.after).toEqual({});
    expect(result?.durationMs).toBe(0);
  });

  it("does not match a sentinel that is not at the start of a line", () => {
    expect(parseDemoSummary(`noise ${SENTINEL}{"mode":"reseed"}`)).toBeNull();
  });
});
