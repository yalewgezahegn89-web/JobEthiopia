import { z } from "zod";

/**
 * Employer team management validation (Batch 91).
 *
 * The employer adds a member by EXACT email (not an internal user id) to avoid
 * exposing a global user-search surface. Role and actor ids are never accepted
 * from the client: authorization is resolved server-side from the session and
 * the database.
 */
export const addEmployerTeamMemberSchema = z
  .object({
    organizationId: z.string().uuid("Organization ID must be a valid UUID"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .max(320, "Email is too long")
      .email("Email must be a valid email address"),
  })
  .strict();

export const employerTeamMembershipIdParamSchema = z.object({
  membershipId: z.string().uuid("membershipId must be a valid UUID"),
});

export type AddEmployerTeamMemberInput = z.infer<
  typeof addEmployerTeamMemberSchema
>;
export type EmployerTeamMembershipIdParam = z.infer<
  typeof employerTeamMembershipIdParamSchema
>;
