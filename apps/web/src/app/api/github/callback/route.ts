import { webActor } from "@/lib/auth/server";
import { appOrigin } from "@/lib/config";
import { githubCallback } from "@wuff/domain";
import { AppError } from "@wuff/contracts";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    await githubCallback(
      await webActor(),
      z.string().min(1).max(300).parse(p.get("code")),
      z.string().min(20).max(100).parse(p.get("state")),
      appOrigin(),
    );
    return Response.redirect(`${appOrigin()}/github?connected=1`);
  } catch (error) {
    console.error("GitHub callback failed", {
      code:
        error instanceof AppError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
    });
    return Response.redirect(`${appOrigin()}/github?error=authorization`);
  }
}
