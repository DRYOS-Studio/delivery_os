"use client";

import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DeleteDiagnosticButton } from "@/components/domain/DeleteDiagnosticButton";
import { saveManagementDiagnosticAction } from "@/lib/actions/diagnostics";
import {
  DIMS,
  PROFILE_FIELDS,
  type Dimension,
  type Question,
} from "@/lib/constants/management-diagnostic";
import type { DiagnosticDetail } from "@/lib/db/queries/diagnostics";
import {
  computeDiagnosticScores,
  isQuestionAnswered,
  type AnswersMap,
  type NaAnswersMap,
} from "@/lib/utils/management-diagnostic";
import type { ProfileData } from "@/lib/validators/management-diagnostic";

type Props = {
  clientId: string;
  clientName: string;
  initialDiagnostic?: DiagnosticDetail | null;
};

export function ManagementDiagnosticWizard({
  clientId,
  clientName,
  initialDiagnostic,
}: Props): React.JSX.Element {
  const router = useRouter();

  const [diagnosticId, setDiagnosticId] = useState<string | null>(
    initialDiagnostic?.id ?? null,
  );
  const [step, setStep] = useState(0);

  const [profile, setProfile] = useState<ProfileData>(() => ({
    empresa: initialDiagnostic?.profileData?.empresa || clientName || "",
    setor: initialDiagnostic?.profileData?.setor || "",
    pessoas: initialDiagnostic?.profileData?.pessoas || "",
    faturamento: initialDiagnostic?.profileData?.faturamento || "",
    respondente: initialDiagnostic?.profileData?.respondente || "",
    cargo: initialDiagnostic?.profileData?.cargo || "",
    data:
      initialDiagnostic?.profileData?.data ||
      initialDiagnostic?.conducted_at ||
      new Date().toISOString().slice(0, 10),
    consultor:
      initialDiagnostic?.profileData?.consultor ||
      "Rafael Carvalho · dryos studio",
    dores: initialDiagnostic?.profileData?.dores || "",
    objetivos: initialDiagnostic?.profileData?.objetivos || "",
  }));

  const [answers, setAnswers] = useState<AnswersMap>(
    () => initialDiagnostic?.answersMap || {},
  );
  const [naAnswers, setNaAnswers] = useState<NaAnswersMap>(
    () => initialDiagnostic?.naAnswersMap || {},
  );

  const [savingStatus, setSavingStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [generalError, setGeneralError] = useState<string | null>(null);

  const scores = useMemo(
    () => computeDiagnosticScores(answers, naAnswers),
    [answers, naAnswers],
  );

  const stepsList = useMemo(() => {
    return [
      { id: "intro", name: "Identificação", short: "Identificação" },
      ...DIMS.map((d) => ({ id: d.id, name: d.name, short: d.short })),
      { id: "conclude", name: "Conclusão", short: "Conclusão" },
    ];
  }, []);

  const totalSteps = stepsList.length;

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSave = useCallback(
    async (asCompleted = false) => {
      setSavingStatus("saving");
      setGeneralError(null);

      const payload = {
        profileData: profile,
        answers,
        naAnswers,
        formType: "estruturacao_processos",
        status: asCompleted ? ("completed" as const) : ("draft" as const),
        conductedAt: profile.data || new Date().toISOString().slice(0, 10),
      };

      const result = await saveManagementDiagnosticAction(
        clientId,
        diagnosticId,
        payload,
      );

      if (result.ok) {
        if (!diagnosticId) {
          setDiagnosticId(result.data.id);
        }
        setSavingStatus("saved");
        return result.data.id;
      } else {
        setSavingStatus("error");
        setGeneralError(result.error);
        return null;
      }
    },
    [clientId, diagnosticId, profile, answers, naAnswers],
  );

  // Debounced autosave quando respostas ou perfil mudam
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      triggerSave(false);
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [answers, naAnswers, profile, triggerSave]);

  const handleNext = async () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      const savedId = await triggerSave(true);
      if (savedId) {
        router.push(`/clients/${clientId}/diagnostic`);
        router.refresh();
      }
    }
  };

  const handlePrev = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step > 0) setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    const savedId = await triggerSave(true);
    if (savedId) {
      router.push(`/clients/${clientId}/diagnostic`);
      router.refresh();
    }
  };

  // Helper para responder pergunta
  const handleSelectScale = (qId: string, val: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setNaAnswers((prev) => {
      const n = { ...prev };
      delete n[qId];
      return n;
    });
  };

  const handleSelectSingle = (qId: string, optIndex: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: optIndex }));
    setNaAnswers((prev) => {
      const n = { ...prev };
      delete n[qId];
      return n;
    });
  };

  const handleToggleMulti = (qId: string, optKey: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qId])
        ? (prev[qId] as string[]).slice()
        : [];
      let updated: string[];

      if (optKey === "none") {
        updated = current.includes("none") ? [] : ["none"];
      } else {
        const withoutNone = current.filter((x) => x !== "none");
        updated = withoutNone.includes(optKey)
          ? withoutNone.filter((x) => x !== optKey)
          : [...withoutNone, optKey];
      }

      if (updated.length === 0) {
        const n = { ...prev };
        delete n[qId];
        return n;
      }
      return { ...prev, [qId]: updated };
    });
    setNaAnswers((prev) => {
      const n = { ...prev };
      delete n[qId];
      return n;
    });
  };

  const handleToggleNa = (qId: string) => {
    setNaAnswers((prev) => {
      const isCurrentlyNa = !!prev[qId];
      if (isCurrentlyNa) {
        const n = { ...prev };
        delete n[qId];
        return n;
      } else {
        setAnswers((a) => {
          const updated = { ...a };
          delete updated[qId];
          return updated;
        });
        return { ...prev, [qId]: true };
      }
    });
  };

  const progressPercent = Math.round((scores.answeredQ / scores.totalQ) * 100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Barra de Topo com Progresso */}
      <div className="bg-card border border-line rounded-xl p-4 sticky top-4 z-20 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <span className="font-mono text-xs uppercase text-oak font-semibold tracking-wider">
              Diagnóstico de Gestão
            </span>
            <h1 className="font-display text-lg text-ink font-bold">
              {stepsList[step]?.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-mute hidden sm:inline">
              {savingStatus === "saving" && "Salvando rascunho..."}
              {savingStatus === "saved" && "Salvo automaticamente"}
              {savingStatus === "error" && "Erro ao salvar"}
            </span>
            {diagnosticId && (
              <DeleteDiagnosticButton
                diagnosticId={diagnosticId}
                clientId={clientId}
                label="Excluir"
                variant="button"
              />
            )}
            <Button
              variant="ghost"
              type="button"
              onClick={() => triggerSave(false)}
              className="inline-flex items-center gap-1.5 text-xs h-8 px-2.5"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-sage transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] font-mono text-mute mt-1.5">
          <span>
            Etapa {step + 1} de {totalSteps}
          </span>
          <span>
            {scores.answeredQ} de {scores.totalQ} respondidas ({progressPercent}%)
          </span>
        </div>
      </div>

      {generalError && (
        <div className="p-3 bg-critical-bg border border-critical text-critical text-sm rounded-lg">
          {generalError}
        </div>
      )}

      {/* Grid Principal: Sidebar de Passos + Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navegação de Passos (Desktop Sticky) */}
        <div className="hidden lg:block lg:col-span-1 space-y-1 bg-card p-3 rounded-xl border border-line sticky top-32 max-h-[calc(100vh-160px)] overflow-y-auto">
          {stepsList.map((s, idx) => {
            const isCurrent = idx === step;
            let isComplete = false;
            let countLabel = "";

            if (idx === 0) {
              isComplete = !!profile.empresa;
            } else if (idx < totalSteps - 1) {
              const dim = DIMS[idx - 1];
              if (dim) {
                const ansCount = dim.qs.filter((q) =>
                  isQuestionAnswered(q, answers, naAnswers),
                ).length;
                countLabel = `${ansCount}/${dim.qs.length}`;
                isComplete = ansCount === dim.qs.length;
              }
            } else {
              isComplete = progressPercent >= 80;
            }

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStep(idx);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  isCurrent
                    ? "bg-oak text-white font-semibold"
                    : isComplete
                    ? "text-ink hover:bg-surface"
                    : "text-mute hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent
                        ? "bg-sage text-ink"
                        : isComplete
                        ? "bg-ok-bg text-ok"
                        : "bg-surface text-mute"
                    }`}
                  >
                    {isComplete ? <Check className="w-2.5 h-2.5" /> : idx === 0 ? "i" : idx}
                  </span>
                  <span className="truncate">{s.short}</span>
                </div>
                {countLabel && (
                  <span
                    className={`font-mono text-[10px] ${
                      isCurrent ? "text-sage" : "text-mute-soft"
                    }`}
                  >
                    {countLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Formulário do Passo Ativo */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-6 md:p-8 border-line-strong bg-card">
            {step === 0 && (
              <StepIntro
                profile={profile}
                onChange={(key, val) =>
                  setProfile((prev) => ({ ...prev, [key]: val }))
                }
              />
            )}

            {step > 0 && step < totalSteps - 1 && (
              <StepDimension
                dimension={DIMS[step - 1]!}
                dimensionIndex={step}
                answers={answers}
                naAnswers={naAnswers}
                onSelectScale={handleSelectScale}
                onSelectSingle={handleSelectSingle}
                onToggleMulti={handleToggleMulti}
                onToggleNa={handleToggleNa}
              />
            )}

            {step === totalSteps - 1 && (
              <StepConclusion
                scores={scores}
                onFinish={handleFinish}
              />
            )}

            {/* Botões de Navegação Inferiores */}
            <div className="flex items-center justify-between gap-3 pt-6 mt-8 border-t border-line flex-wrap">
              <Button
                variant="ghost"
                type="button"
                onClick={handlePrev}
                disabled={step === 0}
                className="inline-flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>

              <div className="flex items-center gap-2">
                <Link href={`/clients/${clientId}`}>
                  <Button variant="ghost" type="button">
                    Sair
                  </Button>
                </Link>
                {step < totalSteps - 1 ? (
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5"
                  >
                    Próxima Etapa
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleFinish}
                    className="inline-flex items-center gap-1.5 bg-ok hover:bg-ok/90"
                  >
                    Finalizar Diagnóstico
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Subcomponente: Identificação
function StepIntro({
  profile,
  onChange,
}: {
  profile: ProfileData;
  onChange: (key: keyof ProfileData, val: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">
          Identificação da Empresa
        </h2>
        <p className="text-sm text-mute mt-1">
          Preencha os dados do cliente e contexto atual. Estas informações alimentam o resumo executivo e a calibragem do relatório.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROFILE_FIELDS.map((fl) => {
          const val = profile[fl.id as keyof ProfileData] ?? "";

          return (
            <div
              key={fl.id}
              className={`space-y-1.5 ${fl.full ? "md:col-span-2" : ""}`}
            >
              <label
                htmlFor={`pf_${fl.id}`}
                className="block font-mono text-[11px] uppercase tracking-wider text-mute"
              >
                {fl.label}
              </label>

              {fl.type === "select" ? (
                <select
                  id={`pf_${fl.id}`}
                  value={val}
                  onChange={(e) =>
                    onChange(fl.id as keyof ProfileData, e.target.value)
                  }
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong"
                >
                  {(fl.opts ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt || "Selecione..."}
                    </option>
                  ))}
                </select>
              ) : fl.type === "textarea" ? (
                <textarea
                  id={`pf_${fl.id}`}
                  rows={3}
                  value={val}
                  onChange={(e) =>
                    onChange(fl.id as keyof ProfileData, e.target.value)
                  }
                  placeholder="Escreva em poucas linhas..."
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong resize-y"
                />
              ) : (
                <input
                  id={`pf_${fl.id}`}
                  type={fl.type}
                  value={val}
                  onChange={(e) =>
                    onChange(fl.id as keyof ProfileData, e.target.value)
                  }
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Subcomponente: Dimensão
function StepDimension({
  dimension,
  dimensionIndex,
  answers,
  naAnswers,
  onSelectScale,
  onSelectSingle,
  onToggleMulti,
  onToggleNa,
}: {
  dimension: Dimension;
  dimensionIndex: number;
  answers: AnswersMap;
  naAnswers: NaAnswersMap;
  onSelectScale: (qId: string, val: number) => void;
  onSelectSingle: (qId: string, optIndex: number) => void;
  onToggleMulti: (qId: string, optKey: string) => void;
  onToggleNa: (qId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-oak-light">
          Dimensão {dimensionIndex} de 13
        </span>
        <h2 className="font-display text-xl font-bold text-ink mt-0.5">
          {dimension.name}
        </h2>
        <p className="text-sm text-mute">
          Selecione a opção que melhor descreve o momento atual da operação.
        </p>
      </div>

      <div className="space-y-6 divide-y divide-line pt-2">
        {dimension.qs.map((q, idx) => {
          const ans = answers[q.id];
          const isNa = !!naAnswers[q.id];

          return (
            <div key={q.id} className="pt-6 first:pt-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-sm text-ink leading-relaxed">
                  <span className="font-mono text-oak-light mr-2 font-bold">
                    {dimensionIndex}.{idx + 1}
                  </span>
                  {q.text}
                  {q.t === "multi" && (
                    <span className="font-normal text-xs text-mute ml-2">
                      (marque todas que se aplicam)
                    </span>
                  )}
                </span>
              </div>

              {/* Controles da Pergunta */}
              {q.t === "scale" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5].map((v) => {
                      const isSel = ans === v && !isNa;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onSelectScale(q.id, v)}
                          className={`w-12 h-11 rounded-xl font-display font-bold text-base transition-all border ${
                            isSel
                              ? "bg-oak text-white border-oak shadow-sm"
                              : "bg-surface text-ink border-line hover:border-line-strong"
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center text-xs text-mute max-w-xs font-mono">
                    <span>1 = {q.low}</span>
                    <span>5 = {q.high}</span>
                  </div>
                </div>
              )}

              {q.t === "single" && (
                <div className="grid grid-cols-1 gap-2">
                  {q.opts.map((opt, optIdx) => {
                    const isSel = ans === optIdx && !isNa;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => onSelectSingle(q.id, optIdx)}
                        className={`flex items-center gap-3 text-left p-3 rounded-lg border text-sm transition-all ${
                          isSel
                            ? "bg-sage-bg border-sage text-ink font-medium"
                            : "bg-surface border-line text-ink-soft hover:border-line-strong"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSel
                              ? "border-oak bg-oak text-white"
                              : "border-mute-soft"
                          }`}
                        >
                          {isSel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span>{opt[0]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.t === "multi" && (
                <div className="grid grid-cols-1 gap-2">
                  {q.opts.map((opt) => {
                    const currentArr = Array.isArray(ans) ? (ans as string[]) : [];
                    const isSel = currentArr.includes(opt[1]) && !isNa;
                    return (
                      <button
                        key={opt[1]}
                        type="button"
                        onClick={() => onToggleMulti(q.id, opt[1])}
                        className={`flex items-center gap-3 text-left p-3 rounded-lg border text-sm transition-all ${
                          isSel
                            ? "bg-sage-bg border-sage text-ink font-medium"
                            : "bg-surface border-line text-ink-soft hover:border-line-strong"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSel
                              ? "border-oak bg-oak text-white"
                              : "border-mute-soft"
                          }`}
                        >
                          {isSel && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </div>
                        <span>{opt[0]}</span>
                      </button>
                    );
                  })}
                  {/* Opção Nenhuma */}
                  <button
                    type="button"
                    onClick={() => onToggleMulti(q.id, "none")}
                    className={`flex items-center gap-3 text-left p-3 rounded-lg border text-sm transition-all ${
                      Array.isArray(ans) && ans.includes("none") && !isNa
                        ? "bg-sage-bg border-sage text-ink font-medium"
                        : "bg-surface border-line text-mute hover:border-line-strong"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        Array.isArray(ans) && ans.includes("none") && !isNa
                          ? "border-oak bg-oak text-white"
                          : "border-mute-soft"
                      }`}
                    >
                      {Array.isArray(ans) && ans.includes("none") && !isNa && (
                        <Check className="w-3 h-3 stroke-[2.5]" />
                      )}
                    </div>
                    <span>Nenhuma das opções anteriores</span>
                  </button>
                </div>
              )}

              {/* Botão Não sei / não se aplica */}
              {q.t !== "multi" && (
                <button
                  type="button"
                  onClick={() => onToggleNa(q.id)}
                  className={`text-xs underline transition-colors ${
                    isNa
                      ? "text-oak font-semibold"
                      : "text-mute hover:text-ink"
                  }`}
                >
                  {isNa ? "✓ Marcado como Não sei / não se aplica" : "Não sei / não se aplica"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Subcomponente: Conclusão
function StepConclusion({
  scores,
  onFinish,
}: {
  scores: ReturnType<typeof computeDiagnosticScores>;
  onFinish: () => void;
}) {
  const coveragePct = Math.round((scores.answeredQ / scores.totalQ) * 100);

  return (
    <div className="space-y-6 text-center py-6">
      <div className="w-16 h-16 rounded-full bg-sage-bg text-oak flex items-center justify-center mx-auto mb-2">
        <Check className="w-8 h-8" />
      </div>

      <h2 className="font-display text-2xl font-bold text-ink">
        Diagnóstico Concluído
      </h2>

      <p className="text-sm text-mute max-w-md mx-auto">
        Você respondeu a <strong>{scores.answeredQ}</strong> de{" "}
        <strong>{scores.totalQ}</strong> perguntas ({coveragePct}% de cobertura).
      </p>

      <div className="p-6 bg-surface rounded-xl border border-line max-w-sm mx-auto">
        <span className="font-mono text-xs uppercase text-mute">Índice Preliminar</span>
        <div className="font-display text-4xl font-bold text-ink mt-1">
          {scores.overall ?? "—"}/100
        </div>
        <p className="text-xs text-mute mt-2">
          Ao clicar em finalizar, o relatório executivo completo com gráficos e planos de ação será consolidado.
        </p>
      </div>

      <div className="pt-4">
        <Button
          variant="primary"
          onClick={onFinish}
          className="bg-ok hover:bg-ok/90 px-8 py-3 text-base h-auto"
        >
          Gerar e Visualizar Relatório
        </Button>
      </div>
    </div>
  );
}
