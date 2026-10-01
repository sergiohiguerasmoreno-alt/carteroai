import { NextRequest, NextResponse } from 'next/server';
import { getOrder, markOrderFreeShared } from '@/lib/payments/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Desbloquea el informe gratis tras compartir CarteroAI (el "100% de
 * descuento" prometido en la interfaz). No hay forma fiable de comprobar
 * del lado del servidor que alguien ha compartido de verdad un enlace
 * fuera de nuestro control (WhatsApp, X, portapapeles...), así que esto
 * sigue siendo, en el fondo, un sistema de confianza. Para que no se quede
 * en "pulsar un botón", el cliente (ver PaywallStep.tsx) no llama a este
 * endpoint en el mismo clic que abre WhatsApp/X o copia el enlace: primero
 * exige abrir ese canal y luego una confirmación explícita y separada
 * ("¿ya se lo has enviado a tu amigo?") antes de pedir el desbloqueo aquí.
 * Es una fricción deliberada, no una verificación real — queda documentado
 * para que quede claro que es una decisión consciente, no un descuido.
 *
 * Lo que sí se hace cumplir en el servidor (no en el cliente, donde
 * cualquiera podría manipularlo) es que cada pedido solo se puede
 * desbloquear una vez.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`free-share:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  const order = await getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'No se encuentra el pedido.' }, { status: 404 });
  }

  if (order.status === 'paid' || order.status === 'free_shared') {
    return NextResponse.json({ unlocked: true });
  }

  const result = await markOrderFreeShared(order.id);
  if (!result.ok) {
    console.error('No se ha podido desbloquear el pedido gratis:', result.reason);
    return NextResponse.json({ error: 'No se ha podido desbloquear el informe. Inténtalo de nuevo.' }, { status: 500 });
  }

  return NextResponse.json({ unlocked: true });
}
