/**
 * Route handler instrumentation (Phase 16 Batch 2).
 *
 * `withRouteMetrics` wraps an exported Next.js route handler so that every
 * API response — success or failure, logged or not — contributes exactly one
 * operational record:
 *   - one in-process metric (route template, method, status class, duration)
 *   - one structured `request_completed` log line on stdout
 *
 * This is the smallest first-party seam that makes request volume, status
 * classes, 4xx/5xx rates and route-level latency measurable. Middleware
 * cannot observe the downstream response status in Next 16, and there is no
 * `instrumentation.ts` after-hook, so the wrap happens at the handler.
 *
 * Contracts:
 *  - Purely observational: the handler's arguments, return value, thrown
 *    errors and thrown-order behaviour are unchanged.
 *  - Only the route TEMPLATE is recorded (e.g. `/api/jobs/[id]`), never the
 *    request URL, path parameters, query string or request body.
 *  - The correlation id is resolved CONCURRENTLY with the handler (never
 *    before it) so instrumentation cannot delay handler start — a timer set
 *    by the handler must already be pending when the handler begins.
 *  - Thrown errors are reported through `reportError`, which emits a stable
 *    `errorCode` and never the raw message, stack, or error object.
 *  - Never throws: metric/logging failures are swallowed.
 */
import { logError, logInfo, logWarn } from "./logger";
import { getRequestId } from "./requestId";
import { reportError, type ReportErrorFields } from "./errors";
import { recordApiRequest } from "./metrics";

/** Structured event emitted once per instrumented API request. */
export const REQUEST_COMPLETED_EVENT = "request_completed";

/**
 * Best-effort status extraction from a handler's return value.
 * Route handlers here always return a `Response`, but the check is
 * structural so test doubles that only mimic `status` still work.
 */
export function statusFromResult(result: unknown): number {
  if (result !== null && typeof result === "object" && "status" in result) {
    const status = (result as { status?: unknown }).status;
    if (typeof status === "number" && Number.isFinite(status)) return status;
  }
  return 200;
}

async function safeRequestId(): Promise<string | undefined> {
  try {
    return await getRequestId();
  } catch {
    return undefined;
  }
}

/**
 * Wraps a route handler with request measurement.
 *
 * @param route Route template (path under `src/app`), e.g. `/api/jobs/[id]`.
 * @param method HTTP method exported by the route file.
 * @param handler The original handler; invoked exactly as before.
 */
export function withRouteMetrics<TArgs extends unknown[], TResult>(
  route: string,
  method: string,
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  const upperMethod = method.toUpperCase();

  return async (...args: TArgs): Promise<TResult> => {
    const start = performance.now();
    // Started (not awaited) so the handler begins in the same tick.
    const requestIdPromise = safeRequestId();

    const finish = async (status: number, threw: boolean, error?: unknown): Promise<void> => {
      try {
        const durationMs = Math.round(performance.now() - start);
        recordApiRequest({ route, method: upperMethod, status, durationMs });

        let requestId: string | undefined;
        try {
          requestId = await requestIdPromise;
        } catch {
          requestId = undefined;
        }

        const fields: ReportErrorFields = {
          requestId,
          route,
          method: upperMethod,
          status,
          durationMs,
        };

        if (threw) {
          reportError(REQUEST_COMPLETED_EVENT, error, fields);
        } else if (status >= 500) {
          logError(REQUEST_COMPLETED_EVENT, fields);
        } else if (status >= 400) {
          logWarn(REQUEST_COMPLETED_EVENT, fields);
        } else {
          logInfo(REQUEST_COMPLETED_EVENT, fields);
        }
      } catch {
        // Instrumentation must never affect the response.
      }
    };

    try {
      const result = await handler(...args);
      await finish(statusFromResult(result), false);
      return result;
    } catch (error: unknown) {
      await finish(500, true, error);
      throw error;
    }
  };
}
