// `GET /api/recipes/[id]/export` — return the recipe as a BeerXML document.
//
// Defaults to `Content-Type: application/xml`. If the caller passes
// `?format=json` they get a small `{ xml }` envelope — handy for the browser
// to download via a `<a>` element.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { internalError, notFound } from "@/lib/api/errors";
import { serializeBeerXml } from "@/lib/beerxml";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
} as const;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) return notFound();

    const xml = serializeBeerXml(recipe);

    const url = new URL(_request.url);
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json({ data: { xml } });
    }

    // Suggest a sensible filename: sanitised title + .xml.
    const safeTitle = (recipe.title ?? "recipe")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
    const filename = `${safeTitle || "recipe"}.beerxml`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/recipes/[id]/export failed:", err);
    return internalError();
  }
}