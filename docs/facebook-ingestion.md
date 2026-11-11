# Facebook Page Ingestion

Facebook Page ingestion imports published job posts from Facebook Pages using
the official Meta Graph API only. It never scrapes HTML, never automates a
browser, and never uses unofficial endpoints.

## Scope and permissions

- Reads **published Page posts only**.
- Requests only `id`, `message`, `created_time`, and `permalink_url`.
- Does not read comments, direct messages, personal profiles, or any other
  personal data.
- No Facebook content is translated. Imported job content and Telegram
  announcements stay English-only; the rest of the website keeps its existing
  en/am/om interface translations.

### Owned Pages

An owned Page is JobEthiopia's own Page. Configure `FACEBOOK_PAGE_ACCESS_TOKEN`
with a Page access token that has:

- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`

### External Pages

An external Page is a third-party Page. It may only be monitored after **both**:

1. Meta **Page Public Content Access** approval is recorded
   (`facebook_approval_state = APPROVED`), and
2. The Page owner's documented content-use authorization is recorded
   (`facebook_content_use_state = AUTHORIZED`).

External Page reads use an app access token. Set either
`FACEBOOK_APP_ACCESS_TOKEN` or `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET`.
Without both approval and authorization, the adapter refuses to fetch.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_FACEBOOK_INGESTION` | `false` | Must be exactly `true` to sweep Facebook sources. It does not enable Facebook auto-publishing, which is currently disabled pending category mapping. |
| `FACEBOOK_GRAPH_API_VERSION` | `v23.0` | Graph API version (`v<major>.<minor>`) |
| `FACEBOOK_GRAPH_API_BASE_URL` | `https://graph.facebook.com` | Optional override; must be the official HTTPS origin. Invalid values fail closed. |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | unset | Owned Page token |
| `FACEBOOK_APP_ACCESS_TOKEN` | unset | External app token |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | unset | Alternative external app token source |

Tokens are read from the server environment only. They are never stored in the
database, returned by an API, or rendered in the admin UI. The Graph client
sends the token as `Authorization: Bearer <token>` (never as a query
parameter), strips any `access_token` from pagination URLs, and redacts
credentials from errors.

`FACEBOOK_GRAPH_API_BASE_URL` is normalized to the official
`https://graph.facebook.com` origin. Non-HTTPS values, alternate hosts or ports,
userinfo, query strings, fragments, and paths are rejected, and the client
further refuses any request or pagination URL whose origin differs from the
configured one. Authorization headers are forwarded across redirects only when
the origin is identical; a scheme, port, or host change drops them.

## Creating a source

1. Open `/admin/sources` and create a source with type `FACEBOOK`.
2. Enter the Page ID, Page URL, Page kind, approval state, content-use state,
   and an authorization note.
3. Keep trust at `MEDIUM` and auto-publish off unless there is a specific,
   reviewed reason to do otherwise.
4. Use **Sync now** on the source detail page. The page shows status, last
   successful check, last attempted check, and last error.

Pausing ingestion uses the existing **Deactivate** action. Deleting a source
that is referenced by jobs is blocked by the existing foreign-key rules.

## Extraction

Extraction is deterministic and uses only text explicitly present in the post.
Missing details are never invented.

- Recognized labels include job title/position, employer/company,
  location/duty station, deadline/closing date, requirements/qualifications,
  responsibilities/duties, salary, and employment type.
- The Page display name is used as the organization fallback.
- `postedAt` comes from `created_time`.
- Deadlines support `YYYY-MM-DD`, `DD/MM/YYYY`, and `Month D, YYYY` /
  `D Month YYYY`, always normalized to end-of-day UTC.
- The application URL is the first safe non-Facebook `http(s)` URL. Facebook
  post links, `m.me`, and Messenger links are not used.
- Applicant eligibility uses the existing explicit classifier and defaults to
  `NOT_STATED`. It is never inferred from location or employer.
- No category or profession is guessed from the post text. The extracted job
  keeps `categoryName: null` and must be classified by a moderator.
- Posts without a recognizable vacancy signal, or without a title, are skipped
  with a reason.

## Review and publishing safety

- Incomplete job posts are still ingested as `DRAFT`, but marked
  `NEEDS_REVIEW` with deterministic reasons written to the audit log (for
  example missing application URL, missing deadline, or unstated eligibility).
  Posts without a deadline stay in review; publication validation accepts a
  null deadline, but the missing field is still recorded for the moderator.
- Facebook sources default to manual review: `MEDIUM` trust and no
  auto-publish. A moderator must assign category/profession and complete any
  missing fields before publication.
- **Facebook auto-publication is intentionally disabled.** Even with
  `ENABLE_FACEBOOK_INGESTION=true` and `autoPublish` on the source, extraction
  never invents a category and `validateJobForPublish` requires a category, so
  the job fails validation and remains a draft. This is the safe behavior until
  an explicit category/profession mapping is reviewed and approved.
- If that gating were satisfied, auto-publishing would still require HIGH
  trust, explicit opt-in, confirmed applicant eligibility, a non-past deadline,
  a safe application URL, and full publication validation. External Pages
  additionally require approval and authorization. Facebook jobs are never
  auto-classified as HIGH trust.
- Website publishing is independent of Telegram. When a Telegram channel is
  configured, the job is also queued in the outbox; when it is not, the
  website publication still succeeds.

## Reconciliation

Each successful fetch reports the external IDs it observed and any items that
need review.

- Published jobs that changed upstream are flagged `NEEDS_REVIEW`.
- Published jobs that were not observed in the latest fetch (deleted or
  edited-away posts) are flagged `NEEDS_REVIEW`.
- An empty observation is never treated as "everything disappeared". If a
  successful fetch returns zero posts, reconciliation is skipped (and logged)
  instead of flagging every previously imported post.
- Nothing is deleted, and the existing job lifecycle owns any subsequent
  unpublishing.
- Bookkeeping failures never fail an otherwise successful ingestion run.

## Deduplication and provenance

Facebook jobs use the existing ingestion pipeline and dedup cascade:

1. source + external ID (`<pageId>:<postId>`),
2. source URL,
3. global content hash,
4. organization + title + location.

The original post URL is stored as provenance and included in the job
description attribution footer.

## Testing

Relevant tests:

- `src/lib/facebook/__tests__/config.test.ts`
- `src/lib/facebook/__tests__/extractJobPost.test.ts`
- `src/lib/facebook/__tests__/graphClient.test.ts`
- `src/lib/facebook/__tests__/publishing.test.ts`
- `src/lib/sources/adapters/__tests__/facebookPage.test.ts`
- `src/lib/ingestion/__tests__/autoPublish.test.ts`
- `src/lib/ingestion/__tests__/runSource.test.ts`
- `src/lib/ingestion/__tests__/facebookSync.test.ts`
- `src/lib/validations/__tests__/sourceUpdate.test.ts`
- `src/lib/sources/adapters/__tests__/index.test.ts`

Publishing to the owned Page is a separate, manual-only feature with its own
flag (`ENABLE_FACEBOOK_PUBLISHING`); see
[Facebook Page Publishing](./facebook-publishing.md).

## Known limitations

- Only the most recent bounded set of Page posts is read per run
  (up to 100 posts, 10 Graph pages).
- Free-form posts without labels rely on conservative heuristics; ambiguous
  posts stay `NOT_STATED` eligibility and require moderator review.
- Facebook auto-publication is disabled until an explicit, reviewed
  category/profession mapping exists. Do not enable it by inventing a category.
- Meta app review, Page owner permission, and production credentials are
  operator responsibilities and are not automated here.
