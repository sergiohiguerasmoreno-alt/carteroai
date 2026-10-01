'use client';

import { useEffect, useRef, useState } from 'react';
import type { PortfolioAnalysis } from '@/lib/types';
import { Section } from '@/components/report/Section';

interface Props {
  analysis: PortfolioAnalysis;
  orderId: string;
  onUnlocked: () => void;
}

const SHARE_TEXT = 'He analizado mi cartera de inversión gratis con CarteroAI. Pruébalo tú también:';

// No hay ninguna opción de pago en la aplicación: el informe completo se
// desbloquea únicamente compartiendo CarteroAI. Este componente conserva el
// nombre "PaywallStep" (así se llamaba cuando sí existía un muro de pago)
// para no tener que borrar y volver a crear el archivo, pero no hay ningún
// "muro" aquí — solo la pantalla de "comparte para desbloquear".
//
// La parte importante está en cómo se desbloquea: NO basta con pulsar el
// botón de compartir. El enlace que se comparte lleva un identificador de
// referido (`?ref=<id>`) y el desbloqueo solo ocurre del lado del servidor
// cuando ESE enlace se abre de verdad en otro sitio (ver
// components/ReferralTracker.tsx, montado en la portada, y
// app/api/orders/[id]/referral-hit). Un clic en "compartir" aquí solo abre
// WhatsApp/X o copia el enlace — eso por sí solo nunca desbloquea nada.
export function PaywallStep({ analysis, orderId, onUnlocked }: Props) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [sharedOnce, setSharedOnce] = useState(false);
  const [notYetDetected, setNotYetDetected] = useState(false);

  const { executiveSummary, score, recommendations } = analysis;
  const previewDoingWell = executiveSummary.doingWell.slice(0, 1);
  const nonMaintainCount = recommendations.filter((r) => r.category !== 'maintain').length;

  const referralUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${orderId}` : '';

  // Guarda qué pedido es "nuestro": components/ReferralTracker.tsx lo
  // consulta para no contar como una apertura real del enlace si el propio
  // dueño del informe vuelve a abrir su enlace de referido en el mismo
  // navegador (p.ej. para comprobar que funciona). No es infalible —basta
  // con usar otro navegador o modo incógnito para saltárselo— pero evita el
  // caso más simple de autodesbloqueo accidental o deliberado.
  useEffect(() => {
    try {
      window.localStorage.setItem('carteroai-own-order', orderId);
    } catch {
      // localStorage puede no estar disponible (navegación privada,
      // almacenamiento bloqueado...): no es crítico, simplemente no se
      // aplica esa comprobación extra.
    }
  }, [orderId]);

  async function checkUnlocked(showNotYetMessage: boolean) {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/free-share`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se ha podido comprobar el estado del informe.');
      if (data.unlocked) {
        setNotYetDetected(false);
        onUnlocked();
      } else if (showNotYetMessage) {
        setNotYetDetected(true);
      }
    } catch (err) {
      if (showNotYetMessage) {
        setError(err instanceof Error ? err.message : 'No se ha podido comprobar el estado del informe.');
      }
    } finally {
      setChecking(false);
    }
  }

  // Sondeo automático: en cuanto se ha compartido al menos una vez, se
  // comprueba el estado cada pocos segundos sin que el usuario tenga que
  // pulsar nada — en cuanto su amigo abra el enlace, el informe se
  // desbloquea solo, en esta misma pantalla.
  const pollingRef = useRef(false);
  useEffect(() => {
    if (!sharedOnce) return;
    pollingRef.current = true;
    const interval = setInterval(() => {
      if (pollingRef.current) checkUnlocked(false);
    }, 5000);
    return () => {
      pollingRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedOnce]);

  async function handleShareClick() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'CarteroAI', text: SHARE_TEXT, url: referralUrl });
      } catch {
        // El usuario ha cerrado el diálogo nativo de compartir sin elegir
        // nada: no lo tratamos como si hubiera compartido.
        return;
      }
      setSharedOnce(true);
      return;
    }
    setShowShareOptions((v) => !v);
  }

  function shareVia(channel: 'whatsapp' | 'x' | 'copy') {
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${referralUrl}`)}`, '_blank', 'noopener,noreferrer');
    } else if (channel === 'x') {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(referralUrl)}`,
        '_blank',
        'noopener,noreferrer',
      );
    } else if (channel === 'copy') {
      navigator.clipboard?.writeText(referralUrl).catch(() => undefined);
    }
    setSharedOnce(true);
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

      <div className="mt-2 rounded-xl border border-ink-100 p-6">
        <p className="mb-1 text-sm font-semibold text-ink-950">Desbloquea el informe completo</p>
        <p className="mb-4 text-sm text-ink-600">
          CarteroAI es gratis. Comparte la aplicación con un amigo y, en cuanto abra tu enlace, tu informe se
          desbloqueará automáticamente — todas las recomendaciones, el análisis completo y el PDF descargable.
        </p>

        {!sharedOnce && (
          <>
            <button onClick={handleShareClick} className="btn-primary w-full">
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

        {sharedOnce && (
          <div className="rounded-lg border border-signal-teal/30 bg-signal-teal/5 p-4">
            <p className="mb-3 text-sm text-ink-700">
              En cuanto tu amigo abra el enlace que has compartido, tu informe se desbloqueará solo — no hace falta
              que hagas nada más. También puedes comprobarlo tú mismo:
            </p>
            {notYetDetected && (
              <p className="mb-3 text-sm text-signal-amber">
                Todavía no hemos detectado que se haya abierto tu enlace en otro sitio. Si ya lo has enviado, puede
                tardar unos segundos — si no, prueba a compartirlo de nuevo.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => checkUnlocked(true)} disabled={checking} className="btn-primary px-4 py-2 text-xs">
                {checking ? 'Comprobando…' : 'Comprobar ahora'}
              </button>
              <button
                onClick={() => {
                  setSharedOnce(false);
                  setShowShareOptions(false);
                  setNotYetDetected(false);
                }}
                disabled={checking}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Compartir de nuevo
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-signal-rose">{error}</p>}
    </div>
  );
}
