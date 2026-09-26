/**
 * Zod validation schema for user registration.
 * Single Responsibility Principle (SRP): Handles input validation and refinement only.
 */
import { z } from "zod";

export const signUpSchema = z
  .object({
    fullName: z.string().trim().max(100).optional(),
    username: z
      .string()
      .trim()
      .min(3, "usernameValidation")
      .max(30, "usernameValidation")
      .regex(/^[a-zA-Z0-9_]+$/, "usernameValidation"),
    password: z.string().min(8, "passwordMinLength"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordsDoNotMatch",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
