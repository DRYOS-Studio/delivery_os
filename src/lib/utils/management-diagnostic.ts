import {
  ACT,
  DIMS,
  FLAGS_RULES,
  LEVELS,
  type Dimension,
  type Question,
} from "@/lib/constants/management-diagnostic";

export type DimensionScore = {
  id: string;
  name: string;
  short: string;
  score: number | null;
  level: number | null;
  answeredCount: number;
  totalCount: number;
  weakKeys: string[];
  strongKeys: string[];
};

export type ComputedScores = {
  dims: DimensionScore[];
  validCount: number;
  overall: number | null;
  level: number | null;
  totalQ: number;
  answeredQ: number;
};

export type DiagnosticFlag = {
  dim: string;
  dimName: string;
  sev: "alta" | "média";
  title: string;
  desc: string;
};

export type ActionPlan = {
  qw: Array<{ dim: string; text: string }>;
  d90: Array<{ dim: string; text: string }>;
  m12: Array<{ dim: string; text: string }>;
};

export type AnswerValue = string | number | boolean | string[] | null;
export type AnswersMap = Record<string, AnswerValue>;
export type NaAnswersMap = Record<string, boolean>;

export function isQuestionAnswered(
  q: Question,
  answers: AnswersMap,
  naAnswers: NaAnswersMap,
): boolean {
  if (naAnswers[q.id]) return true;
  const a = answers[q.id];
  if (q.t === "multi") return Array.isArray(a);
  return a !== undefined && a !== null;
}

export function qScore(
  q: Question,
  answers: AnswersMap,
  naAnswers: NaAnswersMap,
): number | null {
  if (q.noscore || naAnswers[q.id]) return null;
  const a = answers[q.id];

  if (q.t === "scale") {
    if (typeof a !== "number") return null;
    return q.rev ? 6 - a : a;
  }

  if (q.t === "single") {
    if (typeof a !== "number") return null;
    const opt = q.opts[a];
    return opt ? opt[1] : null;
  }

  if (q.t === "multi") {
    if (!Array.isArray(a)) return null;
    const good = a.filter((x) => x !== "none").length;
    return 1 + (4 * good) / q.opts.length;
  }

  return null;
}

export function levelOf(sc: number | null): number | null {
  if (sc === null || sc === undefined) return null;
  if (sc >= 80) return 5;
  if (sc >= 60) return 4;
  if (sc >= 40) return 3;
  if (sc >= 20) return 2;
  return 1;
}

export function computeDimensionScore(
  dim: Dimension,
  answers: AnswersMap,
  naAnswers: NaAnswersMap,
): DimensionScore {
  const scoredQs = dim.qs
    .map((q) => ({ q, s: qScore(q, answers, naAnswers) }))
    .filter((x): x is { q: Question; s: number } => x.s !== null);

  const score = scoredQs.length
    ? Math.round(
        (scoredQs.reduce((acc, x) => acc + (x.s - 1) / 4, 0) /
          scoredQs.length) *
          100,
      )
    : null;

  const weakKeys = scoredQs
    .filter((x) => x.s <= 2)
    .sort((a, b) => a.s - b.s)
    .map((x) => x.q.k);

  const strongKeys = scoredQs
    .filter((x) => x.s >= 4)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.q.k);

  const totalCount = dim.qs.filter((q) => !q.noscore).length;

  return {
    id: dim.id,
    name: dim.name,
    short: dim.short,
    score,
    level: levelOf(score),
    answeredCount: scoredQs.length,
    totalCount,
    weakKeys,
    strongKeys,
  };
}

export function computeDiagnosticScores(
  answers: AnswersMap,
  naAnswers: NaAnswersMap,
): ComputedScores {
  const dims = DIMS.map((d) => computeDimensionScore(d, answers, naAnswers));
  const valid = dims.filter((x): x is DimensionScore & { score: number } => x.score !== null);
  const overall = valid.length
    ? Math.round(valid.reduce((acc, x) => acc + x.score, 0) / valid.length)
    : null;

  const totalQ = DIMS.reduce((acc, d) => acc + d.qs.length, 0);
  const answeredQ = DIMS.reduce(
    (acc, d) =>
      acc +
      d.qs.filter((q) => isQuestionAnswered(q, answers, naAnswers)).length,
    0,
  );

  return {
    dims,
    validCount: valid.length,
    overall,
    level: levelOf(overall),
    totalQ,
    answeredQ,
  };
}

export function detectDiagnosticFlags(
  answers: AnswersMap,
  naAnswers: NaAnswersMap,
): DiagnosticFlag[] {
  const getAns = (id: string): unknown => (naAnswers[id] ? undefined : answers[id]);
  const hasValue = (id: string, v: string): boolean => {
    const a = getAns(id);
    return Array.isArray(a) && a.includes(v);
  };
  const isMultiAnswered = (id: string): boolean => Array.isArray(getAns(id));

  return FLAGS_RULES.filter((rule) => {
    try {
      return rule.test(getAns, hasValue, isMultiAnswered);
    } catch {
      return false;
    }
  })
    .map((rule) => {
      const dim = DIMS.find((d) => d.id === rule.dim);
      return {
        dim: rule.dim,
        dimName: dim?.name ?? rule.dim,
        sev: rule.sev,
        title: rule.t,
        desc: rule.d,
      };
    })
    .sort((a, b) => (a.sev === "alta" ? -1 : 1));
}

export function deriveActionPlan(dims: DimensionScore[]): ActionPlan {
  const valid = dims
    .filter((x): x is DimensionScore & { score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score);

  // Seleciona as 3 piores dimensões (ou até 4 se nota < 25)
  const weakest = valid.filter((x, idx) => idx < 3 || (x.score < 25 && idx < 4));

  const plan: ActionPlan = { qw: [], d90: [], m12: [] };

  weakest.forEach((w) => {
    const act = ACT[w.id];
    if (!act) return;
    act.qw.forEach((text) => plan.qw.push({ dim: w.short, text }));
    act.d90.forEach((text) => plan.d90.push({ dim: w.short, text }));
    act.m12.forEach((text) => plan.m12.push({ dim: w.short, text }));
  });

  return plan;
}

export function getLevelDesc(level: number | null): { name: string; desc: string } | null {
  if (!level || level < 1 || level > 5) return null;
  const l = LEVELS[level - 1];
  return l ? { name: l.name, desc: l.desc } : null;
}
