"use client";

// Login page — 001-identity-access-audit Phase 3 (T016).
// Arabic-first RTL layout.
// Strictly username and password authentication.

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "~/server/better-auth/client";
import { getAuthEnvironmentConfig } from "~/lib/auth";
import { AuthCard } from "../_components/auth-card";
import { AuthDivider } from "../_components/auth-divider";
import { SocialAuthButton } from "../_components/social-auth-button";

import ar from "~/messages/ar.json";

const STRINGS = ar.ui;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const envConfig = getAuthEnvironmentConfig();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password,
      });

      if (result.error) {
        // Distinguish lockout (FORBIDDEN) from generic failure.
        // Better Auth surfaces the server-side APIError status code in
        // result.error.status — 403 = FORBIDDEN (account locked).
        if (result.error.status === 403) {
          setError(STRINGS.loginLocked);
        } else {
          // Generic error — do NOT reveal whether username exists.
          setError(STRINGS.loginError);
        }
        return;
      }

      // Success — navigate to the target callback URL or dashboard.
      router.push(callbackUrl);
    } catch {
      // Network-level or unexpected error — fall back to generic message.
      setError(STRINGS.loginError);
    } finally {
      setLoading(false);
    }
  }

  const signUpHref =
    callbackUrl && callbackUrl !== "/"
      ? `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/sign-up";

  const footerLink = (
    <div className="flex items-center justify-center gap-1.5">
      <span>{STRINGS.dontHaveAccount}</span>
      <Link
        href={signUpHref}
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        {STRINGS.goToSignUp}
      </Link>
    </div>
  );

  return (
    <AuthCard title={STRINGS.loginTitle} footer={footerLink}>
      {/* Development GitHub OAuth provider */}
      {envConfig.isGitHubAuthEnabled && (
        <div className="flex flex-col gap-3">
          <SocialAuthButton
            label={STRINGS.githubOAuthButton}
            showDevBadge={envConfig.isDevelopment}
            onError={(msg) => setError(msg)}
          />
          <AuthDivider label={STRINGS.orDivider} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        data-testid="sign-in-form"
        className="flex flex-col gap-5"
      >
        {/* Username field */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="username"
            className="text-sm font-medium text-foreground"
          >
            {STRINGS.usernameLabel}
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            disabled={loading}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={[
              "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground",
              "placeholder:text-muted-foreground/70 shadow-2xs transition-all duration-200",
              "focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            placeholder={STRINGS.usernameLabel}
          />
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-semibold text-foreground/90"
          >
            {STRINGS.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={[
              "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground",
              "placeholder:text-muted-foreground/70 shadow-2xs transition-all duration-200",
              "focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            placeholder={STRINGS.passwordLabel}
          />
        </div>

        {/* Inline error message */}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive shadow-2xs"
          >
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className={[
            "w-full cursor-pointer rounded-xl bg-gradient-to-b from-primary via-primary to-[color-mix(in_oklch,var(--primary),black_10%)] px-4 py-2.5 text-sm font-semibold text-primary-foreground",
            "shadow-md shadow-primary/20 transition-all duration-150 hover:brightness-105 active:scale-[0.98] active:brightness-95",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
            "focus:outline-none focus:ring-3 focus:ring-primary/30",
          ].join(" ")}
        >
          {loading ? "…" : STRINGS.loginButton}
        </button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
