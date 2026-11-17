// La base del reporte en el teléfono, con fake-indexeddb: el reporte en curso,
// las fotos en el orden de la cadena, y lo que pasa cuando iOS mata la
// conexión con la página abierta (se simula como la deja Safari: sin avisar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { CADENA_CAMBIO, HORAS_DE_UN_REPORTE, abrirBaseDelReporte, reporteVigente, sirveParaUnChoqueNuevo, turnoDe, ultimaVez } from '../js/reporte-bd.js';
import { INICIO_DE_LA_CADENA, sellarRegistro, sha256Hex, verificarCadena } from '../js/evidencia.js';

const PERDIDA = () => new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError');

// Una fábrica que deja ver las conexiones que abrió y matar la última.
function fabricaEspia() {
  const real = new IDBFactory();
  const abiertas = [];
  return {
    abiertas,
    open(...datos) {
      const peticion = real.open(...datos);
      peticion.addEventListener('success', () => abiertas.push(peticion.result));
      return peticion;
    },
    matarUltima() {
      abiertas[abiertas.length - 1].transaction = () => {
        throw PERDIDA();
      };
    },
  };
}

let reloj = new Date('2026-11-17T20:00:00Z');
const opciones = (fabrica) => ({ indexedDB: fabrica, reloj: () => reloj, nuevoId: (() => { let n = 0; return () => `r${++n}`; })() });

async function fotoSellada(reporte, indice, anterior, texto = `foto ${indice}`) {
  const bytes = new TextEncoder().encode(texto);
  const registro = { version: 1, reporte, paso: 'escena', indice, sector: indice, hora: reloj.toISOString(), foto: { tipo: 'image/jpeg', ancho: 2, alto: 2, bytes: bytes.length, sha256: await sha256Hex(bytes) }, reemplaza: null };
  return { sellado: await sellarRegistro(registro, anterior), foto: new Blob([bytes], { type: 'image/jpeg' }), miniatura: new Blob([`mini ${indice}`], { type: 'image/jpeg' }) };
}

test('un reporte vale seis horas desde que se tocó por última vez', () => {
  const ahora = new Date('2026-11-17T20:00:00Z');
  assert.equal(HORAS_DE_UN_REPORTE, 6);
  assert.equal(reporteVigente({ actualizado: '2026-11-17T15:00:00Z' }, ahora), true);
  assert.equal(reporteVigente({ actualizado: '2026-11-17T13:59:00Z' }, ahora), false);
  // Un reloj del celular que se devolvió no deja un reporte "del futuro" pegado para siempre.
  assert.equal(reporteVigente({ actualizado: '2026-11-18T20:00:00Z' }, ahora), false);
  assert.equal(reporteVigente(null, ahora), false);
});

test('el reporte en curso se reusa, y pasado el tiempo empieza otro', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const primero = await base.reporteEnCurso();
  assert.equal(primero.id, 'r1');
  assert.equal((await base.reporteEnCurso()).id, 'r1');
  reloj = new Date('2026-11-18T03:00:00Z');
  assert.equal((await base.reporteEnCurso()).id, 'r2');
  // Creado en el mismo instante que r2: empatan en "actualizado" y gana el último creado.
  const nuevo = await base.nuevoReporte();
  assert.equal(nuevo.id, 'r3');
  assert.equal((await base.reporteEnCurso()).id, 'r3');
  assert.equal((await base.reporteEnCurso()).id, 'r3');
});

test('las fotos se guardan como bytes, salen en el orden de la cadena y la cadena verifica', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const fabrica = fabricaEspia();
  const base = await abrirBaseDelReporte(opciones(fabrica));
  const { id: reporte } = await base.reporteEnCurso();
  let anterior = INICIO_DE_LA_CADENA;
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const { sellado, foto, miniatura } = await fotoSellada(reporte, i, anterior);
    ids.push(await base.agregarFoto(sellado, { foto, miniatura }));
    anterior = sellado.huella;
  }
  const fotos = await base.fotos(reporte);
  assert.deepEqual(fotos.map((f) => f.registro.indice), [0, 1, 2]);
  assert.deepEqual(fotos.map((f) => f.id), ids);
  assert.ok(fotos[1].miniatura instanceof Blob);
  assert.equal(await fotos[1].miniatura.text(), 'mini 1');
  assert.equal(fotos[0].archivo, undefined, 'la lista no trae la foto grande');
  const grande = await base.foto(ids[2]);
  assert.equal(await grande.text(), 'foto 2');
  assert.equal(grande.type, 'image/jpeg');

  const bruto = await new Promise((listo) => {
    const peticion = fabrica.abiertas[0].transaction('fotos').objectStore('fotos').get(ids[0]);
    peticion.onsuccess = () => listo(peticion.result);
  });
  assert.ok(!(bruto.archivo instanceof Blob), 'en la base no hay un Blob (Safari)');
  assert.ok(bruto.archivo.bytes instanceof ArrayBuffer);

  const resultado = await verificarCadena(fotos.map((f) => f.registro), {
    huellaDeLaFoto: async (r) => sha256Hex(await (await base.foto(fotos[r.indice].id)).arrayBuffer()),
  });
  assert.equal(resultado.integra, true);
});

test('una foto que no sigue la cadena no se guarda; la misma foto repetida no se duplica', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const { id: reporte } = await base.reporteEnCurso();
  const primera = await fotoSellada(reporte, 0, INICIO_DE_LA_CADENA);
  const id = await base.agregarFoto(primera.sellado, primera);
  // Reintento de la misma (la conexión se cayó justo después de guardar): devuelve la de antes.
  assert.equal(await base.agregarFoto(primera.sellado, primera), id);
  // Una que apunta al inicio, como si la primera no existiera: se rechaza.
  const colada = await fotoSellada(reporte, 0, INICIO_DE_LA_CADENA, 'otra');
  await assert.rejects(base.agregarFoto(colada.sellado, colada), (e) => e.message === CADENA_CAMBIO);
  // Y una con el índice equivocado, también.
  const saltada = await fotoSellada(reporte, 5, primera.sellado.huella);
  await assert.rejects(base.agregarFoto(saltada.sellado, saltada), (e) => e.message === CADENA_CAMBIO);
  assert.equal((await base.fotos(reporte)).length, 1);
});

test('cada reporte tiene su cadena', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const uno = (await base.reporteEnCurso()).id;
  const dos = (await base.nuevoReporte()).id;
  for (const reporte of [uno, dos]) {
    const f = await fotoSellada(reporte, 0, INICIO_DE_LA_CADENA);
    await base.agregarFoto(f.sellado, f);
  }
  assert.equal((await base.fotos(uno)).length, 1);
  assert.equal((await base.fotos(dos)).length, 1);
});

test('si iOS mata la conexión con la página abierta, la base se levanta sola y la foto entra', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const fabrica = fabricaEspia();
  const base = await abrirBaseDelReporte(opciones(fabrica));
  const { id: reporte } = await base.reporteEnCurso();
  assert.equal(fabrica.abiertas.length, 1);
  fabrica.matarUltima();
  const f = await fotoSellada(reporte, 0, INICIO_DE_LA_CADENA);
  await base.agregarFoto(f.sellado, f);
  assert.equal(fabrica.abiertas.length, 2, 'abrió una conexión nueva');
  fabrica.matarUltima();
  assert.equal((await base.fotos(reporte)).length, 1);
  assert.equal(fabrica.abiertas.length, 3);
});

test('guardar el momento en que se tocó el reporte por última vez', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const { id: reporte } = await base.reporteEnCurso();
  reloj = new Date('2026-11-18T01:30:00Z');
  const f = await fotoSellada(reporte, 0, INICIO_DE_LA_CADENA);
  await base.agregarFoto(f.sellado, f);
  // 7 h después de creado pero 5,5 h después de la foto: sigue en curso.
  reloj = new Date('2026-11-18T03:00:00Z');
  assert.equal((await base.reporteEnCurso()).id, reporte);
});

test('sin IndexedDB lo dice', async () => {
  await assert.rejects(abrirBaseDelReporte({ indexedDB: null }), /IndexedDB/);
});

// --- «Tus reportes» (desde el 17-nov-2026) ------------------------------------------------------

test('abrir un reporte viejo lo deja en curso, aunque una escritura que iba en camino toque el de hoy después', async () => {
  reloj = new Date('2026-11-14T13:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const viejo = await base.reporteEnCurso();
  reloj = new Date('2026-11-17T19:00:00Z');
  const hoy = await base.reporteEnCurso();
  assert.notEqual(hoy.id, viejo.id, 'pasadas las seis horas empezó otro');
  await base.guardarDatos(hoy.id, { danos: [] });
  reloj = new Date('2026-11-17T19:30:00Z');
  const abierto = await base.abrirReporte(viejo.id);
  assert.equal(abierto.id, viejo.id);
  assert.equal(abierto.abierto, '2026-11-17T19:30:00.000Z');
  assert.equal(abierto.actualizado, '2026-11-14T13:00:00.000Z', 'abrirlo no es tocarlo');
  assert.equal((await base.reporteEnCurso()).id, viejo.id);
  // La lectura de una placa del de hoy termina diez minutos después y lo toca: el turno manda,
  // no la última vez que se tocó (con esa regla, el de hoy le ganaría al que se acaba de abrir).
  reloj = new Date('2026-11-17T19:40:00Z');
  await base.guardarDatos(hoy.id, { carros: [] });
  assert.equal((await base.reporteEnCurso()).id, viejo.id);
  // Vale seis horas desde que se abrió; después, otro nuevo.
  reloj = new Date('2026-11-18T01:29:00Z');
  assert.equal((await base.reporteEnCurso()).id, viejo.id);
  reloj = new Date('2026-11-18T01:31:00Z');
  const otro = await base.reporteEnCurso();
  assert.ok(![viejo.id, hoy.id].includes(otro.id));
  await assert.rejects(base.abrirReporte('no-existe'), /ya no está en este teléfono/);
});

test('«Empezar un reporte nuevo» le gana al que se acaba de abrir, y abrir otra vez le gana al nuevo', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const uno = await base.reporteEnCurso();
  await base.abrirReporte(uno.id);
  // En el mismo instante: decide el turno, no la hora.
  const dos = await base.nuevoReporte();
  assert.equal((await base.reporteEnCurso()).id, dos.id);
  await base.abrirReporte(uno.id);
  assert.equal((await base.reporteEnCurso()).id, uno.id);
});

test('con reportes de antes del turno (solo con orden), sigue en curso el último que se tocó, como antes', async () => {
  const fabrica = new IDBFactory();
  // La base como la dejaba la versión del 16-nov: sin `turno` ni `abierto`.
  await new Promise((listo, falla) => {
    const p = fabrica.open('choque-claro', 1);
    p.onupgradeneeded = () => {
      p.result.createObjectStore('reportes', { keyPath: 'id' });
      p.result.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true }).createIndex('reporte', 'reporte');
    };
    p.onsuccess = () => {
      const tx = p.result.transaction('reportes', 'readwrite');
      tx.objectStore('reportes').add({ id: 'viejo-1', orden: 1, creado: '2026-11-17T18:00:00Z', actualizado: '2026-11-17T19:00:00Z' });
      tx.objectStore('reportes').add({ id: 'viejo-2', orden: 2, creado: '2026-11-17T18:30:00Z', actualizado: '2026-11-17T18:40:00Z' });
      tx.oncomplete = () => {
        p.result.close();
        listo();
      };
    };
    p.onerror = () => falla(p.error);
  });
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(fabrica));
  // La versión del 16-nov seguía en el último que se tocó: viejo-1, aunque viejo-2 se haya creado
  // después (la persona volvió a viejo-1 con un guardado que iba en camino). Actualizar la app a
  // mitad de un reporte no puede dejarla en otro.
  assert.equal((await base.reporteEnCurso()).id, 'viejo-1');
  // Desde que uno tiene turno, manda el turno; el `orden` de los viejos cuenta como turno.
  const nuevo = await base.nuevoReporte();
  assert.equal(nuevo.turno, 3);
  assert.equal(nuevo.orden, 3);
  assert.equal((await base.reporteEnCurso()).id, nuevo.id);
  assert.equal((await base.abrirReporte('viejo-2')).turno, 4);
  assert.equal((await base.reporteEnCurso()).id, 'viejo-2');
});

test('el camino del inicio no sigue un reporte sellado, el ejemplo ni uno de otro día', () => {
  const ahora = new Date('2026-11-17T20:00:00Z');
  const deHoy = { id: 'a', creado: '2026-11-17T18:30:00Z' };
  assert.equal(sirveParaUnChoqueNuevo(deHoy, ahora), true);
  assert.equal(sirveParaUnChoqueNuevo({ ...deHoy, sello: { numero: 'CC-261117-ABC123' } }, ahora), false, 'un choque nuevo le cambiaría el número');
  assert.equal(sirveParaUnChoqueNuevo({ ...deHoy, lugar: { origen: 'ejemplo' } }, ahora), false);
  assert.equal(sirveParaUnChoqueNuevo({ ...deHoy, croquis: { ejemplo: true } }, ahora), false);
  // Uno de hace tres días que se volvió a abrir: está en curso, pero el choque de hoy no es ese.
  assert.equal(sirveParaUnChoqueNuevo({ id: 'b', creado: '2026-11-14T13:00:00Z', abierto: '2026-11-17T19:00:00Z' }, ahora), false);
  assert.equal(sirveParaUnChoqueNuevo({ id: 'c', creado: 'no es fecha' }, ahora), false);
  assert.equal(sirveParaUnChoqueNuevo(null, ahora), false);
});

test('la lista: del más nuevo al más viejo, con sus fotos contadas y cuál está en curso', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const uno = await base.reporteEnCurso();
  const f0 = await fotoSellada(uno.id, 0, INICIO_DE_LA_CADENA);
  await base.agregarFoto(f0.sellado, f0);
  const f1 = await fotoSellada(uno.id, 1, f0.sellado.huella);
  await base.agregarFoto(f1.sellado, f1);
  reloj = new Date('2026-11-17T20:05:00Z');
  const dos = await base.nuevoReporte();
  await base.abrirReporte(uno.id);
  const lista = await base.reportes();
  assert.deepEqual(lista.map((r) => [r.id, r.fotos, r.enCurso]), [
    [dos.id, 0, false],
    [uno.id, 2, true],
  ]);
  // Los registros, sin las fotos y en el orden de la cadena.
  const registros = await base.registros(uno.id);
  assert.deepEqual(registros.map((r) => r.indice), [0, 1]);
  assert.equal(registros[1].anterior, registros[0].huella);
  assert.deepEqual(await base.registros(dos.id), []);
  // Pasadas las seis horas, ninguno está en curso (abrir la app empieza otro).
  reloj = new Date('2026-11-18T03:00:00Z');
  assert.ok((await base.reportes()).every((r) => !r.enCurso));
});

test('guardar lo declarado no puede mover el turno ni la hora en que se abrió', async () => {
  reloj = new Date('2026-11-17T20:00:00Z');
  const base = await abrirBaseDelReporte(opciones(new IDBFactory()));
  const uno = await base.reporteEnCurso();
  const guardado = await base.guardarDatos(uno.id, { turno: 99, abierto: '2030-01-01T00:00:00Z', danos: [] });
  assert.equal(guardado.turno, uno.turno);
  assert.equal(guardado.abierto, undefined);
});

test('las seis horas cuentan desde lo último: que se tocó o que se volvió a abrir', () => {
  const ahora = new Date('2026-11-17T20:00:00Z');
  const abierto = { actualizado: '2026-11-14T13:00:00Z', abierto: '2026-11-17T19:00:00Z' };
  assert.equal(ultimaVez(abierto), '2026-11-17T19:00:00Z');
  assert.equal(reporteVigente(abierto, ahora), true);
  assert.equal(ultimaVez({ actualizado: '2026-11-17T19:30:00Z', abierto: '2026-11-17T19:00:00Z' }), '2026-11-17T19:30:00Z');
  assert.equal(ultimaVez({}), null);
  assert.equal(turnoDe({ orden: 3 }), 3);
  assert.equal(turnoDe({ orden: 3, turno: 7 }), 7);
  assert.equal(turnoDe(null), 0);
});
