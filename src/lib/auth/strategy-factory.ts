import { CredentialsSignUpStrategy } from "./strategies/credentials-signup-strategy";
import { GitHubOAuthStrategy } from "./strategies/github-oauth-strategy";

/**
 * Factory for creating authentication strategies.
 * Design Pattern: Factory Pattern.
 * Dependency Inversion Principle (DIP): Callers consume strategies via abstract contracts.
 */
export class AuthStrategyFactory {
  private static readonly credentialsStrategy = new CredentialsSignUpStrategy();
  private static readonly gitHubOAuthStrategy = new GitHubOAuthStrategy();

  static getCredentialsSignUpStrategy(): CredentialsSignUpStrategy {
    return this.credentialsStrategy;
  }

  static getGitHubOAuthStrategy(): GitHubOAuthStrategy {
    return this.gitHubOAuthStrategy;
  }
}
