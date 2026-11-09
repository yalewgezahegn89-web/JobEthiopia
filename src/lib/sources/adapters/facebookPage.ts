import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import type { SourceAdapter, FetchResult, FetchMetadata } from "../adapter";
import type { RawJobInput } from "@/lib/ingestion/types";
import {
  getExternalPageAccessToken,
  getOwnedPageAccessToken,
  isFacebookIngestionEnabled,
} from "@/lib/facebook/config";
import { fetchPagePosts } from "@/lib/facebook/graphClient";
import { extractFacebookJobPost } from "@/lib/facebook/extractJobPost";

/** Hard cap on posts converted from a single Page fetch. */
export const MAX_FACEBOOK_POSTS = 100;

interface FacebookSourceRecord {
  id: string;
  name: string;
  sourceType: string;
  facebookPageId: string | null;
  facebookPageKind: "OWNED_PAGE" | "EXTERNAL_PAGE" | null;
  facebookApprovalState:
    | "NOT_REQUESTED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | null;
  facebookContentUseState:
    | "NOT_RECORDED"
    | "PENDING"
    | "AUTHORIZED"
    | "DENIED"
    | null;
}

export type FacebookSourceLoadResult =
  | { ok: true; source: FacebookSourceRecord }
  | { ok: false; error: string };

async function loadFacebookSource(
  sourceId: string,
): Promise<FacebookSourceLoadResult> {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: {
      id: true,
      name: true,
      sourceType: true,
      facebookPageId: true,
      facebookPageKind: true,
      facebookApprovalState: true,
      facebookContentUseState: true,
    },
  });

  if (!source) return { ok: false, error: "Source not found" };
  if (source.sourceType !== "FACEBOOK") {
    return { ok: false, error: "Source is not a Facebook Page source" };
  }
  if (!source.facebookPageId) {
    return { ok: false, error: "Source has no Facebook Page ID configured" };
  }

  return {
    ok: true,
    source: {
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      facebookPageId: source.facebookPageId,
      facebookPageKind: source.facebookPageKind ?? null,
      facebookApprovalState: source.facebookApprovalState ?? null,
      facebookContentUseState: source.facebookContentUseState ?? null,
    },
  };
}

function resolveAccessToken(
  source: FacebookSourceRecord,
): { ok: true; accessToken: string } | { ok: false; error: string } {
  const kind = source.facebookPageKind ?? "EXTERNAL_PAGE";

  if (kind === "OWNED_PAGE") {
    const token = getOwnedPageAccessToken();
    if (!token.ok) {
      return { ok: false, error: token.reason };
    }
    return { ok: true, accessToken: token.accessToken };
  }

  if (source.facebookApprovalState !== "APPROVED") {
    return {
      ok: false,
      error:
        "External Facebook Page requires Meta Page Public Content Access approval (approval state must be APPROVED)",
    };
  }
  if (source.facebookContentUseState !== "AUTHORIZED") {
    return {
      ok: false,
      error:
        "External Facebook Page content use is not authorized by the Page owner (content-use state must be AUTHORIZED)",
    };
  }

  const token = getExternalPageAccessToken();
  if (!token.ok) {
    return { ok: false, error: token.reason };
  }
  return { ok: true, accessToken: token.accessToken };
}

/**
 * Read-only adapter for Facebook Pages.
 *
 * Owned Pages are read with a Page access token. External Pages stay blocked
 * until both Meta approval and documented content-use authorization are
 * recorded. Only published posts are read and only the documented fields are
 * requested.
 */
export class FacebookPageAdapter implements SourceAdapter {
  constructor(
    private readonly maxPosts: number = MAX_FACEBOOK_POSTS,
  ) {}

  async fetchJobs(sourceId: string): Promise<FetchResult> {
    if (!isFacebookIngestionEnabled()) {
      return {
        success: false,
        error: "Facebook ingestion is disabled (ENABLE_FACEBOOK_INGESTION)",
      };
    }

    const loaded = await loadFacebookSource(sourceId);
    if (!loaded.ok) return { success: false, error: loaded.error };

    const token = resolveAccessToken(loaded.source);
    if (!token.ok) return { success: false, error: token.error };

    const postsResult = await fetchPagePosts(
      loaded.source.facebookPageId!,
      token.accessToken,
      { limit: this.maxPosts },
    );
    if (!postsResult.ok) {
      return { success: false, error: postsResult.error };
    }

    const jobs: RawJobInput[] = [];
    const observedExternalIds: string[] = [];
    const reviewItems: NonNullable<FetchMetadata["reviewItems"]> = [];

    const limit = Math.min(this.maxPosts, MAX_FACEBOOK_POSTS);
    for (const post of postsResult.data.posts.slice(0, limit)) {
      const externalId = `${loaded.source.facebookPageId}:${post.id}`;
      observedExternalIds.push(externalId);

      const extracted = extractFacebookJobPost(
        {
          id: post.id,
          message: post.message,
          createdTime: post.created_time,
          permalinkUrl: post.permalink_url,
        },
        {
          sourceId: loaded.source.id,
          pageId: loaded.source.facebookPageId!,
          pageName: loaded.source.name,
        },
      );

      if (extracted.kind === "NOT_A_JOB") continue;

      jobs.push(extracted.job);
      if (extracted.reviewReasons.length > 0) {
        reviewItems.push({ externalId, reasons: extracted.reviewReasons });
      }
    }

    return {
      success: true,
      jobs,
      metadata: { observedExternalIds, reviewItems },
    };
  }
}
