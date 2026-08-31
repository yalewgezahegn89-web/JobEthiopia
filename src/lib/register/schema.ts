import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/**
 * Strict candidate-registration schema (Batch 95).
 *
 * Only the three credential fields are accepted. `.strict()` rejects every
 * unknown property, so a client can never submit `role`, `userId`,
 * `isActive`, `passwordHash`, or any organization/membership field — those are
 * always derived server-side. Email is normalized elsewhere using the existing
 * canonical normalizeEmail(); this schema validates shape only.
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(100, "Full name must be 100 characters or fewer"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      ),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
