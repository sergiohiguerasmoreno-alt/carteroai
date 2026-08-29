import { NextRequest, NextResponse } from 'next/server';
import { LeadRequestSchema } from '@/lib/validation/schemas';
import { appendLead } from '@/lib/leads/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Guarda el email del inversor (con su consentimiento explícito) antes de
 * mostrarle el informe. Es la única ruta de la aplicación que persiste
 * algo: intencionadamente, solo el email y un par de datos de contexto no
 * sensibles — nunca la cartera ni el análisis. Si el guardado falla (o no
 * está configurado), se responde igualmente ok:true a efectos de UX: no
 * bloqueamos al usuario por un fallo de un servicio de marketing, pero se
 * informa del motivo para poder diagnosticarlo en logs del servidor.
 */
export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`leads:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = LeadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email no válido o falta el consentimiento.' }, { status: 400 });
  }

  const result = await appendLead(parsed.data.email, parsed.data.context);
  if (!result.ok) {
    console.error('No se ha podido guardar el lead:', result.reason);
  }

  return NextResponse.json({ ok: true, saved: result.ok });
}
