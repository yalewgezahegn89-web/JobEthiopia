import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DRIZZLE_DIR = join(process.cwd(), "drizzle");

function migrationByIndex(index: number): string {
  const files = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d+_.+\.sql$/.test(f),
  );
  files.sort((a, b) => {
    const na = Number(a.split("_")[0]);
    const nb = Number(b.split("_")[0]);
    return na - nb;
  });
  return readFileSync(join(DRIZZLE_DIR, files[index]), "utf8");
}

// 0014 is the phone OTP migration (auth_accounts, phone_verifications, auth_provider enum)
const phoneOtpSql = migrationByIndex(14);
// 0020 is the batch 3 account-trust migration (email_verifications, login_failures, etc.)
const batch3Sql = migrationByIndex(20);

describe("phone OTP schema (structural, non-destructive)", () => {

  it("creates auth_accounts with a unique provider identity", () => {
    expect(phoneOtpSql).toContain('CREATE TABLE "auth_accounts"');
    expect(phoneOtpSql).toContain(
      'CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_unique"',
    );
    expect(phoneOtpSql).toContain(
      'ON "auth_accounts" USING btree ("provider","provider_account_id")',
    );
  });

  it("creates phone_verifications without storing the raw OTP", () => {
    expect(phoneOtpSql).toContain('CREATE TABLE "phone_verifications"');
    // Columns are hash/expiry/attempts; a raw code column must never exist.
    expect(phoneOtpSql).toContain('"otp_hash" text NOT NULL');
    expect(phoneOtpSql).toContain('"attempts" integer DEFAULT 0 NOT NULL');
    expect(phoneOtpSql).toContain('"verified_at" timestamp with time zone');
    expect(phoneOtpSql).not.toContain("otp_code");
    expect(phoneOtpSql).not.toContain("otp_plain");
  });

  it("creates the auth_provider enum with the planned provider values", () => {
    expect(phoneOtpSql).toContain("auth_provider");
    for (const provider of ["password", "phone", "google", "apple", "telegram"]) {
      expect(phoneOtpSql).toContain(provider);
    }
  });

  it("adds no destructive changes to the existing users table", () => {
    // The migration must not DROP users, sessions, or audit_log.
    // ALTER TABLE "users" to drop NOT NULL constraints is allowed for phone-first.
    expect(phoneOtpSql).not.toMatch(/DROP TABLE/i);
    expect(phoneOtpSql).not.toMatch(/ALTER TABLE "sessions"/i);
    expect(phoneOtpSql).not.toMatch(/ALTER TABLE "audit_log"/i);
  });

  it("only drops NOT NULL constraints on users, not columns or data", () => {
    // ALTER TABLE "users" is allowed but only DROP NOT NULL
    const userAlters = phoneOtpSql.match(/ALTER TABLE "users"[^;]*/gi) ?? [];
    for (const stmt of userAlters) {
      expect(stmt).toMatch(/DROP NOT NULL/i);
      expect(stmt).not.toMatch(/DROP COLUMN/i);
      expect(phoneOtpSql).not.toMatch(/DELETE FROM "users"/i);
    }
  });

  it("preserves the users id UUID primary key identity model", () => {
    const schemaSource = readFileSync(
      join(process.cwd(), "src/db/schema/users.ts"),
      "utf8",
    );
    expect(schemaSource).toContain('uuid("id").primaryKey().defaultRandom()');
    // email and passwordHash are nullable for phone-first candidates
    expect(schemaSource).toContain('text("email")');
    expect(schemaSource).toContain('text("password_hash")');
  });
});

describe("batch 3 account-trust schema (structural, non-destructive)", () => {
  it("adds users.email_verified_at as nullable timestamptz", () => {
    expect(batch3Sql).toContain(
      'ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;',
    );
  });

  it("creates email_verifications with token hash, email, and expiry", () => {
    expect(batch3Sql).toContain('CREATE TABLE "email_verifications"');
    expect(batch3Sql).toContain('"token_hash" text NOT NULL');
    expect(batch3Sql).toContain('"email" text NOT NULL');
    expect(batch3Sql).toContain('"expires_at" timestamp with time zone NOT NULL');
    expect(batch3Sql).toContain('"consumed_at" timestamp with time zone');
    // A raw token column must never exist.
    expect(batch3Sql).not.toContain("token_plain");
    expect(batch3Sql).not.toContain("token_code");
  });

  it("creates login_failures with a hashed account key, not plaintext email", () => {
    expect(batch3Sql).toContain('CREATE TABLE "login_failures"');
    expect(batch3Sql).toContain('"account_key" text NOT NULL');
    expect(batch3Sql).toContain('"attempted_at" timestamp with time zone');
    // The login_failures block itself must not carry a plaintext email column
    // (account_key is the SHA-256 of the normalized email).
    const block =
      batch3Sql.split('CREATE TABLE "login_failures"')[1].split(";")[0];
    expect(block).not.toMatch(/"email"/i);
  });

  it("links email_verifications to users with ON DELETE CASCADE", () => {
    expect(batch3Sql).toContain(
      '"email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id")',
    );
    expect(batch3Sql).toContain("ON DELETE cascade");
  });

  it("creates the expected batch 3 indexes", () => {
    expect(batch3Sql).toContain(
      'CREATE UNIQUE INDEX "email_verifications_token_hash_unique"',
    );
    expect(batch3Sql).toContain(
      'CREATE INDEX "email_verifications_user_id_idx"',
    );
    expect(batch3Sql).toContain(
      'CREATE INDEX "email_verifications_expires_at_idx"',
    );
    expect(batch3Sql).toContain(
      'CREATE INDEX "login_failures_account_key_attempted_at_idx"',
    );
  });

  it("contains no destructive operations", () => {
    expect(batch3Sql).not.toMatch(/DROP TABLE/i);
    expect(batch3Sql).not.toMatch(/DROP COLUMN/i);
    expect(batch3Sql).not.toMatch(/DELETE FROM/i);
    expect(batch3Sql).not.toMatch(/TRUNCATE/i);
  });
});
