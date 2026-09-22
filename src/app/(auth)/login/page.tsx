"use client";

// Login page — 001-identity-access-audit Phase 3 (T016).
//
// New route group: (auth)/login — does not appear in the (shell) layout.
// Arabic-first RTL layout, username+password only.
// Spec constraints:
//   - No email field (LAN system, username-only auth).
//   - No self-signup link (Admin creates accounts only).
//   - No "forgot password" link (LAN, no mail server).
//   - Uses authClient.signIn.username() via the usernameClient plugin.
//   - On success: redirect to "/" (dashboard).
//   - On failure: generic Arabic error — does NOT distinguish "wrong password"
//     vs "username not found" (no enumeration leak).
//   - On lockout (FORBIDDEN error from Better Auth hooks.before): distinct
//     Arabic locked message (not an enumeration leak — lockout is per-user,
//     not per-username-existence).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "~/server/better-auth/client";

import ar from "~/messages/ar.json";

const STRINGS = ar.ui;

export default function LoginPage() {
  const router = useRouter();
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

      // Success — navigate to the shell dashboard.
      router.push("/");
    } catch {
      // Network-level or unexpected error — fall back to generic message.
      setError(STRINGS.loginError);
    } finally {
      setLoading(false);
    }
  }

  return (
    // RTL layout; use logical properties (ps-/pe-/ms-/me-) throughout.
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      dir="rtl"
      lang="ar"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        {/* App name / brand header */}
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-foreground">
          {STRINGS.appName}
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          {STRINGS.loginTitle}
        </p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
                "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input",
              ].join(" ")}
              placeholder={STRINGS.usernameLabel}
            />
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
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
                "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "border-input",
              ].join(" ")}
              placeholder={STRINGS.passwordLabel}
            />
          </div>

          {/* Inline error message */}
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className={[
              "w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground",
              "transition-opacity",
              "hover:opacity-90 active:opacity-80",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            ].join(" ")}
          >
            {loading ? "…" : STRINGS.loginButton}
          </button>
        </form>
      </div>
    </div>
  );
}
