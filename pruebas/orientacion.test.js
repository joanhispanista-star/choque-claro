// Hacia dónde mira la cámara y qué tan derecha está, con orientaciones que se
// pueden comprobar a mano (celular parado mirando al norte, de lado, torcido…).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conSigno, inclinacionDeLaCamara, lecturaDeOrientacion, normalizar, rumboDeLaCamara, suavizarRumbo } from '../js/orientacion.js';

const cerca = (real, esperado, tolerancia = 1e-6) => assert.ok(Math.abs(conSigno(real - esperado)) < tolerancia, `${real} no es ${esperado}`);

test('celular parado: la cámara mira hacia 360 − alpha', () => {
  cerca(rumboDeLaCamara(0, 90, 0), 0); // norte
  cerca(rumboDeLaCamara(90, 90, 0), 270); // alpha crece al revés del reloj: oeste
  cerca(rumboDeLaCamara(270, 90, 0), 90); // este
  cerca(rumboDeLaCamara(135, 90, 0), 225);
});

test('mirando un poco al piso o al cielo, el rumbo no cambia', () => {
  cerca(rumboDeLaCamara(270, 60, 0), 90);
  cerca(rumboDeLaCamara(270, 115, 0), 90);
});

test('acostado (mirando recto al piso) no hay rumbo, ni sin sensor', () => {
  assert.equal(rumboDeLaCamara(0, 0, 0), null);
  assert.equal(rumboDeLaCamara(0, 5, 3), null);
  assert.equal(rumboDeLaCamara(null, 90, 0), null);
  assert.equal(rumboDeLaCamara(undefined, undefined, undefined), null);
});

test('derecho y a la altura de los ojos: elevación 0 y giro 0', () => {
  const i = inclinacionDeLaCamara(90, 0);
  cerca(i.elevacion, 0);
  cerca(i.giro, 0);
});

test('la elevación: hacia arriba es positiva, hacia el piso negativa', () => {
  cerca(inclinacionDeLaCamara(110, 0).elevacion, 20);
  cerca(inclinacionDeLaCamara(60, 0).elevacion, -30);
  cerca(inclinacionDeLaCamara(0, 0).elevacion, -90); // acostado, cámara al piso
});

test('torcido 20° a la derecha da giro −20, sin importar cómo reparta el navegador los ángulos', () => {
  // El mismo celular (parado, mirando al norte, girado 20° como un timón)
  // escrito de las dos formas que permite la norma.
  for (const [alpha, beta, gamma] of [[270, 70, 90], [90, 110, -90]]) {
    const i = inclinacionDeLaCamara(beta, gamma);
    cerca(i.giro, -20);
    cerca(i.elevacion, 0);
    cerca(rumboDeLaCamara(alpha, beta, gamma), 0);
  }
});

test('de lado: con la pantalla girada no está torcida; con la pantalla bloqueada en vertical, sí', () => {
  // Arriba del celular hacia la izquierda, mirando al norte.
  cerca(rumboDeLaCamara(90, 0, -90), 0);
  cerca(inclinacionDeLaCamara(0, -90, 90).giro, 0);
  cerca(inclinacionDeLaCamara(0, -90, 0).giro, 90);
  cerca(inclinacionDeLaCamara(0, -90, 270).giro, 180);
});

test('iPhone: el rumbo es webkitCompassHeading, con su precisión', () => {
  const l = lecturaDeOrientacion({ type: 'deviceorientation', alpha: 12, beta: 90, gamma: 0, webkitCompassHeading: 45.5, webkitCompassAccuracy: 10 });
  assert.equal(l.rumbo, 45.5);
  assert.equal(l.fuente, 'iphone');
  assert.equal(l.precisionRumbo, 10);
  cerca(l.giro, 0);
});

test('iPhone con la brújula sin calibrar: se dice, no se usa', () => {
  const l = lecturaDeOrientacion({ webkitCompassHeading: 200, webkitCompassAccuracy: -1, beta: 90, gamma: 0 });
  assert.equal(l.rumbo, null);
  assert.equal(l.brujulaDudosa, true);
});

test('Android: solo el evento absoluto da rumbo; el relativo sí da la inclinación', () => {
  const absoluto = lecturaDeOrientacion({ type: 'deviceorientationabsolute', alpha: 90, beta: 90, gamma: 0 });
  cerca(absoluto.rumbo, 270);
  assert.equal(absoluto.fuente, 'android');
  const relativo = lecturaDeOrientacion({ type: 'deviceorientation', absolute: false, alpha: 90, beta: 80, gamma: 0 });
  assert.equal(relativo.rumbo, null);
  cerca(relativo.elevacion, -10);
});

test('un computador sin sensores manda todo en null: no hay nada', () => {
  const l = lecturaDeOrientacion({ type: 'deviceorientation', alpha: null, beta: null, gamma: null, absolute: false });
  assert.deepEqual(l, { rumbo: null, fuente: null, precisionRumbo: null, brujulaDudosa: false, elevacion: null, giro: null });
});

test('suavizar la brújula pasando por el norte no da 180', () => {
  assert.equal(suavizarRumbo(null, 30), 30);
  cerca(suavizarRumbo(359, 1, 0.5), 0);
  cerca(suavizarRumbo(10, 350, 0.5), 0);
  cerca(suavizarRumbo(90, 100, 0.3), 93);
  assert.equal(normalizar(-90), 270);
  assert.equal(conSigno(270), -90);
});
