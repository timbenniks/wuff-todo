import { AppError } from "@wuff/contracts";
import { boundedBody } from "./bounded-body";
// Private Notes images use the same 3 MiB upload contract on both transports.
// All other native operations retain their existing 128 KiB envelope limit.
export async function nativeInput(request: Request) {
  const bytes = await boundedBody(
    request,
    4 * Math.ceil((3 * 1024 * 1024) / 3) + 16_384,
  );
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError("invalid_json", "Invalid request body.", 400);
  }
  if (
    bytes.byteLength > 131_072 &&
    (!value ||
      typeof value !== "object" ||
      !("action" in value) ||
      value.action !== "uploadNoteImage")
  )
    throw new AppError("too_large", "Request is too large.", 413);
  return value;
}
