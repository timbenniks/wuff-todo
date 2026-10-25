import { getMcpToolPreferences, updateMcpToolPreferences } from "@wuff/domain";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
export async function GET(request: Request) {
  try {
    return privateJson(
      await getMcpToolPreferences(await webActor(), {
        clientId: new URL(request.url).searchParams.get("clientId"),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await updateMcpToolPreferences(
        await webActor(),
        await jsonInput(request),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
