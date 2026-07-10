// `DELETE /api/recipes/[id]/tags/[name]` — remove a tag from a recipe.
// The Tag row itself is kept (other recipes may still use it).

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  internalError,
  notFound,
} from "@/lib/api/errors";
import { normalizeTagName } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await context.params;
  const normalised = normalizeTagName(decodeURIComponent(name));
  if (!normalised) {
    return notFound("Tag not found");
  }

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!recipe) return notFound("Recipe not found");

    const tag = await prisma.tag.findUnique({ where: { name: normalised } });
    if (!tag) {
      // Idempotent: nothing to remove.
      return new NextResponse(null, { status: 204 });
    }

    await prisma.recipeTag.deleteMany({
      where: { recipeId: id, tagId: tag.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/recipes/[id]/tags/[name] failed:", err);
    return internalError();
  }
}
