import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { CreateOrderRequestSchema } from '@/lib/validation/schemas';
import { createOrder, isOrderStoreConfigured } from '@/lib/payments/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Crea el "pedido" justo cuando el usuario llega a la pantalla del informe:
 * guarda el análisis, la cartera y el perfil para poder mostrarlos de nuevo
 * cuando alguien abra el enlace de referido que desbloquea el informe (ver
 * lib/payments/store.ts y app/api/orders/[id]/referral-hit) — el navegador
 * de esa otra persona arranca la aplicación desde cero, así que el estado
 * de React del usuario original no sirve para reconstruir el informe.
 *
 * Si la base de datos no está configurada, respondemos `locked: false` en
 * vez de un error: el informe se muestra directo, sin nada que compartir,
 * igual que hace el resto de la aplicación cuando un servicio opcional no
 * está disponible (ver app/api/leads/route.ts).
 */
export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`orders:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  if (!isOrderStoreConfigured()) {
    return NextResponse.json({ locked: false });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = CreateOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos del informe no válidos.' }, { status: 400 });
  }

  const orderId = nanoid();
  const result = await createOrder(orderId, parsed.data);
  if (!result.ok) {
    console.error('No se ha podido crear el pedido:', result.reason);
    // Fallo de infraestructura al crear el pedido: mejor mostrar el
    // informe directamente que dejar al usuario sin nada tras generar su
    // análisis.
    return NextResponse.json({ locked: false });
  }

  return NextResponse.json({ locked: true, orderId });
}
