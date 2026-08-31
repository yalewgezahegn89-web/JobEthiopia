import { z } from "zod";

export const createSavedJobSchema = z
  .object({
    jobId: z.string().uuid("Job ID must be a valid UUID"),
  })
  .strict();

export type CreateSavedJobInput = z.infer<typeof createSavedJobSchema>;

export const savedJobIdParamSchema = z.object({
  jobId: z.string().uuid("Job ID must be a valid UUID"),
});

export type SavedJobIdParam = z.infer<typeof savedJobIdParamSchema>;
