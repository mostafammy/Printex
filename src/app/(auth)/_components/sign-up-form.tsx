"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ar from "~/messages/ar.json";
import { AuthStrategyFactory, signUpSchema } from "~/lib/auth";

const STRINGS = ar.ui;

export interface SignUpFormProps {
  readonly onSuccessRedirect?: string;
}

/**
 * Controlled, accessible Sign-Up Form for Username and Password.
 * Single Responsibility: Form state management, validation feedback, and credential submission.
 */
export function SignUpForm({ onSuccessRedirect = "/" }: SignUpFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side schema validation (SRP)
    const validationResult = signUpSchema.safeParse({
      fullName,
      username,
      password,
      confirmPassword,
    });

    if (!validationResult.success) {
      const formattedErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const path = issue.path[0] as string;
        // Map message key to Arabic translation if available
        const errorKey = issue.message as keyof typeof STRINGS;
        formattedErrors[path] = (STRINGS[errorKey] as string | undefined) ?? issue.message;
      }
      setFieldErrors(formattedErrors);
      return;
    }

    setLoading(true);

    try {
      const strategy = AuthStrategyFactory.getCredentialsSignUpStrategy();
      const result = await strategy.execute({
        fullName,
        username,
        password,
        confirmPassword,
      });

      if (!result.success) {
        const errorKey = (result.error ?? "signUpError") as keyof typeof STRINGS;
        setFormError((STRINGS[errorKey] as string | undefined) ?? STRINGS.signUpError);
        return;
      }

      // Successful registration — navigate to the dashboard
      router.push(result.redirectUrl ?? onSuccessRedirect);
    } catch {
      setFormError(STRINGS.signUpError);
    } finally {
      setLoading(false);
    }
  }

  const isSubmitDisabled =
    loading || !username.trim() || !password || !confirmPassword;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Full Name field (optional) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="fullName"
          className="text-sm font-medium text-foreground"
        >
          {STRINGS.fullNameLabel}
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          disabled={loading}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={[
            "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            fieldErrors.fullName ? "border-destructive" : "border-input",
          ].join(" ")}
          placeholder={STRINGS.fullNameLabel}
        />
        {fieldErrors.fullName && (
          <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
        )}
      </div>

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
          aria-invalid={!!fieldErrors.username}
          aria-describedby={fieldErrors.username ? "username-error" : undefined}
          className={[
            "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            fieldErrors.username ? "border-destructive" : "border-input",
          ].join(" ")}
          placeholder={STRINGS.usernameLabel}
        />
        {fieldErrors.username && (
          <p id="username-error" className="text-xs text-destructive">
            {fieldErrors.username}
          </p>
        )}
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
          autoComplete="new-password"
          required
          disabled={loading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className={[
            "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            fieldErrors.password ? "border-destructive" : "border-input",
          ].join(" ")}
          placeholder={STRINGS.passwordLabel}
        />
        {fieldErrors.password && (
          <p id="password-error" className="text-xs text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Confirm Password field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-foreground"
        >
          {STRINGS.confirmPasswordLabel}
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={loading}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={!!fieldErrors.confirmPassword}
          aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
          className={[
            "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            fieldErrors.confirmPassword ? "border-destructive" : "border-input",
          ].join(" ")}
          placeholder={STRINGS.confirmPasswordLabel}
        />
        {fieldErrors.confirmPassword && (
          <p id="confirmPassword-error" className="text-xs text-destructive">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      {/* Inline Form Error */}
      {formError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitDisabled}
        className={[
          "mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground",
          "shadow-xs transition-opacity hover:opacity-90 active:opacity-80",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        ].join(" ")}
      >
        {loading ? "…" : STRINGS.signUpButton}
      </button>
    </form>
  );
}
