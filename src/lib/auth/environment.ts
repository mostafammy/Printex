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
  // GitHub OAuth is disabled. Authentication is strictly username and password.
  const isGitHubAuthEnabled = false;

  return {
    isDevelopment: isDev,
    isGitHubAuthEnabled,
    isUsernameAuthEnabled: true,
  };
}
