"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert, LogIn, UserPlus, Pause, Play, Sparkles } from "lucide-react";
import ar from "~/messages/ar.json";

const STRINGS = ar.ui;

export interface UnauthenticatedInterstitialProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly redirectTo?: string;
  readonly signUpUrl?: string;
  readonly countdownSeconds?: number;
  readonly className?: string;
}

export function UnauthenticatedInterstitial({
  title = STRINGS.authRequiredTitle,
  subtitle = STRINGS.authRequiredSubtitle,
  redirectTo = "/login",
  signUpUrl = "/sign-up",
  countdownSeconds = 5,
  className = "",
}: UnauthenticatedInterstitialProps) {
  const router = useRouter();
  const totalDurationMs = countdownSeconds * 1000;

  const [timeLeftMs, setTimeLeftMs] = useState(totalDurationMs);
  const [isPaused, setIsPaused] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasTriggeredRef = useRef(false);

  const performRedirect = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    setIsRedirecting(true);
    router.push(redirectTo);
  }, [router, redirectTo]);

  useEffect(() => {
    if (isPaused || isRedirecting) return;

    const interval = 100; // 100ms tick for smooth progress
    const timer = setInterval(() => {
      setTimeLeftMs((prev) => {
        const next = prev - interval;
        if (next <= 0) {
          clearInterval(timer);
          performRedirect();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, isRedirecting, performRedirect]);

  const progressPercent = Math.max(0, Math.min(100, (timeLeftMs / totalDurationMs) * 100));
  const secondsDisplay = Math.ceil(timeLeftMs / 1000);

  return (
    <div
      dir="rtl"
      lang="ar"
      className={`relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-12 ${className}`}
    >
      {/* Ambient background illumination */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -start-40 h-[450px] w-[450px] rounded-full bg-primary/10 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -end-40 h-[400px] w-[400px] rounded-full bg-primary/15 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))]"
      />

      {/* Centerpiece card */}
      <div className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card/90 p-8 shadow-2xl backdrop-blur-2xl transition-all sm:p-10">
        {/* Top subtle glow line */}
        <div
          aria-hidden="true"
          className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />

        {/* Header Icon Anchor */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          {/* Subtle outer pulsing aura */}
          <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/10 opacity-75 duration-1000" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent shadow-[0_0_35px_rgba(var(--primary),0.25)]">
            <Lock className="h-9 w-9 text-primary transition-transform duration-300 hover:scale-110" />
            <div className="absolute -bottom-1 -end-1 flex h-6 w-6 items-center justify-center rounded-full border border-card bg-primary text-primary-foreground shadow-sm">
              <ShieldAlert className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* System & Title Hierarchy */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
            <span>{STRINGS.appName} — {STRINGS.authRequiredBadge}</span>
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>

        {/* Countdown & Progress Transition Bar */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
            <div className="flex items-center gap-1.5" role="status" aria-live="polite">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span>
                {isRedirecting
                  ? "جارٍ تحويلك الآن..."
                  : isPaused
                  ? "تم إيقاف التحويل التلقائي مؤقتاً"
                  : `${STRINGS.authRequiredRedirectNotice} ${secondsDisplay} ${STRINGS.authRequiredSeconds}...`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              disabled={isRedirecting}
              aria-label={isPaused ? STRINGS.authRequiredResume : STRINGS.authRequiredPause}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {isPaused ? (
                <>
                  <Play className="h-3 w-3" />
                  <span>{STRINGS.authRequiredResume}</span>
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3" />
                  <span>{STRINGS.authRequiredPause}</span>
                </>
              )}
            </button>
          </div>

          {/* Progress track */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-100 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Masterpiece Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={redirectTo}
            onClick={() => {
              hasTriggeredRef.current = true;
              setIsRedirecting(true);
            }}
            className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <LogIn className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>{STRINGS.authRequiredLoginNow}</span>
          </Link>

          <Link
            href={signUpUrl}
            onClick={() => {
              hasTriggeredRef.current = true;
              setIsRedirecting(true);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 px-5 py-3 text-sm font-semibold text-secondary-foreground transition-all duration-200 hover:bg-secondary active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>{STRINGS.authRequiredSignUpNow}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
