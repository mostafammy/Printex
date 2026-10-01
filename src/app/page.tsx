import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { getActor } from "~/server/auth";
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

  try {
    const actor = await getActor();
    if (actor.roles.includes("RECEPTION") && !actor.roles.includes("ADMIN_OWNER")) {
      redirect("/reception");
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) {
      throw err;
    }
  }

  redirect("/board");
}
