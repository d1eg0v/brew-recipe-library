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

/** Resolve the absolute origin the request came in on. Falls back to
 *  `NEXT_PUBLIC_BASE_URL` or `http://localhost:3000` so dev still produces a
 *  usable URL. We deliberately do not trust the `Host` header in production
 *  — let the reverse proxy / env decide. */
function resolveOrigin(request: NextRequest): string {
  const headerOrigin = request.headers.get("origin");
  if (headerOrigin) return headerOrigin.replace(/\/+$/g, "");
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/g, "");
  return "http://localhost:3000";
}

/** A short helper that produces a fresh unique share token. A `unique`
 *  constraint on `Recipe.shareToken` makes collisions impossible in practice
 *  (128-bit token space), but DB engines raise on conflict anyway. We retry
 *  a few times so a transiently-locked / racing concurrent writer cannot
 *  fail the request. */
async function issueUniqueShareToken(id: string, attempts = 5): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const token = generateShareToken();
    try {
      await prisma.recipe.update({
        where: { id },
        data: { shareToken: token },
        select: { shareToken: true },
      });
      return token;
    } catch (err) {
      const code = (err as { code?: string }).code;
      // P2002 = unique constraint violation; race with a concurrent POST that
      // generated the same token. Retry with a fresh value.
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
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { shareToken: true },
    });
    if (!recipe) return notFound();

    // Idempotent: if a token already exists, echo it back rather than minting
    // a new one. The UI can repeatedly click "Share" without rotating URLs.
    const token =
      recipe.shareToken ?? (await issueUniqueShareToken(id));

    return NextResponse.json(
      { data: presentShareStatus(token, resolveOrigin(request)) },
      { status: recipe.shareToken ? 200 : 201 },
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
