import { describe, expect, it } from 'vitest';
import { runDecisionEngine } from './engine';
import type { RuleContext, PositionContext } from './types';
import type { CompositionAnalysis, DiversificationAnalysis, InvestorProfile, Position, RiskAnalysis } from '@/lib/types';
import type { CostAnalysis } from '@/lib/calculations/cost';
import { computeSuitability } from '@/lib/calculations/suitability';

function pos(id: string, name: string, weightPct: number, assetClass: Position['assetClass'] = 'etf'): PositionContext {
  return {
    position: {
      id,
      name,
      assetClass,
      extractionConfidence: 'high',
      userConfirmed: true,
      userEdited: false,
    },
    weightPct,
  };
}

function emptyRisk(): RiskAnalysis {
  return { metrics: [], currencyExposure: [], summary: '' };
}

function emptyDiversification(effectiveNumberOfBets: number): DiversificationAnalysis {
  return { effectiveNumberOfBets, overlapPairs: [], hiddenConcentrationNotes: [], summary: '' };
}

function emptyCost(): CostAnalysis {
  return { coverageWeight: 0, note: '' };
}

function baseProfile(overrides: Partial<InvestorProfile> = {}): InvestorProfile {
  return {
    objective: 'wealth_growth',
    horizonBucket: 'long',
    horizonYearsApprox: 20,
    maxAcceptableLossPct: 35,
    reactionToDrop: 'do_nothing',
    experience: 'experienced',
    liquidity: { mayNeedWithdrawal: false },
    contributions: { makesRecurringContributions: false },
    preferences: { vehicles: [], esgFocus: false, exclusions: [], sectorTilts: [], countryTilts: [], dividendFocus: false },
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('runDecisionEngine — principio "no cambiar por cambiar"', () => {
  it('no recomienda ningún cambio para una cartera bien diversificada y coherente con el perfil', () => {
    const positions = [pos('a', 'ETF Global A', 0.5), pos('b', 'ETF Global B', 0.3), pos('c', 'ETF EM', 0.2)];
    const composition: CompositionAnalysis = {
      byAsset: positions.map((p) => ({ label: p.position.name, valueBaseCcy: p.weightPct * 1000, weightPct: p.weightPct })),
      bySector: [],
      byGeography: [],
      byCurrency: [],
      byAssetClass: [{ label: 'etf', valueBaseCcy: 1000, weightPct: 1 }],
      concentrationHhi: 0.5 * 0.5 + 0.3 * 0.3 + 0.2 * 0.2,
      topPositionWeightPct: 0.5,
      top5WeightPct: 1,
      dataCompletenessPct: 1,
    };
    const profile = baseProfile();

    const ctx: RuleContext = {
      positions,
      composition,
      diversification: emptyDiversification(1 / composition.concentrationHhi),
      risk: emptyRisk(),
      cost: emptyCost(),
      suitability: computeSuitability(composition.byAssetClass, profile),
      profile,
      baseCurrency: 'EUR',
    };

    const result = runDecisionEngine(ctx);
    expect(result.needsChanges).toBe(false);
    expect(result.recommendations.every((r) => r.category === 'maintain')).toBe(true);
    expect(result.actionPlan.noActionNeeded).toBe(true);
  });

  it('recomienda "change" ante una concentración extrema incoherente con el perfil declarado', () => {
    const positions = [pos('tsla', 'Tesla Inc', 0.92, 'equity'), pos('cash', 'Efectivo', 0.08, 'cash')];
    const composition: CompositionAnalysis = {
      byAsset: positions.map((p) => ({ label: p.position.name, valueBaseCcy: p.weightPct * 1000, weightPct: p.weightPct })),
      bySector: [],
      byGeography: [],
      byCurrency: [],
      byAssetClass: [
        { label: 'equity', valueBaseCcy: 920, weightPct: 0.92 },
        { label: 'cash', valueBaseCcy: 80, weightPct: 0.08 },
      ],
      concentrationHhi: 0.92 * 0.92 + 0.08 * 0.08,
      topPositionWeightPct: 0.92,
      top5WeightPct: 1,
      dataCompletenessPct: 1,
    };
    // Perfil conservador: poca tolerancia y sin experiencia.
    const profile = baseProfile({ experience: 'beginner', maxAcceptableLossPct: 15 });

    const ctx: RuleContext = {
      positions,
      composition,
      diversification: emptyDiversification(1 / composition.concentrationHhi),
      risk: emptyRisk(),
      cost: emptyCost(),
      suitability: computeSuitability(composition.byAssetClass, profile),
      profile,
      baseCurrency: 'EUR',
    };

    const result = runDecisionEngine(ctx);
    expect(result.needsChanges).toBe(true);
    const change = result.recommendations.find((r) => r.category === 'change');
    expect(change).toBeDefined();
    expect(change!.targetPositionIds).toContain('tsla');
    // Toda recomendación de cambio debe venir justificada.
    expect(change!.why.length).toBeGreaterThan(10);
    expect(change!.confidence).toBeDefined();
  });

  it('degrada la misma concentración a "watch" cuando es coherente con un perfil experimentado y de alta tolerancia', () => {
    const positions = [pos('tsla', 'Tesla Inc', 0.92, 'equity'), pos('cash', 'Efectivo', 0.08, 'cash')];
    const composition: CompositionAnalysis = {
      byAsset: positions.map((p) => ({ label: p.position.name, valueBaseCcy: p.weightPct * 1000, weightPct: p.weightPct })),
      bySector: [],
      byGeography: [],
      byCurrency: [],
      byAssetClass: [
        { label: 'equity', valueBaseCcy: 920, weightPct: 0.92 },
        { label: 'cash', valueBaseCcy: 80, weightPct: 0.08 },
      ],
      concentrationHhi: 0.92 * 0.92 + 0.08 * 0.08,
      topPositionWeightPct: 0.92,
      top5WeightPct: 1,
      dataCompletenessPct: 1,
    };
    const profile = baseProfile({ experience: 'experienced', maxAcceptableLossPct: 50 });

    const ctx: RuleContext = {
      positions,
      composition,
      diversification: emptyDiversification(1 / composition.concentrationHhi),
      risk: emptyRisk(),
      cost: emptyCost(),
      suitability: computeSuitability(composition.byAssetClass, profile),
      profile,
      baseCurrency: 'EUR',
    };

    const result = runDecisionEngine(ctx);
    const changeRecs = result.recommendations.filter((r) => r.category === 'change');
    expect(changeRecs.length).toBe(0);
    const watch = result.recommendations.find((r) => r.category === 'watch' && r.targetPositionIds.includes('tsla'));
    expect(watch).toBeDefined();
  });
});
