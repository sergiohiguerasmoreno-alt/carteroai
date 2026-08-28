import 'server-only';
import { JWT } from 'google-auth-library';

/**
 * Guarda leads (email de inversores) en una fila de un Google Sheet, usando
 * una cuenta de servicio de Google Cloud. Es deliberadamente la ÚNICA pieza
 * de persistencia de todo el proyecto: guarda solo el email y contexto no
 * sensible del cuestionario (objetivo, horizonte), NUNCA la cartera ni el
 * análisis financiero de la persona — eso sigue viviendo únicamente en su
 * navegador, sin tocar el servidor más que para calcularlo.
 *
 * Configuración necesaria (ver .env.example y README):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOOGLE_SHEETS_SHEET_NAME (opcional, por defecto "Leads")
 *
 * Si no está configurado, appendLead() no falla ni bloquea al usuario: solo
 * informa de que no se ha podido guardar, y la aplicación sigue
 * funcionando con normalidad (nunca se sacrifica la experiencia del
 * usuario por un fallo de un servicio de marketing).
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

function getConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Leads';

  if (!email || !rawKey || !spreadsheetId) return undefined;

  // Las claves privadas puestas en variables de entorno suelen llevar los
  // saltos de línea escapados como "\n" literales.
  const key = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  return { email, key, spreadsheetId, sheetName };
}

export function isGoogleSheetsConfigured(): boolean {
  return getConfig() !== undefined;
}

let cachedClient: JWT | undefined;
function getClient(email: string, key: string): JWT {
  if (!cachedClient) {
    cachedClient = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return cachedClient;
}

export async function appendLead(email: string, context: LeadContext): Promise<AppendLeadResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: 'Google Sheets no está configurado (faltan variables de entorno).' };
  }

  try {
    const client = getClient(config.email, config.key);
    const range = `${config.sheetName}!A:E`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

    await client.request({
      url,
      method: 'POST',
      data: {
        values: [[new Date().toISOString(), email, context.objective ?? '', context.horizonYearsApprox ?? '', context.source]],
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Error desconocido al guardar en Google Sheets.' };
  }
}
