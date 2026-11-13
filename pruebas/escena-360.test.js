// La escena en 360°: dónde va cada foto, la geometría del cilindro (comprobada
// con la matriz de rotateY de CSS, no con el mismo código) y lo que se dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPO_DE_LA_FOTO, CAMPO_DEL_VISOR, geometriaDelVisor, gradosPorPixel, panelDeFrente, panelesDelCirculo, textoDeLaFoto, transformacionDelPanel } from '../js/escena-360.js';

const foto = (indice, rumbo, extra = {}) => ({ id: 100 + indice, registro: { paso: 'escena', indice, rumbo, hora: '2026-11-12T22:16:00.000Z', gps: { lat: 4.6484, lon: -74.0105, precision: 6 }, huella: 'a1b2c3d4e5f6', calidad: { aceptadaConProblemas: false }, ...extra } });

test('con brújula, cada foto va en su rumbo, en el orden en que se tomó', () => {
  const { paneles, conBrujula } = panelesDelCirculo([foto(1, 50), foto(0, 3), foto(2, 361), { id: 9, registro: { paso: 'carro', indice: 0, rumbo: 10 } }]);
  assert.equal(conBrujula, true);
  assert.deepEqual(paneles.map((p) => [p.indice, p.angulo]), [[0, 3], [1, 50], [2, 1]]);
});

test('si a una le falta el rumbo, todas van en orden cada 45°, y se dice', () => {
  const { paneles, conBrujula } = panelesDelCirculo([foto(0, 3), foto(1, null), foto(2, 100)]);
  assert.equal(conBrujula, false);
  assert.deepEqual(paneles.map((p) => p.angulo), [0, 45, 90]);
  assert.deepEqual(panelesDelCirculo([]), { paneles: [], conBrujula: false });
});

test('la geometría: el visor ve 70°, cada foto ocupa 50° del círculo', () => {
  const g = geometriaDelVisor(360);
  // El borde del visor queda a 35° del centro: tan(35°) = (360/2) / perspectiva.
  assert.ok(Math.abs((Math.atan(180 / g.perspectiva) * 180) / Math.PI - CAMPO_DEL_VISOR / 2) < 1e-9);
  // Desde el centro del círculo, un panel subtiende 50°.
  assert.ok(Math.abs(((2 * Math.atan(g.anchoPanel / 2 / g.radio)) * 180) / Math.PI - CAMPO_DE_LA_FOTO) < 1e-9);
  assert.ok(Math.abs(g.altoPanel / g.anchoPanel - 4 / 3) < 1e-9);
});

test('el este queda a la derecha del norte (la matriz de rotateY de CSS)', () => {
  // rotateY(a) lleva (x, y, z) a (x cos a + z sen a, y, -x sen a + z cos a).
  const ubicar = (transformacion) => {
    const [, grados, radio] = /rotateY\((-?[\d.]+)deg\) translateZ\((-?[\d.]+)px\)/.exec(transformacion).map(Number);
    const a = (grados * Math.PI) / 180;
    return { x: radio * Math.sin(a), z: radio * Math.cos(a) };
  };
  const norte = ubicar(transformacionDelPanel(0, 100));
  const este = ubicar(transformacionDelPanel(90, 100));
  assert.ok(Math.abs(norte.x) < 1e-9 && norte.z < 0, 'el norte, al frente (z negativo)');
  assert.ok(este.x > 99 && Math.abs(este.z) < 1e-9, 'el este, a la derecha (x positivo)');
});

test('la foto de frente es la de rumbo más cercano, también cruzando el norte', () => {
  const { paneles } = panelesDelCirculo([foto(0, 350), foto(1, 40), foto(2, 180)]);
  assert.equal(panelDeFrente(paneles, 5).indice, 0);
  assert.equal(panelDeFrente(paneles, 30).indice, 1);
  assert.equal(panelDeFrente(paneles, 200).indice, 2);
  assert.equal(panelDeFrente([], 10), null);
});

test('arrastrar todo el ancho gira lo que ve el visor', () => {
  assert.ok(Math.abs(gradosPorPixel(350) * 350 - CAMPO_DEL_VISOR) < 1e-9);
});

test('el texto de la foto: hora de Colombia, rumbo, GPS, huella corta y si se aceptó sin pasar', () => {
  assert.equal(textoDeLaFoto(foto(2, 135).registro), 'Foto 3 · 5:16 p. m. · hacia el sureste (135°) · GPS ±6 m · huella a1b2c3d4…');
  const mala = foto(0, null, { gps: null, calidad: { aceptadaConProblemas: true } }).registro;
  assert.equal(textoDeLaFoto(mala, { conBrujula: false }), 'Foto 1 · 5:16 p. m. · sin GPS · huella a1b2c3d4… · aceptada sin pasar la revisión');
});
