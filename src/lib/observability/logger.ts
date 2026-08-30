/**
 * Structured JSON logger (Batch 76).
 *
 * Emits single-line JSON to stdout/stderr via console.info/warn/error.
 * Designed to NEVER throw and to NEVER alter business logic, responses, or
 * transactions: any failure inside the logger is swallowed.
 */
import { redactSensitive, safeErrorMessage } from "./redact";

type LogLevel = "info" | "warn" | "error";

/** Arbitrary structured fields. Redacted by key name before emission. */
export type LogFields = Record<string, unknown>;

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  try {
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...(fields ? (redactSensitive(fields) as LogFields) : {}),
    };

    const line = JSON.stringify(record);

    if (level === "warn") {
      console.warn(line);
    } else if (level === "error") {
      console.error(line);
    } else {
      console.info(line);
    }
  } catch {
    // Logging must never break business logic.
  }
}

/** Logs an informational structured event. */
export function logInfo(event: string, fields?: LogFields): void {
  emit("info", event, fields);
}

/** Logs a warning structured event. */
export function logWarn(event: string, fields?: LogFields): void {
  emit("warn", event, fields);
}

/** Logs an error structured event. */
export function logError(event: string, fields?: LogFields): void {
  emit("error", event, fields);
}

export { safeErrorMessage };
