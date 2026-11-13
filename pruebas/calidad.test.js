// La revisión de calidad con imágenes hechas a mano: una textura nítida, la
// misma desenfocada o movida, una oscura. Los umbrales de verdad se calibran con
// fotos de un celular (ver calidad.js); esto prueba que las cuentas hagan lo que
// dicen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LADO_DE_REVISION, UMBRALES, aGris, bordesDeLaImagen, brilloMedio, medirFoto, nitidezEnVivo, revisarFoto, textoDeLaRevision, varianzaDelLaplaciano } from '../js/calidad.js';

// Un cuadro de celular parado (16:9) llevado a la escala de revisión.
const ANCHO = LADO_DE_REVISION;
const ALTO = Math.round((LADO_DE_REVISION * 16) / 9);

// Bloques de 6 px con grises al azar (con semilla): bordes por todas partes,
// como una escena con carros, rayas y letreros.
function textura(semilla = 7, brillo = 1) {
  let s = semilla;
  const azar = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bloques = new Map();
  const gris = new Uint8Array(ANCHO * ALTO);
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const clave = `${Math.floor(x / 6)},${Math.floor(y / 6)}`;
      if (!bloques.has(clave)) bloques.set(clave, 40 + azar() * 180);
      gris[y * ANCHO + x] = Math.round(bloques.get(clave) * brillo);
    }
  }
  return gris;
}

// Promedio de una caja de (2r+1) px: en x y en y es desenfoque; solo en x, una
// foto movida al girar.
function desenfocar(gris, radio, { soloHorizontal = false } = {}) {
  const pasar = (fuente, dx, dy) => {
    const salida = new Uint8Array(fuente.length);
    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        let suma = 0;
        let n = 0;
        for (let k = -radio; k <= radio; k++) {
          const xx = x + k * dx;
          const yy = y + k * dy;
          if (xx < 0 || yy < 0 || xx >= ANCHO || yy >= ALTO) continue;
          suma += fuente[yy * ANCHO + xx];
          n++;
        }
        salida[y * ANCHO + x] = Math.round(suma / n);
      }
    }
    return salida;
  };
  const enX = pasar(gris, 1, 0);
  return soloHorizontal ? enX : pasar(enX, 0, 1);
}

test('aGris usa la luma: el verde pesa más que el azul', () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
  assert.deepEqual([...aGris(rgba, 4, 1)], [255, 0, 149, 28]);
});

test('una imagen lisa no tiene bordes: varianza 0', () => {
  assert.equal(varianzaDelLaplaciano(new Uint8Array(100).fill(128), 10, 10), 0);
  assert.equal(varianzaDelLaplaciano(new Uint8Array(4), 2, 2), 0);
});

test('nítida pasa; desenfocada no', () => {
  const nitida = medirFoto(textura(), ANCHO, ALTO);
  const desenfocada = medirFoto(desenfocar(textura(), 3), ANCHO, ALTO);
  assert.ok(nitida.nitidez > UMBRALES.nitidez * 10, `nítida: ${nitida.nitidez}`);
  assert.ok(desenfocada.nitidez < UMBRALES.nitidez, `desenfocada: ${desenfocada.nitidez}`);
  assert.equal(revisarFoto(nitida).ok, true);
  assert.deepEqual(revisarFoto(desenfocada).problemas, ['borrosa']);
});

test('movida al girar: el laplaciano completo no la ve, el eje horizontal sí', () => {
  const nitida = bordesDeLaImagen(textura(), ANCHO, ALTO);
  for (const radio of [4, 8]) {
    const movida = desenfocar(textura(), radio, { soloHorizontal: true });
    const bordes = bordesDeLaImagen(movida, ANCHO, ALTO);
    // Lo que engañaba: las rayas horizontales siguen nítidas y sostienen el número clásico.
    assert.ok(bordes.laplaciano > UMBRALES.nitidez * 10, `laplaciano con ${radio}: ${bordes.laplaciano}`);
    assert.ok(bordes.vertical > UMBRALES.nitidez * 10, `vertical con ${radio}: ${bordes.vertical}`);
    assert.ok(bordes.horizontal < UMBRALES.nitidez, `horizontal con ${radio}: ${bordes.horizontal}`);
    assert.deepEqual(revisarFoto(medirFoto(movida, ANCHO, ALTO)).problemas, ['borrosa']);
  }
  assert.equal(varianzaDelLaplaciano(textura(), ANCHO, ALTO), nitida.laplaciano);
});

test('oscura se dice sola, aunque también salga sin bordes', () => {
  const oscura = medirFoto(textura(7, 0.12), ANCHO, ALTO);
  assert.ok(oscura.brillo < UMBRALES.brillo);
  assert.deepEqual(revisarFoto(oscura).problemas, ['oscura']);
  assert.match(textoDeLaRevision(revisarFoto(oscura)), /oscura/);
});

test('torcida, mirando al piso o al cielo: lo dice el sensor; sin sensor no se juzga', () => {
  const buena = medirFoto(textura(), ANCHO, ALTO);
  assert.deepEqual(revisarFoto({ ...buena, elevacion: -10, giro: 4 }), { ok: true, problemas: [] });
  assert.deepEqual(revisarFoto({ ...buena, elevacion: 0, giro: -20 }).problemas, ['torcida']);
  assert.deepEqual(revisarFoto({ ...buena, elevacion: -70, giro: 0 }).problemas, ['piso']);
  assert.deepEqual(revisarFoto({ ...buena, elevacion: 50, giro: 0 }).problemas, ['cielo']);
  assert.deepEqual(revisarFoto({ ...buena, elevacion: null, giro: null }), { ok: true, problemas: [] });
  assert.deepEqual(revisarFoto({ nitidez: 5, brillo: 120, giro: 30, elevacion: 0 }).problemas, ['borrosa', 'torcida']);
});

test('el brillo medio y la pastilla en vivo', () => {
  assert.equal(brilloMedio(new Uint8Array([0, 100, 200])), 100);
  assert.equal(brilloMedio(new Uint8Array(0)), 0);
  assert.equal(nitidezEnVivo(null).estado, 'neutro');
  assert.deepEqual(nitidezEnVivo({ nitidez: 500, brillo: 120 }), { texto: 'Nítida', estado: 'bien' });
  assert.equal(nitidezEnVivo({ nitidez: 10, brillo: 120 }).texto, 'Movida');
  assert.equal(nitidezEnVivo({ nitidez: 500, brillo: 10 }).texto, 'Oscura');
});
