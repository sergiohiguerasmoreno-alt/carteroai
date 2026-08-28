/**
 * Red de seguridad anti-alucinación: comprueba que ninguna cifra que
 * aparezca en un texto generado por la IA sea ajena a los números que
 * realmente le hemos proporcionado como hechos. Si aparece un número no
 * reconocido, se descarta el texto completo y se usa el fallback
 * determinista. Es una salvaguarda adicional, no la única: el prompt ya
 * instruye a la IA a no inventar cifras.
 */
const NUMBER_RE = /-?\d+(?:[.,]\d+)?/g;

export function extractNumbers(text: string): number[] {
  const matches = text.match(NUMBER_RE) ?? [];
  return matches.map((m) => Number(m.replace(',', '.'))).filter((n) => Number.isFinite(n));
}

export function allNumbersKnown(text: string, allowedNumbers: number[], tolerance = 0.6): boolean {
  const found = extractNumbers(text);
  return found.every((n) => {
    // Se ignoran números pequeños (0, 1, 2...) típicos de enumeraciones o años a secas de 1-2 dígitos,
    // para no ser excesivamente estrictos con "3 posiciones", "2024", etc.
    if (Math.abs(n) <= 12) return true;
    return allowedNumbers.some((a) => Math.abs(a - n) <= tolerance || Math.abs(a - n) / Math.max(Math.abs(a), 1) <= 0.02);
  });
}
