import { z } from "zod";

export const employerStatusChangeSchema = z
  .object({
    status: z.enum(["REVIEWING", "SHORTLISTED", "REJECTED"]),
  })
  .strict();

export type EmployerStatusChangeInput = z.infer<typeof employerStatusChangeSchema>;
