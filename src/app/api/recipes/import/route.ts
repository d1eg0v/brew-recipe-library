// `POST /api/recipes/import` — accept a BeerXML document and create a recipe.
//
// Accepts:
//  - `Content-Type: application/xml` (or text/xml) → the request body is the
//    raw BeerXML document.
//  - `Content-Type: multipart/form-data` with a `file` field → the uploaded
//    file is read as text and parsed.
//
// On success returns `201` with the new recipe in the same envelope as
// `POST /api/recipes`.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  validationError,
} from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";
import { recipeToCreateInput } from "@/lib/api/recipeMapper";
import { recipeCreateSchema } from "@/lib/api/schemas";
import { parseBeerXml, BeerXmlParseError } from "@/lib/beerxml";

import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const RECIPE_INCLUDE = {
  fermentables: { orderBy: { position: "asc" as const } },
  hops: { orderBy: { position: "asc" as const } },
  yeasts: { orderBy: { position: "asc" as const } },
  mashSteps: { orderBy: { position: "asc" as const } },
  processSteps: { orderBy: { position: "asc" as const } },
  additions: { orderBy: { position: "asc" as const } },
} as const;

export async function POST(request: NextRequest) {
  const xml = await readXmlBody(request);
  if (!xml.ok) return xml.response;

  let parsed;
  try {
    parsed = parseBeerXml(xml.value);
  } catch (err) {
    if (err instanceof BeerXmlParseError) {
      return badRequest(`BeerXML parse failed: ${err.message}`);
    }
    console.error("BeerXML parse threw:", err);
    return internalError();
  }

  const validated = recipeCreateSchema.safeParse(parsed);
  if (!validated.success) return validationError(validated.error);

  try {
    const created = await prisma.recipe.create({
      data: recipeToCreateInput(validated.data) as unknown as Prisma.RecipeUncheckedCreateInput,
      include: RECIPE_INCLUDE,
    });
    return NextResponse.json(
      { data: presentRecipe(created, { units: "metric" }) },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return badRequest("A unique field already exists with that value");
    }
    console.error("POST /api/recipes/import failed:", err);
    return internalError();
  }
}

type XmlReadResult =
  | { ok: true; value: string }
  | { ok: false; response: NextResponse };

async function readXmlBody(request: NextRequest): Promise<XmlReadResult> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (
    contentType.includes("application/xml") ||
    contentType.includes("text/xml") ||
    contentType.includes("application/beerxml")
  ) {
    const text = await request.text();
    if (!text.trim()) {
      return { ok: false, response: badRequest("BeerXML body is empty") };
    }
    return { ok: true, value: text };
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return {
        ok: false,
        response: badRequest(
          'multipart/form-data import must include a "file" field',
        ),
      };
    }
    const text = await file.text();
    if (!text.trim()) {
      return { ok: false, response: badRequest("Uploaded file is empty") };
    }
    return { ok: true, value: text };
  }

  return {
    ok: false,
    response: badRequest(
      "Content-Type must be application/xml, text/xml, or multipart/form-data",
    ),
  };
}