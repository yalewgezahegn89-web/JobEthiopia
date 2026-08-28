import { describe, it, expect } from "vitest";
import { computeContentHash } from "../hash";

describe("computeContentHash", () => {
  it("returns a sha256 hex string", () => {
    const hash = computeContentHash({
      normalizedTitle: "Nurse",
      organizationId: "org-1",
      locationId: "loc-1",
      normalizedDescription: "A nursing role",
      deadline: "",
      applicationUrl: "",
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for same input", () => {
    const input = {
      normalizedTitle: "Nurse",
      organizationId: "org-1",
      locationId: "loc-1",
      normalizedDescription: "A nursing role",
      deadline: "",
      applicationUrl: "",
    };
    expect(computeContentHash(input)).toBe(computeContentHash(input));
  });

  it("produces different hashes for different titles", () => {
    const base = {
      organizationId: "org-1",
      locationId: "loc-1",
      normalizedDescription: "A role",
      deadline: "",
      applicationUrl: "",
    };
    const hash1 = computeContentHash({ ...base, normalizedTitle: "Nurse" });
    const hash2 = computeContentHash({ ...base, normalizedTitle: "Doctor" });
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different organizations", () => {
    const base = {
      normalizedTitle: "Nurse",
      locationId: "loc-1",
      normalizedDescription: "A role",
      deadline: "",
      applicationUrl: "",
    };
    const hash1 = computeContentHash({ ...base, organizationId: "org-1" });
    const hash2 = computeContentHash({ ...base, organizationId: "org-2" });
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different descriptions", () => {
    const base = {
      normalizedTitle: "Nurse",
      organizationId: "org-1",
      locationId: "loc-1",
      deadline: "",
      applicationUrl: "",
    };
    const hash1 = computeContentHash({
      ...base,
      normalizedDescription: "Role A",
    });
    const hash2 = computeContentHash({
      ...base,
      normalizedDescription: "Role B",
    });
    expect(hash1).not.toBe(hash2);
  });

  it("truncates description to 500 characters before hashing", () => {
    const longDesc = "a".repeat(1000);
    const truncatedDesc = "a".repeat(500);
    const base = {
      normalizedTitle: "Nurse",
      organizationId: "org-1",
      locationId: "loc-1",
      deadline: "",
      applicationUrl: "",
    };
    const hash1 = computeContentHash({ ...base, normalizedDescription: longDesc });
    const hash2 = computeContentHash({
      ...base,
      normalizedDescription: truncatedDesc,
    });
    expect(hash1).toBe(hash2);
  });

  it("lowercases title before hashing", () => {
    const base = {
      organizationId: "org-1",
      locationId: "loc-1",
      normalizedDescription: "A role",
      deadline: "",
      applicationUrl: "",
    };
    const hash1 = computeContentHash({ ...base, normalizedTitle: "Nurse" });
    const hash2 = computeContentHash({ ...base, normalizedTitle: "nurse" });
    expect(hash1).toBe(hash2);
  });

  it("includes deadline in hash", () => {
    const base = {
      normalizedTitle: "Nurse",
      organizationId: "org-1",
      locationId: "loc-1",
      normalizedDescription: "A role",
      applicationUrl: "",
    };
    const hash1 = computeContentHash({ ...base, deadline: "" });
    const hash2 = computeContentHash({ ...base, deadline: "2025-12-31" });
    expect(hash1).not.toBe(hash2);
  });

  it("includes applicationUrl in hash", () => {
    const base = {
      normalizedTitle: "Nurse",
      organizationId: "org-1",
      locationId: "loc-1",
      normalizedDescription: "A role",
      deadline: "",
    };
    const hash1 = computeContentHash({ ...base, applicationUrl: "" });
    const hash2 = computeContentHash({
      ...base,
      applicationUrl: "https://example.com",
    });
    expect(hash1).not.toBe(hash2);
  });
});
