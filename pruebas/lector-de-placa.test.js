// La segunda pasada del lector de placas para fotos del video: ampliar las
// esquinas sin salirse de la foto, y quedarse con la mejor lectura.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARGENES, ampliarEsquinas, mejorLectura } from '../js/lector-de-placa.js';

const cerca = (a, b) => Math.abs(a - b) < 1e-9;

test('ampliar las esquinas las aleja de su centro, y nunca fuera de la foto', () => {
  const esquinas = [{ x: 0.4, y: 0.6 }, { x: 0.6, y: 0.6 }, { x: 0.6, y: 0.7 }, { x: 0.4, y: 0.7 }];
  const [ai, ad, bd] = ampliarEsquinas(esquinas, 1.2, 1.1);
  assert.ok(cerca(ai.x, 0.38) && cerca(ad.x, 0.62) && cerca(ai.y, 0.595) && cerca(bd.y, 0.705));
  // Una placa pegada al borde (la de la Captiva, en la foto de tres cuartos).
  const alBorde = ampliarEsquinas([{ x: 0.002, y: 0.6 }, { x: 0.06, y: 0.6 }, { x: 0.06, y: 0.7 }, { x: 0.002, y: 0.7 }], 1.25, 1.12);
  assert.equal(alBorde[0].x, 0);
  assert.ok(MARGENES.every(([fx, fy]) => fx > 1 && fy > 1));
});

test('gana la placa válida más segura; si no hay, la que más leyó', () => {
  // Lo medido con la Captiva el 13-nov-2026.
  const lecturas = [
    { placa: '', crudo: 'JRK24', confianza: 0.861 },
    { placa: 'JRK240', crudo: 'JRK240', confianza: 0.643 },
    { placa: 'JRK248', crudo: 'JRK248', confianza: 0.949 },
    { placa: 'JRK248', crudo: 'JRK248', confianza: 0.988 },
  ];
  assert.equal(mejorLectura(lecturas).confianza, 0.988);
  assert.equal(mejorLectura([null, { placa: '', crudo: 'JR', confianza: 0.9 }, { placa: '', crudo: 'JRK24', confianza: 0.5 }]).crudo, 'JRK24');
  assert.equal(mejorLectura([null, null]), null);
});
