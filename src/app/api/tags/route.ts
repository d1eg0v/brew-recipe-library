// `GET /api/tags` — list all tags with usage counts (BRE-29)
// `POST /api/tags` — pre-create a tag (admin / curation; same shape as add)

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  conflict,
  internalError,
  readJson,
  validationError,
} from "@/lib/api/errors";
import { presentTagWithCount } from "@/lib/api/presentTags";
import { tagCreateSchema, tagListQuerySchema } from "@/lib/api/schemas";
import { normalizeTagName } from "@/lib/tags";

import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = tagListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    minCount: url.searchParams.get("minCount") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const q = parsed.data;
  const where: Prisma.TagWhereInput = {};
  if (q.q && q.q.trim().length > 0) {
    where.name = { contains: q.q.trim().toLowerCase() };
  }

  try {
    // Pull tags with their usage counts in one round-trip. We use `_count` to
    // keep this cheap; ordering by recipe count then name keeps the result
    // stable across paginations.
    const tags = await prisma.tag.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: q.limit,
      include: { _count: { select: { recipeTags: true } } },
    });

    const filtered = tags.filter((t) => {
      if (q.minCount == null) return true;
      return t._count.recipeTags >= q.minCount;
    });

    return NextResponse.json({
      data: filtered.map((t) =>
        presentTagWithCount(t, t._count.recipeTags),
      ),
      total: filtered.length,
      limit: q.limit,
    });
  } catch (err) {
    console.error("GET /api/tags failed:", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = tagCreateSchema.safeParse(body.value);
  if (!parsed.success) return validationError(parsed.error);
  const norm = normalizeTagName(parsed.data.name);
  if (!norm) return badRequest("name is required");

  try {
    const tag = await prisma.tag.create({ data: { name: norm } });
    return NextResponse.json(
      { data: { ...tag, recipeCount: 0 } },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return conflict("A tag with that name already exists");
    }
    console.error("POST /api/tags failed:", err);
    return internalError();
  }
}
