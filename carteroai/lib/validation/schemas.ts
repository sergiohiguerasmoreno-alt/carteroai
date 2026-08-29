import { z } from 'zod';

export const AssetClassSchema = z.enum(['equity', 'etf', 'fund', 'commodity', 'bond', 'cash', 'crypto', 'other']);
export const ExtractionConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const PositionSchema = z.object({
  id: z.string().min(1).max(64),
  rawLine: z.string().max(500).optional(),
  name: z.string().min(1).max(200),
  ticker: z.string().max(20).optional(),
  isin: z.string().max(20).optional(),
  assetClass: AssetClassSchema,
  quantity: z.number().finite().optional(),
  price: z.number().finite().optional(),
  currency: z.string().max(6).optional(),
  marketValue: z.number().finite().optional(),
  weightAsStated: z.number().finite().optional(),
  sector: z.string().max(100).optional(),
  geography: z.string().max(100).optional(),
  extractionConfidence: ExtractionConfidenceSchema,
  userConfirmed: z.boolean(),
  userEdited: z.boolean(),
});

export const PortfolioSchema = z.object({
  id: z.string().min(1).max(64),
  positions: z.array(PositionSchema).min(1).max(200),
  baseCurrency: z.string().min(3).max(6),
  sourceFileName: z.string().max(300),
  extractedAt: z.string(),
  extractionWarnings: z.array(z.string()).max(50),
});

export const InvestorProfileSchema = z.object({
  objective: z.enum(['wealth_growth', 'retirement', 'income', 'capital_preservation', 'home_purchase', 'financial_independence', 'other']),
  objectiveOther: z.string().max(300).optional(),
  horizonBucket: z.enum(['short', 'medium', 'long']),
  horizonYearsApprox: z.number().min(0).max(60),
  maxAcceptableLossPct: z.number().min(0).max(100),
  reactionToDrop: z.enum(['sell_immediately', 'sell_some', 'do_nothing', 'buy_more']),
  experience: z.enum(['beginner', 'intermediate', 'experienced']),
  liquidity: z.object({
    mayNeedWithdrawal: z.boolean(),
    timeframeYears: z.number().min(0).max(60).optional(),
    approxShare: z.number().min(0).max(1).optional(),
  }),
  contributions: z.object({
    makesRecurringContributions: z.boolean(),
    approxAmountBucket: z.enum(['low', 'medium', 'high']).optional(),
    frequency: z.enum(['monthly', 'quarterly', 'annual', 'irregular']).optional(),
  }),
  preferences: z.object({
    vehicles: z.array(z.enum(['etf', 'stocks', 'funds', 'bonds', 'no_preference'])).max(10),
    esgFocus: z.boolean(),
    exclusions: z.array(z.string().max(80)).max(20),
    sectorTilts: z.array(z.string()).max(20),
    countryTilts: z.array(z.string()).max(20),
    currencyPreference: z.string().max(6).optional(),
    dividendFocus: z.boolean(),
  }),
  situationNotes: z.string().max(1000).optional(),
  completedAt: z.string(),
});

export const AnalyzeRequestSchema = z.object({
  portfolio: PortfolioSchema,
  profile: InvestorProfileSchema,
});

export const LeadRequestSchema = z.object({
  email: z.string().trim().email().max(200),
  consent: z.literal(true),
  context: z.object({
    objective: z.string().max(60).optional(),
    horizonYearsApprox: z.number().min(0).max(60).optional(),
    source: z.string().max(60),
  }),
});

export const FeedbackRequestSchema = z.object({
  reportId: z.string().min(1).max(64),
  helpful: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});
