import { authorizationMetadata } from "@/lib/oauth";
export const GET = () => Response.json(authorizationMetadata());
