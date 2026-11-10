import type { NtfyIngestMessage } from "@/lib/integrations/ntfy/types";

export function ntfyTimeToIso(time: number | string): string {
  if (typeof time === "number") {
    const ms = time > 1e12 ? time : time * 1000;
    return new Date(ms).toISOString();
  }
  const trimmed = time.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(trimmed);
  if (Number.isFinite(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
}

export function isRecoveryMessage(
  tags: string[] | undefined,
  recoveryTags: string[],
): boolean {
  const normalized = new Set(normalizeTags(tags));
  const targets = recoveryTags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  return targets.some((t) => normalized.has(t));
}

export function buildIncidentTitle(msg: NtfyIngestMessage): string {
  const title = msg.title?.trim();
  if (title && title.length >= 3) return title.slice(0, 200);
  const body = msg.message?.trim();
  if (body && body.length >= 3) {
    const firstLine = body.split("\n")[0] ?? body;
    return firstLine.slice(0, 200);
  }
  return `Alerta ntfy: ${msg.topic}`.slice(0, 200);
}

export function appendOccurrenceNote(
  existing: string | null | undefined,
  receivedAtIso: string,
  message: string | undefined,
): string {
  const line = `[${receivedAtIso}] ${(message ?? "").trim() || "(sem texto)"}`;
  const base = existing?.trim() ?? "";
  const combined = base ? `${base}\n\n---\n${line}` : line;
  return combined.slice(0, 5000);
}

export function dedupeKeyForTopic(topic: string): string {
  return topic.trim().toLowerCase();
}
