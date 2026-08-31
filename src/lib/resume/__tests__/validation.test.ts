import { describe, it, expect } from "vitest";
import {
  MAX_RESUME_BYTES,
  RESUME_MIME,
  sanitizeResumeFilename,
  isPdfMagicBytes,
  validateResumeFile,
  ResumeValidationError,
} from "../validation";

function pdfFile(name: string, overrides: Partial<{ size: number; type: string }> = {}): File {
  return {
    name,
    size: overrides.size ?? 9,
    type: overrides.type ?? RESUME_MIME,
  } as File;
}

describe("isPdfMagicBytes", () => {
  it("accepts a valid PDF header", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7");
    expect(isPdfMagicBytes(bytes)).toBe(true);
  });

  it("rejects fewer than 5 bytes", () => {
    expect(isPdfMagicBytes(new TextEncoder().encode("%PDF"))).toBe(false);
  });

  it("rejects a non-PDF header (e.g. an executable)", () => {
    expect(isPdfMagicBytes(new TextEncoder().encode("MZ\u0000\u0002"))).toBe(false);
  });
});

describe("sanitizeResumeFilename", () => {
  it("strips path separators and control characters", () => {
    expect(sanitizeResumeFilename("../evil\u0000name.pdf")).toBe(
      "..evilname.pdf",
    );
  });

  it("caps length at 255 characters", () => {
    const long = `${"a".repeat(300)}.pdf`;
    expect(sanitizeResumeFilename(long).length).toBeLessThanOrEqual(255);
  });

  it("falls back to resume.pdf when nothing safe remains", () => {
    expect(sanitizeResumeFilename("/")).toBe("resume.pdf");
  });

  it("appends .pdf when the extension is missing", () => {
    expect(sanitizeResumeFilename("cv")).toBe("cv.pdf");
  });
});

describe("validateResumeFile", () => {
  it("accepts a valid PDF file", () => {
    expect(validateResumeFile(pdfFile("cv.pdf"))).toBe("cv.pdf");
  });

  it("throws TOO_LARGE for files over the 5 MB limit", () => {
    const file = pdfFile("big.pdf", { size: MAX_RESUME_BYTES + 1 });
    expect(() => validateResumeFile(file)).toThrowError(
      new ResumeValidationError("TOO_LARGE"),
    );
  });

  it("throws INVALID_EXTENSION for a non-PDF extension", () => {
    expect(() => validateResumeFile(pdfFile("cv.docx"))).toThrowError(
      new ResumeValidationError("INVALID_EXTENSION"),
    );
  });

  it("throws INVALID_TYPE for a non-PDF MIME type", () => {
    const file = pdfFile("cv.pdf", { type: "application/msword" });
    expect(() => validateResumeFile(file)).toThrowError(
      new ResumeValidationError("INVALID_TYPE"),
    );
  });

  it("throws INVALID_FILENAME when the file is nullish", () => {
    expect(() => validateResumeFile(null)).toThrowError(
      new ResumeValidationError("INVALID_FILENAME"),
    );
  });
});
