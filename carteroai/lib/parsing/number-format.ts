/**
 * Utilidades para interpretar números tal y como aparecen en extractos de
 * cartera (formato europeo "1.234,56" o anglosajón "1,234.56"), sin asumir
 * nunca un valor cuando el texto es ambiguo.
 */

/** Convierte un token numérico textual a número, o undefined si no es fiable. */
export function parseLocalizedNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  let s = raw.trim().replace(/\s/g, '');
  if (!s) return undefined;

  // Signo y símbolos de moneda/porcentaje ya deberían haberse retirado antes,
  // pero por seguridad los limpiamos aquí también.
  s = s.replace(/[€$£%]/g, '');
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-/, '');

  if (!/^[0-9.,]+$/.test(s)) return undefined;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // El separador decimal es el que aparece más a la derecha.
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Solo coma: decimal europeo si hay 1-2 dígitos tras ella y no es un
    // grupo de miles de 3 dígitos repetido; si hay más de un grupo de coma
    // asumimos separador de miles.
    const parts = s.split(',');
    if (parts.length === 2 && parts[1] !== undefined && parts[1].length <= 2) {
      normalized = s.replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    const parts = s.split('.');
    if (parts.length > 2) {
      // Varios puntos => separadores de miles europeos, sin decimales.
      normalized = s.replace(/\./g, '');
    } else {
      normalized = s;
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (Number.isNaN(n)) return undefined;
  return negative ? -n : n;
}

export function extractPercent(token: string): number | undefined {
  const m = token.match(/(-?[0-9.,]+)\s*%/);
  if (!m || !m[1]) return undefined;
  const n = parseLocalizedNumber(m[1]);
  if (n === undefined) return undefined;
  return n / 100;
}
