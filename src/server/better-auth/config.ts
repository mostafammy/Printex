import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";

import { env } from "~/env";
import { db } from "~/server/db";
import { recordFailedLogin, recordSuccessfulLogin } from "~/server/auth/lockout";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql", // or "sqlite" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
      redirectURI: "http://localhost:3000/api/auth/callback/github",
    },
  },
  plugins: [username()],
  // Session expires in 12 hours (confirmed: expiresIn is in seconds — see
  // init-options.d.mts line 935: "@default 7 days (60 * 60 * 24 * 7)").
  session: {
    expiresIn: 60 * 60 * 12,
  },
  hooks: {
    // Before hook: reject the request immediately if the account is locked.
    // This fires BEFORE credentials are verified, so a locked user sees the
    // lockout error without any password check ever completing.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/username") return;
      const body = ctx.body as { username?: unknown } | undefined;
      const usernameAttempt = typeof body?.username === "string" ? body.username : undefined;
      if (!usernameAttempt) return;

      const user = await db.user.findUnique({ where: { username: usernameAttempt } });
      if (user?.lockedUntil && user.lockedUntil > new Date()) {
        throw new APIError("FORBIDDEN", {
          message: "Account temporarily locked due to repeated failed login attempts.",
        });
      }
    }),

    // After hook: fires after every /sign-in/username request, including ones
    // that failed (Better Auth's `after` hooks run even when the handler
    // threw an error — the `ctx.context.newSession` field is null on failure
    // and populated with `{ session, user }` on success).
    //
    // We use `ctx.context.newSession` (typed as `{ session, user } | null` in
    // the AuthMiddleware context — see @better-auth/core/dist/api/index.d.mts
    // line ~43) to distinguish success from failure:
    //   - Non-null → sign-in succeeded → reset the lockout counter.
    //   - Null     → sign-in failed   → increment the failure counter.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/username") return;
      const body = ctx.body as { username?: unknown } | undefined;
      const usernameAttempt = typeof body?.username === "string" ? body.username : undefined;
      if (!usernameAttempt) return;

      // `ctx.context.newSession` is set to the new session object when a
      // sign-in endpoint successfully creates a session, and is null otherwise.
      const didSucceed = ctx.context.newSession !== null && ctx.context.newSession !== undefined;

      if (didSucceed) {
        await recordSuccessfulLogin(usernameAttempt);
      } else {
        await recordFailedLogin(usernameAttempt);
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
