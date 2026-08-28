import type { AllocationSlice, InvestorProfile } from '@/lib/types';

/**
 * Modelo simplificado y explícito de "peso razonable en activos de
 * crecimiento" (renta variable, ETFs de renta variable, fondos de renta
 * variable, cripto) en función del horizonte temporal y de la pérdida
 * máxima que el inversor dice poder tolerar. Es una heurística de
 * planificación financiera habitual, no una recomendación regulada ni una
 * fórmula única válida para todos los casos: se documenta como tal.
 */
export interface SuitabilityBand {
  minGrowthWeight: number;
  maxGrowthWeight: number;
  rationale: string;
}

export function reasonableGrowthBand(profile: InvestorProfile): SuitabilityBand {
  const { horizonYearsApprox, maxAcceptableLossPct } = profile;

  let base: [number, number];
  if (horizonYearsApprox >= 10 && maxAcceptableLossPct >= 30) {
    base = [0.7, 1.0];
  } else if (horizonYearsApprox >= 7 && maxAcceptableLossPct >= 20) {
    base = [0.55, 0.85];
  } else if (horizonYearsApprox >= 4 && maxAcceptableLossPct >= 12) {
    base = [0.35, 0.65];
  } else if (horizonYearsApprox >= 2) {
    base = [0.15, 0.4];
  } else {
    base = [0, 0.2];
  }

  // La necesidad de liquidez a corto plazo reduce el rango superior admisible.
  if (profile.liquidity.mayNeedWithdrawal && (profile.liquidity.timeframeYears ?? 99) <= 2) {
    base = [Math.max(0, base[0] - 0.15), Math.max(base[0], base[1] - 0.2)];
  }

  return {
    minGrowthWeight: base[0],
    maxGrowthWeight: base[1],
    rationale: `Para un horizonte de ~${horizonYearsApprox} años y una pérdida máxima aceptada del ${maxAcceptableLossPct}%, un rango orientativo de exposición a activos de crecimiento (renta variable/ETFs de RV) es del ${(base[0] * 100).toFixed(0)}% al ${(base[1] * 100).toFixed(0)}%. Es un rango orientativo, no una fórmula exacta ni un mínimo/máximo regulatorio.`,
  };
}

export interface SuitabilityResult {
  score: number; // 0-100
  growthWeight: number;
  band: SuitabilityBand;
  withinBand: boolean;
  explanation: string;
}

export function computeSuitability(byAssetClass: AllocationSlice[], profile: InvestorProfile): SuitabilityResult {
  const growthWeight = byAssetClass
    .filter((a) => a.label === 'equity' || a.label === 'etf' || a.label === 'fund' || a.label === 'crypto')
    .reduce((acc, a) => acc + a.weightPct, 0);

  const band = reasonableGrowthBand(profile);
  const withinBand = growthWeight >= band.minGrowthWeight && growthWeight <= band.maxGrowthWeight;

  let score: number;
  if (withinBand) {
    score = 90;
  } else {
    const distance =
      growthWeight < band.minGrowthWeight ? band.minGrowthWeight - growthWeight : growthWeight - band.maxGrowthWeight;
    score = Math.max(30, 90 - distance * 150);
  }

  const explanation = withinBand
    ? `La exposición a activos de crecimiento (${(growthWeight * 100).toFixed(0)}%) está dentro del rango orientativo para tu perfil (${(band.minGrowthWeight * 100).toFixed(0)}-${(band.maxGrowthWeight * 100).toFixed(0)}%).`
    : growthWeight < band.minGrowthWeight
      ? `La exposición a activos de crecimiento (${(growthWeight * 100).toFixed(0)}%) es inferior al rango orientativo para tu horizonte y tolerancia al riesgo (${(band.minGrowthWeight * 100).toFixed(0)}-${(band.maxGrowthWeight * 100).toFixed(0)}%). Esto no es necesariamente un error: puede ser una elección consciente de preservar capital.`
      : `La exposición a activos de crecimiento (${(growthWeight * 100).toFixed(0)}%) es superior al rango orientativo para tu horizonte y tolerancia al riesgo declarada (${(band.minGrowthWeight * 100).toFixed(0)}-${(band.maxGrowthWeight * 100).toFixed(0)}%).`;

  return { score, growthWeight, band, withinBand, explanation };
}
