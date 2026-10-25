import { getAiConnections, disconnectAiClient } from "@wuff/domain";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
export async function GET() {
  try {
    const actor = await webActor();
    return privateJson(await getAiConnections(actor));
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor();
    return privateJson(
      await disconnectAiClient(actor, await jsonInput(request)),
    );
  } catch (error) {
    return failure(error);
  }
}
