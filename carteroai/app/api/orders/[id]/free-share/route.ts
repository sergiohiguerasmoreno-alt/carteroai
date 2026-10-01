import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/payments/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Comprueba si el pedido ya se ha desbloqueado. El propio desbloqueo ocurre
 * en app/api/orders/[id]/referral-hit — cuando alguien abre el enlace de
 * referido en otro sitio — nunca aquí: este endpoint solo lee el estado
 * actual, nunca lo cambia él mismo. Lo llama components/flow/PaywallStep.tsx
 * tanto al pulsar "Comprobar ahora" como en el sondeo automático mientras
 * esa pantalla está abierta.
 *
 * (El nombre de la ruta, "free-share", es un resto de cuando existía
 * también la opción de pago — se mantiene para no tener que borrar y
 * recrear el archivo, pero ya no hay nada "de pago" en la aplicación.)
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`check-unlock:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  const order = await getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'No se encuentra el pedido.' }, { status: 404 });
  }

  return NextResponse.json({ unlocked: order.status === 'unlocked' });
}
