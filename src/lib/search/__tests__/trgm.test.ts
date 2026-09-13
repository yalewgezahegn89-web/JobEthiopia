import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import {
  isPgTrgmAvailable,
  resetTrgmAvailabilityForTests,
} from "../trgm";

function fakeClient(available: boolean) {
  return {
    execute: vi.fn().mockResolvedValue({
      rows: [{ available }],
    }),
  };
}

describe("isPgTrgmAvailable", () => {
  beforeEach(() => {
    vi.stubEnv("DISABLE_PG_TRGM", undefined);
    resetTrgmAvailabilityForTests();
    mockExecute.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports true when the pg_trgm extension is installed", async () => {
    const client = fakeClient(true);
    await expect(isPgTrgmAvailable(client)).resolves.toBe(true);
  });

  it("reports false when the pg_trgm extension is missing", async () => {
    const client = fakeClient(false);
    await expect(isPgTrgmAvailable(client)).resolves.toBe(false);
  });

  it("caches the result and probes the database only once", async () => {
    const client = fakeClient(true);
    await isPgTrgmAvailable(client);
    await isPgTrgmAvailable(client);
    expect(client.execute).toHaveBeenCalledTimes(1);
  });

  it("returns false without querying when DISABLE_PG_TRGM is true", async () => {
    vi.stubEnv("DISABLE_PG_TRGM", "true");
    const client = fakeClient(true);
    await expect(isPgTrgmAvailable(client)).resolves.toBe(false);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("degrades to false when the probe query itself throws", async () => {
    const client = { execute: vi.fn().mockRejectedValue(new Error("no db")) };
    await expect(isPgTrgmAvailable(client)).resolves.toBe(false);
  });

  it("re-checks after the cache has been reset", async () => {
    const first = fakeClient(false);
    await isPgTrgmAvailable(first);

    resetTrgmAvailabilityForTests();

    const second = fakeClient(true);
    await expect(isPgTrgmAvailable(second)).resolves.toBe(true);
  });
});