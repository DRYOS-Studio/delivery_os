export function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "arquivo";
  // Substitui qualquer char fora de [A-Za-z0-9._-] por "_"
  const cleaned = trimmed.replace(/[^A-Za-z0-9._-]+/g, "_");
  // Evita filename começando por "." (oculto em Unix)
  return cleaned.replace(/^\.+/, "");
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

export type MimeCategory = {
  label: string;
  // Lucide icon name (resolvido pelo consumer)
  icon: "FileText" | "Image" | "FileBox" | "File";
};

export function mimeCategory(mime: string): MimeCategory {
  const lower = (mime || "").toLowerCase();
  if (lower.includes("pdf")) return { label: "PDF", icon: "FileText" };
  if (lower.startsWith("image/")) return { label: "Imagem", icon: "Image" };
  if (
    lower.includes("word") ||
    lower.includes("document") ||
    lower.includes("officedocument") ||
    lower.includes("sheet") ||
    lower.includes("excel") ||
    lower.includes("presentation")
  )
    return { label: "Doc", icon: "FileBox" };
  return { label: "Arquivo", icon: "File" };
}
