'use client';

import { useState } from 'react';
import type { PortfolioAnalysis } from '@/lib/types';
import { Section } from '@/components/report/Section';

interface Props {
  analysis: PortfolioAnalysis;
  orderId: string;
  onUnlocked: () => void;
}

const SHARE_TEXT = 'He analizado mi cartera de inversión gratis con CarteroAI. Pruébalo tú también:';

export function PaywallStep({ analysis, orderId, onUnlocked }: Props) {
  const [paying, setPaying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  // No desbloqueamos en el mismo clic que abre WhatsApp/X/el diálogo nativo
  // de compartir: eso solo demuestra que se ha pulsado un botón, no que el
  // enlace haya llegado a nadie. En su lugar, tras esa acción pedimos una
  // confirmación explícita y separada ("ya se lo he enviado a un amigo")
  // antes de desbloquear. Sigue siendo un sistema de confianza — no hay
  // forma de comprobar de verdad que el mensaje llegó — pero exige un paso
  // deliberado más, no solo pulsar el botón de compartir.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const { executiveSummary, score, recommendations } = analysis;
  const previewDoingWell = executiveSummary.doingWell.slice(0, 1);
  const nonMaintainCount = recommendations.filter((r) => r.category !== 'maintain').length;

  async function handlePay() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'No se ha podido iniciar el pago.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido iniciar el pago. Inténtalo de nuevo.');
      setPaying(false);
    }
  }

  async function unlockFree() {
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/free-share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.unlocked) throw new Error(data.error ?? 'No se ha podido desbloquear el informe.');
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido desbloquear el informe. Inténtalo de nuevo.');
    } finally {
      setSharing(false);
    }
  }

  async function handleShareClick() {
    const shareUrl = window.location.origin;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'CarteroAI', text: SHARE_TEXT, url: shareUrl });
      } catch {
        // El usuario ha cerrado el diálogo nativo de compartir sin elegir
        // nada: no lo tratamos como un error, simplemente no desbloqueamos
        // ni pedimos confirmación.
        return;
      }
      // navigator.share solo resuelve si el usuario ha completado el envío
      // a través del selector del sistema (si cancela, cae en el catch de
      // arriba), así que esto ya es una señal más fuerte que un simple
      // clic — pero aun así pedimos la confirmación explícita, igual que
      // en el resto de canales, para ser consistentes.
      setAwaitingConfirmation(true);
      return;
    }
    setShowShareOptions((v) => !v);
  }

  function shareVia(channel: 'whatsapp' | 'x' | 'copy') {
    const shareUrl = window.location.origin;
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${shareUrl}`)}`, '_blank', 'noopener,noreferrer');
    } else if (channel === 'x') {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareUrl)}`,
        '_blank',
        'noopener,noreferrer',
      );
    } else if (channel === 'copy') {
      navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    }
    // No desbloqueamos aquí: solo se ha abierto la ventana de WhatsApp/X (o
    // copiado el enlace), no se ha confirmado que el mensaje se haya
    // enviado de verdad. Lo siguiente es pedir esa confirmación.
    setAwaitingConfirmation(true);
  }

  return (
    <div className="container-app py-10">
      <div className="mb-8">
        <p className="label-sm mb-2 text-signal-teal">Informe listo</p>
        <h1 className="font-serif text-3xl text-ink-950">Tu análisis de cartera</h1>
      </div>

      <Section title="Vista previa" subtitle={`Puntuación global: ${score.overall}/100.`}>
        <p className="mb-4 text-base font-medium leading-relaxed text-ink-950">{executiveSummary.headline}</p>
        {previewDoingWell.length > 0 && (
          <ul className="space-y-1.5 text-sm text-ink-700">
            {previewDoingWell.map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        )}

        <div className="relative mt-6 overflow-hidden rounded-lg border border-ink-100">
          <div aria-hidden className="pointer-events-none select-none space-y-3 p-5 blur-sm">
            {recommendations.slice(0, 3).map((r, i) => (
              <p key={i} className="text-sm text-ink-700">
                {r.targetLabel}: {r.why}
              </p>
            ))}
            {recommendations.length === 0 && <p className="text-sm text-ink-700">{executiveSummary.conservativeStatement}</p>}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 px-4 text-center">
            <p className="text-sm font-medium text-ink-600">
              {nonMaintainCount > 0
                ? `${nonMaintainCount} recomendación${nonMaintainCount === 1 ? '' : 'es'} personalizada${nonMaintainCount === 1 ? '' : 's'} esperándote`
                : 'El análisis completo, con el PDF descargable, está listo'}
            </p>
          </div>
        </div>
      </Section>

      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex-1 rounded-xl border border-ink-100 p-6">
          <p className="mb-1 text-sm font-semibold text-ink-950">Desbloquea el informe completo</p>
          <p className="mb-4 text-sm text-ink-600">Todas las recomendaciones, el análisis completo y el PDF descargable.</p>
          <button onClick={handlePay} disabled={paying} className="btn-primary w-full">
            {paying ? 'Redirigiendo al pago…' : 'Desbloquear por 9,99 €'}
          </button>
        </div>
        <div className="flex-1 rounded-xl border border-ink-100 p-6">
          <p className="mb-1 text-sm font-semibold text-ink-950">O consíguelo gratis</p>
          <p className="mb-4 text-sm text-ink-600">Comparte CarteroAI con un amigo y desbloquea tu informe sin pagar nada.</p>

          {!awaitingConfirmation && (
            <>
              <button onClick={handleShareClick} disabled={sharing} className="btn-secondary w-full">
                Compartir con un amigo
              </button>
              {showShareOptions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => shareVia('whatsapp')} className="btn-secondary px-3 py-1.5 text-xs">
                    WhatsApp
                  </button>
                  <button onClick={() => shareVia('x')} className="btn-secondary px-3 py-1.5 text-xs">
                    X
                  </button>
                  <button onClick={() => shareVia('copy')} className="btn-secondary px-3 py-1.5 text-xs">
                    Copiar enlace
                  </button>
                </div>
              )}
            </>
          )}

          {awaitingConfirmation && (
            <div className="rounded-lg border border-signal-teal/30 bg-signal-teal/5 p-4">
              <p className="mb-3 text-sm text-ink-700">¿Ya le has enviado el enlace a tu amigo?</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={unlockFree} disabled={sharing} className="btn-primary px-4 py-2 text-xs">
                  {sharing ? 'Desbloqueando…' : 'Sí, ya lo he compartido'}
                </button>
                <button
                  onClick={() => {
                    setAwaitingConfirmation(false);
                    setShowShareOptions(false);
                  }}
                  disabled={sharing}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Todavía no
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-signal-rose">{error}</p>}
    </div>
  );
}
