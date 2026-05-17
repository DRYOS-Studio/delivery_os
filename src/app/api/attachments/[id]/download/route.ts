import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getAttachment } from "@/lib/db/queries/attachments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const attachment = await getAttachment(id);
  if (!attachment) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createServer();
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: attachment.filename,
    });
  if (error || !data?.signedUrl) {
    return new NextResponse("Storage error", { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
