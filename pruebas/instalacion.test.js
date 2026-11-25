// Tenerla en el teléfono: en qué navegador está la persona, qué se le ofrece y qué se le dice de lo
// guardado. Lo del iPhone decide si alguien pierde su reporte: por eso está probado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AVISO_DEL_PASO_8, abiertaDesdeInicio, esAndroid, esIOS, esLocal, formaDeAgregar, notaDeLoGuardado, seBorraSolo } from '../js/instalacion.js';

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 };
const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
const MAC = { ...IPAD, maxTouchPoints: 0 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-A556E) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 };
const WINDOWS = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36', platform: 'Win32', maxTouchPoints: 10 };

test('el iPhone y el iPad (que se presenta como un Mac) sí; un Mac, un Android y un Windows con pantalla táctil, no', () => {
  assert.deepEqual([IPHONE, IPAD, MAC, ANDROID, WINDOWS].map(esIOS), [true, true, false, false, false]);
  assert.deepEqual([IPHONE, ANDROID].map(esAndroid), [false, true]);
  assert.equal(esIOS(null), false);
  assert.equal(esAndroid(null), false);
});

test('abierta desde el ícono: como lo dice Safari y como lo dicen los demás', () => {
  assert.equal(abiertaDesdeInicio({ navigator: { standalone: true } }), true);
  assert.equal(abiertaDesdeInicio({ navigator: { standalone: false }, matchMedia: () => ({ matches: false }) }), false);
  assert.equal(abiertaDesdeInicio({ navigator: {}, matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) }), true);
  assert.equal(abiertaDesdeInicio({ navigator: {} }), false);
});

test('qué se ofrece: en el iPhone se hace a mano; el botón, solo donde el navegador deja', () => {
  assert.equal(formaDeAgregar({ ios: true, desdeInicio: true }), 'ya');
  assert.equal(formaDeAgregar({ ios: true, conBoton: true }), 'iphone');
  assert.equal(formaDeAgregar({ conBoton: true }), 'boton');
  assert.equal(formaDeAgregar({}), 'menu');
});

test('solo en Safari del iPhone se borra solo, y el aviso dice qué hacer', () => {
  assert.equal(seBorraSolo({ ios: true, desdeInicio: false }), true);
  assert.equal(seBorraSolo({ ios: true, desdeInicio: true }), false);
  assert.equal(seBorraSolo({ ios: false, desdeInicio: false }), false);
  assert.match(AVISO_DEL_PASO_8, /^Compártelo hoy\./);
  assert.match(AVISO_DEL_PASO_8, /siete días/);
});

test('la nota de «Tus reportes» no le promete a nadie lo que su teléfono no cumple', () => {
  const safari = notaDeLoGuardado({ ios: true });
  assert.match(safari, /Safari los borra solo si pasan siete días/);
  const icono = notaDeLoGuardado({ ios: true, desdeInicio: true });
  assert.doesNotMatch(icono, /siete días/);
  // Desde el ícono abre vacía: si no se dice, la persona cree que perdió su reporte.
  assert.match(icono, /Los que hiciste en Safari no se ven aquí/);
  const android = notaDeLoGuardado({});
  assert.doesNotMatch(android, /Safari|siete días/);
  for (const nota of [safari, icono, android]) assert.match(nota, /comparte el expediente en PDF\.$/);
});

test('el servidor de este PC se reconoce; la página publicada, no', () => {
  assert.deepEqual(['localhost', '127.0.0.1', '[::1]', 'choque.localhost'].map(esLocal), [true, true, true, true]);
  assert.deepEqual(['joanhispanista-star.github.io', '192.168.1.10', 'localhost.example.com'].map(esLocal), [false, false, false]);
});
