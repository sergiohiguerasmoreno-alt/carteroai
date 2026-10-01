import { NextRequest, NextResponse } from 'next/server';
import { recordReferralHit } from '@/lib/payments/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Lo llama components/ReferralTracker.tsx, montado en la portada (app/page.tsx),
 * cuando la página se carga con `?ref=<id>` en la URL — es decir, cuando
 * alguien ha abierto el enlace de referido de un informe. No lo llama
 * nunca el propio dueño del informe al pulsar "compartir": eso solo abre
 * WhatsApp/X o copia el enlace (ver components/flow/PaywallStep.tsx). El
 * seguimiento ocurre en el otro extremo, cuando ese enlace se abre de
 * verdad en algún sitio.
 *
 * Siempre responde `{ok:true}` exista o no ese pedido, para no dar pistas
 * sobre qué ids son válidos a quien llame a este endpoint directamente.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`referral-hit:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  await recordReferralHit(params.id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
