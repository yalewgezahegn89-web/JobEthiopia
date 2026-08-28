import { z } from "zod";

export const sourceIdParamSchema = z.object({
  id: z.string().uuid("Invalid source ID"),
});

export type SourceIdParam = z.infer<typeof sourceIdParamSchema>;
