import { describe, expect, it } from 'vitest';
import { parseLocalizedNumber, extractPercent } from './number-format';

describe('parseLocalizedNumber', () => {
  it('parsea formato europeo con miles y decimales', () => {
    expect(parseLocalizedNumber('10.248,00')).toBeCloseTo(10248);
    expect(parseLocalizedNumber('1.234.567,89')).toBeCloseTo(1234567.89);
  });

  it('parsea formato anglosajón con miles y decimales', () => {
    expect(parseLocalizedNumber('10,248.00')).toBeCloseTo(10248);
  });

  it('parsea enteros largos sin separador de miles', () => {
    expect(parseLocalizedNumber('1200')).toBe(1200);
    expect(parseLocalizedNumber('49000')).toBe(49000);
  });

  it('parsea decimales simples con coma europea', () => {
    expect(parseLocalizedNumber('85,40')).toBeCloseTo(85.4);
  });

  it('parsea decimales simples con punto', () => {
    expect(parseLocalizedNumber('85.40')).toBeCloseTo(85.4);
  });

  it('parsea un entero con separador de miles de un solo punto y sin decimales ("1.500" = mil quinientos, no 1,5)', () => {
    expect(parseLocalizedNumber('1.500')).toBe(1500);
    expect(parseLocalizedNumber('16.875')).toBe(16875);
  });

  it('no confunde un decimal de un solo dígito o de dos con separador de miles', () => {
    expect(parseLocalizedNumber('11.5')).toBeCloseTo(11.5);
    expect(parseLocalizedNumber('11.25')).toBeCloseTo(11.25);
  });

  it('gestiona negativos y paréntesis contables', () => {
    expect(parseLocalizedNumber('-120,50')).toBeCloseTo(-120.5);
    expect(parseLocalizedNumber('(120,50)')).toBeCloseTo(-120.5);
  });

  it('devuelve undefined para texto no numérico', () => {
    expect(parseLocalizedNumber('abc')).toBeUndefined();
    expect(parseLocalizedNumber('')).toBeUndefined();
  });
});

describe('extractPercent', () => {
  it('extrae un porcentaje europeo de un token', () => {
    expect(extractPercent('45,2%')).toBeCloseTo(0.452);
  });
});
