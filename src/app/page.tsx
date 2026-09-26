import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { UnauthenticatedInterstitial } from "~/components/auth/unauthenticated-interstitial";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return (
      <UnauthenticatedInterstitial
        redirectTo="/login"
        signUpUrl="/sign-up"
        countdownSeconds={5}
      />
    );
  }

  redirect("/my-queue");
}
