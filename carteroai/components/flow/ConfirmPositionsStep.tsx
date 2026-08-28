'use client';

import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { AssetClass, Position, Portfolio } from '@/lib/types';

const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity: 'Acción',
  etf: 'ETF',
  fund: 'Fondo',
  bond: 'Renta fija',
  cash: 'Efectivo',
  crypto: 'Cripto',
  other: 'Otro',
};

const CONFIDENCE_LABEL: Record<Position['extractionConfidence'], { label: string; className: string }> = {
  high: { label: 'Confianza alta', className: 'bg-signal-teal/10 text-signal-tealDark' },
  medium: { label: 'Confianza media', className: 'bg-signal-amber/10 text-signal-amber' },
  low: { label: 'Confianza baja — revisa', className: 'bg-signal-rose/10 text-signal-rose' },
};

function emptyPosition(): Position {
  return {
    id: nanoid(10),
    name: '',
    assetClass: 'equity',
    extractionConfidence: 'low',
    userConfirmed: false,
    userEdited: true,
  };
}

interface Props {
  portfolio: Portfolio;
  onChange: (portfolio: Portfolio) => void;
  onContinue: () => void;
}

export function ConfirmPositionsStep({ portfolio, onChange, onContinue }: Props) {
  const [baseCurrency, setBaseCurrency] = useState(portfolio.baseCurrency);

  function updatePosition(id: string, patch: Partial<Position>) {
    onChange({
      ...portfolio,
      positions: portfolio.positions.map((p) => (p.id === id ? { ...p, ...patch, userEdited: true } : p)),
    });
  }

  function removePosition(id: string) {
    onChange({ ...portfolio, positions: portfolio.positions.filter((p) => p.id !== id) });
  }

  function addPosition() {
    onChange({ ...portfolio, positions: [...portfolio.positions, emptyPosition()] });
  }

  const totalWeightStated = portfolio.positions.reduce((acc, p) => acc + (p.weightAsStated ?? 0), 0);
  const canContinue = portfolio.positions.length > 0 && portfolio.positions.every((p) => p.name.trim().length > 0);

  function handleContinue() {
    onChange({
      ...portfolio,
      baseCurrency,
      positions: portfolio.positions.map((p) => ({ ...p, userConfirmed: true })),
    });
    onContinue();
  }

  return (
    <div className="container-app py-10">
      <p className="label-sm mb-2 text-signal-teal">Paso 2 de 5</p>
      <h1 className="mb-2 font-serif text-3xl text-ink-950">Confirma tus posiciones</h1>
      <p className="mb-6 max-w-lg text-sm leading-relaxed text-ink-600">
        Los PDFs pueden contener errores de lectura. Revisa cada posición y corrige lo que haga falta antes de
        continuar — esto es clave para que el análisis sea fiable.
      </p>

      {portfolio.extractionWarnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {portfolio.extractionWarnings.map((w, i) => (
            <p key={i} className="rounded-lg bg-signal-amber/10 px-4 py-3 text-sm text-signal-amber">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-ink-500">
          Divisa base de la cartera
          <select
            className="input-field ml-2 inline-block w-24"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
          >
            {['EUR', 'USD', 'GBP', 'CHF'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {portfolio.positions.some((p) => p.weightAsStated !== undefined) && (
          <span className="text-xs text-ink-400">Suma de pesos leídos del PDF: {(totalWeightStated * 100).toFixed(1)}%</span>
        )}
      </div>

      <div className="space-y-3">
        {portfolio.positions.map((p, idx) => (
          <div key={p.id} className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-400">Posición {idx + 1}</span>
              <div className="flex items-center gap-2">
                <span className={`pill ${CONFIDENCE_LABEL[p.extractionConfidence].className}`}>
                  {CONFIDENCE_LABEL[p.extractionConfidence].label}
                </span>
                <button onClick={() => removePosition(p.id)} className="text-xs text-ink-400 hover:text-signal-rose">
                  Eliminar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="col-span-2 text-xs text-ink-500 sm:col-span-2">
                Nombre del activo
                <input className="input-field mt-1" value={p.name} onChange={(e) => updatePosition(p.id, { name: e.target.value })} />
              </label>
              <label className="text-xs text-ink-500">
                Ticker
                <input className="input-field mt-1" value={p.ticker ?? ''} onChange={(e) => updatePosition(p.id, { ticker: e.target.value || undefined })} />
              </label>
              <label className="text-xs text-ink-500">
                ISIN
                <input className="input-field mt-1" value={p.isin ?? ''} onChange={(e) => updatePosition(p.id, { isin: e.target.value || undefined })} />
              </label>

              <label className="text-xs text-ink-500">
                Tipo de activo
                <select className="input-field mt-1" value={p.assetClass} onChange={(e) => updatePosition(p.id, { assetClass: e.target.value as AssetClass })}>
                  {Object.entries(ASSET_CLASS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink-500">
                Divisa
                <input className="input-field mt-1" value={p.currency ?? ''} onChange={(e) => updatePosition(p.id, { currency: e.target.value || undefined })} placeholder={portfolio.baseCurrency} />
              </label>
              <label className="text-xs text-ink-500">
                Cantidad
                <input
                  type="number"
                  className="input-field mt-1"
                  value={p.quantity ?? ''}
                  onChange={(e) => updatePosition(p.id, { quantity: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>
              <label className="text-xs text-ink-500">
                Precio
                <input
                  type="number"
                  className="input-field mt-1"
                  value={p.price ?? ''}
                  onChange={(e) => updatePosition(p.id, { price: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>

              <label className="text-xs text-ink-500">
                Valor de mercado
                <input
                  type="number"
                  className="input-field mt-1"
                  value={p.marketValue ?? ''}
                  onChange={(e) => updatePosition(p.id, { marketValue: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>
              <label className="text-xs text-ink-500">
                Peso en cartera (%, opcional)
                <input
                  type="number"
                  className="input-field mt-1"
                  value={p.weightAsStated !== undefined ? p.weightAsStated * 100 : ''}
                  onChange={(e) => updatePosition(p.id, { weightAsStated: e.target.value ? Number(e.target.value) / 100 : undefined })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addPosition} className="btn-secondary mt-4 w-full sm:w-auto">
        + Añadir posición manualmente
      </button>

      <div className="sticky bottom-0 -mx-5 mt-8 border-t border-ink-100 bg-white/90 px-5 py-4 backdrop-blur sm:mx-0 sm:rounded-xl2 sm:border">
        <button onClick={handleContinue} disabled={!canContinue} className="btn-primary w-full sm:w-auto">
          Confirmar posiciones y continuar
        </button>
        {!canContinue && <p className="mt-2 text-xs text-ink-400">Cada posición necesita al menos un nombre.</p>}
      </div>
    </div>
  );
}
