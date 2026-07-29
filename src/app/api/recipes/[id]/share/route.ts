// `GET    /api/recipes/[id]/share`     — read share status (no token created if missing)
// `POST   /api/recipes/[id]/share`     — issue a share token if none, or echo the existing one
// `DELETE /api/recipes/[id]/share`     — revoke any active token
//
// BRE-43: unguessable URL-safe tokens generated from CSPRNG bytes (see
// `@/lib/share/shareToken`). The token is stored verbatim on the recipe row;
// the public route at `/share/[token]` is the only place it is used to fetch
// the recipe.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { internalError, notFound } from "@/lib/api/errors";
import { presentShareStatus } from "@/lib/api/presentShare";
import { generateShareToken } from "@/lib/share/shareToken";

export const dynamic = "force-dynamic";

/** Resolve the absolute origin to build share URLs from.
 *
 *  `NEXT_PUBLIC_BASE_URL` is authoritative — behind a reverse proxy it is the
 *  only value this server actually controls. Without it we fall back to the
 *  origin the request was addressed to, which still describes this
 *  deployment.
 *
 *  The `Origin` header is deliberately not consulted. It is set by the caller
 *  and describes *their* page, not this server, so honouring it let any
 *  client dictate the absolute URL the API hands back — a share link pointing
 *  at an attacker-chosen host, emitted by us and rendered as ours. Set
 *  `NEXT_PUBLIC_BASE_URL` in any deployment that terminates TLS upstream. */
function resolveOrigin(request: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/g, "");
  return new URL(request.url).origin;
}

interface ShareTokenResult {
  token: string;
  created: boolean;
}

/**
 * Return the existing token or atomically claim the null slot with a new one.
 * The conditional update is what makes concurrent POSTs idempotent: only one
 * writer can change `null` to a token, and every loser re-reads that winner.
 */
async function getOrIssueShareToken(
  id: string,
  attempts = 5,
): Promise<ShareTokenResult | null> {
  const existing = await prisma.recipe.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  if (!existing) return null;
  if (existing.shareToken) {
    return { token: existing.shareToken, created: false };
  }

  for (let i = 0; i < attempts; i++) {
    const token = generateShareToken();
    try {
      const claimed = await prisma.recipe.updateMany({
        where: { id, shareToken: null },
        data: { shareToken: token },
      });
      if (claimed.count === 1) {
        return { token, created: true };
      }

      const winner = await prisma.recipe.findUnique({
        where: { id },
        select: { shareToken: true },
      });
      if (!winner) return null;
      if (winner.shareToken) {
        return { token: winner.shareToken, created: false };
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      // P2002 = an improbable token collision with another recipe. Retry with
      // fresh entropy; concurrent requests for this recipe use the winner path.
      if (code !== "P2002") throw err;
    }
  }
  throw new Error("failed to issue a unique share token after retries");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { shareToken: true },
    });
    if (!recipe) return notFound();
    return NextResponse.json({
      data: presentShareStatus(recipe.shareToken, resolveOrigin(request)),
    });
  } catch (err) {
    console.error("GET /api/recipes/[id]/share failed:", err);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const result = await getOrIssueShareToken(id);
    if (!result) return notFound();

    return NextResponse.json(
      { data: presentShareStatus(result.token, resolveOrigin(request)) },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    console.error("POST /api/recipes/[id]/share failed:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!recipe) return notFound();
    await prisma.recipe.update({
      where: { id },
      data: { shareToken: null },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/recipes/[id]/share failed:", err);
    return internalError();
  }
}
