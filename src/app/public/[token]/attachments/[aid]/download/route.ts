import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/db/client";
import { getPublicLinkByToken } from "@/lib/db/queries/publicLinks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; aid: string }> },
) {
  const { token, aid } = await params;

  if (!UUID_RE.test(token) || !UUID_RE.test(aid)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 1. Validate token (revogado/expirado/operação arquivada → null)
  const link = await getPublicLinkByToken(token);
  if (!link) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 2. Fetch attachment via admin (bypass RLS)
  const admin = createAdmin();
  const { data: attachment, error: attErr } = await admin
    .from("attachments")
    .select("id, operation_id, meeting_id, storage_path, filename, visibility")
    .eq("id", aid)
    .maybeSingle();
  if (attErr || !attachment) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 3. Validate operation match
  if (attachment.operation_id !== link.operationId) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 4. Visibility própria do anexo — interno nunca sai no público.
  // 404 (não 403): status distinto seria oráculo de existência sem auth.
  if (attachment.visibility !== "cliente") {
    return new NextResponse("Not found", { status: 404 });
  }

  // 5. If attached to a meeting, validate meeting visibility (regra composta: E)
  if (attachment.meeting_id !== null) {
    const { data: meeting, error: mErr } = await admin
      .from("meetings")
      .select("visibility")
      .eq("id", attachment.meeting_id)
      .maybeSingle();
    if (mErr || !meeting || meeting.visibility !== "cliente") {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // 6. Generate signed URL
  const { data: signed, error: sErr } = await admin.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: attachment.filename,
    });
  if (sErr || !signed?.signedUrl) {
    return new NextResponse("Storage error", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
