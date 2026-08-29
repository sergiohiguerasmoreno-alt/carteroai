import type { MarketDataBundle, Position } from '@/lib/types';
import type { PositionEnrichment } from '@/lib/calculations/composition';
import type { CompanyProfile } from '@/lib/market-data/providers/fmp';
import { mapCountryToRegion } from '@/lib/market-data/region-map';

function percentBreakdownToFraction(pct: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!pct) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pct)) {
    if (!Number.isFinite(v)) continue;
    out[k] = (out[k] ?? 0) + v / 100;
  }
  return out;
}

function regionizeGeo(pctByCountry: Record<string, number> | undefined): Record<string, number> | undefined {
  const fractions = percentBreakdownToFraction(pctByCountry);
  if (!fractions) return undefined;
  const out: Record<string, number> = {};
  for (const [country, frac] of Object.entries(fractions)) {
    const region = mapCountryToRegion(country);
    out[region] = (out[region] ?? 0) + frac;
  }
  return out;
}

export function buildEnrichmentMap(
  positions: Position[],
  bundles: Map<string, MarketDataBundle>,
  profiles: Map<string, CompanyProfile | undefined>,
): Map<string, PositionEnrichment> {
  const map = new Map<string, PositionEnrichment>();

  for (const position of positions) {
    const bundle = bundles.get(position.id);

    if (position.assetClass === 'equity') {
      const profile = profiles.get(position.id);
      if (profile?.sector || profile?.country) {
        map.set(position.id, {
          sector: profile.sector ? { [profile.sector]: 1 } : undefined,
          geography: profile.country ? { [mapCountryToRegion(profile.country)]: 1 } : undefined,
        });
      }
      continue;
    }

    if ((position.assetClass === 'etf' || position.assetClass === 'fund') && bundle?.etf) {
      map.set(position.id, {
        sector: percentBreakdownToFraction(bundle.etf.sectorBreakdown),
        geography: regionizeGeo(bundle.etf.geoBreakdown),
      });
      continue;
    }

    if (position.assetClass === 'commodity') {
      // No depende de un proveedor externo: por definición, una posición de
      // materias primas (oro físico, plata, un ETC de commodities...) no
      // tiene un "sector" de empresa ni una geografía de negocio en el
      // sentido habitual, así que se clasifica de forma determinista en vez
      // de dejarla caer en "Sin clasificar" por falta de datos de mercado.
      map.set(position.id, { sector: { 'Materias primas': 1 } });
      continue;
    }

    if (position.assetClass === 'cash') {
      map.set(position.id, { sector: { Liquidez: 1 }, geography: { [`Divisa ${position.currency ?? ''}`.trim()]: 1 } });
      continue;
    }

    if (position.assetClass === 'bond') {
      map.set(position.id, { sector: { 'Renta fija': 1 } });
      continue;
    }
    // Sin datos suficientes: se deja sin definir a propósito (irá a "Sin clasificar").
  }

  return map;
}
