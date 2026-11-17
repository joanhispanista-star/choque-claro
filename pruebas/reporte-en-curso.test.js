// El reporte en curso que comparten la escena, los carros y los daños: una
// sola cadena con las fotos de los tres pasos, y lo declarado (carros, daños)
// guardado aparte sin que un paso le borre lo suyo al otro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { abrirBaseDelReporte } from '../js/reporte-bd.js';
import { OTRO_REPORTE, crearReporteEnCurso } from '../js/reporte-en-curso.js';
import { registroDeFoto } from '../js/evidencia.js';

let reloj = new Date('2026-11-18T15:00:00Z');
let n = 0;
const abrirBase = () => abrirBaseDelReporte({ indexedDB: new IDBFactory(), reloj: () => reloj, nuevoId: () => `r${++n}` });
// En Node no hay lienzo: la "reducción" deja la foto como está.
const reducir = async (blob) => ({ foto: blob, miniatura: blob, ancho: 4, alto: 3 });
const urls = { createObjectURL: () => 'blob:prueba', revokeObjectURL: () => {} };

const toma = (texto) => ({
  blob: new Blob([texto], { type: 'image/jpeg' }),
  hora: reloj,
  gps: { lat: 4.6, lon: -74.1, precision: 8, hora: reloj },
  orientacion: { rumbo: 90, fuente: 'android', precisionRumbo: null, elevacion: -5, giro: 1 },
  medida: { nitidez: 400, laplaciano: 900, brillo: 120 },
  revision: { ok: true, problemas: [] },
});

test('la escena, un carro y un daño quedan en UNA cadena íntegra', async () => {
  const reporte = crearReporteEnCurso({ abrirBase, reducir, urls });
  await reporte.cargar();
  await reporte.agregarFoto(toma('escena'), { paso: 'escena', sector: 0 });
  await reporte.agregarFoto(toma('frente A'), { paso: 'carro', sector: 0, carro: 'A' });
  await reporte.agregarFoto(toma('bómper A'), { paso: 'danos', carro: 'A', pieza: 'bomper-del', dano: 'abolladura' });
  const registros = reporte.registros();
  assert.deepEqual(registros.map((r) => [r.indice, r.paso, r.carro ?? null, r.pieza ?? null, r.dano ?? null]), [
    [0, 'escena', null, null, null],
    [1, 'carro', 'A', null, null],
    [2, 'danos', 'A', 'bomper-del', 'abolladura'],
  ]);
  // La de la escena no trae las claves nuevas: su huella sale igual que antes.
  assert.ok(!('carro' in registros[0]) && !('pieza' in registros[0]));
  assert.equal(registros[1].anterior, registros[0].huella);
  assert.deepEqual(await reporte.revisarCadena(), { integra: true, total: 3, rota: null });
  // Al volver a entrar (otra pantalla), la cadena se lee igual de la base.
  await reporte.cargar();
  assert.equal(reporte.registros().length, 3);
});

test('los carros y los daños se guardan sin pisarse, y no se puede cambiar el id', async () => {
  const reporte = crearReporteEnCurso({ abrirBase, reducir, urls });
  const inicial = await reporte.cargar();
  await reporte.guardarDatos({ carros: [{ letra: 'A' }] });
  await reporte.guardarDatos({ danos: [{ carro: 'A', pieza: 'capo', tipo: 'roto' }], id: 'otro', creado: 'ayer' });
  const guardado = await reporte.cargar();
  assert.equal(guardado.id, inicial.id);
  assert.equal(guardado.creado, inicial.creado);
  assert.deepEqual(guardado.carros, [{ letra: 'A' }]);
  assert.deepEqual(guardado.danos, [{ carro: 'A', pieza: 'capo', tipo: 'roto' }]);
  // Una foto guardada después no le quita los datos al reporte.
  await reporte.agregarFoto(toma('escena'), { paso: 'escena', sector: 0 });
  assert.deepEqual((await reporte.cargar()).carros, [{ letra: 'A' }]);
});

test('el registro solo lleva carro, pieza y daño cuando se dan', () => {
  const comun = { reporte: 'r', indice: 0, hora: reloj, calidad: { nitidez: 1, laplaciano: 1, brillo: 1, problemas: [] }, foto: { tipo: 'image/jpeg', ancho: 1, alto: 1, bytes: 1, sha256: 'x' } };
  const escena = registroDeFoto({ ...comun, paso: 'escena', sector: 2 });
  assert.deepEqual(Object.keys(escena).filter((k) => ['carro', 'pieza', 'dano'].includes(k)), []);
  const dano = registroDeFoto({ ...comun, paso: 'danos', carro: 'B', pieza: 'espejo-der', dano: 'suelto' });
  assert.equal(dano.carro, 'B');
  assert.equal(dano.pieza, 'espejo-der');
  assert.equal(dano.dano, 'suelto');
  assert.equal(dano.sector, null);
});

// --- «Tus reportes» (desde el 17-nov-2026) ------------------------------------------------------

// Una puerta que deja pasar cuando la prueba quiere: para cambiar de reporte a mitad de un guardado.
function puerta() {
  let abrir;
  const cerrada = new Promise((listo) => (abrir = listo));
  return { cerrada, abrir: () => abrir() };
}

test('abrir un reporte guardado lo deja en curso con sus fotos, y las otras pantallas lo ven al entrar', async () => {
  const reporte = crearReporteEnCurso({ abrirBase, reducir, urls });
  const uno = await reporte.cargar();
  await reporte.agregarFoto(toma('escena del uno'), { paso: 'escena', sector: 0 });
  const dos = await reporte.nuevoReporte();
  assert.deepEqual(reporte.registros(), []);
  await reporte.abrir(uno.id);
  assert.equal(reporte.reporte().id, uno.id);
  assert.equal(reporte.registros().length, 1);
  // Otra pantalla entra y carga: sigue siendo el que se abrió.
  assert.equal((await reporte.cargar()).id, uno.id);
  const lista = await reporte.reportes();
  assert.deepEqual(lista.map((r) => r.id).sort(), [uno.id, dos.id].sort());
  assert.deepEqual((await reporte.registrosDe(uno.id)).map((r) => r.paso), ['escena']);
});

test('lo que se guarda mientras se cambia de reporte cae en el suyo, y el de ahora no se pisa', async () => {
  const p = puerta();
  const conPuerta = async () => {
    const base = await abrirBase();
    return { ...base, guardarDatos: async (...datos) => (await p.cerrada, base.guardarDatos(...datos)) };
  };
  const reporte = crearReporteEnCurso({ abrirBase: conPuerta, reducir, urls });
  const uno = await reporte.cargar();
  const guardando = reporte.guardarDatos({ danos: [{ carro: 'A', pieza: 'capo', tipo: 'roto' }] });
  const dos = await reporte.nuevoReporte();
  p.abrir();
  const guardado = await guardando;
  assert.equal(guardado.id, uno.id);
  assert.equal(reporte.reporte().id, dos.id, 'el reporte en curso sigue siendo el nuevo');
  assert.equal(reporte.reporte().danos, undefined);
  await reporte.abrir(uno.id);
  assert.deepEqual(reporte.reporte().danos, [{ carro: 'A', pieza: 'capo', tipo: 'roto' }]);
});

test('una foto que se estaba reduciendo cuando se cambió de reporte no entra a ninguno', async () => {
  const p = puerta();
  const lenta = async (blob) => (await p.cerrada, reducir(blob));
  const reporte = crearReporteEnCurso({ abrirBase, reducir: lenta, urls });
  const uno = await reporte.cargar();
  const tomando = reporte.agregarFoto(toma('escena'), { paso: 'escena', sector: 0 });
  const dos = await reporte.nuevoReporte();
  p.abrir();
  await assert.rejects(tomando, (e) => e.message === OTRO_REPORTE);
  assert.deepEqual(await reporte.registrosDe(uno.id), []);
  assert.deepEqual(await reporte.registrosDe(dos.id), []);
  assert.deepEqual(reporte.registros(), []);
});

test('una foto que la base estaba guardando cuando se cambió de reporte queda en el suyo, no en el nuevo', async () => {
  const p = puerta();
  const conPuerta = async () => {
    const base = await abrirBase();
    return { ...base, agregarFoto: async (...datos) => (await p.cerrada, base.agregarFoto(...datos)) };
  };
  const reporte = crearReporteEnCurso({ abrirBase: conPuerta, reducir, urls });
  const uno = await reporte.cargar();
  const tomando = reporte.agregarFoto(toma('escena'), { paso: 'escena', sector: 0 });
  // Se espera a que la foto llegue a la base: ya pasó la reducción y el sello.
  await new Promise((listo) => setTimeout(listo, 20));
  const dos = await reporte.nuevoReporte();
  p.abrir();
  const foto = await tomando;
  assert.equal(foto.registro.reporte, uno.id);
  assert.equal(foto.url, null, 'no se muestra en la lista del nuevo');
  assert.deepEqual(reporte.registros(), []);
  assert.equal(reporte.reporte().id, dos.id);
  assert.deepEqual((await reporte.registrosDe(uno.id, 1)).map((r) => r.paso), ['escena']);
});

test('si no se pueden leer las fotos del que se abre, no se cambia de reporte: ni en la base ni aquí', async () => {
  let falla = false;
  const conFalla = async () => {
    const base = await abrirBase();
    return { ...base, fotos: async (id) => (falla ? Promise.reject(new Error('Safari cerró la base')) : base.fotos(id)) };
  };
  const reporte = crearReporteEnCurso({ abrirBase: conFalla, reducir, urls });
  const uno = await reporte.cargar();
  await reporte.agregarFoto(toma('escena del uno'), { paso: 'escena', sector: 0 });
  const dos = await reporte.nuevoReporte();
  falla = true;
  await assert.rejects(reporte.abrir(uno.id), /Safari cerró la base/);
  assert.equal(reporte.reporte().id, dos.id);
  falla = false;
  assert.equal((await reporte.cargar()).id, dos.id, 'en la base también sigue el de antes');
});

test('los registros de otro reporte se leen una vez mientras no le lleguen fotos', async () => {
  let lecturas = 0;
  const contando = async () => {
    const base = await abrirBase();
    return { ...base, registros: async (id) => (lecturas++, base.registros(id)) };
  };
  const reporte = crearReporteEnCurso({ abrirBase: contando, reducir, urls });
  const uno = await reporte.cargar();
  await reporte.agregarFoto(toma('escena del uno'), { paso: 'escena', sector: 0 });
  // El de ahora: sus registros ya están en la memoria.
  assert.equal((await reporte.registrosDe(uno.id, 1)).length, 1);
  assert.equal(lecturas, 0);
  await reporte.nuevoReporte();
  await reporte.registrosDe(uno.id, 1);
  await reporte.registrosDe(uno.id, 1);
  assert.equal(lecturas, 1);
  // Con otra cuenta (se le agregó una foto), se vuelve a leer.
  await reporte.registrosDe(uno.id, 2);
  assert.equal(lecturas, 2);
});
