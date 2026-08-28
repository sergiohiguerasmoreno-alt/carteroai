import 'server-only';
import { nanoid } from 'nanoid';
import type { ConfirmedPortfolio, InvestorProfile, MarketDataBundle, PortfolioAnalysis, EtfHolding } from '@/lib/types';
import { MarketDataService } from '@/lib/market-data/service';
import {
  computeValuedPortfolio,
  computeComposition,
  computeDiversification,
  buildHoldingsLookup,
  computeRiskAnalysis,
  computeReturnAnalysis,
  selectBenchmark,
  computeCostAnalysis,
  computeScore,
  computeSuitability,
  type PositionEnrichment,
} from '@/lib/calculations';
import type { WeightedHistory } from '@/lib/calculations/returns';
import type { PositionRiskInput } from '@/lib/calculations/risk';
import type { CostInput } from '@/lib/calculations/cost';
import { buildEnrichmentMap } from './enrichment';
import { buildFundamentalNotes, buildEtfNotes } from './notes';
import { collectDataLimitations, collectSources } from './sources';
import { runDecisionEngine } from '@/lib/rules/engine';
import type { PositionContext, RuleContext } from '@/lib/rules/types';
import { buildScenarios } from '@/lib/rules/scenarios';
import { generateExecutiveSummary } from '@/lib/ai/executive-summary';
import { DISCLAIMER_TEXT } from '@/lib/config/legal-flags';

export async function analyzePortfolio(portfolio: ConfirmedPortfolio, profile: InvestorProfile): Promise<PortfolioAnalysis> {
  const marketData = new MarketDataService();

  const fxRates = await marketData.getFxRates(portfolio.baseCurrency);
  const valuedPortfolio = computeValuedPortfolio(portfolio, fxRates);

  const bundleList = await Promise.all(portfolio.positions.map((p) => marketData.getBundle(p)));
  const bundleByPositionId = new Map<string, MarketDataBundle>(portfolio.positions.map((p, i) => [p.id, bundleList[i]!]));

  const equityProfiles = new Map(
    await Promise.all(
      portfolio.positions
        .filter((p) => p.assetClass === 'equity')
        .map(async (p) => {
          const symbol = await marketData.resolveSymbol(p);
          const profile = symbol ? await marketData.getCompanyProfile(symbol) : undefined;
          return [p.id, profile] as const;
        }),
    ),
  );

  const enrichment: Map<string, PositionEnrichment> = buildEnrichmentMap(portfolio.positions, bundleByPositionId, equityProfiles);
  const composition = computeComposition(valuedPortfolio, enrichment);

  const holdingsMap = new Map<string, EtfHolding[]>();
  for (const p of portfolio.positions) {
    const holdings = bundleByPositionId.get(p.id)?.etf?.topHoldings;
    if (holdings) holdingsMap.set(p.id, holdings);
  }
  const diversification = computeDiversification(valuedPortfolio, composition, buildHoldingsLookup(holdingsMap));

  const positionRisks: PositionRiskInput[] = valuedPortfolio.positions
    .filter((v) => v.weightPct !== undefined)
    .map((v) => ({ positionId: v.position.id, weight: v.weightPct!, points: bundleByPositionId.get(v.position.id)?.history?.points }));
  const risk = computeRiskAnalysis(composition, composition.byCurrency, positionRisks);

  const benchmark = selectBenchmark(composition.byGeography, composition.byAssetClass);
  const benchmarkHistory = benchmark.symbol ? await marketData.getHistory(benchmark.symbol) : undefined;

  const portfolioHistories: WeightedHistory[] = valuedPortfolio.positions
    .filter((v) => v.weightPct !== undefined)
    .map((v) => ({ positionId: v.position.id, weight: v.weightPct!, points: bundleByPositionId.get(v.position.id)?.history?.points }));
  const returns = computeReturnAnalysis(portfolioHistories, benchmark, benchmarkHistory?.points);

  const costInputs: CostInput[] = valuedPortfolio.positions
    .filter((v) => v.weightPct !== undefined)
    .map((v) => ({
      positionId: v.position.id,
      weight: v.weightPct!,
      assetClass: v.position.assetClass,
      terPct: bundleByPositionId.get(v.position.id)?.etf?.terPct,
    }));
  const cost = computeCostAnalysis(costInputs, valuedPortfolio.totalValueBaseCcy);

  const score = computeScore(composition, diversification, risk, cost, profile);

  const ruleContext: RuleContext = {
    positions: valuedPortfolio.positions
      .filter((v) => v.weightPct !== undefined)
      .map(
        (v): PositionContext => ({
          position: v.position,
          weightPct: v.weightPct!,
          terPct: costInputs.find((c) => c.positionId === v.position.id)?.terPct,
        }),
      ),
    composition,
    diversification,
    risk,
    cost,
    suitability: computeSuitability(composition.byAssetClass, profile),
    profile,
    baseCurrency: portfolio.baseCurrency,
  };
  const { recommendations, actionPlan, needsChanges } = runDecisionEngine(ruleContext);

  const scenarios = buildScenarios(returns);
  const fundamentals = buildFundamentalNotes(portfolio.positions, bundleByPositionId);
  const etfNotes = buildEtfNotes(portfolio.positions, bundleByPositionId, diversification.overlapPairs);

  const executiveSummaryResult = await generateExecutiveSummary(score, composition, risk, recommendations, profile);

  const sources = collectSources(bundleList, [
    { provider: 'Frankfurter (tipos de referencia BCE)', retrievedAt: new Date().toISOString(), fieldsUsed: ['tipos de cambio'] },
    benchmarkHistory?.source,
  ]);
  const dataLimitations = collectDataLimitations(bundleList, [
    valuedPortfolio.unvaluedCount > 0 ? `${valuedPortfolio.unvaluedCount} posición(es) no se han podido valorar por falta de precio, cantidad o tipo de cambio.` : undefined,
    returns.dataCoverageWarning,
    cost.weightedTerPct === undefined ? cost.note : undefined,
  ]);

  const analysis: PortfolioAnalysis = {
    id: nanoid(12),
    generatedAt: new Date().toISOString(),
    executiveSummary: {
      headline: executiveSummaryResult.headline,
      doingWell: executiveSummaryResult.doingWell,
      problems: executiveSummaryResult.problems,
      mainRisks: executiveSummaryResult.mainRisks,
      needsChanges,
      conservativeStatement: executiveSummaryResult.conservativeStatement,
    },
    score,
    composition,
    diversification,
    risk,
    returns,
    fundamentals,
    etfNotes,
    recommendations,
    scenarios,
    actionPlan,
    sources,
    dataLimitations,
    disclaimer: DISCLAIMER_TEXT,
  };

  return analysis;
}
