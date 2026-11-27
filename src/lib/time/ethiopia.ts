/**
 * Ethiopia is fixed at UTC+03:00 (EAT) and does not observe daylight saving.
 * Admin-facing deadlines are always interpreted and displayed in EAT, never in
 * the server's local timezone, so a UTC production server cannot shift them.
 */
export const ETHIOPIA_TIME_ZONE = "Africa/Addis_Ababa";
export const ETHIOPIA_UTC_OFFSET = "+03:00";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: ETHIOPIA_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const INPUT_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ETHIOPIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toValidDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats an instant as an EAT date-time, e.g. "19 Nov 2026, 23:55 EAT". */
export function formatEthiopiaDateTime(
  value: Date | string | number
): string {
  const date = toValidDate(value);
  if (!date) return "n/a";
  return `${DATE_TIME_FORMATTER.format(date)} EAT`;
}

/**
 * Converts an instant to the EAT wall-clock value used by <input
 * type="datetime-local">. Returns "" when the value is missing or invalid.
 */
export function toEthiopiaDateTimeInput(
  value: Date | string | number | null
): string {
  if (value === null) return "";
  const date = toValidDate(value);
  if (!date) return "";
  const parts = INPUT_PARTS_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Parses an EAT wall-clock datetime-local value (YYYY-MM-DDTHH:mm) into the
 * corresponding instant. Returns null for malformed values or impossible
 * calendar dates. The offset is fixed, never read from the process timezone.
 */
export function parseEthiopiaDateTime(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(
    value.trim()
  );
  if (!match) return null;
  const date = new Date(
    `${match[1]}:${match[2] ?? "00"}${ETHIOPIA_UTC_OFFSET}`
  );
  if (Number.isNaN(date.getTime())) return null;
  if (toEthiopiaDateTimeInput(date) !== match[1]) return null;
  return date;
}
