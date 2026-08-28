'use client';

import { useState } from 'react';
import type { ConfirmedPortfolio, InvestorProfile, PortfolioAnalysis } from '@/lib/types';
import { Section } from './Section';
import { ScoreTile } from './ScoreTile';
import { RecommendationsSection } from './RecommendationsSection';
import { AllocationBarChart } from '@/components/charts/AllocationBarChart';
import { ReturnComparisonChart } from '@/components/charts/ReturnComparisonChart';

interface Props {
  analysis: PortfolioAnalysis;
  portfolio: ConfirmedPortfolio;
  profile: InvestorProfile;
  onRestart: () => void;
}

export function ReportView({ analysis, portfolio, profile, onRestart }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch('/api/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, portfolio, profile }),
      });
      if (!res.ok) throw new Error('No se ha podido generar el PDF.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carteroai-informe.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('No se ha podido generar el PDF. Inténtalo de nuevo.');
    } finally {
      setDownloading(false);
    }
  }

  const { executiveSummary, score, composition, diversification, risk, returns, recommendations, scenarios, actionPlan, fundamentals, etfNotes, sources, dataLimitations, disclaimer } = analysis;

  return (
    <div className="container-app py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label-sm mb-2 text-signal-teal">Informe completado</p>
          <h1 className="font-serif text-3xl text-ink-950">Tu análisis de cartera</h1>
          <p className="mt-1 text-sm text-ink-500">{new Date(analysis.generatedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadPdf} disabled={downloading} className="btn-primary">
            {downloading ? 'Generando PDF…' : 'Descargar informe en PDF'}
          </button>
        </div>
      </div>
      {downloadError && <p className="mb-6 text-sm text-signal-rose">{downloadError}</p>}

      {/* Resumen ejecutivo */}
      <Section title="Resumen ejecutivo" subtitle="Si solo lees una sección, que sea esta.">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <ScoreTile label="Global" value={score.overall} big />
          <ScoreTile label="Diversificación" value={score.diversification} />
          <ScoreTile label="Ajuste de riesgo" value={score.riskAlignment} />
          <ScoreTile label="Coste" value={score.cost} />
          <ScoreTile label="Adecuación" value={score.suitability} />
        </div>
        <p className="mb-4 text-sm leading-relaxed text-ink-700">{score.explanation}</p>

        <p className="mb-4 text-base font-medium leading-relaxed text-ink-950">{executiveSummary.headline}</p>
        {executiveSummary.conservativeStatement && (
          <p className="mb-4 rounded-lg bg-signal-teal/10 px-4 py-3 text-sm font-medium text-signal-tealDark">
            {executiveSummary.conservativeStatement}
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Qué está haciendo bien</p>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {executiveSummary.doingWell.map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Puntos a revisar</p>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {executiveSummary.problems.map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Composición */}
      <Section title="Composición" subtitle="Cómo se reparte tu cartera, con los datos disponibles para cada dimensión.">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-ink-950">Por posición</p>
            <AllocationBarChart data={composition.byAsset} />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-ink-950">Por tipo de activo</p>
            <AllocationBarChart data={composition.byAssetClass} />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-ink-950">Por sector</p>
            <AllocationBarChart data={composition.bySector} />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-ink-950">Por región</p>
            <AllocationBarChart data={composition.byGeography} />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-ink-950">Por divisa</p>
            <AllocationBarChart data={composition.byCurrency} />
          </div>
          <div className="space-y-2 text-sm text-ink-700">
            <p className="text-sm font-medium text-ink-950">Concentración</p>
            <p>Mayor posición: {(composition.topPositionWeightPct * 100).toFixed(1)}% de la cartera.</p>
            <p>5 mayores posiciones: {(composition.top5WeightPct * 100).toFixed(1)}% de la cartera.</p>
            <p className="text-xs text-ink-400">
              Clasificación sectorial/geográfica disponible para el {(composition.dataCompletenessPct * 100).toFixed(0)}% del valor de la cartera.
            </p>
          </div>
        </div>
      </Section>

      {/* Diversificación */}
      <Section title="Diversificación">
        <p className="mb-4 text-sm leading-relaxed text-ink-700">{diversification.summary}</p>
        {diversification.hiddenConcentrationNotes.length > 0 && (
          <ul className="space-y-2 text-sm text-ink-700">
            {diversification.hiddenConcentrationNotes.map((n, i) => (
              <li key={i} className="rounded-lg bg-ink-50 px-4 py-3">
                {n}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Riesgo */}
      <Section title="Riesgo" subtitle={risk.summary}>
        <div className="grid gap-3 sm:grid-cols-2">
          {risk.metrics.map((m) => (
            <div key={m.label} className="card p-4">
              <p className="text-xs font-medium text-ink-500">{m.label}</p>
              {m.available && m.value !== undefined ? (
                <p className="mt-1 font-serif text-2xl text-ink-950">
                  {m.value.toFixed(m.unit === '' ? 2 : 1)}
                  {m.unit}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-400">No disponible</p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{m.available ? m.explanation : m.unavailableReason}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Rentabilidad */}
      <Section title="Rentabilidad y benchmark">
        <p className="mb-4 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-950">Benchmark: {returns.benchmark.name}. </span>
          {returns.benchmark.rationale}
        </p>
        {returns.annualizedReturnPct !== undefined ? (
          <>
            <div className="mb-4 flex flex-wrap gap-6">
              <div>
                <p className="label-sm">Rentabilidad anualizada</p>
                <p className="font-serif text-2xl text-ink-950">{returns.annualizedReturnPct.toFixed(1)}%</p>
              </div>
              <div>
                <p className="label-sm">Volatilidad anualizada</p>
                <p className="font-serif text-2xl text-ink-950">{returns.annualizedVolatilityPct?.toFixed(1)}%</p>
              </div>
            </div>
            <ReturnComparisonChart series={returns.series} benchmarkName={returns.benchmark.name} />
          </>
        ) : (
          <p className="text-sm text-ink-500">{returns.dataCoverageWarning}</p>
        )}
        <p className="mt-4 text-xs text-ink-400">{returns.disclaimer}</p>
      </Section>

      {/* Escenarios */}
      {scenarios.length > 0 && (
        <Section title="Escenarios" subtitle="Rangos ilustrativos, no predicciones.">
          <div className="grid gap-3 sm:grid-cols-3">
            {scenarios.map((s) => (
              <div key={s.name} className="card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  {s.name === 'favorable' ? 'Favorable' : s.name === 'base' ? 'Base' : 'Adverso'}
                </p>
                <p className="mt-1 font-serif text-xl text-ink-950">
                  {s.annualizedReturnRangePct[0].toFixed(1)}% a {s.annualizedReturnRangePct[1].toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-ink-400">
            {scenarios[0]!.assumptions.map((a, i) => (
              <li key={i}>— {a}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Fundamental / ETF notes */}
      {(fundamentals.length > 0 || etfNotes.length > 0) && (
        <Section title="Análisis fundamental y de ETFs/fondos">
          {fundamentals.length > 0 && (
            <div className="mb-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Acciones individuales</p>
              {fundamentals.map((f) => (
                <div key={f.positionId} className="card p-4">
                  <p className="text-sm font-medium text-ink-950">{f.label}</p>
                  <p className="mt-1 text-sm text-ink-600">{f.summary}</p>
                </div>
              ))}
            </div>
          )}
          {etfNotes.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">ETFs y fondos</p>
              {etfNotes.map((e) => (
                <div key={e.positionId} className="card p-4">
                  <p className="text-sm font-medium text-ink-950">{e.label}</p>
                  <p className="mt-1 text-sm text-ink-600">{e.summary}</p>
                  {e.redundantWith && e.redundantWith.length > 0 && (
                    <p className="mt-1 text-xs text-signal-amber">Posible redundancia con: {e.redundantWith.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Recomendaciones */}
      <RecommendationsSection recommendations={recommendations} />

      {/* Plan de acción */}
      <Section title="Plan de acción">
        {actionPlan.noActionNeeded ? (
          <p className="text-sm font-medium text-signal-tealDark">No es necesaria ninguna acción en este momento.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              ['Ahora', actionPlan.now],
              ['Próximos 3 meses', actionPlan.next3Months],
              ['Próximos 6-12 meses', actionPlan.next6to12Months],
            ].map(([title, items]) => (
              <div key={title as string}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
                {(items as string[]).length > 0 ? (
                  <ul className="space-y-1.5 text-sm text-ink-700">
                    {(items as string[]).map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-400">Nada que destacar.</p>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 card p-4">
          <p className="text-sm font-medium text-ink-950">Rebalanceo</p>
          <p className="mt-1 text-sm text-ink-600">{actionPlan.rebalancing.rationale}</p>
          <p className="mt-2 text-xs text-ink-400">{actionPlan.rebalancing.thresholdNote}</p>
        </div>
      </Section>

      {/* Fuentes */}
      <Section title="Fuentes utilizadas">
        <div className="space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="flex flex-col gap-0.5 border-b border-ink-100 pb-2 text-sm sm:flex-row sm:justify-between">
              <span className="font-medium text-ink-950">{s.provider}</span>
              <span className="text-ink-500">{s.fieldsUsed.join(', ')}</span>
              <span className="text-xs text-ink-400">{new Date(s.retrievedAt).toLocaleDateString('es-ES')}</span>
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-ink-400">No se han consultado fuentes externas para este análisis.</p>}
        </div>
        {dataLimitations.length > 0 && (
          <>
            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">Limitaciones de datos</p>
            <ul className="space-y-1.5 text-sm text-ink-600">
              {dataLimitations.map((d, i) => (
                <li key={i}>• {d}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* Legal */}
      <Section title="Aviso legal">
        <p className="text-xs leading-relaxed text-ink-500">{disclaimer}</p>
      </Section>

      <div className="mt-10 flex justify-center">
        <button onClick={onRestart} className="btn-secondary">
          Analizar otra cartera
        </button>
      </div>
    </div>
  );
}
