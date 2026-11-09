import "server-only";

import { headers } from "next/headers";
import { resolveSiteOrigin } from "@/lib/utils/site-origin";

export async function getSiteOriginForServerAction(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-host");
  const host = forwarded ?? h.get("host");
  return resolveSiteOrigin(host);
}
