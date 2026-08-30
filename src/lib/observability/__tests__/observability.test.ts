import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logInfo, logWarn, logError } from "../logger";
import { redactSensitive, safeErrorMessage } from "../redact";
import {
  generateRequestId,
  applyRequestIdToHeaders,
  REQUEST_ID_HEADER,
} from "../requestId";

describe("observability logger", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastJson(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
    const [arg] = spy.mock.calls[spy.mock.calls.length - 1] as [string];
    return JSON.parse(arg);
  }

  it("logInfo emits a single-line valid JSON with timestamp, level, event", () => {
    logInfo("request_completed", { route: "/api/jobs", status: 200 });
    const record = lastJson(infoSpy);
    expect(record.event).toBe("request_completed");
    expect(record.level).toBe("info");
    expect(new Date(record.timestamp as string).toISOString()).toBe(
      record.timestamp,
    );
  });

  it("logWarn uses console.warn with level warn", () => {
    logWarn("rate_limit_rejected", { status: 429 });
    const record = lastJson(warnSpy);
    expect(record.level).toBe("warn");
    expect(record.event).toBe("rate_limit_rejected");
  });

  it("logError uses console.error with level error", () => {
    logError("maintenance_failed", { errorCode: "INTERNAL_ERROR" });
    const record = lastJson(errorSpy);
    expect(record.level).toBe("error");
    expect(record.event).toBe("maintenance_failed");
  });

  it("preserves safe scalar and numeric fields", () => {
    logInfo("maintenance_completed", {
      durationMs: 42,
      sourcesChecked: 5,
      ok: true,
      label: "run",
    });
    const record = lastJson(infoSpy);
    expect(record.durationMs).toBe(42);
    expect(record.sourcesChecked).toBe(5);
    expect(record.ok).toBe(true);
    expect(record.label).toBe("run");
  });

  it("redacts top-level sensitive fields", () => {
    logError("email_reset_dispatch_failed", {
      password: "s3cret",
      token: "abc123",
      resetToken: "xyz",
      apiKey: "key",
      authorization: "Bearer x",
      databaseUrl: "postgres://u:p@host",
    });
    const record = lastJson(errorSpy);
    expect(record.password).toBe("[REDACTED]");
    expect(record.token).toBe("[REDACTED]");
    expect(record.resetToken).toBe("[REDACTED]");
    expect(record.apiKey).toBe("[REDACTED]");
    expect(record.authorization).toBe("[REDACTED]");
    expect(record.databaseUrl).toBe("[REDACTED]");
    const raw = JSON.stringify(record);
    expect(raw).not.toContain("s3cret");
    expect(raw).not.toContain("abc123");
    expect(raw).not.toContain("Bearer x");
  });

  it("redacts nested sensitive fields recursively", () => {
    logInfo("ingestion_completed", {
      user: {
        profile: {
          passwordHash: "abc",
          resetToken: "def",
        },
      },
    });
    const record = lastJson(infoSpy);
    const profile = (record.user as { profile: Record<string, unknown> }).profile;
    expect(profile.passwordHash).toBe("[REDACTED]");
    expect(profile.resetToken).toBe("[REDACTED]");
    const raw = JSON.stringify(record);
    expect(raw).not.toContain("abc");
    expect(raw).not.toContain("def");
  });

  it("never throws on circular data", () => {
    const circular: Record<string, unknown> = { name: "x" };
    circular.self = circular;
    expect(() => logInfo("request_completed", { nested: circular })).not.toThrow();
    const record = lastJson(infoSpy);
    expect(record.nested).toBeDefined();
  });

  it("never throws when the console sink itself fails", () => {
    infoSpy.mockImplementation(() => {
      throw new Error("console down");
    });
    expect(() => logInfo("request_completed")).not.toThrow();
  });

  it("drops undefined-valued optional fields from the JSON record", () => {
    logInfo("maintenance_started", { requestId: undefined });
    const record = lastJson(infoSpy);
    expect(record.requestId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(record, "requestId")).toBe(false);
  });
});

describe("observability redaction", () => {
  it("redactSensitive handles primitives and nested structures", () => {
    const input = {
      safeField: "keep",
      password: "p",
      nested: { apiKey: "k", ok: 1 },
      list: [{ token: "t" }, { value: "v" }],
    };
    const out = redactSensitive(input) as Record<string, unknown>;
    expect(out.safeField).toBe("keep");
    expect(out.password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect((out.list as Array<{ token: string; value: string }>)[0].token).toBe(
      "[REDACTED]",
    );
    expect((out.list as Array<{ value: string }>)[1].value).toBe("v");
  });

  it("redactSensitive tolerates cycles without throwing", () => {
    const obj: Record<string, unknown> = {};
    obj.circular = obj;
    expect(() => redactSensitive(obj)).not.toThrow();
  });

  it("safeErrorMessage strips nothing but returns a bounded message", () => {
    expect(safeErrorMessage(new Error("boom"))).toBe("boom");
    expect(safeErrorMessage("raw")).toBe("unknown error");
    expect(safeErrorMessage(undefined)).toBe("unknown error");
  });
});

describe("observability request id", () => {
  it("generates a UUID-formatted, unique id", () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(b).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(a).not.toBe(b);
  });

  it("applyRequestIdToHeaders sets the header when a settable target exists", () => {
    const headers = new Headers();
    applyRequestIdToHeaders(headers, "id-123");
    expect(headers.get(REQUEST_ID_HEADER)).toBe("id-123");
  });

  it("applyRequestIdToHeaders tolerates a target without a set method", () => {
    expect(() =>
      applyRequestIdToHeaders({} as { set?: () => void }, "id"),
    ).not.toThrow();
    expect(() =>
      applyRequestIdToHeaders(undefined, "id"),
    ).not.toThrow();
  });
});
