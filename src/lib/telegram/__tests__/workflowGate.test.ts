import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../../../.github/workflows/telegram.yml",
);
const workflow = readFileSync(WORKFLOW_PATH, "utf8");
const lines = workflow.split(/\r?\n/);
const GATE_LINE = "    if: vars.ENABLE_PRODUCTION_SCHEDULED_WORKFLOWS == 'true'";

describe("telegram workflow gate", () => {
  it("retains the exact job-level gate condition", () => {
    expect(lines).toContain(GATE_LINE);
    expect(lines.filter((line) => /^\s*if:/.test(line))).toEqual([GATE_LINE]);
  });

  it("does not let workflow_dispatch bypass the gate", () => {
    expect(lines).toContain("  schedule:");
    expect(lines).toContain("  workflow_dispatch:");

    const gateIndex = lines.indexOf(GATE_LINE);
    const jobIndex = lines.findIndex(
      (line) => line.trim() === "run-telegram-outbox:",
    );
    const stepsIndex = lines.findIndex((line) => line.trim() === "steps:");

    expect(jobIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeGreaterThan(jobIndex);
    expect(stepsIndex).toBeGreaterThan(gateIndex);
    expect(lines.slice(stepsIndex).some((line) => /^\s*if:/.test(line))).toBe(
      false,
    );
  });

  it("retains the Telegram concurrency group", () => {
    expect(lines).toContain("  group: telegram-outbox-production");
    expect(lines).toContain("  cancel-in-progress: false");
  });
});
