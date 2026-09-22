// @vitest-environment jsdom
//
// Shell navigation test — tasks.md T029 (US3). Written before T031/T032 are
// implemented; at that point `src/app/layout.tsx` still has
// `<html lang="en">` with no `dir`, so scenario (a) below fails until T031
// lands. `filterNavByPermissions` (T032's testable core) and `SidebarNav`
// already exist as of this commit so (b)/(c) can be authored against a real
// signature per the TDD note in tasks.md.
//
// Covers spec.md User Story 3, Acceptance Scenarios 1 & 2 (FR-013).
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { asUserId } from "~/server/core/ids";

// next/font/google's exports only work under the Next.js compiler (webpack/
// turbopack loader magic); imported directly under Vitest they throw. Stub
// the one font function the root layout uses so we can render it here.
vi.mock("next/font/google", () => ({
  IBM_Plex_Sans_Arabic: () => ({
    className: "font-ibm-plex-sans-arabic",
    variable: "--font-arabic",
  }),
}));

const ARABIC_RANGE = /[؀-ۿ]/;

describe("root layout — RTL document configuration", () => {
  it("sets dir=\"rtl\" and lang=\"ar\" on <html>", async () => {
    const { default: RootLayout } = await import("~/app/layout");

    const html = renderToStaticMarkup(
      RootLayout({ children: "content" as unknown as React.ReactNode }),
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });
});

describe("filterNavByPermissions", () => {
  it("shows only entries the actor's roles allow", async () => {
    const { filterNavByPermissions, navItems } = await import(
      "~/app/(shell)/nav"
    );

    const reception = filterNavByPermissions(
      { id: asUserId("u1"), roles: ["reception"], departmentIds: [] },
      navItems,
    );
    const ids = reception.map((i) => i.id);

    expect(ids).toContain("my-queue");
    expect(ids).toContain("reception");
    expect(ids).not.toContain("design");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("delivery");
    expect(ids).not.toContain("admin");
  });

  it("shows every entry to an admin actor", async () => {
    const { filterNavByPermissions, navItems } = await import(
      "~/app/(shell)/nav"
    );

    const admin = filterNavByPermissions(
      { id: asUserId("u2"), roles: ["admin"], departmentIds: [] },
      navItems,
    );

    expect(admin.map((i) => i.id).sort()).toEqual(
      [...navItems].map((i) => i.id).sort(),
    );
  });

  it("shows only the roleless entries to an actor with no roles", async () => {
    const { filterNavByPermissions, navItems } = await import(
      "~/app/(shell)/nav"
    );

    const noRoles = filterNavByPermissions(
      { id: asUserId("u3"), roles: [], departmentIds: [] },
      navItems,
    );

    expect(noRoles.map((i) => i.id)).toEqual(["my-queue"]);
  });

  it("every nav item's label is an Arabic string, not an English placeholder", async () => {
    const { navItems } = await import("~/app/(shell)/nav");

    for (const item of navItems) {
      expect(item.label).toMatch(ARABIC_RANGE);
    }
  });
});

describe("SidebarNav component", () => {
  it("renders only the permitted entries, in Arabic", async () => {
    const { SidebarNav } = await import(
      "~/app/(shell)/_components/sidebar-nav"
    );

    render(
      SidebarNav({
        actor: { id: asUserId("u4"), roles: ["production"], departmentIds: [] },
      }),
    );

    expect(screen.getByText("طابور أعمالي")).toBeTruthy();
    expect(screen.getByText("الإنتاج")).toBeTruthy();
    expect(screen.queryByText("الإدارة")).toBeNull();
  });
});
