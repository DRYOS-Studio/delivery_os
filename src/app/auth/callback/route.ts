import { NextResponse } from "next/server";
import { createServer } from "@/lib/db/client";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  const supabase = await createServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url),
    );
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
