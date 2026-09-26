import { authClient } from "~/server/better-auth/client";
import type { AuthResult, AuthStrategy, SignUpFormData } from "../types";

/**
 * Strategy for credentials-based account registration.
 * Follows Liskov Substitution Principle (LSP) and Strategy Pattern.
 */
export class CredentialsSignUpStrategy
  implements AuthStrategy<SignUpFormData, AuthResult>
{
  readonly id = "credentials";

  async execute(input: SignUpFormData): Promise<AuthResult> {
    const cleanUsername = input.username.trim();
    // In LAN/intranet environment, synthesize email address for Better Auth
    const email = `${cleanUsername.toLowerCase()}@local.invalid`;
    const displayName = input.fullName?.trim() ? input.fullName.trim() : cleanUsername;

    try {
      const result = await authClient.signUp.email({
        email,
        password: input.password,
        name: displayName,
        username: cleanUsername,
        callbackURL: "/",
      });

      if (result.error) {
        const errorMsg = result.error.message ?? "";
        if (
          errorMsg.includes("USERNAME_IS_ALREADY_TAKEN") ||
          errorMsg.includes("already taken") ||
          result.error.status === 422 ||
          result.error.status === 400
        ) {
          return { success: false, error: "usernameTaken" };
        }
        return { success: false, error: "signUpError" };
      }

      return { success: true, redirectUrl: "/" };
    } catch {
      return { success: false, error: "signUpError" };
    }
  }
}
