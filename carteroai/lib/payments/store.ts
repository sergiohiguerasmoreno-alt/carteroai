import 'server-only';
import { neon } from '@neondatabase/serverless';

/**
 * Persistencia de los "informes bloqueados": CarteroAI no cobra nada por el
 * informe — se desbloquea compartiendo la aplicación con alguien más (ver
 * app/api/orders/[id]/referral-hit y components/ReferralTracker.tsx) — pero
 * sigue haciendo falta guardar el informe en algún sitio del lado del
 * servidor mientras tanto: el enlace de referido que se comparte vuelve a
 * cargar la aplicación desde cero en el navegador de otra persona, así que
 * el estado de React del usuario original (análisis, cartera, perfil) no
 * sirve para decidir si desbloquear o no — hace falta una fuente de verdad
 * compartida. Misma base de datos Postgres que ya usa la aplicación para
 * `leads` (ver lib/leads/store.ts) — misma variable de entorno
 * (DATABASE_URL/POSTGRES_URL), sin ninguna configuración nueva que hacer.
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

export type OrderStatus = 'pending' | 'unlocked';

export interface OrderRow {
  id: string;
  status: OrderStatus;
  payload: OrderPayload;
  referralHits: number;
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
        referral_hits INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL
      )
    `;
    tableEnsured = true;
  }
  return sql;
}

export async function createOrder(id: string, payload: OrderPayload): Promise<StoreResult> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return { ok: false, reason: 'No hay ninguna base de datos Postgres conectada a este proyecto.' };
  }
  try {
    const sql = await getSql(connectionString);
    await sql`
      INSERT INTO orders (id, status, payload)
      VALUES (${id}, 'pending', ${JSON.stringify(payload)}::jsonb)
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
      SELECT id, status, payload, referral_hits FROM orders WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0] as { id: string; status: OrderStatus; payload: OrderPayload; referral_hits: number } | undefined;
    if (!row) return null;
    return { id: row.id, status: row.status, payload: row.payload, referralHits: row.referral_hits };
  } catch {
    return null;
  }
}

/**
 * Se llama cuando alguien abre el enlace de referido de un informe (ver
 * components/ReferralTracker.tsx, montado en la portada) — no cuando el
 * propio dueño del informe pulsa "compartir". Esa es la diferencia clave:
 * un clic en "compartir" solo demuestra que alguien abrió una ventana de
 * WhatsApp/X o copió un enlace; esto demuestra que ESE enlace se ha
 * cargado de verdad en algún sitio. Sigue sin ser una prueba perfecta de
 * que ha sido "un amigo" concreto (nada que no exija cuentas de usuario
 * puede serlo), pero ya no basta con pulsar un botón: el enlace tiene que
 * abrirse en otro sitio para que esto se ejecute.
 *
 * Desbloquea el pedido en el mismo paso (si seguía 'pending') en vez de
 * exigir una llamada aparte: en cuanto se registra la primera apertura
 * real del enlace, el informe queda disponible.
 */
export async function recordReferralHit(id: string): Promise<StoreResult> {
  const connectionString = getConnectionString();
  if (!connectionString) return { ok: false, reason: 'No hay ninguna base de datos Postgres conectada a este proyecto.' };
  try {
    const sql = await getSql(connectionString);
    await sql`
      UPDATE orders
      SET referral_hits = referral_hits + 1,
          status = CASE WHEN status = 'pending' THEN 'unlocked' ELSE status END
      WHERE id = ${id}
    `;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al registrar la visita de referido.' };
  }
}
