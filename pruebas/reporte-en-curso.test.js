// El reporte en curso que comparten la escena, los carros y los daños: una
// sola cadena con las fotos de los tres pasos, y lo declarado (carros, daños)
// guardado aparte sin que un paso le borre lo suyo al otro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { abrirBaseDelReporte } from '../js/reporte-bd.js';
import { crearReporteEnCurso } from '../js/reporte-en-curso.js';
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
