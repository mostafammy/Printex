"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ar from "~/messages/ar.json";
import { getAuthEnvironmentConfig } from "~/lib/auth";
import { AuthCard } from "../_components/auth-card";
import { AuthDivider } from "../_components/auth-divider";
import { SignUpForm } from "../_components/sign-up-form";
import { SocialAuthButton } from "../_components/social-auth-button";

const STRINGS = ar.ui;

function SignUpContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const envConfig = getAuthEnvironmentConfig();
  const [socialError, setSocialError] = useState<string | null>(null);

  const loginHref =
    callbackUrl && callbackUrl !== "/"
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";

  const footerLink = (
    <div className="flex items-center justify-center gap-1.5">
      <span>{STRINGS.alreadyHaveAccount}</span>
      <Link
        href={loginHref}
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        {STRINGS.goToLogin}
      </Link>
    </div>
  );

  return (
    <AuthCard title={STRINGS.signUpTitle} footer={footerLink}>
      {/* Development GitHub OAuth provider */}
      {envConfig.isGitHubAuthEnabled && (
        <div className="flex flex-col gap-3">
          <SocialAuthButton
            label={STRINGS.githubOAuthButton}
            showDevBadge={envConfig.isDevelopment}
            onError={(msg) => setSocialError(msg)}
          />

          {socialError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {socialError}
            </p>
          )}

          <AuthDivider label={STRINGS.orDivider} />
        </div>
      )}

      {/* Production & Development credentials registration */}
      <SignUpForm onSuccessRedirect={callbackUrl} />
    </AuthCard>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  );
}
