# Telegram Publishing (Outbox)

JobEthiopia publishes qualifying jobs to a Telegram channel through a durable
outbox. Publishing is intentionally separate from Telegram OIDC login: the bot
uses `TELEGRAM_BOT_TOKEN`, never `TELEGRAM_CLIENT_SECRET`.

## Configuration

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather). Required to send. |
| `TELEGRAM_CHANNEL_ID` | Channel username (e.g. `@jobs`) or numeric chat ID. |
| `TELEGRAM_API_BASE_URL` | Optional override; must be the official `https://api.telegram.org` origin. Invalid values disable sending instead of risking the token. |
| `INTERNAL_TELEGRAM_API_KEY` | Optional route key for the internal outbox endpoint; a blank value falls back to `MAINTENANCE_API_KEY`. |

Add the bot as an **administrator** of the target channel. If the token or
channel is missing, the outbox worker returns `configured: false` and leaves
queued rows untouched; the rest of the application keeps working. Telegram is
not required to publish on the website: the job publication and the optional
outbox insert happen together, and the website publish succeeds even when no
channel is configured.

Because the bot token is part of the request URL, `TELEGRAM_API_BASE_URL` is
restricted to the official HTTPS origin. Plaintext HTTP, alternate hosts or
ports, credentials, query strings, fragments, and paths are rejected before any
request is made, so a misconfigured base URL can neither receive the token nor
be silently redirected.

Publications are English-only. The templates use English headings and labels,
and the original official English job content is published unchanged. No
translation provider or translation API is used. The website keeps its existing
Amharic and Afaan Oromo interface localization.

## Safety gates for auto-publish

A freshly ingested job is auto-published only when **all** of the following are
true:

1. The source exists, is active, and has `autoPublish` enabled.
2. The source has `trustLevel = HIGH` and a supported adapter (`API`/`FEED`, or
   a `WEBSITE` on an allow-listed airline host such as `ethiopianairlines.com`).
3. The job is still `DRAFT` (only newly created imports are considered).
4. `applicantEligibility` is explicitly `ETHIOPIAN_APPLICANTS_CONFIRMED` or
   `INTERNATIONAL_APPLICANTS_ACCEPTED`. Eligibility is never inferred from a
   location, employer country, or missing field; ambiguous jobs remain
   `NOT_STATED` and are not auto-published.
5. The deadline is not in the past. A missing deadline is allowed, but Facebook
   posts without one normally stay in review for that and other missing fields.
6. The application URL is a safe `http(s)` URL.
7. `validateJobForPublish` passes (complete data, active organization,
   category, location, and provenance).
8. For `FACEBOOK` sources, ingestion is enabled and external Pages have both
   Meta approval and documented content-use authorization. Facebook
   auto-publication is currently inert because extraction does not assign a
   category (see [Facebook Page Ingestion](./facebook-ingestion.md)).

The publish and optional outbox insert happen in one transaction. The job update
is guarded by `status = DRAFT`, so two workers cannot publish the same job, and
a unique `(job_id, channel)` index prevents duplicate queue rows. If any gate
fails, the job stays a draft for manual review. A missing Telegram channel only
skips the outbox insert; it does not block website publication.

## Outbox lifecycle

`telegram_publications.state` moves through:

| State | Meaning |
|---|---|
| `QUEUED` | Waiting for the worker. |
| `SENDING` | Claimed by a worker (`FOR UPDATE SKIP LOCKED`). |
| `RETRY` | Transient failure; scheduled at `next_retry_at`. |
| `SENT` | Delivered; `telegram_message_id` recorded. |
| `FAILED` | Permanent error or `max_attempts` exhausted. |
| `SKIPPED` | Job is no longer published/deleted, or the channel changed. |

Retries use exponential backoff from 1 minute up to 6 hours, honouring
Telegram's `retry_after` for HTTP 429. Permanent 4xx errors fail immediately.
Rows left in `SENDING` for at least 10 minutes (for example after a killed
worker) are recovered atomically at the start of each run, before new rows are
claimed: the attempt counter is incremented and the row becomes `RETRY` with an
immediate `next_retry_at`, or `FAILED` once `max_attempts` is reached. Recovery
runs even when Telegram configuration is missing, so a stuck row is never
hidden behind `configured: false`. Before sending, the worker re-checks that the
job is still `PUBLISHED` and that the configured channel still matches the
queued channel.

Delivery is **at-least-once**, not exactly-once. If Telegram accepts a message
but the worker dies or the response is lost before the row is marked `SENT`, the
lease recovery will retry it and the channel can receive a duplicate. The
10-minute lease keeps that window bounded; it cannot be eliminated without
Telegram-side idempotency.

Messages are HTML-escaped. The description is converted to plain text and
truncated to 500 characters; the link points at the public `/jobs/{id}` page.

## Operations

Scheduled worker:
[`.github/workflows/telegram.yml`](../.github/workflows/telegram.yml) calls
`POST /api/internal/telegram/publish` every 5 minutes.

Manual drain:

```bash
curl -X POST \
  -H "x-maintenance-key: $MAINTENANCE_API_KEY" \
  "https://jobs.example.com/api/internal/telegram/publish?limit=20"
```

The response shape is:

```json
{
  "configured": true,
  "reason": null,
  "recovered": 0,
  "claimed": 0,
  "sent": 0,
  "retried": 0,
  "failed": 0,
  "skipped": 0
}
```

`recovered` counts stale `SENDING` rows reclaimed by the lease at the start of
the run. Operators can inspect states, errors, and retry failed rows from
`/admin/telegram`. Relevant audit actions are `JOB_AUTO_PUBLISHED`,
`TELEGRAM_OUTBOX_RUN`, `TELEGRAM_PUBLICATION_SENT`,
`TELEGRAM_PUBLICATION_FAILED`, and `TELEGRAM_PUBLICATION_SKIPPED`.

## Troubleshooting

- **Nothing is sent:** check `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, bot
  channel-admin status, and whether the job is `PUBLISHED` with a `QUEUED` row.
- **`configured: false`:** the bot token or channel is missing; queued rows are
  intentionally left pending.
- **`FAILED` with a 4xx error:** usually a wrong chat ID, bot removed from the
  channel, or malformed message. Fix the configuration and retry from the admin
  page.
- **`SKIPPED`:** the job was unpublished/removed, or the channel configuration
  changed after the row was queued.
- **A row was stuck in `SENDING`:** the next run reclaims it after 10 minutes.
  If the channel already received the message, treat the retry as a possible
  duplicate; delivery is at-least-once.
- **Don't** reuse `TELEGRAM_CLIENT_SECRET` for publishing; rotate a dedicated
  bot token if it is ever exposed.
