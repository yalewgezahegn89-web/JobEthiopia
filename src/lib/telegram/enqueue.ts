import type { db } from "@/db";
import { telegramPublications } from "@/db/schema/telegramPublications";

type TelegramEnqueueTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

interface EnqueueTelegramPublicationInput {
  jobId: string;
  channel: string;
  now: Date;
}

export async function enqueueTelegramPublication(
  tx: TelegramEnqueueTransaction,
  { jobId, channel, now }: EnqueueTelegramPublicationInput,
): Promise<void> {
  await tx
    .insert(telegramPublications)
    .values({
      jobId,
      channel,
      state: "QUEUED",
      attempts: 0,
      nextRetryAt: now,
    })
    .onConflictDoNothing();
}
