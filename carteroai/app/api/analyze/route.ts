import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeRequestSchema } from '@/lib/validation/schemas';
import { analyzePortfolio } from '@/lib/analysis/orchestrator';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Ruta sin estado: recibe la cartera confirmada por el usuario y su perfil,
 * ejecuta todo el pipeline (datos de mercado -> cálculos -> reglas -> IA de
 * interpretación) y devuelve el análisis completo. No se guarda nada en el
 * servidor entre peticiones.
 */
export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`analyze:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de cartera o perfil no válidos.', details: parsed.error.flatten() }, { status: 400 });
  }

  const unconfirmed = parsed.data.portfolio.positions.filter((p) => !p.userConfirmed);
  if (unconfirmed.length > 0) {
    return NextResponse.json({ error: 'Todas las posiciones deben confirmarse antes de analizar la cartera.' }, { status: 400 });
  }

  try {
    const analysis = await analyzePortfolio(parsed.data.portfolio, parsed.data.profile);
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error('Error generando el análisis:', err instanceof Error ? err.message : 'error desconocido');
    return NextResponse.json({ error: 'No se ha podido completar el análisis. Inténtalo de nuevo en unos minutos.' }, { status: 500 });
  }
}
