export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCurrency(value: number, currency: string, locale = 'es-ES'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

export function formatNumber(value: number, decimals = 2, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(value);
}
