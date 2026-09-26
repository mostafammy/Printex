/**
 * Strategy configuration & feature flagging.
 * Open/Closed Principle (OCP): Runtime evaluation of authentication capabilities.
 */

export interface AuthEnvironmentConfig {
  readonly isDevelopment: boolean;
  readonly isGitHubAuthEnabled: boolean;
  readonly isUsernameAuthEnabled: boolean;
}

export function getAuthEnvironmentConfig(): AuthEnvironmentConfig {
  const isDev = process.env.NODE_ENV !== "production";
  // Development uses GitHub OAuth; production focuses on username/password.
  // Can also be explicitly enabled via NEXT_PUBLIC_ENABLE_GITHUB_AUTH if required.
  const isGitHubAuthEnabled =
    isDev || process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true";

  return {
    isDevelopment: isDev,
    isGitHubAuthEnabled,
    isUsernameAuthEnabled: true,
  };
}
