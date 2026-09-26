// @vitest-environment jsdom

import React from "react";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { UnauthenticatedInterstitial } from "~/components/auth/unauthenticated-interstitial";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("UnauthenticatedInterstitial component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders Arabic masterpiece copy and action buttons", () => {
    render(
      <UnauthenticatedInterstitial
        redirectTo="/login"
        signUpUrl="/sign-up"
        countdownSeconds={5}
      />,
    );

    // Title & subtitle
    expect(screen.getByText("تسجيل الدخول مطلوب للمتابعة")).toBeDefined();
    expect(
      screen.getByText(
        "أنت بحاجة لتسجيل الدخول إلى حسابك أو إنشاء حساب جديد للوصول إلى نظام برينتكس وإدارة طوابير العمل.",
      ),
    ).toBeDefined();

    // CTAs
    const loginLink = screen.getByRole("link", { name: /تسجيل الدخول الآن/i });
    expect(loginLink.getAttribute("href")).toBe("/login");

    const signUpLink = screen.getByRole("link", { name: /إنشاء حساب جديد/i });
    expect(signUpLink.getAttribute("href")).toBe("/sign-up");

    // RTL & ARIA
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("automatically redirects when countdown reaches 0", () => {
    render(
      <UnauthenticatedInterstitial
        redirectTo="/login?callbackUrl=%2Freception"
        countdownSeconds={3}
      />,
    );

    expect(pushMock).not.toHaveBeenCalled();

    // Fast-forward 3000ms
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(pushMock).toHaveBeenCalledWith("/login?callbackUrl=%2Freception");
  });

  it("allows user to pause and resume the automatic redirect", () => {
    render(
      <UnauthenticatedInterstitial
        redirectTo="/login"
        countdownSeconds={4}
      />,
    );

    // Click pause button
    const pauseButton = screen.getByRole("button", { name: /إيقاف مؤقت/i });
    fireEvent.click(pauseButton);

    expect(screen.getByText("تم إيقاف التحويل التلقائي مؤقتاً")).toBeDefined();

    // Advance 5000ms while paused
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should NOT have redirected
    expect(pushMock).not.toHaveBeenCalled();

    // Click resume button
    const resumeButton = screen.getByRole("button", { name: /استئناف/i });
    fireEvent.click(resumeButton);

    // Advance remaining time
    act(() => {
      vi.advanceTimersByTime(4100);
    });

    // Should now redirect
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
