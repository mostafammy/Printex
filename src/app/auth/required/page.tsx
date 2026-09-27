import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { UnauthenticatedInterstitial } from "~/components/auth/unauthenticated-interstitial";

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function AuthRequiredPage({ searchParams }: PageProps) {
  const session = await getSession();

  // If already authenticated, redirect straight to target or dashboard
  const { callbackUrl } = await searchParams;
  if (session) {
    redirect(callbackUrl ?? "/my-queue");
  }

  const loginRedirect = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";
  const signUpRedirect = callbackUrl
    ? `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/sign-up";

  return (
    <UnauthenticatedInterstitial
      redirectTo={loginRedirect}
      signUpUrl={signUpRedirect}
      countdownSeconds={5}
    />
  );
}
