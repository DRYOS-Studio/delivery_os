"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadAttachmentAction } from "@/lib/actions/attachments";
import { formatBytes } from "@/lib/utils/file";
import { MAX_ATTACHMENT_BYTES } from "@/lib/validators/attachment";

type Props = {
  operationId: string;
  meetingId?: string | undefined;
};

export function AttachmentUploadForm({
  operationId,
  meetingId,
}: Props): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setError(
        `Arquivo maior que 10MB (atual: ${formatBytes(file.size)}). Reduza ou escolha outro.`,
      );
      setSelectedFile(null);
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Selecione um arquivo.");
      return;
    }
    setError(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    fd.set("file", selectedFile);
    if (meetingId) fd.set("meeting_id", meetingId);

    const result = await uploadAttachmentAction(operationId, fd);
    setBusy(false);

    if (result.ok) {
      formRef.current?.reset();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-card border border-line rounded p-4 space-y-3"
    >
      <div className="space-y-1">
        <label
          htmlFor={`file-${meetingId ?? "op"}-${operationId}`}
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Arquivo
        </label>
        <input
          ref={fileInputRef}
          id={`file-${meetingId ?? "op"}-${operationId}`}
          type="file"
          onChange={handleFileChange}
          disabled={busy}
          className="block w-full text-sm text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-sage-bg file:text-sage-deep hover:file:bg-sage hover:file:text-bg file:transition-colors file:cursor-pointer disabled:opacity-50"
        />
        {selectedFile && (
          <p className="font-mono text-[10px] text-mute-soft">
            {selectedFile.name} · {formatBytes(selectedFile.size)}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`desc-${meetingId ?? "op"}-${operationId}`}
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Descrição (opcional)
        </label>
        <input
          id={`desc-${meetingId ?? "op"}-${operationId}`}
          name="description"
          type="text"
          disabled={busy}
          placeholder="Ata da reunião, brief inicial, contrato..."
          className="w-full bg-bg border border-line rounded px-3 py-1.5 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`vis-${meetingId ?? "op"}-${operationId}`}
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Visibilidade
        </label>
        <select
          id={`vis-${meetingId ?? "op"}-${operationId}`}
          name="visibility"
          defaultValue="cliente"
          disabled={busy}
          className="w-full bg-bg border border-line rounded px-3 py-1.5 text-sm text-ink-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
        >
          <option value="cliente">Cliente — aparece no link público</option>
          <option value="interno">Interno — só o time vê</option>
        </select>
      </div>

      {error && (
        <div className="bg-critical-bg border border-critical text-critical text-xs rounded px-3 py-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={busy || !selectedFile}
        className="inline-flex items-center gap-2"
      >
        <Upload className="w-4 h-4" strokeWidth={1.75} />
        {busy ? "Enviando..." : "Enviar arquivo"}
      </Button>
    </form>
  );
}
