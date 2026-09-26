/**
 * Types & Domain Contracts for Printex Authentication.
 * Following Interface Segregation (ISP) and Dependency Inversion (DIP) principles.
 */

export interface AuthResult {
  readonly success: boolean;
  readonly error?: string;
  readonly redirectUrl?: string;
}

export interface SignUpFormData {
  readonly fullName?: string;
  readonly username: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface AuthStrategy<TInput, TOutput = AuthResult> {
  readonly id: string;
  execute(input: TInput): Promise<TOutput>;
}
