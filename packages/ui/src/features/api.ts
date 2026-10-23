import { wuffError } from "./lib/copy";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  userId?: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(userId ? { "X-Wuff-User": userId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    if (data.error?.code === "account_changed" && typeof window !== "undefined")
      window.location.replace("/lists");
    throw new ApiError(
      wuffError(data.error?.message ?? "Couldn’t save your change."),
      response.status,
      data.error?.code,
    );
  }
  return data;
}
