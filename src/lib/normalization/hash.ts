import { createHash } from "crypto";
import type { ContentHashInput } from "./types";

export function computeContentHash(input: ContentHashInput): string {
  const descriptionTruncated = input.normalizedDescription.substring(0, 500);

  const raw = [
    input.normalizedTitle.toLowerCase().trim(),
    input.organizationId,
    input.locationId,
    descriptionTruncated.toLowerCase().trim(),
    input.deadline ?? "",
    input.applicationUrl ?? "",
  ].join("|");

  return createHash("sha256").update(raw, "utf8").digest("hex");
}
