"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { updateOperationVillainAction } from "@/lib/actions/operation-villains";
import {
  editOperationVillainSchema,
  type EditOperationVillainInput,
  type EditOperationVillainOutput,
} from "@/lib/validators/operation-villain";

type Props = {
  itemId: string;
  initialProgressPct: number;
  initialEvidence: string | null;
  onClose: () => void;
};

export function EditOperationVillainForm({
  itemId,
  initialProgressPct,
  initialEvidence,
  onClose,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<
    EditOperationVillainInput,
    undefined,
    EditOperationVillainOutput
  >({
    resolver: zodResolver(editOperationVillainSchema),
    defaultValues: {
      progress_pct: initialProgressPct,
      evidence: initialEvidence ?? "",
    },
  });

  async function onSubmit(data: EditOperationVillainOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("progress_pct", String(data.progress_pct));
    fd.set("evidence", data.evidence ?? "");
    const result = await updateOperationVillainAction(itemId, fd);
    if (result.ok) {
      router.refresh();
      onClose();
      return;
    }
    if (result.code === "validation_progress_pct") {
      setError("progress_pct", { message: result.error });
    } else if (result.code === "validation_evidence") {
      setError("evidence", { message: result.error });
    } else {
      setGeneralError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-bg border border-line rounded p-3 space-y-3 mt-3"
    >
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-xs rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <p className="font-mono text-[10px] text-mute italic">
        Severidade inicial é write-once (Inv. 07) e não pode ser alterada.
      </p>

      <div className="space-y-1">
        <label
          htmlFor={`progress-${itemId}`}
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Progresso (%)
        </label>
        <input
          id={`progress-${itemId}`}
          type="number"
          min={0}
          max={100}
          step={1}
          {...register("progress_pct")}
          disabled={isSubmitting}
          className={inputCn}
        />
        {errors.progress_pct?.message && (
          <p className="text-critical text-xs">{errors.progress_pct.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`evidence-${itemId}`}
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Evidência
        </label>
        <textarea
          id={`evidence-${itemId}`}
          {...register("evidence")}
          disabled={isSubmitting}
          rows={3}
          className={textareaCn}
        />
        {errors.evidence?.message && (
          <p className="text-critical text-xs">{errors.evidence.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

const inputCn =
  "w-full bg-card border border-line rounded px-3 py-1.5 text-sm text-ink-soft focus:outline-none focus:border-line-strong disabled:opacity-50";

const textareaCn = `${inputCn} font-body leading-relaxed resize-y`;
