import React from "react";
import { Printer, Sparkles } from "lucide-react";
import ar from "~/messages/ar.json";

const STRINGS = ar.ui;

export interface AuthCardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}

/**
 * Reusable Auth Card container designed with Apple Human Interface standards.
 * Translucent frosted glass, subtle depth illumination, and refined typography.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12"
      dir="rtl"
      lang="ar"
    >
      {/* Ambient background illumination */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -start-40 h-[450px] w-[450px] rounded-full bg-primary/10 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -end-40 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,113,227,0.08),rgba(255,255,255,0))]"
      />

      {/* Centerpiece Apple Liquid Glass Card */}
      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/90 p-8 shadow-2xl backdrop-blur-2xl transition-all sm:p-10">
        {/* Top subtle glow line */}
        <div
          aria-hidden="true"
          className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />

        {/* App brand header */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-lg shadow-primary/25">
            <Printer className="h-8 w-8" />
            <Sparkles className="absolute -top-1 -end-1 h-4 w-4 text-amber-300 animate-pulse" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {STRINGS.appName}
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              {subtitle}
            </p>
          )}
        </div>

        {/* Content body */}
        <div className="flex flex-col gap-5">{children}</div>

        {/* Optional footer navigation */}
        {footer && (
          <div className="mt-8 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
