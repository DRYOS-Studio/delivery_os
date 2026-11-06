"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createTaskFromMeetingNextStepAction } from "@/lib/actions/meeting-next-steps";

type Step = {
  id: string;
  description: string;
  due_date: string | null;
  task_id: string | null;
  task: { id: string; frente_id: string | null } | null;
};

type Props = {
  operationId: string;
  steps: Step[];
  frentes: { id: string; name: string }[];
};

function StepRow({
  operationId,
  s,
  frentes,
  onError,
}: {
  operationId: string;
  s: Step;
  frentes: { id: string; name: string }[];
  onError: (m: string | null) => void;
}) {
  const router = useRouter();
  const [frenteId, setFrenteId] = useState("");
  const [busy, setBusy] = useState(false);

  if (s.task_id && s.task?.frente_id) {
    const href = `/operations/${operationId}/frentes/${s.task.frente_id}/tasks/${s.task.id}/edit`;
    return (
      <li key={s.id} className="text-sm flex flex-wrap items-center gap-2">
        <span className="text-ink-soft">{s.description}</span>
        <Link href={href} className="text-sage underline text-sm">
          Abrir tarefa
        </Link>
      </li>
    );
  }

  if (s.task_id) {
    return (
      <li key={s.id} className="text-sm text-mute">
        Passo vinculado a tarefa (sem Frente — área). id: {s.task_id}
      </li>
    );
  }

  async function promote() {
    onError(null);
    if (!frenteId) {
      onError("Escolha uma Frente.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("next_step_id", s.id);
    fd.set("frente_id", frenteId);
    const result = await createTaskFromMeetingNextStepAction(fd);
    setBusy(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    onError(result.error);
  }

  return (
    <li className="flex flex-col gap-2 md:flex-row md:items-start text-sm">
      <span className="text-ink-soft flex-1">{s.description}</span>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="bg-card border border-line rounded px-2 py-1 text-xs text-ink-soft min-w-[10rem]"
          value={frenteId}
          onChange={(e) => setFrenteId(e.target.value)}
          disabled={busy || frentes.length === 0}
        >
          <option value="">Escolher Frente…</option>
          {frentes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || frentes.length === 0}
          onClick={() => void promote()}
        >
          {busy ? "Criando…" : "Criar tarefa"}
        </Button>
      </div>
    </li>
  );
}

export function MeetingNextStepPromote({
  operationId,
  steps,
  frentes,
}: Props): React.ReactNode {
  const [error, setError] = useState<string | null>(null);

  const hasOpen = steps.some((s) => !s.task_id);
  if (steps.length === 0) {
    return (
      <p className="text-sm text-mute mt-4">Nenhum próximo passo cadastrado.</p>
    );
  }
  if (!hasOpen) return null;

  return (
    <div className="mt-6 space-y-3 border border-line rounded-lg p-4 bg-card/40">
      <h3 className="font-mono text-[10px] text-mute uppercase tracking-wide">
        Virar tarefa
      </h3>
      <p className="text-sm text-mute">
        Cria uma tarefa na Frente escolhida e vincula a este próximo passo.
      </p>
      {error && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {steps.map((s) => (
          <StepRow
            key={s.id}
            operationId={operationId}
            s={s}
            frentes={frentes}
            onError={setError}
          />
        ))}
      </ul>
      {frentes.length === 0 && (
        <p className="text-xs text-warning">
          Não há Frentes ativas nesta Operação para criar tarefa.
        </p>
      )}
    </div>
  );
}
