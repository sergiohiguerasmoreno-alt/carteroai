import type {
  ContributionPlan,
  HorizonBucket,
  InvestorPreferences,
  InvestorProfile,
  InvestmentObjective,
  LiquidityNeed,
  PreferredVehicle,
  RiskReaction,
  InvestorExperience,
} from '@/lib/types';
import type { AnswerMap } from './types';

function horizonBucketFromYears(years: number): HorizonBucket {
  if (years <= 3) return 'short';
  if (years <= 8) return 'medium';
  return 'long';
}

export function buildInvestorProfile(answers: AnswerMap): InvestorProfile {
  const liquidity: LiquidityNeed = {
    mayNeedWithdrawal: answers.mayNeedWithdrawal === true,
    timeframeYears: typeof answers.liquidityTimeframeYears === 'number' ? answers.liquidityTimeframeYears : undefined,
    approxShare: typeof answers.liquidityApproxShare === 'string' ? parseFloat(answers.liquidityApproxShare) : undefined,
  };

  const contributions: ContributionPlan = {
    makesRecurringContributions: answers.makesRecurringContributions === true,
    approxAmountBucket: answers.contributionAmountBucket as ContributionPlan['approxAmountBucket'],
    frequency: answers.contributionFrequency as ContributionPlan['frequency'],
  };

  const preferences: InvestorPreferences = {
    vehicles: (Array.isArray(answers.vehicles) ? (answers.vehicles as string[]) : []) as PreferredVehicle[],
    esgFocus: answers.esgFocus === true,
    exclusions: typeof answers.exclusions === 'string' && answers.exclusions.trim().length > 0
      ? answers.exclusions.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    sectorTilts: [],
    countryTilts: [],
    dividendFocus: answers.dividendFocus === true,
  };

  const horizonYearsApprox = typeof answers.horizonYearsApprox === 'number' ? answers.horizonYearsApprox : 10;

  return {
    objective: (answers.objective as InvestmentObjective) ?? 'wealth_growth',
    objectiveOther: typeof answers.objectiveOther === 'string' ? answers.objectiveOther : undefined,
    horizonBucket: horizonBucketFromYears(horizonYearsApprox),
    horizonYearsApprox,
    maxAcceptableLossPct: typeof answers.maxAcceptableLossPct === 'number' ? answers.maxAcceptableLossPct : 15,
    reactionToDrop: (answers.reactionToDrop as RiskReaction) ?? 'do_nothing',
    experience: (answers.experience as InvestorExperience) ?? 'beginner',
    liquidity,
    contributions,
    preferences,
    situationNotes: typeof answers.situationNotes === 'string' && answers.situationNotes.trim() ? answers.situationNotes : undefined,
    completedAt: new Date().toISOString(),
  };
}
