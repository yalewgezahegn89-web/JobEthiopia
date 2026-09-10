import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { jobAlerts } from "./jobAlerts";
import { jobs } from "./jobs";
import { alertDeliveryStatusEnum } from "./enums";

export const jobAlertDeliveries = pgTable(
  "job_alert_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => jobAlerts.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: alertDeliveryStatusEnum("status").notNull().default("SENT"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("job_alert_deliveries_alert_id_job_id_unique").on(
      t.alertId,
      t.jobId,
    ),
    index("job_alert_deliveries_alert_id_idx").on(t.alertId),
    index("job_alert_deliveries_job_id_idx").on(t.jobId),
  ],
);