import { describe, it, expect } from "vitest";
import {
  signUpSchema,
  AuthStrategyFactory,
  getAuthEnvironmentConfig,
} from "~/lib/auth";

describe("signUpSchema validation", () => {
  it("validates successful sign-up payload", () => {
    const validData = {
      fullName: "أحمد محمد",
      username: "ahmed_dev",
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
    };

    const result = signUpSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("fails when password and confirmPassword do not match", () => {
    const mismatchData = {
      fullName: "Test User",
      username: "testuser",
      password: "Password123",
      confirmPassword: "DifferentPassword123",
    };

    const result = signUpSchema.safeParse(mismatchData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("passwordsDoNotMatch");
    }
  });

  it("fails when username is too short or contains invalid characters", () => {
    const tooShort = {
      username: "ab",
      password: "Password123",
      confirmPassword: "Password123",
    };

    const invalidChars = {
      username: "user name with spaces",
      password: "Password123",
      confirmPassword: "Password123",
    };

    expect(signUpSchema.safeParse(tooShort).success).toBe(false);
    expect(signUpSchema.safeParse(invalidChars).success).toBe(false);
  });

  it("fails when password is shorter than 8 characters", () => {
    const shortPassword = {
      username: "valid_username",
      password: "123",
      confirmPassword: "123",
    };

    const result = signUpSchema.safeParse(shortPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("passwordMinLength");
    }
  });
});

describe("AuthStrategyFactory", () => {
  it("provides singleton strategy instances adhering to contracts", () => {
    const credentialsStrategy1 = AuthStrategyFactory.getCredentialsSignUpStrategy();
    const credentialsStrategy2 = AuthStrategyFactory.getCredentialsSignUpStrategy();
    const gitHubStrategy = AuthStrategyFactory.getGitHubOAuthStrategy();

    expect(credentialsStrategy1).toBe(credentialsStrategy2);
    expect(credentialsStrategy1.id).toBe("credentials");
    expect(gitHubStrategy.id).toBe("github");
  });
});

describe("getAuthEnvironmentConfig", () => {
  it("returns auth environment configuration with GitHub auth disabled", () => {
    const config = getAuthEnvironmentConfig();
    expect(typeof config.isDevelopment).toBe("boolean");
    expect(config.isGitHubAuthEnabled).toBe(false);
    expect(config.isUsernameAuthEnabled).toBe(true);
  });
});
