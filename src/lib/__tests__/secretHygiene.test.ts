import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRoot(name: string): string {
  return readFileSync(path.join(REPO_ROOT, name), "utf8");
}

describe("repo secret hygiene (Phase 8 Batch 1)", () => {
  it(".gitignore explicitly blocks staging env credentials", () => {
    const gitignore = readRoot(".gitignore");
    expect(gitignore).toContain("/.env.staging.txt");
    // The general env rule must keep the committed example file allowed.
    expect(gitignore).toContain(".env*");
    expect(gitignore).toContain("!.env.example");
  });

  it(".env.staging.txt is not present in the working tree", () => {
    expect(existsSync(path.join(REPO_ROOT, ".env.staging.txt"))).toBe(false);
  });

  it(".env.example's DATABASE_URL is the documented placeholder, not a real credential", () => {
    const example = readRoot(".env.example");
    const dbLine = example
      .split("\n")
      .find((line) => line.startsWith("DATABASE_URL="))
      ?.trimEnd();
    expect(dbLine).toBe(
      'DATABASE_URL="postgresql://user:password@localhost:5432/jobethiopia"',
    );
  });

  it(".env.example documents internal per-route keys as variable names only", () => {
    const example = readRoot(".env.example");
    expect(example).toContain("INTERNAL_INGESTION_API_KEY");
    expect(example).toContain("INTERNAL_JOB_ALERTS_API_KEY");
    expect(example).toContain('MAINTENANCE_API_KEY="change-me"');
    // No real-looking key material is allowed in the committed example.
    expect(example).not.toContain("INTERNAL_INGESTION_API_KEY=\"sk_");
  });
});