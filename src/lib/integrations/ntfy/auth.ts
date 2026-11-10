import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function extractNtfyIngestToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length > 0) return t;
  }
  const header = req.headers.get("x-ntfy-ingest-token");
  if (header && header.trim().length > 0) return header.trim();
  return null;
}

export function verifyNtfyIngestToken(token: string | null): boolean {
  const secret = process.env.NTFY_INGEST_SECRET;
  if (!secret || !token) return false;
  return safeEqual(token, secret);
}
