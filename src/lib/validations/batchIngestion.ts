import { z } from "zod";

export const batchIngestionRequestSchema = z.object({
  sourceId: z.string().uuid("sourceId must be a valid UUID"),
  jobs: z
    .array(z.unknown())
    .min(1, "jobs array must not be empty")
    .max(100, "jobs array must not exceed 100 items"),
});

export type BatchIngestionRequest = z.infer<typeof batchIngestionRequestSchema>;
