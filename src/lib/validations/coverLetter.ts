import { z } from "zod";
import { emptyToNull } from "./cv";

/**
 * Cover letter validation (Phase 13 — Career Tools).
 *
 * Everything is bounded: field lengths, body length. Unicode is accepted
 * anywhere (Amharic, Afaan Oromoo, and mixed text are all valid). Empty
 * optional strings normalize to null. `id` and `jobId` are handled by the
 * caller (validated independently as UUID shapes before the payload parse).
 */

export const COVER_LETTER_TITLE_MAX = 120;
export const COVER_LETTER_FIELD_MAX = 120;
export const COVER_LETTER_BODY_MAX = 8000;
export const COVER_LETTERS_MAX = 50;

const requiredText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max, `${message} (max ${max} characters)`);

const optionalText = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" ? emptyToNull(v) : v),
      z.string().max(max).nullish(),
    );

export const coverLetterSchema = z
  .object({
    title: requiredText(COVER_LETTER_TITLE_MAX, "Title is required"),
    position: requiredText(COVER_LETTER_FIELD_MAX, "Position is required"),
    employer: requiredText(COVER_LETTER_FIELD_MAX, "Employer is required"),
    recipient: optionalText(COVER_LETTER_FIELD_MAX),
    location: optionalText(COVER_LETTER_FIELD_MAX),
    body: requiredText(COVER_LETTER_BODY_MAX, "Letter body is required"),
  })
  .strict();

export type CoverLetterInput = z.infer<typeof coverLetterSchema>;

/**
 * Parses the optional `id` / `jobId` fields that travel alongside the letter
 * payload. Accepts UUID-shaped strings or empty/null; anything else fails so
 * the server never trusts arbitrary identifiers.
 */
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCoverLetterReference(value: unknown): {
  id: string | null;
  jobId: string | null;
  ok: boolean;
} {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { id: null, jobId: null, ok: false };
  }

  const coerce = (v: unknown): string | null | undefined => {
    if (v == null) return null;
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const id = coerce((value as Record<string, unknown>).id);
  const jobId = coerce((value as Record<string, unknown>).jobId);

  if (id === undefined || jobId === undefined) return { id: null, jobId: null, ok: false };
  if (id !== null && !uuidShape.test(id)) return { id: null, jobId: null, ok: false };
  if (jobId !== null && !uuidShape.test(jobId)) return { id: null, jobId: null, ok: false };
  return { id, jobId, ok: true };
}

export function isValidUuid(value: string): boolean {
  return uuidShape.test(value);
}