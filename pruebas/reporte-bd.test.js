// La base del reporte en el teléfono, con fake-indexeddb: el reporte en curso,
// las fotos en el orden de la cadena, y lo que pasa cuando iOS mata la
// conexión con la página abierta (se simula como la deja Safari: sin avisar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { CADENA_CAMBIO, HORAS_DE_UN_REPORTE, abrirBaseDelReporte, reporteVigente } from '../js/reporte-bd.js';
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
