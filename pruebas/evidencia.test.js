// La cadena de huellas: que se pueda rehacer, y que se rompa en el registro
// justo cuando alguien cambia una foto, un dato o el orden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { INICIO_DE_LA_CADENA, SIN_CRIPTO, huellaDelRegistro, registroDeFoto, sellarRegistro, sha256Hex, textoCanonico, textoDeLaCadena, verificarCadena } from '../js/evidencia.js';

const bytesDe = (texto) => new TextEncoder().encode(texto);

async function registro(indice, { rumbo = 47.04, imagen = `foto ${indice}` } = {}) {
  return registroDeFoto({
    reporte: 'r-prueba',
    paso: 'escena',
    indice,
    sector: indice,
    hora: new Date(Date.UTC(2026, 10, 17, 20, 15, indice)),
    gps: { lat: 4.648412345678, lon: -74.010498765, precision: 6.44, edadS: 1.25 },
    orientacion: { rumbo, fuente: 'iphone', precisionRumbo: 15, elevacion: -8.26, giro: 2.51 },
    calidad: { nitidez: 812.345, laplaciano: 2001.2, brillo: 121.77, problemas: [] },
    foto: { tipo: 'image/jpeg', ancho: 720, alto: 1280, bytes: 9, sha256: await sha256Hex(bytesDe(imagen)) },
  });
}

async function cadenaDe(n) {
  const registros = [];
  let anterior = INICIO_DE_LA_CADENA;
  for (let i = 0; i < n; i++) {
    const sellado = await sellarRegistro(await registro(i), anterior);
    registros.push(sellado);
    anterior = sellado.huella;
  }
  return registros;
}

const fotos = (registros, cambiada = {}) => async (r) => sha256Hex(bytesDe(cambiada[r.indice] ?? `foto ${r.indice}`));

test('sha256 da la huella conocida', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha256Hex(bytesDe('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sin crypto.subtle (por http) lo dice en vez de reventar callado', async () => {
  await assert.rejects(sha256Hex('abc', null), (e) => e.message === SIN_CRIPTO);
});

test('el texto canónico ordena las claves, no deja espacios y no acepta números rotos', () => {
  assert.equal(textoCanonico({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  assert.equal(textoCanonico({ a: 1, b: undefined }), '{"a":1}');
  assert.throws(() => textoCanonico({ a: Number.NaN }), /no válido/);
  assert.throws(() => textoCanonico([undefined]), /indefinido/);
});

test('el registro guarda los números ya redondeados, y el rumbo de 359,96° es 0', async () => {
  const r = await registro(0);
  assert.equal(r.gps.lat, 4.6484123);
  assert.equal(r.gps.lon, -74.0104988);
  assert.equal(r.gps.precision, 6.4);
  assert.equal(r.rumbo, 47);
  assert.equal(r.rumboFuente, 'iphone');
  assert.deepEqual(r.inclinacion, { elevacion: -8.3, giro: 2.5 });
  assert.deepEqual(r.calidad, { nitidez: 812.3, laplaciano: 2001.2, brillo: 121.8, problemas: [], aceptadaConProblemas: false });
  assert.equal(r.hora, '2026-11-17T20:15:00.000Z');
  assert.equal(r.reemplaza, null);
  assert.equal((await registro(0, { rumbo: 359.96 })).rumbo, 0);
  const sinSensores = registroDeFoto({ reporte: 'r', paso: 'escena', indice: 0, hora: 0, calidad: { nitidez: 1, laplaciano: 2, brillo: 3, problemas: ['borrosa'] }, foto: { tipo: 'image/jpeg', ancho: 1, alto: 1, bytes: 1, sha256: 'x' } });
  assert.equal(sinSensores.gps, null);
  assert.equal(sinSensores.rumbo, null);
  assert.equal(sinSensores.rumboFuente, null);
  assert.equal(sinSensores.inclinacion, null);
  assert.equal(sinSensores.calidad.aceptadaConProblemas, true);
});

test('una cadena sin tocar está íntegra, y la huella se puede rehacer desde el texto', async () => {
  const cadena = await cadenaDe(3);
  assert.equal(cadena[0].anterior, INICIO_DE_LA_CADENA);
  assert.equal(cadena[1].anterior, cadena[0].huella);
  assert.equal(cadena[0].huella, await huellaDelRegistro(cadena[0]));
  const { huella, ...sinHuella } = cadena[2];
  assert.equal(huella, await sha256Hex(textoCanonico(sinHuella)));
  const resultado = await verificarCadena(cadena, { huellaDeLaFoto: fotos(cadena) });
  assert.deepEqual(resultado, { integra: true, total: 3, rota: null });
  assert.match(textoDeLaCadena(resultado), /cadena de 3 huellas: ninguna foto ni dato ha cambiado/);
});

test('cambiar la imagen rompe la cadena en esa foto', async () => {
  const cadena = await cadenaDe(3);
  const resultado = await verificarCadena(cadena, { huellaDeLaFoto: fotos(cadena, { 1: 'foto retocada' }) });
  assert.deepEqual(resultado.rota, { indice: 1, motivo: 'foto' });
  assert.match(textoDeLaCadena(resultado), /registro 2: la imagen ya no es la que se tomó/);
});

test('cambiar un dato (la hora, el GPS) rompe la cadena aunque la imagen sea la misma', async () => {
  const cadena = await cadenaDe(3);
  cadena[2] = { ...cadena[2], hora: '2026-11-17T19:00:00.000Z' };
  assert.deepEqual((await verificarCadena(cadena)).rota, { indice: 2, motivo: 'datos' });
  const otra = await cadenaDe(3);
  otra[0] = { ...otra[0], gps: { ...otra[0].gps, lat: 4.7 } };
  assert.deepEqual((await verificarCadena(otra)).rota, { indice: 0, motivo: 'datos' });
});

test('quitar una foto del medio o cambiar el orden rompe la cadena', async () => {
  const cadena = await cadenaDe(4);
  assert.deepEqual((await verificarCadena([cadena[0], cadena[2], cadena[3]])).rota, { indice: 1, motivo: 'orden' });
  assert.deepEqual((await verificarCadena([cadena[1], cadena[0]])).rota, { indice: 0, motivo: 'orden' });
  // Rehacer el sello de una foto cambiada no alcanza: la siguiente apunta a la huella vieja.
  const rehecha = await sellarRegistro({ ...cadena[1], hora: '2026-11-17T19:00:00.000Z', huella: undefined }, cadena[0].huella);
  assert.deepEqual((await verificarCadena([cadena[0], rehecha, cadena[2], cadena[3]])).rota, { indice: 2, motivo: 'orden' });
});

test('una cadena vacía está íntegra', async () => {
  assert.deepEqual(await verificarCadena([]), { integra: true, total: 0, rota: null });
  assert.match(textoDeLaCadena({ integra: true, total: 1, rota: null }), /1 huella:/);
});
