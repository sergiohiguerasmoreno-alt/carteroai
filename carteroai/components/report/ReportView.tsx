'use client';

import { useState } from 'react';
import type { ConfirmedPortfolio, InvestorProfile, PortfolioAnalysis } from '@/lib/types';
import { Section } from './Section';
import { RecommendationsSection } from './RecommendationsSection';
import { FeedbackWidget } from './FeedbackWidget';

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

  const { executiveSummary, score, recommendations, dataLimitations, disclaimer } = analysis;

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

      {/* Análisis */}
      <Section title="Análisis de tu cartera" subtitle={`Puntuación global: ${score.overall}/100.`}>
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

      {/* Sugerencias */}
      <RecommendationsSection recommendations={recommendations} />

      {/* Cosas a comprobar (avisos sobre la lectura del PDF o datos que faltan) */}
      {dataLimitations.length > 0 && (
        <Section title="Cosas a comprobar" subtitle="Para que sepas qué has de verificar tú con tu extracto original.">
          <ul className="space-y-1.5 text-sm text-ink-700">
            {dataLimitations.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Legal */}
      <Section title="Aviso legal">
        <p className="text-xs leading-relaxed text-ink-500">{disclaimer}</p>
      </Section>

      <FeedbackWidget reportId={analysis.id} />

      <div className="mt-10 flex justify-center">
        <button onClick={onRestart} className="btn-secondary">
          Analizar otra cartera
        </button>
      </div>
    </div>
  );
}
