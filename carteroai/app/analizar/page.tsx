'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { InvestorProfile, Portfolio, PortfolioAnalysis } from '@/lib/types';
import type { AnswerMap } from '@/lib/questions/types';
import { buildInvestorProfile } from '@/lib/questions/build-profile';
import { UploadStep } from '@/components/flow/UploadStep';
import { StagedProcessing } from '@/components/flow/StagedProcessing';
import { QuestionsStep } from '@/components/flow/QuestionsStep';
import { EmailGateStep } from '@/components/flow/EmailGateStep';
import { PaywallStep } from '@/components/flow/PaywallStep';
import { ReportView } from '@/components/report/ReportView';

type Phase = 'upload' | 'parsing' | 'questions' | 'email-gate' | 'analyzing' | 'resuming' | 'report' | 'error';

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 15);

interface OrderPayload {
  analysis: PortfolioAnalysis;
  portfolio: Portfolio;
  profile: InvestorProfile;
}

export default function AnalizarPage() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [groupIndex, setGroupIndex] = useState(0);
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  // `orderId` identifica el informe bloqueado asociado a este análisis;
  // `unlocked` decide si se muestra el informe completo (ReportView) o solo
  // la vista previa con la opción de compartir (ver PaywallStep). Si la
  // base de datos de pedidos no está configurada, nunca se crea un pedido y
  // `unlocked` se queda en `true` desde el principio (informe sin bloquear)
  // — ver handleEmailSubmit.
  const [orderId, setOrderId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(true);

  // Si el usuario vuelve a /analizar?order=... (p.ej. guardó el enlace para
  // continuar más tarde, o recargó la página), recuperamos el pedido por su
  // id en vez de repetir todo el proceso de subida + cuestionario — ver
  // app/api/orders/[id].
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resumeOrderId = params.get('order');
    if (!resumeOrderId) return;

    window.history.replaceState(null, '', window.location.pathname);
    setPhase('resuming');

    (async () => {
      try {
        const res = await fetch(`/api/orders/${resumeOrderId}`);
        if (!res.ok) {
          setPhase('upload');
          return;
        }
        const data = await res.json();
        applyOrderPayload(data.payload as OrderPayload);
        setOrderId(resumeOrderId);
        setUnlocked(data.status === 'unlocked');
        setPhase('report');
      } catch {
        setPhase('upload');
      }
    })();
    // Solo debe ejecutarse una vez al montar, leyendo la URL inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyOrderPayload(payload: OrderPayload) {
    setPortfolio(payload.portfolio);
    setProfile(payload.profile);
    setAnalysis(payload.analysis);
  }

  async function handleFileSelected(file: File) {
    setErrorMessage(null);
    setPhase('parsing');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? 'No se ha podido procesar el PDF.');
        setPhase('upload');
        return;
      }

      // No hay pantalla de confirmación manual: las posiciones extraídas se
      // dan por buenas directamente. Aun así, nunca pasamos a analizar una
      // cartera vacía o con nombres vacíos (el motor de cálculo y el
      // esquema de validación de /api/analyze exigen al menos una posición
      // con nombre) — si la extracción no ha producido nada usable, se
      // informa con un error claro en vez de seguir con un análisis vacío.
      const portfolioData = data.portfolio as Portfolio;
      const usablePositions = portfolioData.positions.filter((p) => p.name.trim().length > 0);
      if (usablePositions.length === 0) {
        setErrorMessage(
          'No hemos podido identificar posiciones en este PDF. Prueba con otro archivo (por ejemplo, el extracto de posiciones de tu bróker o banco en formato tabla).',
        );
        setPhase('upload');
        return;
      }

      setPortfolio({
        ...portfolioData,
        positions: usablePositions.map((p) => ({ ...p, userConfirmed: true })),
      });
      setPhase('questions');
    } catch {
      setErrorMessage('No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
      setPhase('upload');
    }
  }

  function handleQuestionsComplete() {
    const builtProfile = buildInvestorProfile(answers);
    setProfile(builtProfile);
    setPhase('email-gate');
  }

  async function handleEmailSubmit(email: string) {
    if (!portfolio || !profile) return;
    setEmailSubmitting(true);

    // El guardado del email no debe bloquear nunca el análisis: si falla o
    // tarda, seguimos igualmente. Es un intento best-effort de captación,
    // nunca un requisito técnico para que la app funcione.
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        consent: true,
        context: { objective: profile.objective, horizonYearsApprox: profile.horizonYearsApprox, source: 'analizar' },
      }),
    }).catch(() => undefined);

    setPhase('analyzing');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio, profile }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? 'No se ha podido completar el análisis.');
        setPhase('error');
        return;
      }
      const newAnalysis = data.analysis as PortfolioAnalysis;
      setAnalysis(newAnalysis);

      // Crea el pedido que decide si el informe se enseña directo (p.ej. si
      // la base de datos no está configurada) o bloqueado hasta compartir.
      // Un fallo aquí no debe dejar al usuario sin nada tras generar su
      // análisis: ante cualquier problema, se enseña el informe directo.
      try {
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysis: newAnalysis, portfolio, profile }),
        });
        const orderData = await orderRes.json();
        if (orderRes.ok && orderData.locked && orderData.orderId) {
          setOrderId(orderData.orderId);
          setUnlocked(false);
          // Deja constancia de qué pedido es "nuestro" para que, si más
          // tarde abrimos nuestro propio enlace de referido en este mismo
          // navegador, no cuente como si lo hubiera abierto otra persona
          // (ver components/ReferralTracker.tsx).
          try {
            window.localStorage.setItem('carteroai-own-order', orderData.orderId);
          } catch {
            // No crítico si no está disponible.
          }
        } else {
          setUnlocked(true);
        }
      } catch {
        setUnlocked(true);
      }

      setPhase('report');
    } catch {
      setErrorMessage('No se ha podido conectar con el servidor. Inténtalo de nuevo en unos minutos.');
      setPhase('error');
    } finally {
      setEmailSubmitting(false);
    }
  }

  function restart() {
    setPortfolio(null);
    setAnswers({});
    setGroupIndex(0);
    setProfile(null);
    setAnalysis(null);
    setErrorMessage(null);
    setOrderId(null);
    setUnlocked(true);
    setPhase('upload');
  }

  if (phase === 'resuming') {
    return <StagedProcessing title="Recuperando tu informe…" stages={['Comprobando el estado', 'Preparando tu informe']} stepDurationMs={900} />;
  }

  if (phase === 'upload') {
    return <UploadStep onFileSelected={handleFileSelected} maxSizeMb={MAX_UPLOAD_MB} errorMessage={errorMessage} />;
  }

  if (phase === 'parsing') {
    return (
      <StagedProcessing
        title="Analizando tu cartera…"
        stages={['Extrayendo posiciones', 'Identificando activos', 'Analizando composición', 'Preparando preguntas', 'Consultando información actualizada']}
      />
    );
  }

  if (phase === 'questions') {
    return (
      <QuestionsStep
        answers={answers}
        onAnswersChange={setAnswers}
        groupIndex={groupIndex}
        onGroupIndexChange={setGroupIndex}
        onComplete={handleQuestionsComplete}
      />
    );
  }

  if (phase === 'email-gate') {
    return <EmailGateStep onSubmit={handleEmailSubmit} submitting={emailSubmitting} />;
  }

  if (phase === 'analyzing') {
    return (
      <StagedProcessing
        title="Preparando tu informe…"
        stages={['Valorando tu cartera', 'Comparando con el mercado', 'Analizando riesgo y diversificación', 'Aplicando el motor de recomendaciones', 'Redactando el resumen']}
        stepDurationMs={1600}
      />
    );
  }

  if (phase === 'report' && analysis && portfolio && profile) {
    if (!unlocked && orderId) {
      return <PaywallStep analysis={analysis} orderId={orderId} onUnlocked={() => setUnlocked(true)} />;
    }
    return <ReportView analysis={analysis} portfolio={portfolio} profile={profile} onRestart={restart} />;
  }

  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="mb-3 font-serif text-2xl text-ink-950">No hemos podido completar el análisis</h1>
      <p className="mb-6 max-w-md text-sm text-ink-600">{errorMessage ?? 'Ha ocurrido un error inesperado.'}</p>
      <div className="flex gap-3">
        <button onClick={restart} className="btn-primary">
          Empezar de nuevo
        </button>
        <Link href="/" className="btn-secondary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
