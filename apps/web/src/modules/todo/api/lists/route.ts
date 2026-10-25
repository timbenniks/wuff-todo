import { failure, jsonInput, sameOrigin } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { createList, listLists } from "@wuff/domain";
export async function GET() {
  try {
    return await listResponse(listLists);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await jsonInput(request);
    return await listResponse((actor) => createList(actor, input));
  } catch (error) {
    return failure(error);
  }
}
