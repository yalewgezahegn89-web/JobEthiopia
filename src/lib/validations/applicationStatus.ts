import { z } from "zod";

export const employerStatusChangeSchema = z
  .object({
    status: z.enum(["REVIEWING", "SHORTLISTED", "REJECTED"]),
  })
  .strict();

export type EmployerStatusChangeInput = z.infer<typeof employerStatusChangeSchema>;

/** Maximum number of application IDs accepted in a bulk status-change request. */
export const BULK_STATUS_CHANGE_MAX_IDS = 50;

/**
 * Bulk employer status-change schema (B93).
 *
 * One target status plus up to 50 application IDs. The schema is strict so any
 * client-supplied organizationId, candidateUserId, actorUserId, currentStatus or
 * other unrelated fields are rejected outright. Duplicate IDs are rejected.
 */
export const bulkApplicationStatusChangeSchema = z
  .object({
    applicationIds: z
      .array(z.string().uuid("id must be a valid UUID"))
      .min(1, "At least one application is required")
      .max(
        BULK_STATUS_CHANGE_MAX_IDS,
        `At most ${BULK_STATUS_CHANGE_MAX_IDS} applications per request`,
      ),
    status: z.enum(["REVIEWING", "SHORTLISTED", "REJECTED"]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const duplicates = data.applicationIds.filter(
      (id, index) => data.applicationIds.indexOf(id) !== index,
    );
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["applicationIds"],
        message: "Duplicate application IDs are not allowed",
      });
    }
  });

export type BulkApplicationStatusChangeInput = z.infer<
  typeof bulkApplicationStatusChangeSchema
>;
