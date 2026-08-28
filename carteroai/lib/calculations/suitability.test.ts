import { describe, expect, it } from 'vitest';
import { computeSuitability, reasonableGrowthBand } from './suitability';
import type { AllocationSlice, InvestorProfile } from '@/lib/types';

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

describe('reasonableGrowthBand', () => {
  it('sugiere un rango alto para horizonte largo y alta tolerancia', () => {
    const band = reasonableGrowthBand(baseProfile());
    expect(band.minGrowthWeight).toBeGreaterThanOrEqual(0.7);
  });

  it('sugiere un rango bajo para horizonte corto', () => {
    const band = reasonableGrowthBand(baseProfile({ horizonYearsApprox: 1, maxAcceptableLossPct: 5 }));
    expect(band.maxGrowthWeight).toBeLessThanOrEqual(0.2);
  });

  it('reduce el rango si hay necesidad de liquidez a corto plazo', () => {
    const withoutLiquidity = reasonableGrowthBand(baseProfile());
    const withLiquidity = reasonableGrowthBand(
      baseProfile({ liquidity: { mayNeedWithdrawal: true, timeframeYears: 1 } }),
    );
    expect(withLiquidity.maxGrowthWeight).toBeLessThan(withoutLiquidity.maxGrowthWeight);
  });
});

describe('computeSuitability', () => {
  it('detecta una cartera dentro del rango orientativo', () => {
    const byAssetClass: AllocationSlice[] = [{ label: 'equity', valueBaseCcy: 900, weightPct: 0.9 }, { label: 'cash', valueBaseCcy: 100, weightPct: 0.1 }];
    const result = computeSuitability(byAssetClass, baseProfile());
    expect(result.withinBand).toBe(true);
    expect(result.score).toBeGreaterThan(80);
  });

  it('detecta una cartera excesivamente conservadora para el perfil', () => {
    const byAssetClass: AllocationSlice[] = [{ label: 'cash', valueBaseCcy: 900, weightPct: 0.9 }, { label: 'equity', valueBaseCcy: 100, weightPct: 0.1 }];
    const result = computeSuitability(byAssetClass, baseProfile());
    expect(result.withinBand).toBe(false);
    expect(result.growthWeight).toBeCloseTo(0.1);
  });
});
