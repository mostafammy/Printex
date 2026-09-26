// Unit tests for the pure half of 053: the state->phase mapping, the one age
// formatter, the derived-event fan-out, the catalog's alias table, and the
// override union. None of these touch a database, which is what makes them
// cheap enough to be the first thing anyone runs after a change.

import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  ALL_ROLE_KEYS,
} from "~/server/auth";
import {
  CATALOG,
  canonicalType,
  deriveDelay,
  evaluateDelay,
  Events,
  formatAge,
  formatDuration,
  isTerminalState,
  lookup,
  parseDuration,
  phaseForState,
  renderEntry,
  spellingsOf,
  toArabicDigits,
  unionSpecs,
  type DelayPhase,
  type ThresholdRow,
} from "~/server/notifications";
import { deriveFromStateChange, collapseByUser } from "~/server/notifications/derived";

const STATES = [
  "NEW", "ASSIGNED", "IN_DESIGN", "DESIGN_COMPLETED", "WAITING_REVIEW",
  "REWORK_REQUIRED", "APPROVED", "WAITING_PRICING", "READY_FOR_PRODUCTION",
  "IN_PRODUCTION", "PRODUCTION_COMPLETED", "READY_FOR_COLLECTION",
  "DELIVERED", "COMPLETED", "CANCELLED",
] as const;

const ANCHOR_OLD = new Date("2026-09-26T00:00:00Z");
const NOW = new Date("2026-09-26T05:00:00Z"); // 300 minutes later

describe("state -> phase mapping (T015 / SC-011)", () => {
  it("maps the five measured phases and leaves everything else unmeasured", () => {
    expect(phaseForState("ASSIGNED")).toBe("DESIGN");
    expect(phaseForState("IN_DESIGN")).toBe("DESIGN");
    expect(phaseForState("WAITING_REVIEW")).toBe("REVIEW");
    expect(phaseForState("REWORK_REQUIRED")).toBe("REVIEW");
    expect(phaseForState("READY_FOR_PRODUCTION")).toBe("PRODUCTION");
    expect(phaseForState("IN_PRODUCTION")).toBe("PRODUCTION");
    expect(phaseForState("READY_FOR_COLLECTION")).toBe("COLLECTION");

    // Deliberately unmeasured: nothing is waiting on anyone for these.
    expect(phaseForState("NEW")).toBeNull();
    expect(phaseForState("DESIGN_COMPLETED")).toBeNull();
    expect(phaseForState("APPROVED")).toBeNull();
    expect(phaseForState("WAITING_PRICING")).toBeNull();
  });

  it("never measures a terminal state (FR-039)", () => {
    for (const state of ["DELIVERED", "COMPLETED", "CANCELLED"] as const) {
      expect(isTerminalState(state)).toBe(true);
      const derived = deriveDelay({
        workItemId: "w",
        state,
        requiresDesign: true,
        openQueueStartedAt: ANCHOR_OLD,
        pricingWaitingSince: null,
        pricingResolved: false,
        now: NOW,
      });
      // A stale anchor on a delivered item must never surface it as late.
      expect(derived.phase).toBeNull();
      expect(derived.waitingAgeMinutes).toBeNull();
    }
  });

  it("is never design-delayed when the item never needed a design (FR-040)", () => {
    for (const state of ["ASSIGNED", "IN_DESIGN"] as const) {
      const derived = deriveDelay({
        workItemId: "w",
        state,
        requiresDesign: false,
        openQueueStartedAt: ANCHOR_OLD,
        pricingWaitingSince: null,
        pricingResolved: false,
        now: NOW,
      });
      expect(derived.phase).toBeNull();
    }
  });

  it("measures pricing from PricingStatus even while IN PRODUCTION (PRD §55 Rule 9)", () => {
    const derived = deriveDelay({
      workItemId: "w",
      state: "IN_PRODUCTION",
      requiresDesign: false,
      openQueueStartedAt: ANCHOR_OLD,
      pricingWaitingSince: ANCHOR_OLD,
      pricingResolved: false,
      now: NOW,
    });
    expect(derived.phase).toBe("PRICING");
    expect(derived.anchor).toBe("PRICING_STATUS");
    expect(derived.waitingAgeMinutes).toBe(300);
  });

  it("measures a dispute as still-unresolved pricing", () => {
    const derived = deriveDelay({
      workItemId: "w",
      state: "IN_DESIGN",
      requiresDesign: true,
      openQueueStartedAt: ANCHOR_OLD,
      pricingWaitingSince: ANCHOR_OLD,
      // pricingResolved is the PRICED/else test, so a dispute (not resolved)
      // must keep aging.
      pricingResolved: false,
      now: NOW,
    });
    expect(derived.phase).toBe("PRICING");
  });
});

describe("one shared age formatter (T016 / SC-012)", () => {
  it("renders the same age identically everywhere", () => {
    expect(formatAge(0)).toBe("٠د");
    expect(formatAge(45)).toBe("٤٥د");
    expect(formatAge(60)).toBe("١س");
    expect(formatAge(134)).toBe("٢س ١٤د");
    expect(formatAge(1440)).toBe("٢٤س");
  });

  it("never renders a negative age", () => {
    expect(formatAge(-5)).toBe("٠د");
  });

  it("round-trips durations through the Admin input format", () => {
    expect(parseDuration("30")).toBe(30);
    expect(parseDuration("4h")).toBe(240);
    expect(parseDuration("1h30m")).toBe(90);
    expect(parseDuration("")).toBeNull();
    expect(Number.isNaN(parseDuration("soon"))).toBe(true);

    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(240)).toBe("4h");
    expect(formatDuration(90)).toBe("1h30m");
    expect(formatDuration(null)).toBe("");
  });

  it("converts digits to Arabic-Indic", () => {
    expect(toArabicDigits(134)).toBe("١٣٤");
  });
});

describe("threshold evaluation", () => {
  const threshold: ThresholdRow = {
    phase: "REVIEW",
    thresholdMinutes: 60,
    alertRoles: ["HEAD_DESIGNER"],
    alertPermissions: [],
    alertDepartmentIds: [],
  };
  const map: ReadonlyMap<DelayPhase, ThresholdRow> = new Map([["REVIEW", threshold]]);

  it("is not late at exactly the threshold", () => {
    const outcome = evaluateDelay(
      { phase: "REVIEW", anchor: "PHASE_TIMING", waitingSince: NOW, waitingAgeMinutes: 60 },
      map,
    );
    expect(outcome.kind).toBe("NONE");
  });

  it("is late one minute past it", () => {
    const outcome = evaluateDelay(
      { phase: "REVIEW", anchor: "PHASE_TIMING", waitingSince: NOW, waitingAgeMinutes: 61 },
      map,
    );
    expect(outcome.kind).toBe("DELAYED");
  });

  it("never alerts on a DISABLED phase (thresholdMinutes = null)", () => {
    const disabled: ReadonlyMap<DelayPhase, ThresholdRow> = new Map([
      ["COLLECTION", { ...threshold, phase: "COLLECTION", thresholdMinutes: null }],
    ]);
    const outcome = evaluateDelay(
      { phase: "COLLECTION", anchor: "PHASE_TIMING", waitingSince: NOW, waitingAgeMinutes: 999_999 },
      disabled,
    );
    expect(outcome.kind).toBe("NONE");
  });
});

describe("derived events from work_item.state_changed (T023)", () => {
  it("derives awaiting-review on entry to WAITING_REVIEW", () => {
    const derived = deriveFromStateChange({
      from: "DESIGN_COMPLETED",
      to: "WAITING_REVIEW",
      orderPriority: "NORMAL",
    });
    expect(derived.map((d) => d.type)).toContain("work_item.awaiting_review");
  });

  it("produces TWO entries for an urgent move into production — by design", () => {
    const derived = deriveFromStateChange({
      from: "APPROVED",
      to: "READY_FOR_PRODUCTION",
      orderPriority: "URGENT",
    });
    const types = derived.map((d) => d.type);
    expect(types).toContain("work_item.ready_for_production");
    expect(types).toContain("work_item.urgent");
  });

  it("derives nothing for a NORMAL move into production beyond the one entry", () => {
    const derived = deriveFromStateChange({
      from: "APPROVED",
      to: "READY_FOR_PRODUCTION",
      orderPriority: "NORMAL",
    });
    expect(derived.map((d) => d.type)).toEqual(["work_item.ready_for_production"]);
  });

  it("collapses a user reached twice to ONE entry at the higher severity", () => {
    const collapsed = collapseByUser([
      { userId: "u1", event: { type: "work_item.ready_for_production", severity: "ACTION" } },
      { userId: "u1", event: { type: "work_item.urgent", severity: "URGENT" } },
      { userId: "u2", event: { type: "work_item.ready_for_production", severity: "ACTION" } },
    ]);
    expect(collapsed).toHaveLength(2);
    const forU1 = collapsed.find((c) => c.userId === "u1");
    // The URGENT entry wins — collapsing by insertion order would have kept
    // the ACTION one and arrived at the right count by the wrong route.
    expect(forU1?.event.severity).toBe("URGENT");
  });
});

describe("catalog integrity (T014 / T021 / T082 / SC-015)", () => {
  it("introduces NO permission key — every catalog Permission is a 001 key", () => {
    const known = new Set<string>(ALL_PERMISSIONS);
    for (const entry of CATALOG) {
      const spec = typeof entry.recipients === "function" ? entry.recipients({
        payload: { assigneeId: "a", departmentId: "d" },
        entityId: "e",
      }) : entry.recipients;
      for (const permission of spec.permissions ?? []) {
        expect(known, `${entry.type} uses unknown permission ${permission}`).toContain(permission);
      }
    }
  });

  it("introduces no role key either", () => {
    const known = new Set<string>(ALL_ROLE_KEYS);
    for (const entry of CATALOG) {
      const spec = typeof entry.recipients === "function" ? entry.recipients({
        payload: { assigneeId: "a", departmentId: "d" },
        entityId: "e",
      }) : entry.recipients;
      for (const role of spec.roles ?? []) {
        expect(known, `${entry.type} uses unknown role ${role}`).toContain(role);
      }
    }
  });

  it("addresses no employee by name or id — only configuration", () => {
    // SC-015: delivery rules must not single out a person. A literal id or a
    // personal name in a recipient spec is the failure this asserts against.
    for (const entry of CATALOG) {
      const spec = typeof entry.recipients === "function" ? entry.recipients({
        payload: { assigneeId: "a", departmentId: "d" },
        entityId: "e",
      }) : entry.recipients;
      for (const id of spec.userIds ?? []) {
        // The only permitted literal is reading the assignee OUT OF THE
        // PAYLOAD, which is a per-event decision, not a hard-coded person.
        expect(id, `${entry.type} hard-codes a user id`).not.toMatch(/^(?!a$)/);
      }
    }
  });

  it("resolves both spellings of 012/013/014's events to one entry (T021)", () => {
    expect(canonicalType("workitem.rejected")).toBe("workitem.rejected");
    expect(canonicalType("work_item.rejected")).toBe("workitem.rejected");
    expect(canonicalType("workitem.assigned")).toBe("workitem.assigned");
    expect(canonicalType("work_item.assigned")).toBe("workitem.assigned");
    expect(canonicalType("work_item.production_file_revised")).toBe("workitem.production_file_revised");
    expect(canonicalType("workitem.production_file_revised")).toBe("workitem.production_file_revised");
  });

  it("expands a filter to every spelling of the type", () => {
    const spellings = spellingsOf("workitem.rejected");
    expect(spellings).toContain("workitem.rejected");
    expect(spellings).toContain("work_item.rejected");
  });

  it("leaves an unknown type unmapped rather than guessing (FR-019)", () => {
    expect(lookup("totally.unknown.event")).toBeUndefined();
    expect(canonicalType("totally.unknown.event")).toBeUndefined();
  });

  it("gives every DIRECT entry an Arabic title and a valid severity", () => {
    for (const entry of CATALOG) {
      if (entry.delivery !== "DIRECT") continue;
      expect(entry.title.length, `${entry.type} has no Arabic title`).toBeGreaterThan(0);
      // Arabic ranges, so a Latin placeholder cannot pass silently.
      expect(entry.title, `${entry.type} title is not Arabic`).toMatch(/[؀-ۿ]/);
      expect(["INFO", "ACTION", "URGENT"]).toContain(entry.severity);
    }
  });

  it("exposes one constant per emitter-visible type", () => {
    for (const value of Object.values(Events)) {
      expect(canonicalType(value), `${value} is not in the catalog`).toBe(value);
    }
  });

  it("never lets a body or link throw out of renderEntry", () => {
    const hostile = {
      ...CATALOG[0]!,
      type: "test.hostile",
      body: () => {
        throw new Error("boom");
      },
      link: () => {
        throw new Error("boom");
      },
    };
    const rendered = renderEntry(hostile, { payload: null, entityId: null });
    // Degrades to a title-only notification; never drops the event.
    expect(rendered.body).toBeNull();
    expect(rendered.linkHref).toBeNull();
  });
});

describe("override union semantics (T077 / FR-017)", () => {
  it("ADDS recipients and never removes the catalog's own", () => {
    const base = { roles: ["HEAD_DESIGNER"], userIds: ["designer-1"] };
    const override = { roles: ["ADMIN_OWNER"] };
    const union = unionSpecs(base, override);
    expect(union.roles).toEqual(expect.arrayContaining(["HEAD_DESIGNER", "ADMIN_OWNER"]));
    // The catalog's own recipient survives an override that omits it.
    expect(union.userIds).toEqual(["designer-1"]);
  });

  it("treats an empty or absent override as adding nothing", () => {
    const base = { roles: ["HEAD_DESIGNER"] };
    expect(unionSpecs(base, null).roles).toEqual(["HEAD_DESIGNER"]);
    expect(unionSpecs(base, {}).roles).toEqual(["HEAD_DESIGNER"]);
    expect(unionSpecs(base, { roles: [] }).roles).toEqual(["HEAD_DESIGNER"]);
  });

  it("deduplicates a recipient reached by both the base and the override", () => {
    const union = unionSpecs({ roles: ["ACCOUNTING"] }, { roles: ["ACCOUNTING"] });
    expect(union.roles).toEqual(["ACCOUNTING"]);
  });
});
