import { describe, it, expect } from "vitest";
import {
  coverLetterSchema,
  parseCoverLetterReference,
  isValidUuid,
  COVER_LETTER_TITLE_MAX,
  COVER_LETTER_FIELD_MAX,
  COVER_LETTER_BODY_MAX,
  COVER_LETTERS_MAX,
} from "@/lib/validations/coverLetter";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Accountant — application",
    position: "Senior Accountant",
    employer: "ABC Group",
    recipient: "Mr. Dawit Alemu",
    location: "Addis Ababa",
    body: "I am writing to apply for the Senior Accountant position.",
    ...overrides,
  };
}

function dropKey(input: Record<string, unknown>, key: string) {
  const out = { ...input };
  delete out[key];
  return out;
}

const UUID = "11111111-1111-4111-8111-111111111111";

describe("cover letter constants", () => {
  it("exports correct limits", () => {
    expect(COVER_LETTER_TITLE_MAX).toBe(120);
    expect(COVER_LETTER_FIELD_MAX).toBe(120);
    expect(COVER_LETTER_BODY_MAX).toBe(8000);
    expect(COVER_LETTERS_MAX).toBe(50);
  });
});

describe("coverLetterSchema", () => {
  it("accepts a valid letter", () => {
    const res = coverLetterSchema.safeParse(validInput());
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.title).toBe("Accountant — application");
    }
  });

  it("requires title", () => {
    const res = coverLetterSchema.safeParse(dropKey(validInput(), "title"));
    expect(res.success).toBe(false);
  });

  it("rejects empty title", () => {
    const res = coverLetterSchema.safeParse(validInput({ title: "  " }));
    expect(res.success).toBe(false);
  });

  it("rejects title over max length", () => {
    const res = coverLetterSchema.safeParse(
      validInput({ title: "a".repeat(COVER_LETTER_TITLE_MAX + 1) }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts title at max length", () => {
    const res = coverLetterSchema.safeParse(
      validInput({ title: "a".repeat(COVER_LETTER_TITLE_MAX) }),
    );
    expect(res.success).toBe(true);
  });

  it("requires position", () => {
    expect(coverLetterSchema.safeParse(dropKey(validInput(), "position")).success).toBe(false);
  });

  it("requires employer", () => {
    expect(coverLetterSchema.safeParse(dropKey(validInput(), "employer")).success).toBe(false);
  });

  it("requires body", () => {
    expect(coverLetterSchema.safeParse(dropKey(validInput(), "body")).success).toBe(false);
  });

  it("rejects position over max length", () => {
    const res = coverLetterSchema.safeParse(
      validInput({ position: "a".repeat(COVER_LETTER_FIELD_MAX + 1) }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects body over max length", () => {
    const res = coverLetterSchema.safeParse(
      validInput({ body: "a".repeat(COVER_LETTER_BODY_MAX + 1) }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts body at max length", () => {
    const res = coverLetterSchema.safeParse(
      validInput({ body: "a".repeat(COVER_LETTER_BODY_MAX) }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty recipient to null", () => {
    const res = coverLetterSchema.safeParse(validInput({ recipient: "   " }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.recipient).toBeNull();
  });

  it("maps empty location to null", () => {
    const res = coverLetterSchema.safeParse(validInput({ location: "" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.location).toBeNull();
  });

  it("accepts null recipient", () => {
    const res = coverLetterSchema.safeParse(validInput({ recipient: null }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.recipient).toBeNull();
  });

  it("maps missing recipient to null", () => {
    const res = coverLetterSchema.safeParse(dropKey(validInput(), "recipient"));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.recipient ?? null).toBeNull();
  });

  it("rejects unknown fields (strict mode)", () => {
    const res = coverLetterSchema.safeParse(validInput({ extra: "x" }));
    expect(res.success).toBe(false);
  });

  it("trims bound values", () => {
    const res = coverLetterSchema.safeParse(
      validInput({ title: "  My Letter  ", position: "  Auditor  " }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.title).toBe("My Letter");
      expect(res.data.position).toBe("Auditor");
    }
  });

  it("accepts Amharic and Afaan Oromo text", () => {
    const res = coverLetterSchema.safeParse(
      validInput({
        title: "ማመልከቻ — አካውንታንት",
        position: "Akawuntantii Guddaa",
        body: "ከተወዳዳሪ ተሞክሮ ጋር ለመስራት እፈልጋለሁ።",
      }),
    );
    expect(res.success).toBe(true);
  });
});

describe("parseCoverLetterReference", () => {
  it("parses a valid id and jobId", () => {
    const res = parseCoverLetterReference({ id: UUID, jobId: UUID });
    expect(res.ok).toBe(true);
    expect(res.id).toBe(UUID);
    expect(res.jobId).toBe(UUID);
  });

  it("allows empty id and jobId (create)", () => {
    const res = parseCoverLetterReference({ id: "", jobId: "" });
    expect(res.ok).toBe(true);
    expect(res.id).toBeNull();
    expect(res.jobId).toBeNull();
  });

  it("allows null id and jobId", () => {
    const res = parseCoverLetterReference({ id: null, jobId: null });
    expect(res.ok).toBe(true);
    expect(res.id).toBeNull();
    expect(res.jobId).toBeNull();
  });

  it("allows missing id and jobId", () => {
    const res = parseCoverLetterReference({});
    expect(res.ok).toBe(true);
    expect(res.id).toBeNull();
    expect(res.jobId).toBeNull();
  });

  it("trims whitespace around ids", () => {
    const res = parseCoverLetterReference({ id: `  ${UUID}  `, jobId: "" });
    expect(res.ok).toBe(true);
    expect(res.id).toBe(UUID);
  });

  it("rejects a malformed id", () => {
    const res = parseCoverLetterReference({ id: "not-a-uuid", jobId: "" });
    expect(res.ok).toBe(false);
  });

  it("rejects a malformed jobId", () => {
    const res = parseCoverLetterReference({ id: "", jobId: "bad" });
    expect(res.ok).toBe(false);
  });

  it("rejects a non-string id (array)", () => {
    const res = parseCoverLetterReference([UUID]);
    expect(res.ok).toBe(false);
  });

  it("rejects a numeric id", () => {
    const res = parseCoverLetterReference({ id: 42, jobId: "" });
    expect(res.ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(parseCoverLetterReference("x").ok).toBe(false);
    expect(parseCoverLetterReference(3).ok).toBe(false);
    expect(parseCoverLetterReference(null).ok).toBe(false);
  });
});

describe("isValidUuid", () => {
  it("accepts a valid uuid", () => {
    expect(isValidUuid(UUID)).toBe(true);
  });

  it("rejects malformed uuids", () => {
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("11111111-1111-4111-8111")).toBe(false);
    expect(isValidUuid("x".repeat(36))).toBe(false);
  });
});