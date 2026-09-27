// T014 / T074: 053 introduces ZERO new vocabulary and performs ZERO
// outbound I/O — the two constitution claims that are checkable as code
// rather than as promises.
//
// T014 guards constitution VI: 001's 22 permission keys and 7 role keys are
// frozen, and a 053 that added one would force a 001 amendment nobody
// noticed. The array literals below are a SNAPSHOT — when they change, this
// test fails and the change must be deliberate, reviewed as a 001 change,
// never slipped in as part of a notifications PR.
//
// T074 guards constitution VII / PRD §52: the feature must work with the WAN
// unplugged, which is only true if nothing in it ever opens a socket. A
// structural assertion (no network-capable imports in the module) holds
// unconditionally; a cable-pulling test would only hold while the cable is
// pulled.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ALL_ROLE_KEYS } from "~/server/auth";
import { DELAY_PHASES } from "~/server/notifications";

describe("frozen vocabulary (T014 / constitution VI)", () => {
  it("still has exactly 22 permission keys, unchanged from 001", () => {
    // The frozen set. If this fails, someone added a key — which requires a
    // 001 amendment, not an edit here to make CI green.
    expect([...ALL_PERMISSIONS].sort()).toEqual(
      [
        "order.create",
        "order.edit",
        "order.cancel",
        "customer.manage",
        "workitem.assign_designer",
        "design.work",
        "design.review",
        "production.operate",
        "collection.receive",
        "delivery.record",
        "pricing.use_fixed",
        "pricing.set_variable",
        "pricing.override",
        "payment.record",
        "payment.void",
        "expense.record",
        "finance.view",
        "files.download_production",
        "audit.view",
        "admin.users",
        "admin.config",
        "admin.override",
      ].sort(),
    );
    expect(ALL_PERMISSIONS).toHaveLength(22);
  });

  it("still has exactly 7 role keys, unchanged from 001", () => {
    expect([...ALL_ROLE_KEYS].sort()).toEqual(
      [
        "ACCOUNTING",
        "ADMIN_OWNER",
        "DESIGNER",
        "HEAD_DESIGNER",
        "PRINT_RECEPTION_DELIVERY",
        "PRODUCTION_OPERATOR",
        "RECEPTION",
      ].sort(),
    );
    expect(ALL_ROLE_KEYS).toHaveLength(7);
  });

  it("053's DelayPhase vocabulary stays at five — a new AXIS is a code change", () => {
    // constitution VI's measurement-axis rule: a new *threshold* is a row,
    // a new *phase to measure* needs a new age source and derivation rule,
    // so it must not be data- or PR-added.
    expect(DELAY_PHASES).toHaveLength(5);
  });
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

describe("local-only operation (T074 / constitution VII / PRD §52)", () => {
  it("performs no outbound network I/O anywhere in the module", () => {
    // The import shapes that open a socket or issue an HTTP request. None is
    // needed: the stream is served by this process, the outbox is the local
    // Postgres, and delivery is an insert.
    const forbidden = [
      "node:http",
      "node:https",
      "node:net",
      "node:dgram",
      "node:dns",
      "undici",
      "node-fetch",
      "axios",
      "ws",
      "socket.io",
    ];

    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src", "server", "notifications"))) {
      const text = readFileSync(file, "utf-8");
      for (const moduleName of forbidden) {
        // Match `from "axios"`, `import("ws")`, `require("node:http")`.
        if (text.includes(`"${moduleName}"`) || text.includes(`'${moduleName}'`)) {
          offenders.push(`${file}: ${moduleName}`);
        }
      }
    }

    // Also a generic `fetch(` — Node has a global fetch, so the import list
    // alone would miss the common case.
    for (const file of sourceFiles(join(process.cwd(), "src", "server", "notifications"))) {
      const text = readFileSync(file, "utf-8");
      const code = text
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      if (/\bfetch\s*\(/.test(code)) offenders.push(`${file}: fetch()`);
    }

    expect(offenders).toEqual([]);
  });

  it("the SSE route and client hook are the only transport surfaces", async () => {
    // They speak to the LOCAL server (same origin, relative URL), which is
    // why they do not trip the import check above: EventSource and fetch
    // here target /api/notifications/stream, not an external host.
    const route = readFileSync(
      join(process.cwd(), "src", "app", "api", "notifications", "stream", "route.ts"),
      "utf-8",
    );
    expect(route).not.toMatch(/https?:\/\//); // no absolute external URL

    const hook = readFileSync(
      join(process.cwd(), "src", "components", "notifications", "use-notification-stream.ts"),
      "utf-8",
    );
    expect(hook).toContain("/api/notifications/stream");
    expect(hook).not.toMatch(/["'`]https?:\/\//); // same-origin only
  });
});
