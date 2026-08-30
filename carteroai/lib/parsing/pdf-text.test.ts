import { describe, expect, it } from 'vitest';
import { reconstructPageText, type TextItemLike } from './pdf-text';

function item(str: string, x: number, y: number): TextItemLike {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

describe('reconstructPageText', () => {
  it('reconstruye líneas de una sola columna en orden de arriba a abajo', () => {
    const items = [item('Segunda línea', 20, 700), item('Primera línea', 20, 750)];
    const text = reconstructPageText(items);
    expect(text.split('\n')).toEqual(['Primera línea', 'Segunda línea']);
  });

  it('une en una sola línea varios fragmentos de una misma fila de tabla (nombre + peso + importe)', () => {
    // Caso real y frecuente: una tabla de una sola posición por fila, con
    // varios campos como fragmentos de texto independientes a distinta X.
    // No debe partirse solo por tener varios fragmentos.
    const items = [item('Fondo Genérico Global', 20, 700), item('34%', 300, 700), item('102 €/mes', 450, 700)];
    const text = reconstructPageText(items);
    expect(text.split('\n')).toEqual(['Fondo Genérico Global 34% 102 €/mes']);
  });

  it('separa en dos líneas una fila que mezcla dos tarjetas de posición distintas (dos tickers sueltos)', () => {
    // Maquetación en dos columnas: dos tarjetas de posición con la misma
    // altura de fila acaban en el mismo grupo por coordenada Y. La señal de
    // que son dos posiciones, no una, es que hay dos tokens cortos en
    // mayúsculas (tickers) sueltos en la misma fila.
    const items = [
      item('CGG', 20, 700),
      item('Descripción de la primera tarjeta', 60, 700),
      item('2.5%', 250, 700),
      item('XYZ', 320, 700),
      item('2.5%', 520, 700),
    ];
    const text = reconstructPageText(items);
    expect(text.split('\n')).toEqual(['CGG Descripción de la primera tarjeta 2.5%', 'XYZ 2.5%']);
  });

  it('no separa una fila con un único ticker suelto (no hay una segunda tarjeta que separar)', () => {
    const items = [item('CGG', 20, 700), item('Descripción de una sola tarjeta', 60, 700), item('2.5%', 500, 700)];
    const text = reconstructPageText(items);
    expect(text.split('\n')).toEqual(['CGG Descripción de una sola tarjeta 2.5%']);
  });

  it('no confunde una palabra corta en mayúsculas de la lista de exclusión (p.ej. una divisa) con un segundo ticker', () => {
    const items = [item('CGG', 20, 700), item('Importe en', 60, 700), item('EUR', 250, 700), item('2.5%', 500, 700)];
    const text = reconstructPageText(items);
    expect(text.split('\n')).toEqual(['CGG Importe en EUR 2.5%']);
  });
});
