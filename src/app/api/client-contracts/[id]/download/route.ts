import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL = 300;
const BUCKET = "contracts";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("client_contracts")
    .select("storage_path, filename")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, TTL, { download: row.filename });

  if (signErr || !signed?.signedUrl) {
    return new NextResponse("Storage error", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
