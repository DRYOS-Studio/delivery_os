import { NextResponse } from "next/server";

export type JsonRpcId = string | number | null;

export function jsonRpcError(id: JsonRpcId, code: number, message: string, status: number) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status },
  );
}

export function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

export function toolText(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 0) }],
  };
}
