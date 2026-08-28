import { z } from 'zod';
import type { CompositionAnalysis, InvestorProfile, Recommendation, RiskAnalysis, ScoreBreakdown } from '@/lib/types';
import { generateText, isAiConfigured } from './client';
import { allNumbersKnown, extractNumbers } from './fact-guard';
import { NO_CHANGE_STATEMENT } from '@/lib/rules/engine';

export interface ExecutiveSummaryResult {
  headline: string;
  doingWell: string[];
  problems: string[];
  mainRisks: string[];
  needsChanges: boolean;
  conservativeStatement?: string;
  source: 'ai' | 'deterministic';
}

const SummarySchema = z.object({
  headline: z.string().min(1).max(220),
  doingWell: z.array(z.string().min(1)).max(5),
  problems: z.array(z.string().min(1)).max(5),
  mainRisks: z.array(z.string().min(1)).max(5),
});

function buildFacts(
  score: ScoreBreakdown,
  composition: CompositionAnalysis,
  risk: RiskAnalysis,
  recommendations: Recommendation[],
  profile: InvestorProfile,
) {
  const changeCount = recommendations.filter((r) => r.category === 'change' || r.category === 'remove').length;
  const reviewCount = recommendations.filter((r) => r.category === 'review').length;
  const watchCount = recommendations.filter((r) => r.category === 'watch').length;

  return {
    scoreOverall: score.overall,
    scoreDiversification: score.diversification,
    scoreRisk: score.riskAlignment,
    scoreCost: score.cost,
    scoreSuitability: score.suitability,
    topPositionWeightPct: Math.round(composition.topPositionWeightPct * 1000) / 10,
    top5WeightPct: Math.round(composition.top5WeightPct * 1000) / 10,
    numberOfPositions: composition.byAsset.length,
    riskMetrics: risk.metrics.filter((m) => m.available).map((m) => ({ label: m.label, value: m.value !== undefined ? Math.round(m.value * 10) / 10 : undefined })),
    changeCount,
    reviewCount,
    watchCount,
    objective: profile.objective,
    horizonYears: profile.horizonYearsApprox,
  };
}

function allowedNumbersFromFacts(facts: ReturnType<typeof buildFacts>): number[] {
  const nums: number[] = [
    facts.scoreOverall,
    facts.scoreDiversification,
    facts.scoreRisk,
    facts.scoreCost,
    facts.scoreSuitability,
    facts.topPositionWeightPct,
    facts.top5WeightPct,
    facts.numberOfPositions,
    facts.changeCount,
    facts.reviewCount,
    facts.watchCount,
    facts.horizonYears,
  ];
  for (const m of facts.riskMetrics) if (m.value !== undefined) nums.push(m.value);
  return nums;
}

function deterministicSummary(
  facts: ReturnType<typeof buildFacts>,
  recommendations: Recommendation[],
  needsChanges: boolean,
): ExecutiveSummaryResult {
  const headline = `Puntuación global ${facts.scoreOverall}/100. ${
    needsChanges
      ? `Se han identificado ${facts.changeCount} cambio(s) con justificación suficiente.`
      : 'No se ha encontrado ninguna razón suficientemente sólida para modificar la cartera.'
  }`;

  const doingWell: string[] = [];
  if (facts.scoreDiversification >= 70) doingWell.push('La cartera está razonablemente diversificada entre posiciones.');
  if (facts.scoreCost >= 80) doingWell.push('El coste medio de los productos de la cartera es competitivo.');
  if (facts.scoreSuitability >= 70) doingWell.push('El nivel de riesgo global encaja con tu horizonte y tolerancia declarados.');
  if (doingWell.length === 0) doingWell.push('Se han identificado aspectos concretos a mejorar; consulta el detalle en cada sección.');

  const problems = recommendations
    .filter((r) => r.category === 'change' || r.category === 'remove' || r.category === 'review')
    .slice(0, 5)
    .map((r) => `${r.targetLabel}: ${r.why}`);

  const mainRisks = facts.riskMetrics.slice(0, 3).map((m) => `${m.label}: ${m.value ?? '—'}`);

  return {
    headline,
    doingWell,
    problems: problems.length > 0 ? problems : ['No se han detectado problemas relevantes con los datos disponibles.'],
    mainRisks: mainRisks.length > 0 ? mainRisks : ['No hay suficiente histórico de mercado para cuantificar el riesgo con precisión.'],
    needsChanges,
    conservativeStatement: needsChanges ? undefined : NO_CHANGE_STATEMENT,
    source: 'deterministic',
  };
}

export async function generateExecutiveSummary(
  score: ScoreBreakdown,
  composition: CompositionAnalysis,
  risk: RiskAnalysis,
  recommendations: Recommendation[],
  profile: InvestorProfile,
): Promise<ExecutiveSummaryResult> {
  const needsChanges = recommendations.some((r) => r.category === 'change' || r.category === 'remove');
  const facts = buildFacts(score, composition, risk, recommendations, profile);
  const fallback = deterministicSummary(facts, recommendations, needsChanges);

  if (!isAiConfigured()) return fallback;

  const system = `Eres el redactor de resúmenes ejecutivos de CarteroAI, una aplicación de análisis de carteras de inversión.
REGLAS ESTRICTAS:
1. SOLO puedes usar los datos numéricos que aparecen en el JSON de "hechos" que se te proporciona. No inventes ni calcules ninguna cifra nueva.
2. No des consejos regulados de inversión ni recomiendes comprar/vender activos concretos: eso ya lo decide un motor de reglas independiente, tú solo redactas el resumen ejecutivo.
3. Si needsChanges es false, refleja claramente que la cartera está bien construida y no requiere cambios; no inventes problemas para parecer útil.
4. Responde EXCLUSIVAMENTE con un JSON válido con esta forma exacta: {"headline": string, "doingWell": string[], "problems": string[], "mainRisks": string[]}. Máximo 5 elementos por lista. Español, tono profesional y cercano, sin tecnicismos innecesarios.`;

  const user = JSON.stringify({ facts, needsChanges, topIssues: recommendations.filter((r) => r.category !== 'maintain').slice(0, 8).map((r) => ({ category: r.category, label: r.targetLabel, why: r.why })) });

  const raw = await generateText({ system, user, maxTokens: 900 });
  if (!raw) return fallback;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = SummarySchema.parse(JSON.parse(jsonMatch[0]));

    const allNums = allowedNumbersFromFacts(facts);
    const fullText = [parsed.headline, ...parsed.doingWell, ...parsed.problems, ...parsed.mainRisks].join(' ');
    if (extractNumbers(fullText).length > 0 && !allNumbersKnown(fullText, allNums)) {
      return fallback; // la IA ha mencionado una cifra que no le dimos: descartamos por seguridad
    }

    return {
      headline: parsed.headline,
      doingWell: parsed.doingWell,
      problems: parsed.problems,
      mainRisks: parsed.mainRisks,
      needsChanges,
      conservativeStatement: needsChanges ? undefined : NO_CHANGE_STATEMENT,
      source: 'ai',
    };
  } catch {
    return fallback;
  }
}
