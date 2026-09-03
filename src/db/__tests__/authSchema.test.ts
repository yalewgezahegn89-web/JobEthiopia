import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DRIZZLE_DIR = join(process.cwd(), "drizzle");

function latestMigration(): string {
  const files = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d+_.+\.sql$/.test(f),
  );
  files.sort((a, b) => {
    const na = Number(a.split("_")[0]);
    const nb = Number(b.split("_")[0]);
    return na - nb;
  });
  return readFileSync(join(DRIZZLE_DIR, files[files.length - 1]), "utf8");
}

describe("phone OTP schema (structural, non-destructive)", () => {
  const sql = latestMigration();

  it("creates auth_accounts with a unique provider identity", () => {
    expect(sql).toContain('CREATE TABLE "auth_accounts"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_unique"',
    );
    expect(sql).toContain(
      'ON "auth_accounts" USING btree ("provider","provider_account_id")',
    );
  });

  it("creates phone_verifications without storing the raw OTP", () => {
    expect(sql).toContain('CREATE TABLE "phone_verifications"');
    // Columns are hash/expiry/attempts; a raw code column must never exist.
    expect(sql).toContain('"otp_hash" text NOT NULL');
    expect(sql).toContain('"attempts" integer DEFAULT 0 NOT NULL');
    expect(sql).toContain('"verified_at" timestamp with time zone');
    expect(sql).not.toContain("otp_code");
    expect(sql).not.toContain("otp_plain");
  });

  it("creates the auth_provider enum with the planned provider values", () => {
    expect(sql).toContain("auth_provider");
    for (const provider of ["password", "phone", "google", "apple", "telegram"]) {
      expect(sql).toContain(provider);
    }
  });

  it("adds no destructive changes to the existing users table", () => {
    // The migration must not ALTER/DROP users, sessions, or audit_log.
    expect(sql).not.toMatch(/ALTER TABLE "users"/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE "sessions"/i);
    expect(sql).not.toMatch(/ALTER TABLE "audit_log"/i);
  });

  it("preserves the users id UUID primary key identity model", () => {
    const schemaSource = readFileSync(
      join(process.cwd(), "src/db/schema/users.ts"),
      "utf8",
    );
    expect(schemaSource).toContain('uuid("id").primaryKey().defaultRandom()');
    expect(schemaSource).toContain('text("email").notNull()');
    expect(schemaSource).toContain('text("password_hash").notNull()');
  });
});
