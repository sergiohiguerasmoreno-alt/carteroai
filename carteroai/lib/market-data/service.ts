import 'server-only';
import type { EtfSnapshot, FundamentalsSnapshot, MarketDataBundle, PriceHistory, Position } from '@/lib/types';
import type { FxRateMap } from '@/lib/calculations/currency';
import { getStooqHistory } from './providers/stooq';
import { getFxRates } from './providers/frankfurter';
import { getFundamentals, getEtfSnapshot, isFmpConfigured, resolveSymbolByIsin, getCompanyProfile, type CompanyProfile } from './providers/fmp';

/**
 * Punto único de acceso a datos de mercado. Composición de proveedores:
 * intercambiar o añadir un proveedor nuevo implica solo cambiar este
 * archivo (o añadir uno nuevo en ./providers) sin tocar el resto de capas.
 *
 * Todo el resultado se cachea en memoria por símbolo durante la vida de la
 * petición HTTP (una sola sesión de análisis), nunca entre usuarios.
 */
export class MarketDataService {
  private historyCache = new Map<string, PriceHistory | undefined>();
  private fundamentalsCache = new Map<string, FundamentalsSnapshot | undefined>();
  private etfCache = new Map<string, EtfSnapshot | undefined>();
  private symbolCache = new Map<string, string | undefined>();
  private profileCache = new Map<string, CompanyProfile | undefined>();
  private fxCache: FxRateMap | undefined;

  async resolveSymbol(position: Position): Promise<string | undefined> {
    const key = position.id;
    if (this.symbolCache.has(key)) return this.symbolCache.get(key);

    let symbol: string | undefined = position.ticker;
    if (!symbol && position.isin && isFmpConfigured()) {
      symbol = await resolveSymbolByIsin(position.isin);
    }
    this.symbolCache.set(key, symbol);
    return symbol;
  }

  async getFxRates(baseCurrency: string): Promise<FxRateMap> {
    if (this.fxCache) return this.fxCache;
    const result = await getFxRates(baseCurrency);
    this.fxCache = result?.rates ?? { [baseCurrency]: 1 };
    return this.fxCache;
  }

  async getHistory(symbol: string): Promise<PriceHistory | undefined> {
    if (this.historyCache.has(symbol)) return this.historyCache.get(symbol);
    const history = await getStooqHistory(symbol);
    this.historyCache.set(symbol, history);
    return history;
  }

  async getFundamentals(symbol: string): Promise<FundamentalsSnapshot | undefined> {
    if (this.fundamentalsCache.has(symbol)) return this.fundamentalsCache.get(symbol);
    const data = await getFundamentals(symbol);
    this.fundamentalsCache.set(symbol, data);
    return data;
  }

  async getEtf(symbol: string): Promise<EtfSnapshot | undefined> {
    if (this.etfCache.has(symbol)) return this.etfCache.get(symbol);
    const data = await getEtfSnapshot(symbol);
    this.etfCache.set(symbol, data);
    return data;
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | undefined> {
    if (this.profileCache.has(symbol)) return this.profileCache.get(symbol);
    const data = await getCompanyProfile(symbol);
    this.profileCache.set(symbol, data);
    return data;
  }

  async getBundle(position: Position): Promise<MarketDataBundle> {
    const notes: string[] = [];
    const symbol = await this.resolveSymbol(position);
    if (!symbol) {
      notes.push('No se ha podido identificar un ticker bursátil para esta posición (solo se dispone de ISIN/nombre), por lo que no hay datos de mercado externos disponibles.');
      return { symbol: position.isin ?? position.name, notes };
    }

    const history = await this.getHistory(symbol);
    if (!history) notes.push(`Sin histórico de precios disponible en la fuente configurada para "${symbol}".`);

    let fundamentals: FundamentalsSnapshot | undefined;
    let etf: EtfSnapshot | undefined;

    if (position.assetClass === 'equity') {
      fundamentals = await this.getFundamentals(symbol);
      if (!fundamentals) {
        notes.push(
          isFmpConfigured()
            ? `Fundamentales no disponibles para "${symbol}" en la fuente configurada.`
            : 'Fundamentales no disponibles: no hay proveedor de fundamentales configurado (FMP_API_KEY).',
        );
      }
    }

    if (position.assetClass === 'etf' || position.assetClass === 'fund' || position.assetClass === 'commodity') {
      etf = await this.getEtf(symbol);
      if (!etf) {
        notes.push(
          isFmpConfigured()
            ? `Ficha de ETF/fondo no disponible para "${symbol}" en la fuente configurada.`
            : 'Datos de composición de ETF/fondo no disponibles: no hay proveedor configurado (FMP_API_KEY).',
        );
      }
    }

    return { symbol, history, fundamentals, etf, notes };
  }
}
