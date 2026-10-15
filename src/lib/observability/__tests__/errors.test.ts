import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { classifyError, reportError } from "../errors";

describe("classifyError", () => {
  it("classifies a generic Error as INTERNAL_ERROR", () => {
    expect(classifyError(new Error("boom")).code).toBe("INTERNAL_ERROR");
  });

  it("classifies a non-Error throw as INTERNAL_ERROR", () => {
    expect(classifyError("raw string")).toBeDefined();
    expect(classifyError(undefined).code).toBe("INTERNAL_ERROR");
    expect(classifyError(null).code).toBe("INTERNAL_ERROR");
  });

  it("classifies a DatabaseError/pg-like error with a string code as DATABASE_ERROR", () => {
    const err = new Error("connection refused");
    (err as unknown as { code: string }).code = "ECONNREFUSED";
    const classified = classifyError(err);
    expect(classified.code).toBe("DATABASE_ERROR");
  });

  it("classifies a pg SQL error code as DATABASE_ERROR", () => {
    const err = new Error("relation does not exist");
    (err as unknown as { code: string }).code = "42P01";
    expect(classifyError(err).code).toBe("DATABASE_ERROR");
  });

  it("classifies a Zod validation error as VALIDATION_ERROR", () => {
    const schema = z.object({ name: z.string() });
    const parsed = schema.safeParse({ name: 42 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(classifyError(parsed.error).code).toBe("VALIDATION_ERROR");
    }
  });

  it("keeps a bounded, whitespace-normalized safeMessage", () => {
    const classified = classifyError(
      new Error("  boom   with   spaces   and a very long tail ".repeat(40)),
    );
    expect(classified.safeMessage).toContain("boom");
    expect(classified.safeMessage.length).toBeLessThanOrEqual(200);
  });
});

describe("reportError", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastRecord(): Record<string, unknown> {
    const [line] = errorSpy.mock.calls[errorSpy.mock.calls.length - 1] as [
      string,
    ];
    return JSON.parse(line);
  }

  it("emits a single structured error record with a stable errorCode", () => {
    reportError("job_alerts_digest_failed", new Error("boom"), {
      requestId: "req-1",
      route: "/api/internal/job-alerts/daily",
      method: "POST",
      status: 500,
      durationMs: 42,
    });

    const record = lastRecord();
    expect(record.event).toBe("job_alerts_digest_failed");
    expect(record.level).toBe("error");
    expect(record.errorCode).toBe("INTERNAL_ERROR");
    expect(record.status).toBe(500);
    expect(record.requestId).toBe("req-1");
    expect(record.method).toBe("POST");
  });

  it("never emits the raw error message or stack (even a message containing a secret)", () => {
    const secret = "SECRET_DB_PASSWORD=super-secret";
    reportError("ingestion_run_failed", new Error(`boom: ${secret}`), {
      status: 500,
    });
    const raw = JSON.stringify(errorSpy.mock.calls);
    expect(raw).not.toContain(secret);
  });

  it("classifies database failures without leaking internals", () => {
    reportError(
      "ingestion_run_failed",
      Object.assign(new Error("server closed the connection unexpectedly"), {
        code: "57P01",
      }),
      { status: 500 },
    );
    const record = lastRecord();
    expect(record.errorCode).toBe("DATABASE_ERROR");
    const raw = JSON.stringify(record);
    expect(raw).not.toContain("server closed");
  });

  it("never throws when the logger swallows or on exotic inputs", () => {
    expect(() =>
      reportError("some_event_failed", { nested: "raw object" } as unknown, {
        status: 500,
      }),
    ).not.toThrow();
    expect(() =>
      reportError("some_event_failed", undefined, { status: 500 }),
    ).not.toThrow();
  });
});