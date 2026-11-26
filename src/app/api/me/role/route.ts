import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/server";

/** Papel do usuário logado — só para UI de diagnóstico (error boundary). */
export async function GET(): Promise<NextResponse> {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ role: null }, { status: 401 });
  }
  return NextResponse.json({ role: profile.role });
}