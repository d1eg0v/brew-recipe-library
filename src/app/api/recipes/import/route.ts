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
  payloadTooLarge,
  validationError,
} from "@/lib/api/errors";
import { presentRecipe } from "@/lib/api/present";
import { recipeToCreateInput } from "@/lib/api/recipeMapper";
import { recipeCreateSchema } from "@/lib/api/schemas";
import { parseBeerXml, BeerXmlParseError } from "@/lib/beerxml";

import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const MAX_BEER_XML_BYTES = 1_048_576;

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

type LimitedBodyResult =
  | { ok: true; value: Uint8Array }
  | { ok: false; response: NextResponse };

function tooLargeResponse(): NextResponse {
  return payloadTooLarge(
    `BeerXML payload must not exceed ${MAX_BEER_XML_BYTES} bytes`,
  );
}

async function readLimitedBody(request: Request): Promise<LimitedBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength != null) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BEER_XML_BYTES) {
      return { ok: false, response: tooLargeResponse() };
    }
  }

  if (!request.body) {
    return { ok: true, value: new Uint8Array() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BEER_XML_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: tooLargeResponse() };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      response: badRequest("Could not read BeerXML request body"),
    };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: body };
}

async function readXmlBody(request: NextRequest): Promise<XmlReadResult> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const body = await readLimitedBody(request);
  if (!body.ok) return body;

  if (
    contentType.includes("application/xml") ||
    contentType.includes("text/xml") ||
    contentType.includes("application/beerxml")
  ) {
    const text = new TextDecoder().decode(body.value);
    if (!text.trim()) {
      return { ok: false, response: badRequest("BeerXML body is empty") };
    }
    return { ok: true, value: text };
  }

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      const replay = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: body.value.buffer.slice(
          body.value.byteOffset,
          body.value.byteOffset + body.value.byteLength,
        ) as ArrayBuffer,
      });
      form = await replay.formData();
    } catch {
      return {
        ok: false,
        response: badRequest("Malformed multipart/form-data body"),
      };
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return {
        ok: false,
        response: badRequest(
          'multipart/form-data import must include a "file" field',
        ),
      };
    }
    if (file.size > MAX_BEER_XML_BYTES) {
      return { ok: false, response: tooLargeResponse() };
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
