// El paso 8 sin pantalla: la revisión de lo que tiene y le falta al reporte (que avisa pero no
// bloquea), las dos únicas cosas que impiden sellar, y el mensaje de WhatsApp con el número y la
// huella completa, sin puntos dobles ni placas que nadie revisó presentadas como ciertas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sellarReporte } from '../js/sello.js';
import { LEJOS_DEL_CROQUIS, enlaceDeWhatsApp, impideSellar, nombreDelArchivo, revisionDelReporte, textoParaWhatsApp } from '../js/enviar.js';
import { carroNuevo, nombreDelCarro, placaParaMostrar, textoDeLaLinea } from '../js/carros.js';
import { tituloDelCaso } from '../js/croquis.js';
import { fechaYHora } from '../js/fechas.js';
import { planoLocal } from '../js/geo.js';
import { CARROS, HORA_DEL_CHOQUE, reporteDePrueba } from './reporte-de-prueba.js';

const porClave = (items) => Object.fromEntries(items.map((i) => [i.clave, i]));

test('un reporte vacío: todo por hacer, cada cosa con su botón', () => {
  const items = revisionDelReporte({ reporte: { id: 'r', carros: [], danos: [], croquis: null, lugar: null }, registros: [] });
  assert.deepEqual(items.map((i) => i.clave), ['lugar', 'escena', 'carro-A', 'carro-B', 'danos', 'croquis']);
  const i = porClave(items);
  assert.deepEqual([i.lugar.detalle, i.lugar.completo, i.lugar.ir, i.lugar.boton], ['Sin marcar.', false, 'donde', 'Marcar']);
  assert.deepEqual([i.escena.detalle, i.escena.completo, i.escena.boton], ['Sin fotos.', false, 'Tomarlas']);
  assert.equal(i['carro-A'].titulo, nombreDelCarro(carroNuevo('A', 'tuyo')));
  assert.equal(i['carro-A'].detalle, 'Sin fotos · placa sin leer.');
  // Ningún daño marcado puede ser verdad (un toque sin daños): no cuenta como incompleto.
  assert.deepEqual([i.danos.detalle, i.danos.completo], ['Ninguno marcado.', true]);
  assert.deepEqual([i.croquis.detalle, i.croquis.completo, i.croquis.boton], ['No se hizo.', false, 'Hacerlo']);
});

test('el reporte de prueba: lo completo, y lo que falta dicho con el número', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const i = porClave(revisionDelReporte({ reporte, registros }));
  assert.equal(i.lugar.completo, true);
  assert.equal(i.lugar.detalle, `${reporte.lugar.via.nombre} · ${fechaYHora(HORA_DEL_CHOQUE)}`);
  assert.deepEqual([i.escena.detalle, i.escena.completo], ['8 de 8 fotos.', true]);
  assert.equal(i['carro-A'].detalle, `8 de 8 fotos · placa ${placaParaMostrar('JRK245')} · ${textoDeLaLinea(CARROS[0].linea)}.`);
  assert.equal(i['carro-A'].completo, true);
  // B: le faltan dos tomas y la placa que leyó la app nadie la revisó.
  assert.equal(i['carro-B'].detalle, `6 de 8 fotos · placa ${placaParaMostrar('HTX918')} sin revisar · ${textoDeLaLinea(CARROS[1].linea)}.`);
  assert.equal(i['carro-B'].completo, false);
  assert.deepEqual([i.danos.detalle, i.danos.completo], ['4 piezas marcadas; falta 1 foto de cerca.', false]);
  assert.deepEqual([i.croquis.detalle, i.croquis.completo], [`${tituloDelCaso('frente')}.`, true]);

  const sinElRayon = porClave(revisionDelReporte({ reporte: { ...reporte, danos: reporte.danos.filter((d) => d.pieza !== 'guardafango-del-der') }, registros }));
  assert.deepEqual([sinElRayon.danos.detalle, sinElRayon.danos.completo], ['3 piezas marcadas, todas con su foto de cerca.', true]);
  const soloB = porClave(revisionDelReporte({ reporte: { ...reporte, danos: reporte.danos.filter((d) => d.carro === 'B') }, registros }));
  assert.equal(soloB.danos.detalle, '1 pieza marcada, con su foto de cerca.');
  const sinTerminar = porClave(revisionDelReporte({ reporte: { ...reporte, croquis: { ...reporte.croquis, hecho: null } }, registros }));
  assert.deepEqual([sinTerminar.croquis.detalle, sinTerminar.croquis.completo, sinTerminar.croquis.boton], [`${tituloDelCaso('frente')}, sin terminar.`, false, 'Terminar']);
});

test('si el punto de «¿Dónde fue?» y el del croquis no son el mismo lugar, se avisa', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const aGrados = planoLocal(reporte.lugar.punto).aGrados;
  const corrido = (metros) => ({ ...reporte, croquis: { ...reporte.croquis, punto: aGrados({ x: 0, y: metros }) } });
  const lejos = porClave(revisionDelReporte({ reporte: corrido(50), registros })).lugar;
  assert.equal(lejos.completo, false);
  assert.equal(lejos.ir, 'croquis');
  assert.equal(lejos.detalle, 'El punto de «¿Dónde fue?» está a 50 m del croquis. Revisa cuál es el del choque.');
  // Dentro del margen del GPS no es otro lugar.
  assert.equal(porClave(revisionDelReporte({ reporte: corrido(LEJOS_DEL_CROQUIS - 5), registros })).lugar.completo, true);
  // Sin el paso 3 (la página se recargó): queda el punto del croquis y se dice qué se perdió.
  const sinLugar = porClave(revisionDelReporte({ reporte: { ...reporte, lugar: null }, registros })).lugar;
  assert.deepEqual([sinLugar.completo, sinLugar.ir, sinLugar.boton], [false, 'donde', 'Abrir']);
  assert.match(sinLugar.detalle, /^Solo el punto del croquis/);
});

test('solo dos cosas impiden sellar: no tener fotos y la cadena rota', async () => {
  const { registros } = await reporteDePrueba();
  assert.match(impideSellar({ registros: [] }), /^Todavía no hay fotos que sellar/);
  assert.equal(impideSellar({ registros }, { integra: true, total: registros.length, rota: null }), null);
  assert.equal(impideSellar({ registros }), null);
  assert.equal(impideSellar({ registros }, { integra: false, total: registros.length, rota: { indice: 3, motivo: 'foto' } }), 'La cadena de fotos se rompe en el registro 4: este reporte no se puede sellar. Empieza uno nuevo.');
});

test('el mensaje de WhatsApp: número, huella completa, el choque y los carros como se declararon', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const { sello } = await sellarReporte({ reporte, registros, hora: new Date('2026-11-13T22:44:12Z') });
  const texto = textoParaWhatsApp({ reporte, sello, totalDeFotos: registros.length });
  const lineas = texto.split('\n');
  assert.equal(lineas[0], `EJEMPLO (choque inventado). Reporte de choque ${sello.numero}, hecho con Choque Claro.`);
  assert.equal(lineas[1], 'Sellado el 13 de noviembre de 2026, 5:44 p. m.');
  assert.equal(lineas[2], `Huella SHA-256: ${sello.huella}`);
  assert.match(sello.huella, /^[0-9a-f]{64}$/);
  assert.equal(lineas[3], `El choque: ${fechaYHora(HORA_DEL_CHOQUE)}, en ${reporte.lugar.via.nombre}.`);
  assert.equal(lineas[4], `Carros: A ${placaParaMostrar('JRK245')} (${textoDeLaLinea(CARROS[0].linea)}); B placa sin revisar (${textoDeLaLinea(CARROS[1].linea)}).`);
  assert.equal(lineas[5], 'El expediente completo, con las 26 fotos, va en PDF.');
  assert.ok(!texto.includes('..'));

  // Un choque de verdad no dice EJEMPLO; con una sola foto no dice «las 1 foto».
  const real = { ...reporte, lugar: { ...reporte.lugar, origen: 'gps' }, croquis: { ...reporte.croquis, ejemplo: false } };
  const deVerdad = textoParaWhatsApp({ reporte: real, sello, totalDeFotos: 1 }).split('\n');
  assert.ok(deVerdad[0].startsWith('Reporte de choque '));
  assert.equal(deVerdad.at(-1), 'El expediente completo va en PDF.');

  // La hora de la mañana ya termina en punto («a. m.»): no se le pone otro. Sin hora ni vía, la
  // línea del choque no va.
  const deManana = { ...real, croquis: null, lugar: { ...real.lugar, hora: '2026-11-13T13:38:00Z', via: null } };
  assert.ok(textoParaWhatsApp({ reporte: deManana, sello }).includes('\nEl choque: 13 de noviembre de 2026, 8:38 a. m.\n'));
  const sinNada = textoParaWhatsApp({ reporte: { ...real, croquis: null, lugar: null }, sello });
  assert.ok(!sinNada.includes('El choque:'));
  assert.ok(!sinNada.includes('..'));
});

test('el enlace de WhatsApp lleva el texto entero y codificado; el archivo, el número', () => {
  const texto = 'Reporte de choque CC-261113-74B9F9.\nHuella SHA-256: abc & ñ';
  const enlace = enlaceDeWhatsApp(texto);
  assert.ok(enlace.startsWith('https://wa.me/?text='));
  assert.ok(!/[\s&ñ]/.test(enlace.slice('https://wa.me/?text='.length)));
  assert.equal(decodeURIComponent(enlace.slice('https://wa.me/?text='.length)), texto);
  assert.equal(nombreDelArchivo({ numero: 'CC-261113-74B9F9' }), 'Choque-Claro-CC-261113-74B9F9.pdf');
});
