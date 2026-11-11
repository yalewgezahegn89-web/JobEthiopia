# Facebook Page Publishing (Manual, Administrator-Triggered)

JobEthiopia can publish an eligible job to its **own** Facebook Page —
"Job Ethiopia", Page ID `872697352845055` — through the official Meta Graph
API only. Publishing is a manual staff action. There is no background worker,
no cron job, and no ingestion hook: every post starts from an authenticated
`ADMIN`/`SUPER_ADMIN` request in `/admin/jobs/<id>`.

This feature is separate from Facebook Page ingestion
(`ENABLE_FACEBOOK_INGESTION`): reading Pages never enables writing to our
Page, and writing never enables reading.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_FACEBOOK_PUBLISHING` | `false` | Must be exactly `true` to allow any publish request. Dedicated flag; never implied by `ENABLE_FACEBOOK_INGESTION`. |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | unset | Page access token for the owned Page. Sending requires the `pages_manage_posts` permission in addition to the read permissions. |
| `FACEBOOK_GRAPH_API_VERSION` | `v23.0` | Graph API version (`v<major>.<minor>`). Overridable after verifying the token against a newer version. |
| `FACEBOOK_GRAPH_API_BASE_URL` | `https://graph.facebook.com` | Optional override; must be the official HTTPS origin. Invalid values fail closed. |

The destination Page is a code constant
(`OWNED_FACEBOOK_PAGE_ID = "872697352845055"`), never client input or an
environment override, so no request can redirect a post to another Page.

### Graph API version decision

The default is `v23.0` (served by Meta until 2027-10-08). The v27.0
changelog (released 2026-11-04) was reviewed before this feature was built:
it contains no changes to `GET /{page-id}`, `GET /{page-id}/posts`, or
`POST /{page-id}/feed` with `message`/`link`; its changes affect post-edit
`is_ai_generated`, the Marketing API, the Catalog `/batch` endpoint, and six
legacy features (multi-ID requests, `date_format`, method override, field
aliases, JSONP, `asyncbatch`) that this codebase does not use. Because no
v27.0 change benefits these operations and the live pipeline is verified
against v23.0, the default stays at v23.0. Operators may set
`FACEBOOK_GRAPH_API_VERSION=v27.0` after verifying their token against the
newer version.

## Safety gates

A publish request is refused before any Meta call unless **all** of the
following hold:

1. The requesting user is an authenticated `ADMIN` or `SUPER_ADMIN`
   (identity from the verified session; the client cannot supply an actor).
2. `ENABLE_FACEBOOK_PUBLISHING` is exactly `true`.
3. `FACEBOOK_PAGE_ACCESS_TOKEN` is configured.
4. The job exists and is already `PUBLISHED` **and** `VERIFIED` on the
   website (Facebook publishing never changes the website lifecycle).
5. The deadline is not in the past.
6. `applicantEligibility` is `ETHIOPIAN_APPLICANTS_CONFIRMED` or
   `INTERNATIONAL_APPLICANTS_ACCEPTED`.
7. The canonical public job URL (and, when present, the application URL) is
   a safe `http(s)` URL.
8. The administrator explicitly confirmed JobEthiopia's right to
   redistribute the listing (checkbox in the UI).
9. The job has provenance (`job_sources`), and for Facebook-origin jobs
   every external Page source has both Meta approval
   (`facebook_approval_state = APPROVED`) and documented content-use
   authorization (`facebook_content_use_state = AUTHORIZED`). The
   JobEthiopia-owned Page is our own content and is always authorized.
10. No durable publication record blocks the attempt (see below).

The post text is composed server-side from structured job fields only
(title, employer, location, employment type, deadline, eligibility, and the
canonical job URL). It is an original, concise JobEthiopia composition; it
never copies a third-party Page's post text, full description, or other
copyrighted wording. The administrator sees the exact text before
confirming.

## Duplicate protection

`facebook_publications` is a durable record with a unique `(job_id, page_id)`
index. A row is **claimed as `PENDING` before the Graph API call**, so a
second concurrent request for the same job can never send a second POST.

States:

| State | Meaning | Re-publish allowed? |
|---|---|---|
| `PENDING` | Claimed; the Graph call is in flight | No — blocked |
| `PUBLISHED` | Facebook confirmed the post | No — blocked |
| `FAILED` | Facebook definitively rejected the post (no post exists) | Yes — a new explicit administrator request re-claims the row |
| `UNKNOWN` | Ambiguous outcome (e.g. network timeout); the post may exist | No — never, without manual operator review |

Additional invariants:

- The Graph POST is issued **exactly once** per claim. There is no retry
  logic of any kind — a repeat POST could create a duplicate post.
- Network-level failures (timeout, DNS, connection reset) and unreadable
  success responses are recorded as `UNKNOWN` and audited.
- An `UNKNOWN` row can only be resolved by an operator (verify on Facebook
  whether the post exists, then correct the row manually); the service
  never re-attempts it and never silently permits a duplicate.
- A crashed worker can leave a row in `PENDING`; that row blocks future
  attempts and requires the same manual review.

## Manual recovery for stuck PENDING and UNKNOWN records

`PENDING` and `UNKNOWN` records block every later publish request for the
same job. Resolve them by hand, from the official Job Ethiopia Facebook Page.
There is no automatic recovery worker, and none should be added: a blind retry
could create a duplicate post.

### 1. Inspect the records (read-only)

Run this query against the application database. It only reads; it does not
change any row.

```sql
SELECT
  p.id AS publication_id,
  p.job_id,
  p.page_id,
  p.state,
  p.facebook_post_id,
  p.requested_by,
  p.last_error,
  p.created_at,
  p.updated_at,
  j.title AS job_title,
  j.slug AS job_slug
FROM facebook_publications p
JOIN jobs j ON j.id = p.job_id
WHERE p.state IN ('PENDING', 'UNKNOWN')
ORDER BY p.updated_at ASC;
```

To inspect one record:

```sql
SELECT *
FROM facebook_publications
WHERE id = '<publication_id>';
```

### 2. Verify the Page feed

1. Open the official **Job Ethiopia** Page (Page ID `872697352845055`) while
   signed in as an administrator of that Page.
2. Open the Page's feed / published posts. Use the record's `created_at`
   (`updated_at` is close) as the reference time. Times are stored in UTC;
   the Page displays Africa/Addis_Ababa time, so convert before comparing.
3. Look for a post created within a few minutes of `created_at`. Re-read the
   feed if the attempt was very recent — propagation can lag.
4. Correlate the exact post text: the message is composed deterministically
   from the job's title, employer, location, employment type, deadline,
   eligibility, and the canonical URL
   `<APP_BASE_URL>/jobs/<job_id>`. The job URL contains the same `job_id` as
   the record, which is the strongest match.
5. Open the post and copy its remote Facebook post ID from the permalink
   (the numeric ID at the end of the post URL), and note its creation time.

### 3. Reconcile the record

Choose exactly one outcome. Use a transaction and scope every update with
`WHERE id = ... AND state IN ('PENDING', 'UNKNOWN')` so a concurrent change
is not overwritten.

**A. The matching post is confirmed on the Page**

- Verify the remote Facebook post ID from the post permalink.
- Update the record to `PUBLISHED`, recording `facebook_post_id` and
  `published_at` (the post's creation time).

```sql
UPDATE facebook_publications
SET
  state = 'PUBLISHED',
  facebook_post_id = '<remote_post_id>',
  published_at = '<post_created_at_iso8601>',
  last_error = NULL,
  updated_at = now()
WHERE id = '<publication_id>'
  AND state IN ('PENDING', 'UNKNOWN');
```

**B. The post is confidently confirmed absent**

- Change the record to `FAILED`.
- Record a manual reconciliation explanation in `last_error`, including the
  date, operator, and how absence was verified.
- A `FAILED` record may then be re-claimed by a new explicit administrator
  request using the existing reclaim logic. Do not publish from SQL.

```sql
UPDATE facebook_publications
SET
  state = 'FAILED',
  last_error = 'Manual reconciliation YYYY-MM-DD by <operator>: post confirmed absent from the Job Ethiopia Page feed for job <job_id>.',
  updated_at = now()
WHERE id = '<publication_id>'
  AND state IN ('PENDING', 'UNKNOWN');
```

**C. The outcome is still uncertain**

- Do not retry.
- Leave the record `UNKNOWN`. If a stuck `PENDING` record cannot be verified,
  move it to `UNKNOWN` so the ambiguity is explicit instead of looking like
  an in-flight request.
- Re-check later; do not guess and do not create a second post.

```sql
UPDATE facebook_publications
SET
  state = 'UNKNOWN',
  last_error = 'Manual reconciliation YYYY-MM-DD by <operator>: outcome could not be verified; not retried.',
  updated_at = now()
WHERE id = '<publication_id>'
  AND state = 'PENDING';
```

Do **not** clear or delete publication records. They are the durable duplicate
protection; deleting one would allow the same job to be posted again.

## Transport security

- Requests target only the official `https://graph.facebook.com` origin
  (validated by URL, with DNS resolution pinned against SSRF).
- The token is sent only in the `Authorization: Bearer` header — never in
  the URL, query parameters, or the form-encoded body.
- The body is form-encoded and contains only `message` and an optional
  `link`.
- Authorization headers and the body are only forwarded across redirects
  when the origin is identical; a scheme, port, or host change drops them.
- Errors are redacted (`redactFacebookSecrets`) before they are stored,
  logged, audited, or returned to the admin UI.

## Admin interface

On `/admin/jobs/<id>` (for published jobs) a "Publish to Facebook" panel
shows the destination Page, the exact post text, and the attached link.
Before a request is sent the administrator must check the publication-rights
confirmation and press the explicit **Publish to Facebook** button. The
button is disabled while the request is in flight and whenever a durable
publication record blocks a repeat. The Page access token is never present
in the UI; it lives only in the server environment.

## Auditing

Every attempt writes an audit event (never credentials): successful
publication (`JOB_FACEBOOK_PUBLISHED`, with the remote post id), definite
rejection (`JOB_FACEBOOK_PUBLISH_FAILED`), ambiguous outcome
(`JOB_FACEBOOK_PUBLISH_UNKNOWN`), duplicate rejection
(`JOB_FACEBOOK_PUBLISH_DUPLICATE_REJECTED`), forbidden role
(`JOB_FACEBOOK_PUBLISH_FORBIDDEN`), and a missing rights confirmation
(`JOB_FACEBOOK_PUBLISH_RIGHTS_UNCONFIRMED`).

The requesting administrator (`actorUserId`, plus `actorRole`) is kept on
every publication outcome. After the server has validated the explicit
acknowledgement, terminal `PUBLISHED`, `FAILED`, and `UNKNOWN` audit metadata
also records `contentRightsConfirmed: true`. Credentials are never stored in
audit metadata.

## Database migration

`drizzle/0026_tense_rick_jones.sql` is generated from the Drizzle schema and
creates the `facebook_publication_state` enum and the `facebook_publications`
table (foreign keys, unique `(job_id, page_id)` index, and state index).
Apply it with `npm run db:migrate` against a local/preview database
(**never** production without an operator-reviewed plan).

## Testing

All Meta API calls are mocked; no test performs a real Graph request and no
test publishes a real post.

- `src/lib/facebook/__tests__/graphClient.test.ts` (POST coverage)
- `src/lib/facebook/__tests__/publishing.test.ts`
- `src/app/admin/jobs/__tests__/facebook-publish-action.test.ts`
- `src/app/admin/jobs/[id]/__tests__/facebook-publish-panel.test.ts`

## Known limitations

- `UNKNOWN` outcomes and abandoned `PENDING` rows require manual operator
  review (see [Manual recovery](#manual-recovery-for-stuck-pending-and-unknown-records)).
  The service deliberately never retries them.
- Meta app review, Page permissions (`pages_manage_posts`), and production
  credentials are operator responsibilities and are not automated here.
