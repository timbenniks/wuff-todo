import { wuffError } from "./copy";
import { ZodError } from "zod";
import { AppError } from "@wuff/contracts";
import { appOrigin } from "./config";

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new AppError(
      "invalid_origin",
      "This request must come from Wuff Todo.",
      403,
    );
}
export async function jsonInput(request: Request, limit = 32_768) {
  const text = await request.text();
  if (text.length > limit)
    throw new AppError("too_large", "Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("invalid_json", "Invalid request body.", 400);
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: {
          code: "invalid_input",
          message: wuffError(error.issues.map((i) => i.message).join("; ")),
        },
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json(
      { error: { code: error.code, message: wuffError(error.message) } },
      { status: error.status },
    );
  const requestId = crypto.randomUUID();
  console.error("Request failed", {
    requestId,
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Ruff patch! Something went wrong. Try again.",
        requestId,
      },
    },
    { status: 500 },
  );
}
export function privateJson(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
