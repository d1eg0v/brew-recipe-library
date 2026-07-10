// BRE-43 — response shape for the share-link endpoints.

import { buildShareUrl } from "@/lib/share/shareToken";

/** Public shape for `GET /api/recipes/[id]/share` (and `POST`).
 *  - `shareable: true` when the recipe currently has a share token; the
 *    `shareUrl` is the absolute URL the owner can hand out.
 *  - `shareable: false` when there is no token; `shareUrl` is null.
 *  - `shareToken` is the raw token (kept on the response so the owner-side
 *    UI can keep working with the bare token if it needs to) — it is not
 *    exposed by the public recipe-detail endpoint, only here.
 */
export interface ShareResponseData {
  shareable: boolean;
  shareUrl: string | null;
  shareToken: string | null;
}

/** Build the standard share response.
 *
 *  `origin` is the absolute origin the request came in on (scheme + host,
 *  without trailing slash). Pass `null`/`undefined` to omit the absolute URL
 *  — useful for tests. */
export function presentShareStatus(
  shareToken: string | null,
  origin: string | null | undefined = null,
): ShareResponseData {
  if (!shareToken) {
    return { shareable: false, shareUrl: null, shareToken: null };
  }
  return {
    shareable: true,
    shareUrl: buildShareUrl(shareToken, origin),
    shareToken,
  };
}
