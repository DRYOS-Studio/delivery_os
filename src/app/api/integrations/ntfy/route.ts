import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/db/client";
import {
  extractNtfyIngestToken,
  verifyNtfyIngestToken,
} from "@/lib/integrations/ntfy/auth";
import { ingestNtfyMessage } from "@/lib/integrations/ntfy/ingest";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const token = extractNtfyIngestToken(req);
  if (!verifyNtfyIngestToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createAdmin();
  try {
    const result = await ingestNtfyMessage(admin, body);
    return NextResponse.json(result, {
      status: result.outcome === "duplicate" ? 200 : 201,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
