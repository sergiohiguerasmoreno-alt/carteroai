import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface AiTextRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

/**
 * Llamada mínima al modelo. La capa de IA NUNCA debe usarse para calcular
 * cifras: el "system" prompt de cada caso de uso (ver lib/ai/*) exige
 * explícitamente ceñirse a los datos ya calculados que se le entregan.
 */
export async function generateText(req: AiTextRequest): Promise<string | undefined> {
  if (!isAiConfigured()) return undefined;
  try {
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
    const res = await getClient().messages.create({
      model,
      max_tokens: req.maxTokens ?? 1200,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    });
    const block = res.content.find((c) => c.type === 'text');
    return block && block.type === 'text' ? block.text : undefined;
  } catch {
    // Cualquier fallo de la IA degrada a los textos deterministas de fallback;
    // nunca debe romper la generación del informe.
    return undefined;
  }
}
