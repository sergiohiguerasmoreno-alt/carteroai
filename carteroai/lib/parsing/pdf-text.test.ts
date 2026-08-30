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

  it('reconstruye dos tarjetas en dos columnas cuando cada una tiene sus campos repartidos en varias filas distintas (no en la misma fila que el ticker)', () => {
    // Patrón real detectado: a diferencia del caso anterior (todo en una sola
    // fila por tarjeta), aquí el nombre va en su propia fila y el peso/importe
    // en otra fila intermedia, con el ticker y la descripción en una tercera
    // fila que es la única que junta ambas tarjetas (dos tickers sueltos). Sin
    // reagrupar por bloque, el peso/nombre de cada tarjeta queda huérfano en
    // una fila que nunca se une a su ticker.
    const items = [
      // Fila de nombres (una tarjeta a la izquierda, otra a la derecha)
      item('Empresa Uno', 20, 750),
      item('Empresa Dos', 320, 750),
      // Fila de peso + importe (misma columna que su nombre)
      item('2%', 20, 730),
      item('6 €/mes', 90, 730),
      item('1.5%', 320, 730),
      item('4.50 €/mes', 390, 730),
      // Fila de ticker + descripción (la que junta las dos tarjetas: dos
      // tickers sueltos en la misma fila)
      item('ABC', 20, 710),
      item('Descripción larga uno', 60, 710),
      item('XYZ', 320, 710),
      item('Descripción larga dos', 360, 710),
    ];
    const text = reconstructPageText(items);
    expect(text.split('\n')).toEqual([
      'Empresa Uno 2% 6 €/mes ABC Descripción larga uno',
      'Empresa Dos 1.5% 4.50 €/mes XYZ Descripción larga dos',
    ]);
  });
});
