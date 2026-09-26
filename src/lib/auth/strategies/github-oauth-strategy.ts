import { authClient } from "~/server/better-auth/client";
import type { AuthResult, AuthStrategy } from "../types";

export interface GitHubOAuthInput {
  callbackURL?: string;
}

/**
 * Strategy for GitHub OAuth registration / sign-in.
 * Follows Liskov Substitution Principle (LSP) and Strategy Pattern.
 */
export class GitHubOAuthStrategy
  implements AuthStrategy<GitHubOAuthInput, AuthResult>
{
  readonly id = "github";

  async execute(input: GitHubOAuthInput = {}): Promise<AuthResult> {
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: input.callbackURL ?? "/",
      });

      if (result.error) {
        return {
          success: false,
          error: result.error.message ?? "signUpError",
        };
      }

      return { success: true, redirectUrl: result.data?.url ?? "/" };
    } catch {
      return { success: false, error: "signUpError" };
    }
  }
}
