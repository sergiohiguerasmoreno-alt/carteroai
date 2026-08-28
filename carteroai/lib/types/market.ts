/**
 * Tipos para la capa de datos de mercado. Todo lo que llega por aquí debe
 * venir de un proveedor real y trazable (ver lib/market-data), nunca de la
 * IA. Cuando un dato no está disponible, el campo correspondiente debe ir
 * a `undefined` — nunca rellenarse con un valor inventado o "typical".
 */

export interface SourceRef {
  /** Nombre del proveedor de datos, p.ej. "Stooq", "Financial Modeling Prep". */
  provider: string;
  /** URL o endpoint consultado, cuando sea posible exponerlo. */
  url?: string;
  /** Fecha/hora en que se obtuvo el dato. */
  retrievedAt: string;
  /** Qué información concreta se usó de esta fuente. */
  fieldsUsed: string[];
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface PriceHistory {
  symbol: string;
  currency?: string;
  points: PricePoint[];
  source: SourceRef;
}

export interface QuoteSnapshot {
  symbol: string;
  price?: number;
  currency?: string;
  marketCap?: number;
  asOf?: string;
  source: SourceRef;
}

export interface FundamentalsSnapshot {
  symbol: string;
  peRatio?: number;
  evToEbitda?: number;
  dividendYieldPct?: number;
  revenueGrowthYoyPct?: number;
  earningsGrowthYoyPct?: number;
  grossMarginPct?: number;
  netMarginPct?: number;
  roe?: number;
  roic?: number;
  netDebtToEbitda?: number;
  freeCashFlowMargin?: number;
  source: SourceRef;
  /** Campos que se han pedido pero no estaban disponibles en la fuente. */
  unavailableFields: string[];
}

export interface EtfHolding {
  symbolOrName: string;
  weightPct: number;
}

export interface EtfSnapshot {
  symbol: string;
  name?: string;
  indexTracked?: string;
  /** Comisión de gestión total (TER) como fracción de 1, p.ej. 0.007 = 0.7%. */
  terPct?: number;
  replicationMethod?: 'physical' | 'synthetic' | 'unknown';
  aumUsd?: number;
  numberOfHoldings?: number;
  topHoldings?: EtfHolding[];
  sectorBreakdown?: Record<string, number>;
  geoBreakdown?: Record<string, number>;
  currency?: string;
  distributionPolicy?: 'accumulating' | 'distributing' | 'unknown';
  source: SourceRef;
  unavailableFields: string[];
}

export interface MacroSnapshot {
  /** p.ej. tipo BCE, inflación eurozona — solo si hay fuente fiable configurada. */
  label: string;
  value: number;
  unit: string;
  asOf: string;
  source: SourceRef;
}

/** Resultado agregado de todo lo que se pudo obtener de mercado para un símbolo. */
export interface MarketDataBundle {
  symbol: string;
  quote?: QuoteSnapshot;
  history?: PriceHistory;
  fundamentals?: FundamentalsSnapshot;
  etf?: EtfSnapshot;
  notes: string[]; // p.ej. "Fundamentales no disponibles: FMP_API_KEY no configurada"
}
