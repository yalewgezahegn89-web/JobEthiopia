/**
 * Resume file validation (Batch 89).
 *
 * PDF-only, max 5 MB. Validation is layered: size, extension, MIME type, and
 * (in the service) PDF magic-byte signature. MIME and extension are never
 * trusted on their own — the magic-byte check is authoritative. All failures
 * map to neutral codes; no implementation details leak to users.
 */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const RESUME_MIME = "application/pdf";
export const MAX_FILENAME_LENGTH = 255;

export type ResumeValidationErrorCode =
  | "TOO_LARGE"
  | "INVALID_TYPE"
  | "INVALID_EXTENSION"
  | "INVALID_SIGNATURE"
  | "INVALID_FILENAME";

export class ResumeValidationError extends Error {
  readonly code: ResumeValidationErrorCode;
  constructor(code: ResumeValidationErrorCode) {
    super("Invalid resume file");
    this.name = "ResumeValidationError";
    this.code = code;
  }
}

/**
 * Checks that the first bytes are the literal ASCII sequence "%PDF-".
 */
export function isPdfMagicBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

/**
 * Produces a safe, displayable filename:
 * - strips path separators, NUL, CR/LF and other control characters
 * - trims and collapses whitespace
 * - caps length at 255 characters (Unicode-aware via slice on the string)
 * - falls back to "resume.pdf" when nothing safe remains
 * - ensures the extension is .pdf
 *
 * The result is used only for DB display and the Content-Disposition header,
 * never as a storage key.
 */
export function sanitizeResumeFilename(name: string): string {
  let cleaned = (name ?? "").replace(/[/\\\u0000-\u001f\u007f]/g, "");
  cleaned = cleaned.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return "resume.pdf";

  if (/\.pdf$/i.test(cleaned)) {
    if (cleaned.length > MAX_FILENAME_LENGTH) {
      cleaned = cleaned.slice(0, MAX_FILENAME_LENGTH);
      // Re-check after slicing in case the extension was truncated away.
      if (!/\.pdf$/i.test(cleaned)) cleaned = cleaned.slice(0, -5);
    }
  } else {
    // Reserve room so the appended extension keeps the total within the cap.
    const maxBase = MAX_FILENAME_LENGTH - ".pdf".length;
    if (cleaned.length > maxBase) cleaned = cleaned.slice(0, maxBase);
    cleaned = `${cleaned}.pdf`;
  }
  return cleaned;
}

/**
 * Runs the non-signature part of validation on the submitted File and returns
 * a sanitized display filename. Throws ResumeValidationError with a neutral
 * code on any failure. The PDF magic-byte check is performed separately by the
 * service after reading the body (isPdfMagicBytes) to avoid relying on MIME.
 */
export function validateResumeFile(
  file: File | null | undefined,
): string {
  if (!file) throw new ResumeValidationError("INVALID_FILENAME");
  if (file.size <= 0) throw new ResumeValidationError("INVALID_TYPE");
  if (file.size > MAX_RESUME_BYTES) {
    throw new ResumeValidationError("TOO_LARGE");
  }
  const filename = file.name || "";
  if (!/\.pdf$/i.test(filename)) {
    throw new ResumeValidationError("INVALID_EXTENSION");
  }
  if (file.type !== RESUME_MIME) {
    throw new ResumeValidationError("INVALID_TYPE");
  }
  return sanitizeResumeFilename(filename);
}
