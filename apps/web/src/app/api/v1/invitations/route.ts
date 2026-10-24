import { failure } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { listInvitations } from "@wuff/domain";
export async function GET() {
  try {
    return await listResponse(listInvitations);
  } catch (error) {
    return failure(error);
  }
}
