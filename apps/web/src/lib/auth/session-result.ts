import { AppError } from "@wuff/contracts";

export function sessionIdentity<T>({
  data,
  error,
}: {
  data?: { user?: T } | null;
  error?: { status?: number } | null;
}): T | null {
  if (error) {
    if (error.status === 401) return null;
    throw new AppError(
      "auth_unavailable",
      "We couldn’t check your session. Please try again shortly.",
      error.status === 429 ? 429 : 503,
    );
  }
  return data?.user ?? null;
}
