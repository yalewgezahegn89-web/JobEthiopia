import { z } from "zod";

/**
 * Application note validation (Batch 92).
 *
 * Notes are EMPLOYER-PRIVATE workflow data. Only the note body is accepted from
 * the client. authorUserId / organizationId / candidateUserId / role are never
 * accepted: all authority is derived server-side from the verified session and
 * the database.
 */
export const createApplicationNoteSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "Note body is required")
      .max(4000, "Note body must be 4000 characters or fewer"),
  })
  .strict();

export const applicationNoteIdParamSchema = z
  .object({
    applicationId: z.string().uuid("applicationId must be a valid UUID"),
  })
  .strict();

export const applicationNotePathSchema = z
  .object({
    applicationId: z.string().uuid("applicationId must be a valid UUID"),
    noteId: z.string().uuid("noteId must be a valid UUID"),
  })
  .strict();

export type CreateApplicationNoteInput = z.infer<
  typeof createApplicationNoteSchema
>;
export type ApplicationNoteIdParam = z.infer<
  typeof applicationNoteIdParamSchema
>;
export type ApplicationNotePathParam = z.infer<
  typeof applicationNotePathSchema
>;
