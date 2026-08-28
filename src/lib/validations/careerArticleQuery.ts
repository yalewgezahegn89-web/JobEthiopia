import { z } from "zod";

const ArticleStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const careerArticleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: ArticleStatus.optional(),
  category: z.string().optional(),
});

export type CareerArticleListQuery = z.infer<typeof careerArticleListQuerySchema>;

export const careerArticleIdParamSchema = z.object({
  id: z.string().uuid("Invalid career article ID"),
});

export type CareerArticleIdParam = z.infer<typeof careerArticleIdParamSchema>;
