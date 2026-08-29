import 'server-only';
import { neon } from '@neondatabase/serverless';

/**
 * Guarda los emails captados (leads) en la base de datos Postgres del
 * propio proyecto de Vercel — es la ÚNICA pieza de persistencia de toda la
 * aplicación, y guarda intencionadamente solo el email y un par de datos
 * de contexto no sensibles, nunca la cartera ni las respuestas del
 * cuestionario.
 *
 * No requiere ninguna cuenta ni credencial externa: basta con conectar una
 * base de datos Postgres al proyecto desde la pestaña "Storage" del panel
 * de Vercel (Neon, incluido en el plan gratuito). Al conectarla, Vercel
 * inyecta automáticamente las variables de entorno de conexión en el
 * despliegue — no hay ninguna clave que copiar a mano. Usamos
 * `@neondatabase/serverless` (el driver mantenido activamente por Neon;
 * `@vercel/postgres` quedó deprecado tras el paso de "Vercel Postgres" a
 * ser una integración de Neon) y leemos `DATABASE_URL` — el nombre que usa
 * la integración actual — con `POSTGRES_URL` como alternativa, porque
 * Vercel también sigue exponiendo esa variable heredada por compatibilidad
 * con proyectos que ya usaban el nombre antiguo. Si ninguna está presente,
 * este módulo se limita a devolver `ok:false` sin lanzar ningún error: el
 * resto de la aplicación sigue funcionando con normalidad (ver
 * app/api/leads/route.ts).
 */
export interface LeadContext {
  objective?: string;
  horizonYearsApprox?: number;
  source: string;
}

export interface AppendLeadResult {
  ok: boolean;
  reason?: string;
}

function getConnectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function isLeadStoreConfigured(): boolean {
  return Boolean(getConnectionString());
}

// Evita repetir el CREATE TABLE en cada petición dentro de la misma
// instancia "caliente" de la función serverless. Es idempotente (IF NOT
// EXISTS), así que repetirlo entre instancias frías no tiene coste real.
let tableEnsured = false;

export async function appendLead(email: string, context: LeadContext): Promise<AppendLeadResult> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return {
      ok: false,
      reason: 'No hay ninguna base de datos Postgres conectada a este proyecto (faltan DATABASE_URL/POSTGRES_URL).',
    };
  }

  try {
    const sql = neon(connectionString);

    if (!tableEnsured) {
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          email TEXT NOT NULL,
          objective TEXT,
          horizon_years_approx NUMERIC,
          source TEXT NOT NULL
        )
      `;
      tableEnsured = true;
    }

    await sql`
      INSERT INTO leads (email, objective, horizon_years_approx, source)
      VALUES (${email}, ${context.objective ?? null}, ${context.horizonYearsApprox ?? null}, ${context.source})
    `;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al guardar el lead.' };
  }
}
