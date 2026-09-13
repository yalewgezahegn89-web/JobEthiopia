/**
 * Error classification and safe structured error reporting (Phase 8 Batch 1).
 *
 * Provides a single, provider-neutral seam for capturing operational errors.
 * The default sink is the existing structured JSON logger; a future external
 * error-tracking service can be wired inside `reportError` without changing
 * any caller. No external service is introduced by this module.
 *
 * Safety contract:
 *  - `reportError` NEVER emits the raw error object, its message, or a stack
 *    trace. Only a stable `errorCode` and explicit, caller-supplied safe
 *    fields are logged. Callers that need a free-text message must pass it in
 *    deliberately via `errorMessage` after running it through `safeErrorMessage`.
 */
import { logError, type LogFields } from "./logger";
import { safeErrorMessage } from "./redact";

export type ErrorCode =
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR"
  | "VALIDATION_ERROR";

export interface ErrorClassification {
  code: ErrorCode;
  safeMessage: string;
}

/**
 * True for Zod validation errors.
 *
 * Shape-based (an `issues` array) so the classifier does not need to import
 * the zod module and remains decoupled from the validator implementation.
 */
function isValidationError(err: unknown): boolean {
  return (
    err instanceof Error && Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * True for errors that look like a database/connectivity failure.
 *
 * PostgreSQL `pg`-client and Node network errors carry a string `code`
 * property (`ECONNREFUSED`, `ETIMEDOUT`, `57014`, `42P01`, ...). Treating a
 * string `code` as infra/domain classification is intentionally conservative:
 * this only selects the log label, never client-visible behavior.
 */
function isDatabaseLikeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0;
}

/**
 * Classifies a thrown value into a stable errorCode. Falls back to
 * INTERNAL_ERROR for anything unrecognized. `safeMessage` is a bounded,
 * whitespace-normalized message suitable for optional free-text logging.
 */
export function classifyError(err: unknown): ErrorClassification {
  if (isValidationError(err)) {
    return { code: "VALIDATION_ERROR", safeMessage: safeErrorMessage(err) };
  }
  if (isDatabaseLikeError(err)) {
    return { code: "DATABASE_ERROR", safeMessage: safeErrorMessage(err) };
  }
  return { code: "INTERNAL_ERROR", safeMessage: safeErrorMessage(err) };
}

export interface ReportErrorFields extends LogFields {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
}

/**
 * Emits ONE structured error event with a stable `errorCode` plus explicit
 * safe fields. The thrown error is consumed for classification only; its raw
 * message, properties, and stack are never emitted. Never throws.
 */
export function reportError(
  event: string,
  error: unknown,
  fields: ReportErrorFields = {},
): void {
  const classification = classifyError(error);
  logError(event, {
    ...fields,
    errorCode: classification.code,
  });
}