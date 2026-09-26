import React from "react";
import ar from "~/messages/ar.json";

const STRINGS = ar.ui;

export interface AuthCardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}

/**
 * Reusable Auth Card container.
 * Single Responsibility: Layout, brand presentation, and accessible framing.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4 py-8"
      dir="rtl"
      lang="ar"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        {/* App brand header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {STRINGS.appName}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {/* Content body */}
        <div className="flex flex-col gap-5">
          {children}
        </div>

        {/* Optional footer navigation */}
        {footer && (
          <div className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
