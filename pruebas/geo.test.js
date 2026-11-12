import test from 'node:test';
import assert from 'node:assert/strict';
import { diferenciaAngular, numero, planoLocal, proyectarEnSegmento, puntoCardinal, rumbo } from '../js/geo.js';

test('el plano local va y vuelve sin perder nada', () => {
  const plano = planoLocal({ lat: 4.65, lon: -74.05 });
  const p = { lat: 4.6512, lon: -74.0487 };
  const vuelta = plano.aGrados(plano.aMetros(p));
  assert.ok(Math.abs(vuelta.lat - p.lat) < 1e-12 && Math.abs(vuelta.lon - p.lon) < 1e-12);
  // Un milésimo de grado de latitud son unos 111 m en cualquier parte.
  assert.ok(Math.abs(plano.aMetros({ lat: 4.651, lon: -74.05 }).y - 111.2) < 0.2);
});

test('proyectar en un segmento', () => {
  const r = proyectarEnSegmento({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
  assert.deepEqual(r, { punto: { x: 5, y: 0 }, t: 0.5, distancia: 3 });
  assert.equal(proyectarEnSegmento({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }).distancia, 5);
});

test('rumbos, diferencias y puntos cardinales', () => {
  assert.equal(rumbo({ x: 0, y: 0 }, { x: 0, y: 1 }), 0);
  assert.equal(rumbo({ x: 0, y: 0 }, { x: 1, y: 0 }), 90);
  assert.equal(rumbo({ x: 0, y: 0 }, { x: -1, y: 0 }), 270);
  assert.equal(diferenciaAngular(10, 350), 20);
  assert.equal(diferenciaAngular(0, 180), 180);
  assert.equal(diferenciaAngular(90, 90), 0);
  assert.equal(puntoCardinal(0), 'norte');
  assert.equal(puntoCardinal(251), 'oeste-suroeste');
  assert.equal(puntoCardinal(359), 'norte');
  assert.equal(puntoCardinal(-90), 'oeste');
});

test('números con coma decimal', () => {
  assert.equal(numero(0.1, 1), '0,1');
  assert.equal(numero(18.68, 1), '18,7');
  assert.equal(numero(13), '13');
});
