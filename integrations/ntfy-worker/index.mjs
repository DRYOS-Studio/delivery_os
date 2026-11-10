#!/usr/bin/env node
/**
 * Assina tópicos ntfy via GET /<topic>/json (stream) e repassa ao DeliveryOS.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const NTFY_BASE_URL = (process.env.NTFY_BASE_URL ?? "https://ntfy.sh").replace(
  /\/$/,
  "",
);
const TOPICS = (process.env.NTFY_TOPICS ?? "")
  .split(/[,;\s]+/)
  .map((t) => t.trim())
  .filter(Boolean);
const NTFY_TOKEN = process.env.NTFY_TOKEN?.trim() || "";
const INGEST_URL = (process.env.DELIVERY_NTFY_INGEST_URL ?? "").trim();
const INGEST_SECRET = process.env.NTFY_INGEST_SECRET?.trim() || "";
const STATE_FILE =
  process.env.NTFY_WORKER_STATE_FILE ?? "./ntfy-worker-state.json";
const RECONNECT_MS = Number(process.env.NTFY_RECONNECT_MS ?? "5000");

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function loadSince() {
  if (!existsSync(STATE_FILE)) return "all";
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return typeof raw.since === "string" ? raw.since : "all";
  } catch {
    return "all";
  }
}

function saveSince(messageId) {
  if (!messageId) return;
  writeFileSync(STATE_FILE, JSON.stringify({ since: messageId }, null, 2));
}

async function forwardMessage(msg) {
  if (!INGEST_URL || !INGEST_SECRET) {
    throw new Error(
      "DELIVERY_NTFY_INGEST_URL e NTFY_INGEST_SECRET obrigatórios",
    );
  }
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${INGEST_SECRET}`,
    },
    body: JSON.stringify(msg),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ingest ${res.status}: ${text}`);
  }
  return res.json();
}

async function consumeJsonStream(topic) {
  const since = loadSince();
  const url = `${NTFY_BASE_URL}/${encodeURIComponent(topic)}/json?poll=1&since=${encodeURIComponent(since)}`;
  const headers = {};
  if (NTFY_TOKEN) headers.Authorization = `Bearer ${NTFY_TOKEN}`;

  while (true) {
    try {
      log(`connecting ${topic} since=${since}`);
      const res = await fetch(url, { headers });
      if (!res.ok || !res.body) {
        throw new Error(`ntfy stream HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let msg;
          try {
            msg = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (msg.event && msg.event !== "message") continue;
          if (!msg.id) continue;
          const result = await forwardMessage(msg);
          log(`forwarded ${msg.id} → ${JSON.stringify(result)}`);
          saveSince(msg.id);
        }
      }
    } catch (e) {
      log(`stream error: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, RECONNECT_MS));
  }
}

function main() {
  if (TOPICS.length === 0) {
    console.error("Defina NTFY_TOPICS (lista separada por vírgula)");
    process.exit(1);
  }
  for (const topic of TOPICS) {
    void consumeJsonStream(topic);
  }
}

main();
