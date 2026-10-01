import 'server-only';
import { neon } from '@neondatabase/serverless';

/**
 * Persistencia de los "pedidos" (el pago de 9,99€ que desbloquea el informe
 * completo), en la misma base de datos Postgres que ya usa la aplicación
 * para `leads` (ver lib/leads/store.ts) — misma variable de entorno
 * (DATABASE_URL/POSTGRES_URL), sin ninguna configuración nueva que hacer.
 *
 * Por qué se guarda el informe entero (`payload`) aquí: Stripe Checkout es
 * una página alojada fuera de nuestro dominio, así que al volver del pago
 * el estado de React de la página se ha perdido por completo (recarga
 * completa). Guardar aquí el análisis, la cartera y el perfil del inversor
 * — generados en el momento de llegar al muro de pago — permite reconstruir
 * el informe al volver, sin tener que repetir todo el proceso.
 *
 * El `id` de cada pedido se genera con nanoid() (alta entropía) y actúa
 * como el único control de acceso a ese informe: quien tenga el enlace
 * puede verlo, igual que con un enlace "cualquiera con el enlace" de Google
 * Docs. No hay cuentas de usuario en la aplicación, así que es el mismo
 * modelo de seguridad que ya usa el resto del producto.
 */
export interface OrderPayload {
  analysis: unknown;
  portfolio: unknown;
  profile: unknown;
}

export type OrderStatus = 'pending' | 'paid' | 'free_shared';

export interface OrderRow {
  id: string;
  status: OrderStatus;
  payload: OrderPayload;
  stripeSessionId: string | null;
}

export interface StoreResult {
  ok: boolean;
  reason?: string;
}

function getConnectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function isOrderStoreConfigured(): boolean {
  return Boolean(getConnectionString());
}

// Mismo patrón que lib/leads/store.ts: evita repetir el CREATE TABLE en
// cada petición dentro de la misma instancia "caliente" de la función
// serverless. Es idempotente (IF NOT EXISTS), así que no hay coste real en
// repetirlo entre instancias frías.
let tableEnsured = false;

// Devuelve el cliente de consultas ya listo para usar, asegurando antes la
// tabla si hiciera falta. Se evita darle un tipo explícito al cliente de
// `neon(...)` (más allá de la inferencia automática de TypeScript): con
// varias funciones en este módulo compartiendo esta ayuda, anotar el tipo a
// mano chocaba con los genéricos internos del driver de Neon sin aportar
// ninguna seguridad de tipos real.
async function getSql(connectionString: string) {
  const sql = neon(connectionString);
  if (!tableEnsured) {
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status TEXT NOT NULL DEFAULT 'pending',
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        stripe_session_id TEXT,
        payload JSONB NOT NULL
      )
    `;
    tableEnsured = true;
  }
  return sql;
}

export async function createOrder(
  id: string,
  payload: OrderPayload,
  amountCents: number,
  currency: string,
): Promise<StoreResult> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return { ok: false, reason: 'No hay ninguna base de datos Postgres conectada a este proyecto.' };
  }
  try {
    const sql = await getSql(connectionString);
    await sql`
      INSERT INTO orders (id, status, amount_cents, currency, payload)
      VALUES (${id}, 'pending', ${amountCents}, ${currency}, ${JSON.stringify(payload)}::jsonb)
    `;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al crear el pedido.' };
  }
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const connectionString = getConnectionString();
  if (!connectionString) return null;
  try {
    const sql = await getSql(connectionString);
    const rows = await sql`
      SELECT id, status, payload, stripe_session_id FROM orders WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0] as { id: string; status: OrderStatus; payload: OrderPayload; stripe_session_id: string | null } | undefined;
    if (!row) return null;
    return { id: row.id, status: row.status, payload: row.payload, stripeSessionId: row.stripe_session_id };
  } catch {
    return null;
  }
}

export async function setOrderStripeSession(id: string, stripeSessionId: string): Promise<StoreResult> {
  const connectionString = getConnectionString();
  if (!connectionString) return { ok: false, reason: 'No hay ninguna base de datos Postgres conectada a este proyecto.' };
  try {
    const sql = await getSql(connectionString);
    await sql`UPDATE orders SET stripe_session_id = ${stripeSessionId} WHERE id = ${id} AND status = 'pending'`;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al guardar la sesión de pago.' };
  }
}

// Solo transiciona pedidos todavía 'pending': si ya estaba 'paid' o
// 'free_shared' (doble clic, verificación repetida...) no hace nada y se
// trata como éxito igualmente — la operación es idempotente a propósito.
export async function markOrderPaid(id: string): Promise<StoreResult> {
  const connectionString = getConnectionString();
  if (!connectionString) return { ok: false, reason: 'No hay ninguna base de datos Postgres conectada a este proyecto.' };
  try {
    const sql = await getSql(connectionString);
    await sql`UPDATE orders SET status = 'paid' WHERE id = ${id} AND status = 'pending'`;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al confirmar el pago.' };
  }
}

export async function markOrderFreeShared(id: string): Promise<StoreResult> {
  const connectionString = getConnectionString();
  if (!connectionString) return { ok: false, reason: 'No hay ninguna base de datos Postgres conectada a este proyecto.' };
  try {
    const sql = await getSql(connectionString);
    await sql`UPDATE orders SET status = 'free_shared' WHERE id = ${id} AND status = 'pending'`;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al desbloquear el informe.' };
  }
}
