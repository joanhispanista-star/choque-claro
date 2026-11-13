// La silueta guía: dónde se para la cámara en cada toma (en las coordenadas
// del carro de carro.js) y el contorno que sale de la mancha del 3D.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { construirCarro } from '../js/carro.js';
import { MIRA, cajaDeLaMascara, contornoDeMascara, posicionDeLaCamara } from '../js/silueta.js';

test('la toma 0 mira el frente y la 2 el lado derecho del carro', () => {
  assert.deepEqual(posicionDeLaCamara(0, { distancia: 6, altura: 1.4 }), [0, 1.4, -6]);
  assert.deepEqual(posicionDeLaCamara(2, { distancia: 6, altura: 1.4 }), [6, 1.4, 0]);
  assert.deepEqual(posicionDeLaCamara(4, { distancia: 6, altura: 1.4 }), [0, 1.4, 6]);
  assert.deepEqual(posicionDeLaCamara(6, { distancia: 6, altura: 1.4 }), [-6, 1.4, 0]);
  // Con el carro de verdad: desde la toma 0 lo más cercano es el bómper
  // delantero, y desde la 2 el espejo y las puertas DERECHAS.
  const { grupo } = construirCarro();
  grupo.updateMatrixWorld(true);
  const primeroDesde = (sector) => {
    const desde = new THREE.Vector3(...posicionDeLaCamara(sector));
    const rayo = new THREE.Raycaster(desde, new THREE.Vector3(...MIRA).sub(desde).normalize());
    const cruce = rayo.intersectObject(grupo, true).find((c) => c.object.userData.piezaId);
    return cruce && cruce.object.userData.piezaId;
  };
  assert.match(primeroDesde(0), /^(bomper-del|capo)$/);
  assert.match(primeroDesde(2), /-der$/);
  assert.match(primeroDesde(6), /-izq$/);
  assert.match(primeroDesde(4), /^(bomper-tras|baul)$/);
});

// Una mancha rectangular opaca de 6 × 4 en una imagen de 10 × 8.
function mancha() {
  const ancho = 10;
  const alto = 8;
  const rgba = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 8; x++) rgba[(y * ancho + x) * 4 + 3] = 255;
  return { rgba, ancho, alto };
}

test('la caja de la mancha, y null si no hay nada', () => {
  const { rgba, ancho, alto } = mancha();
  assert.deepEqual(cajaDeLaMascara(rgba, ancho, alto), { x1: 2, y1: 2, x2: 7, y2: 5 });
  assert.equal(cajaDeLaMascara(new Uint8ClampedArray(16), 2, 2), null);
});

test('el contorno es blanco y opaco en el borde, casi transparente adentro y vacío afuera', () => {
  const { rgba, ancho, alto } = mancha();
  const salida = contornoDeMascara(rgba, ancho, alto, { grosor: 1, relleno: 36 });
  const alfa = (x, y) => salida[(y * ancho + x) * 4 + 3];
  assert.equal(alfa(0, 0), 0);
  assert.equal(alfa(2, 2), 255); // esquina
  assert.equal(alfa(5, 2), 255); // borde de arriba
  assert.equal(alfa(3, 3), 36); // adentro
  assert.equal(alfa(4, 4), 36);
  assert.equal(alfa(7, 4), 255); // borde derecho
  assert.equal(salida[(3 * ancho + 3) * 4], 255); // blanco
});
