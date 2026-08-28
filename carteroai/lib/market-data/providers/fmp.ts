import 'server-only';
import type { EtfHolding, EtfSnapshot, FundamentalsSnapshot, SourceRef } from '@/lib/types';
import { fetchJson } from '../http';

/**
 * Financial Modeling Prep (opcional, requiere FMP_API_KEY). Aporta
 * fundamentales de acciones y composición/TER de ETFs. Si no hay clave
 * configurada, todas las funciones devuelven undefined de inmediato y el
 * resto del sistema debe registrar explícitamente "dato no disponible" —
 * nunca inventar una cifra de sustitución.
 */
const BASE = 'https://financialmodelingprep.com/api/v3';

function apiKey(): string | undefined {
  const key = process.env.FMP_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

function source(url: string, fields: string[]): SourceRef {
  return { provider: 'Financial Modeling Prep', url: url.replace(/apikey=[^&]+/, 'apikey=***'), retrievedAt: new Date().toISOString(), fieldsUsed: fields };
}

export function isFmpConfigured(): boolean {
  return apiKey() !== undefined;
}

interface SearchResult {
  symbol: string;
  name?: string;
}

/** Intenta resolver un ticker bursátil a partir de un ISIN. Requiere clave FMP. */
export async function resolveSymbolByIsin(isin: string): Promise<string | undefined> {
  const key = apiKey();
  if (!key) return undefined;
  const url = `${BASE}/search?query=${encodeURIComponent(isin)}&limit=1&apikey=${key}`;
  const res = await fetchJson<SearchResult[]>(url);
  return res?.[0]?.symbol;
}

interface CompanyProfileResponse {
  sector?: string;
  country?: string;
  industry?: string;
}

export interface CompanyProfile {
  sector?: string;
  country?: string;
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | undefined> {
  const key = apiKey();
  if (!key) return undefined;
  const url = `${BASE}/profile/${encodeURIComponent(symbol)}?apikey=${key}`;
  const res = await fetchJson<CompanyProfileResponse[]>(url);
  const profile = res?.[0];
  if (!profile) return undefined;
  return { sector: profile.sector, country: profile.country };
}

interface RatiosTtm {
  peRatioTTM?: number;
  dividendYielTTM?: number; // (sic) nombre real del campo en FMP
  dividendYieldTTM?: number;
  returnOnEquityTTM?: number;
  netProfitMarginTTM?: number;
  grossProfitMarginTTM?: number;
}

interface KeyMetricsTtm {
  evToEbitdaTTM?: number;
  roicTTM?: number;
  netDebtToEBITDATTM?: number;
  freeCashFlowYieldTTM?: number;
}

interface IncomeGrowth {
  growthRevenue?: number;
  growthNetIncome?: number;
}

export async function getFundamentals(symbol: string): Promise<FundamentalsSnapshot | undefined> {
  const key = apiKey();
  if (!key) return undefined;

  const ratiosUrl = `${BASE}/ratios-ttm/${encodeURIComponent(symbol)}?apikey=${key}`;
  const metricsUrl = `${BASE}/key-metrics-ttm/${encodeURIComponent(symbol)}?apikey=${key}`;
  const growthUrl = `${BASE}/income-statement-growth/${encodeURIComponent(symbol)}?limit=1&apikey=${key}`;

  const [ratiosArr, metricsArr, growthArr] = await Promise.all([
    fetchJson<RatiosTtm[]>(ratiosUrl),
    fetchJson<KeyMetricsTtm[]>(metricsUrl),
    fetchJson<IncomeGrowth[]>(growthUrl),
  ]);

  const ratios = ratiosArr?.[0];
  const metrics = metricsArr?.[0];
  const growth = growthArr?.[0];

  if (!ratios && !metrics && !growth) return undefined;

  const unavailable: string[] = [];
  const field = <T,>(v: T | undefined, name: string): T | undefined => {
    if (v === undefined) unavailable.push(name);
    return v;
  };

  return {
    symbol,
    peRatio: field(ratios?.peRatioTTM, 'PER'),
    evToEbitda: field(metrics?.evToEbitdaTTM, 'EV/EBITDA'),
    dividendYieldPct: field(
      ratios?.dividendYieldTTM !== undefined ? ratios.dividendYieldTTM * 100 : ratios?.dividendYielTTM !== undefined ? ratios.dividendYielTTM * 100 : undefined,
      'rentabilidad por dividendo',
    ),
    revenueGrowthYoyPct: field(growth?.growthRevenue !== undefined ? growth.growthRevenue * 100 : undefined, 'crecimiento de ingresos'),
    earningsGrowthYoyPct: field(growth?.growthNetIncome !== undefined ? growth.growthNetIncome * 100 : undefined, 'crecimiento de beneficios'),
    grossMarginPct: field(ratios?.grossProfitMarginTTM !== undefined ? ratios.grossProfitMarginTTM * 100 : undefined, 'margen bruto'),
    netMarginPct: field(ratios?.netProfitMarginTTM !== undefined ? ratios.netProfitMarginTTM * 100 : undefined, 'margen neto'),
    roe: field(ratios?.returnOnEquityTTM, 'ROE'),
    roic: field(metrics?.roicTTM, 'ROIC'),
    netDebtToEbitda: field(metrics?.netDebtToEBITDATTM, 'deuda neta/EBITDA'),
    freeCashFlowMargin: field(metrics?.freeCashFlowYieldTTM, 'flujo de caja libre'),
    source: source(ratiosUrl, ['ratios TTM', 'key metrics TTM', 'crecimiento de ingresos/beneficios']),
    unavailableFields: unavailable,
  };
}

interface EtfInfoResponse {
  symbol: string;
  name?: string;
  expenseRatio?: number;
  aum?: number;
  holdingsCount?: number;
  domicile?: string;
}
interface EtfHolderResponse {
  asset: string;
  weightPercentage: number;
}
interface EtfSectorWeighting {
  sector: string;
  weightPercentage: string;
}
interface EtfCountryWeighting {
  country: string;
  weightPercentage: string;
}

export async function getEtfSnapshot(symbol: string): Promise<EtfSnapshot | undefined> {
  const key = apiKey();
  if (!key) return undefined;

  const infoUrl = `${BASE}/etf-info?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
  const holdersUrl = `${BASE}/etf-holder/${encodeURIComponent(symbol)}?apikey=${key}`;
  const sectorUrl = `${BASE}/etf-sector-weightings/${encodeURIComponent(symbol)}?apikey=${key}`;
  const countryUrl = `${BASE}/etf-country-weightings/${encodeURIComponent(symbol)}?apikey=${key}`;

  const [infoArr, holders, sectors, countries] = await Promise.all([
    fetchJson<EtfInfoResponse[]>(infoUrl),
    fetchJson<EtfHolderResponse[]>(holdersUrl),
    fetchJson<EtfSectorWeighting[]>(sectorUrl),
    fetchJson<EtfCountryWeighting[]>(countryUrl),
  ]);

  const info = infoArr?.[0];
  if (!info && !holders && !sectors && !countries) return undefined;

  // FMP ha devuelto históricamente expenseRatio unas veces como fracción
  // (0.007 = 0.7%) y otras como porcentaje (0.7 = 0.7%) según el endpoint y
  // el plan contratado. Normalizamos de forma defensiva: un TER real nunca
  // supera razonablemente el 5% (0.05 en fracción), así que un valor mayor
  // se interpreta como porcentaje y se convierte a fracción.
  const rawTer = info?.expenseRatio;
  const terAsFraction = rawTer === undefined ? undefined : rawTer > 0.05 ? rawTer / 100 : rawTer;

  const unavailable: string[] = [];
  if (!info?.expenseRatio) unavailable.push('TER');
  if (!holders || holders.length === 0) unavailable.push('principales posiciones');
  if (!sectors || sectors.length === 0) unavailable.push('distribución sectorial');
  if (!countries || countries.length === 0) unavailable.push('distribución geográfica');

  const topHoldings: EtfHolding[] | undefined = holders
    ?.slice(0, 15)
    .map((h) => ({ symbolOrName: h.asset, weightPct: h.weightPercentage }));

  const sectorBreakdown = sectors
    ? Object.fromEntries(sectors.map((s) => [s.sector, parseFloat(s.weightPercentage)]))
    : undefined;
  const geoBreakdown = countries
    ? Object.fromEntries(countries.map((c) => [c.country, parseFloat(c.weightPercentage)]))
    : undefined;

  return {
    symbol,
    name: info?.name,
    terPct: terAsFraction,
    aumUsd: info?.aum,
    numberOfHoldings: info?.holdingsCount,
    topHoldings,
    sectorBreakdown,
    geoBreakdown,
    source: source(infoUrl, ['ficha del ETF', 'principales posiciones', 'distribución sectorial/geográfica']),
    unavailableFields: unavailable,
  };
}
