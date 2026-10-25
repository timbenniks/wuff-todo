import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { webActor } from "@/lib/auth/server";
import { getEmpireSettings, updateEmpireSettings } from "@wuff/domain";
export async function GET() {
  try {
    return privateJson(await getEmpireSettings(await webActor()));
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await updateEmpireSettings(await webActor(), await jsonInput(request)),
    );
  } catch (error) {
    return failure(error);
  }
}
