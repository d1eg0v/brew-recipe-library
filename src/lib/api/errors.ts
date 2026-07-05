// HTTP error helpers for the recipe API.
//
// All routes return JSON. Non-2xx responses have the shape
// `{ error: { message, issues? } }` for the client to surface.

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

function flattenZodIssues(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
    code: i.code,
  }));
}

export function jsonError(
  message: string,
  status: number,
  issues?: unknown,
): NextResponse {
  return NextResponse.json(
    issues
      ? { error: { message, issues } }
      : { error: { message } },
    { status },
  );
}

export function validationError(error: ZodError): NextResponse {
  return jsonError("Invalid request body", 400, flattenZodIssues(error));
}

export function badRequest(message: string): NextResponse {
  return jsonError(message, 400);
}

export function notFound(message = "Recipe not found"): NextResponse {
  return jsonError(message, 404);
}

export function conflict(message: string): NextResponse {
  return jsonError(message, 409);
}

export function internalError(message = "Internal server error"): NextResponse {
  return jsonError(message, 500);
}

/** Safely parse a JSON request body, returning a 400 response on failure. */
export async function readJson(request: Request): Promise<
  { ok: true; value: unknown } | { ok: false; response: NextResponse }
> {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: badRequest("Content-Type must be application/json"),
    };
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest("Malformed JSON body") };
  }
  if (raw == null || typeof raw !== "object") {
    return {
      ok: false,
      response: badRequest("Request body must be a JSON object"),
    };
  }
  return { ok: true, value: raw };
}
