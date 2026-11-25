// «Tus reportes» (desde el 17-nov-2026): qué dice cada fila, cuál va en el renglón del inicio y cuáles
// no se listan. Con el reporte de prueba del paso 8, sellado y sin sellar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatosParaSeguir, cuandoDeLaFila, dondeFue, filaDelReporte, reporteVacio, reportesConAlgo, textoDeGuardados, tituloDelRenglon } from '../js/reportes.js';
import { sellarReporte } from '../js/sello.js';
import { carroNuevo } from '../js/carros.js';
import { diaRelativo } from '../js/fechas.js';
import { CARROS, DANOS, reporteDePrueba } from './reporte-de-prueba.js';

// Martes 17 de noviembre de 2026, 3:00 p. m. en Bogotá.
const AHORA = new Date('2026-11-17T20:00:00Z');

test('el día se cuenta en Colombia: hoy, ayer, el día de la semana y el año si es otro', () => {
  assert.equal(diaRelativo('2026-11-17T05:00:00Z', AHORA), 'hoy', 'medianoche en Bogotá');
  assert.equal(diaRelativo('2026-11-17T04:59:00Z', AHORA), 'ayer', '11:59 p. m. del lunes en Bogotá, aunque en Londres ya sea martes');
  assert.equal(diaRelativo('2026-11-13T22:20:00Z', AHORA), 'vie 13 nov');
  assert.equal(diaRelativo('2025-12-09T15:00:00Z', AHORA), 'mar 9 dic 2025');
  assert.equal(diaRelativo('no es una fecha', AHORA), '');
});

test('no se listan los reportes que se crearon solos y nadie llenó', () => {
  assert.equal(reporteVacio({ id: 'r1', fotos: 0 }), true);
  assert.equal(reporteVacio({ id: 'r1', fotos: 0, carros: [carroNuevo('A', 'tuyo'), carroNuevo('B')], danos: [] }), true, 'los carros que el paso 5 pone de entrada no cuentan');
  assert.equal(reporteVacio({ id: 'r1', fotos: 1 }), false);
  assert.equal(reporteVacio({ id: 'r1', fotos: 0, lugar: { punto: { lat: 4.6, lon: -74.1 } } }), false);
  assert.equal(reporteVacio({ id: 'r1', fotos: 0, antes: { embriaguez: 'si', hora: null } }), false, 'lo que dijo antes de mover es suyo');
  assert.equal(reporteVacio({ id: 'r1', fotos: 0, carros: [{ ...carroNuevo('A', 'tuyo'), placa: { texto: 'JRK245', fuente: 'escrita', lectura: null, intentos: [] } }] }), false);
  assert.equal(reporteVacio({ id: 'r1', fotos: 0, danos: [DANOS[0]] }), false);
  assert.deepEqual(reportesConAlgo([{ id: 'a', fotos: 0 }, { id: 'b', fotos: 3 }]).map((r) => r.id), ['b']);
});

test('dónde fue: la vía del paso 3, si no la del croquis, y nunca una calle que no se sabe', async () => {
  const { reporte } = await reporteDePrueba();
  assert.equal(dondeFue(reporte), reporte.lugar.via.nombre);
  assert.equal(dondeFue({ ...reporte, lugar: null }), reporte.croquis.via.nombre);
  // Un punto sin nombre de vía: el análisis pudo no llegar; no se dice que la calle no tenga nombre.
  assert.equal(dondeFue({ lugar: { punto: { lat: 4.6, lon: -74.1 }, via: null } }), 'Punto marcado en el mapa');
  assert.equal(dondeFue({}), 'Sin lugar marcado');
});

test('un reporte a medias: «Seguir» lleva a lo primero que falta', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const fila = await filaDelReporte({ reporte: { ...reporte, fotos: registros.length }, registros }, { ahora: AHORA });
  assert.equal(fila.id, 'r-prueba');
  assert.deepEqual([fila.dia, fila.hora], ['vie 13 nov', '5:20 p. m.']);
  assert.equal(cuandoDeLaFila(fila), 'Vie 13 nov, 5:20 p. m.');
  assert.equal(fila.ejemplo, true);
  assert.equal(fila.sello, 'sin-sellar');
  assert.equal(fila.numero, null);
  // B tiene 6 de 8 fotos y la placa sin revisar: va lo primero, sin el resto del detalle.
  assert.equal(fila.linea, 'Falta: carro B · el otro (6 de 8 fotos)');
  assert.deepEqual([fila.ir, fila.boton], ['carros', 'Seguir']);
});

test('un reporte sellado: «Abrir» lleva al número; si cambió después, vuelve a «Seguir» y sin el número viejo', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const { sello } = await sellarReporte({ reporte, registros, hora: new Date('2026-11-13T22:50:00Z') });
  const sellado = { ...reporte, sello };
  const fila = await filaDelReporte({ reporte: sellado, registros }, { ahora: AHORA });
  assert.equal(fila.sello, 'vigente');
  assert.equal(fila.numero, sello.numero);
  assert.equal(fila.linea, null);
  assert.deepEqual([fila.ir, fila.boton], ['enviar', 'Abrir']);

  const cambiado = await filaDelReporte({ reporte: { ...sellado, danos: DANOS.slice(0, 2) }, registros }, { ahora: AHORA });
  assert.equal(cambiado.sello, 'cambio');
  assert.equal(cambiado.numero, null, 'el número viejo ya no vale para lo que hay');
  assert.equal(cambiado.boton, 'Seguir');
});

test('con todo completo falta sellarlo, y si cambió después de sellar, sellarlo otra vez', async () => {
  const { reporte, registros } = await reporteDePrueba();
  // Solo A (B es el que tiene fotos de menos) y sus daños con foto de cerca: no falta nada.
  const completo = { ...reporte, carros: [CARROS[0]], danos: DANOS.filter((d) => d.carro === 'A' && d.pieza !== 'guardafango-del-der') };
  const fila = await filaDelReporte({ reporte: completo, registros }, { ahora: AHORA });
  assert.deepEqual([fila.sello, fila.linea, fila.ir, fila.boton], ['sin-sellar', 'Está todo: falta sellarlo', 'enviar', 'Seguir']);

  const { sello } = await sellarReporte({ reporte: completo, registros, hora: new Date('2026-11-13T22:50:00Z') });
  const otraLinea = { ...completo, carros: [{ ...CARROS[0], linea: null }], sello };
  const cambiada = await filaDelReporte({ reporte: otraLinea, registros }, { ahora: AHORA });
  assert.deepEqual([cambiada.sello, cambiada.linea, cambiada.ir], ['cambio', 'Cambió después de sellar: falta sellarlo otra vez', 'enviar']);
});

test('lo que falta se dice corto: el lugar, la escena y el croquis', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const sinLugar = await filaDelReporte({ reporte: { ...reporte, lugar: null, croquis: null }, registros }, { ahora: AHORA });
  assert.equal(sinLugar.linea, 'Falta: dónde y cuándo (sin marcar)');
  assert.equal(sinLugar.ir, 'donde');
  const pocas = registros.filter((r) => r.paso === 'escena').slice(0, 3);
  const escena = await filaDelReporte({ reporte, registros: pocas }, { ahora: AHORA });
  assert.equal(escena.linea, 'Falta: la escena (3 de 8 fotos)');
  assert.equal(escena.ir, 'escena');
});

test('el renglón del inicio: el reporte en curso primero, después el último que se empezó', () => {
  const a = { id: 'a', creado: '2026-11-17T19:00:00Z' };
  const b = { id: 'b', creado: '2026-11-14T13:00:00Z', enCurso: true };
  assert.deepEqual(candidatosParaSeguir([a, b]).map((r) => r.id), ['b', 'a']);
  assert.deepEqual(candidatosParaSeguir([{ ...a, enCurso: true }, { ...b, enCurso: false }]).map((r) => r.id), ['a'], 'el último está en curso: va una vez');
  assert.deepEqual(candidatosParaSeguir([a]).map((r) => r.id), ['a']);
  assert.deepEqual(candidatosParaSeguir([]), []);
});

test('los textos del renglón y del enlace', () => {
  assert.equal(tituloDelRenglon({ dia: 'hoy', hora: '3:40 p. m.' }), 'Reporte de hoy, 3:40 p. m.');
  assert.equal(tituloDelRenglon({ dia: 'ayer', hora: '8:15 a. m.' }), 'Reporte de ayer, 8:15 a. m.');
  assert.equal(tituloDelRenglon({ dia: 'sáb 14 nov', hora: '8:15 a. m.' }), 'Reporte del sáb 14 nov, 8:15 a. m.');
  assert.equal(cuandoDeLaFila({ dia: 'hoy', hora: '3:40 p. m.' }), 'Hoy, 3:40 p. m.');
  assert.equal(textoDeGuardados(1), '1 guardado');
  assert.equal(textoDeGuardados(4), '4 guardados');
});
