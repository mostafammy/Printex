import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";

import { db } from "~/server/db";
import { recordFailedLogin, recordSuccessfulLogin, audit } from "~/server/auth";

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "XRqF9o5y7NTCNaOmkE0Ham/YqUuDQMnuGZmNdPOblQg=",
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  trustedOrigins: [
    "http://localhost:3000",
    "https://*.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  database: prismaAdapter(db, {
    provider: "postgresql", // or "sqlite" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username()],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          let username = (user as { username?: string }).username;
          if (!username) {
            const email = (user as { email?: string }).email;
            const name = (user as { name?: string }).name;
            const seed = (email ? email.split("@")[0] : name) ?? "user";
            const sanitized = seed.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 15) || "user";
            const randomSuffix = Math.random().toString(36).slice(2, 7);
            username = `${sanitized}_${randomSuffix}`;
          }
          return {
            data: {
              ...user,
              username,
              displayUsername:
                ((user as { displayUsername?: string }).displayUsername ??
                (user as { name?: string }).name) ??
                username,
              isActive: (user as { isActive?: boolean }).isActive ?? true,
              failedLoginAttempts:
                (user as { failedLoginAttempts?: number }).failedLoginAttempts ?? 0,
            },
          };

        },
      },
    },
  },

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
      // Record the audit event before the session is actually destroyed by the
      // sign-out handler — `/sign-out` has `requireHeaders: true`, so the
      // existing session cookie is reliably present and `ctx.context.session`
      // is populated whenever this hook is reached.
      if (ctx.path === "/sign-out") {
        const userId = ctx.context.session?.user.id;
        if (userId) {
          try {
            await db.$transaction(async (tx) => {
              await audit.record(tx, {
                action: "logout",
                entityType: "User",
                entityId: userId,
                actorId: userId,
              });
            });
          } catch (err) {
            console.error("[BetterAuth sign-out audit error]", err);
          }
        }
        return;
      }

      if (ctx.path !== "/sign-in/username") return;
      const body = ctx.body as { username?: unknown } | undefined;
      const usernameAttempt = typeof body?.username === "string" ? body.username : undefined;
      if (!usernameAttempt) return;

      try {
        const user = await db.user.findUnique({ where: { username: usernameAttempt } });
        if (user?.lockedUntil && user.lockedUntil > new Date()) {
          throw new APIError("FORBIDDEN", {
            message: "Account temporarily locked due to repeated failed login attempts.",
          });
        }
      } catch (err) {
        if (err instanceof APIError) throw err;
        console.error("[BetterAuth before sign-in hook error]", err);
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

      try {
        if (didSucceed) {
          await recordSuccessfulLogin(usernameAttempt);
          const userId = ctx.context.newSession!.user.id;
          await db.$transaction(async (tx) => {
            await audit.record(tx, {
              action: "login.success",
              entityType: "User",
              entityId: userId,
              actorId: userId,
            });
          });
        } else {
          await recordFailedLogin(usernameAttempt);
          const user = await db.user.findUnique({ where: { username: usernameAttempt } });
          const event = user
            ? { action: "login.failure" as const, entityType: "User", entityId: user.id, actorId: user.id }
            : { action: "login.failure" as const, entityType: "User", entityId: usernameAttempt };
          await db.$transaction(async (tx) => {
            await audit.record(tx, event);
          });
        }
      } catch (err) {
        console.error("[BetterAuth after sign-in hook error]", err);
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
