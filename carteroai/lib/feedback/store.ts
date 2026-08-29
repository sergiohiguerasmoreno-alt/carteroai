import 'server-only';
import { neon } from '@neondatabase/serverless';

/**
 * Guarda la valoración del informe (¿te ha resultado útil?) y, si el
 * usuario ha querido añadirlo, un comentario breve. Usa la misma base de
 * datos Postgres (Neon) que ya conecta lib/leads/store.ts, con su propia
 * tabla — no guarda ningún dato personal ni la cartera del usuario, solo
 * la valoración, el comentario opcional y a qué informe corresponde.
 */
export interface AppendFeedbackResult {
  ok: boolean;
  reason?: string;
}

function getConnectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function isFeedbackStoreConfigured(): boolean {
  return Boolean(getConnectionString());
}

// Igual que en lib/leads/store.ts: evita repetir el CREATE TABLE en cada
// petición dentro de la misma instancia "caliente" de la función
// serverless. Es idempotente (IF NOT EXISTS).
let tableEnsured = false;

export async function appendFeedback(reportId: string, helpful: boolean, comment?: string): Promise<AppendFeedbackResult> {
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
        CREATE TABLE IF NOT EXISTS feedback (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          report_id TEXT NOT NULL,
          helpful BOOLEAN NOT NULL,
          comment TEXT
        )
      `;
      tableEnsured = true;
    }

    await sql`
      INSERT INTO feedback (report_id, helpful, comment)
      VALUES (${reportId}, ${helpful}, ${comment ?? null})
    `;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al guardar el feedback.' };
  }
}
