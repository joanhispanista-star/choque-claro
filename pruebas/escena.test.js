// La vuelta de 8 tomas: en qué toma cae cada rumbo, qué dice la guía y cómo se
// dibuja el anillo. Con la primera foto a 100° (este-sureste) para que ningún
// número coincida con el norte por casualidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEJOS_DEL_PUNTO,
  TEXTOS,
  TOMAS,
  caminoDelSector,
  dibujoDelAnillo,
  estadoDeLaVuelta,
  etiquetaDeLaFoto,
  guiaDeLaVuelta,
  sectorDelRumbo,
  sectorParaLaFoto,
  textoDeLaBrujula,
  textoDeLaCuenta,
  textoDeLaDistancia,
  textoDelGps,
} from '../js/escena.js';

const foto = (sector, rumbo, extra = {}) => ({ paso: 'escena', sector, rumbo, huella: `h${sector}-${rumbo}`, ...extra });
// Una vuelta con brújula que empezó a 100° y ya tiene las tomas `sectores`.
const conBrujula = (sectores, opciones) => estadoDeLaVuelta(sectores.map((s) => foto(s, (100 + s * 45) % 360)), opciones);

test('cada rumbo cae en la toma más cercana, contando desde la primera foto', () => {
  assert.equal(sectorDelRumbo(100, 100), 0);
  assert.equal(sectorDelRumbo(122, 100), 0);
  assert.equal(sectorDelRumbo(123, 100), 1);
  assert.equal(sectorDelRumbo(145, 100), 1);
  assert.equal(sectorDelRumbo(80, 100), 0);
  assert.equal(sectorDelRumbo(55, 100), 7);
  assert.equal(sectorDelRumbo(10, 350), 0);
});

test('la vuelta vacía no ha decidido si va con brújula', () => {
  const v = estadoDeLaVuelta([]);
  assert.equal(v.conBrujula, null);
  assert.equal(v.cuantas, 0);
  assert.equal(v.completa, false);
  assert.equal(textoDeLaCuenta(v), '0 de 8 tomas');
});

test('una toma repetida vale la última, y la que se pide repetir cuenta como vacía', () => {
  const v = estadoDeLaVuelta([foto(0, 100), foto(1, 147), foto(1, 143)]);
  assert.equal(v.vigentes[1].rumbo, 143);
  assert.equal(v.cuantas, 2);
  const repitiendo = estadoDeLaVuelta([foto(0, 100), foto(1, 143)], { porRepetir: 1 });
  assert.equal(repitiendo.cuantas, 1);
  assert.equal(repitiendo.tomadas[1], false);
  assert.equal(repitiendo.porRepetir, 1);
  // Pedir repetir una toma que no existe no hace nada.
  assert.equal(estadoDeLaVuelta([foto(0, 100)], { porRepetir: 5 }).porRepetir, null);
  // Las fotos de otros pasos (los carros, mañana) no cuentan en la vuelta.
  assert.equal(estadoDeLaVuelta([foto(0, 100), { paso: 'carros', sector: 1, rumbo: 3 }]).cuantas, 1);
});

test('la guía: primera foto, girar, seguir girando, tomar', () => {
  assert.deepEqual(guiaDeLaVuelta(estadoDeLaVuelta([]), 100), { accion: 'tomar', sector: 0, desvio: 0, texto: TEXTOS.primera });
  const v = conBrujula([0]);
  assert.equal(v.origen, 100);
  assert.deepEqual(guiaDeLaVuelta(v, 100), { accion: 'girar', sector: 1, sentido: 'derecha', texto: TEXTOS.derecha });
  // A 20° antes del centro de la toma 2 todavía falta.
  assert.equal(guiaDeLaVuelta(v, 125).accion, 'seguir');
  assert.equal(guiaDeLaVuelta(v, 125).texto, 'Sigue girando despacio a tu derecha');
  assert.equal(guiaDeLaVuelta(v, 135).accion, 'tomar');
  assert.equal(guiaDeLaVuelta(v, 150).accion, 'tomar');
  assert.equal(guiaDeLaVuelta(v, 150).sector, 1);
});

test('si la que falta queda a la izquierda, se devuelve; si no, sigue a la derecha', () => {
  const faltaLaUltima = conBrujula([0, 1, 2, 3, 4, 5, 6]);
  assert.equal(guiaDeLaVuelta(faltaLaUltima, 100).sentido, 'izquierda');
  assert.equal(guiaDeLaVuelta(faltaLaUltima, 100).sector, 7);
  const faltaLaTercera = conBrujula([0, 1, 3, 4, 5, 6, 7]);
  assert.equal(guiaDeLaVuelta(faltaLaTercera, 100).sentido, 'derecha');
  // Empatadas a dos pasos por cada lado: gana seguir la vuelta.
  const faltanDos = conBrujula([0, 1, 3, 4, 5, 7]);
  assert.equal(guiaDeLaVuelta(faltanDos, 100).sector, 2);
});

test('repetir una toma: la guía lleva a esa, y la foto entra ahí', () => {
  const v = conBrujula([0, 1, 2, 3, 4, 5, 6, 7], { porRepetir: 2 });
  assert.equal(v.completa, false);
  assert.equal(guiaDeLaVuelta(v, 100).sector, 2);
  assert.equal(guiaDeLaVuelta(v, 100).sentido, 'derecha');
  assert.deepEqual(sectorParaLaFoto(v, 190), { sector: 2 });
  assert.match(sectorParaLaFoto(v, 100).error, /ya tiene su foto/);
});

test('sin brújula: las tomas van en orden y la guía dice cuánto girar', () => {
  const vacia = estadoDeLaVuelta([]);
  assert.equal(guiaDeLaVuelta(vacia, null).texto, TEXTOS.primera);
  assert.deepEqual(sectorParaLaFoto(vacia, null), { sector: 0 });
  const v = estadoDeLaVuelta([foto(0, null), foto(1, null)]);
  assert.equal(v.conBrujula, false);
  const guia = guiaDeLaVuelta(v, null);
  assert.equal(guia.sector, 2);
  assert.equal(guia.texto, 'Gira un octavo de vuelta a tu derecha y toma la foto 3');
  // Aunque después aparezca la brújula, la vuelta sigue en orden: el anillo no se reacomoda.
  assert.deepEqual(sectorParaLaFoto(v, 250), { sector: 2 });
  assert.equal(guiaDeLaVuelta(estadoDeLaVuelta([foto(0, null), foto(1, null)], { porRepetir: 0 }), null).texto, 'Apunta hacia donde tomaste la foto 1 y repítela');
});

test('con brújula pero caída a mitad de la vuelta: sigue en orden, sin trabarse', () => {
  const v = conBrujula([0, 1]);
  assert.deepEqual(sectorParaLaFoto(v, null), { sector: 2 });
  assert.equal(guiaDeLaVuelta(v, null).sinBrujula, true);
});

test('completa', () => {
  const v = conBrujula([0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(v.completa, true);
  assert.equal(guiaDeLaVuelta(v, 30).accion, 'completa');
  assert.match(sectorParaLaFoto(v, 30).error, /completa/);
});

test('el anillo con brújula gira: lo que la cámara tiene al frente queda arriba', () => {
  const v = conBrujula([0]);
  const alFrente = dibujoDelAnillo(v, guiaDeLaVuelta(v, 100), 100);
  assert.equal(alFrente.conBrujula, true);
  assert.equal(alFrente.tomas[0].angulo, 0);
  assert.equal(alFrente.tomas[2].angulo, 90);
  assert.equal(alFrente.tomas[0].estado, 'tomada');
  assert.equal(alFrente.tomas[1].estado, 'siguiente');
  assert.equal(alFrente.tomas[5].estado, 'vacia');
  // El norte (0°) queda 100° a la izquierda de lo que se mira.
  assert.equal(alFrente.norte, -100);
  const girado = dibujoDelAnillo(v, guiaDeLaVuelta(v, 145), 145);
  assert.equal(girado.tomas[1].angulo, 0);
  assert.equal(girado.tomas[0].angulo, -45);
});

test('sin brújula el anillo queda quieto, con la primera arriba', () => {
  const v = estadoDeLaVuelta([foto(0, null)]);
  const dibujo = dibujoDelAnillo(v, guiaDeLaVuelta(v, null), null);
  assert.equal(dibujo.conBrujula, false);
  assert.equal(dibujo.norte, null);
  assert.deepEqual(dibujo.tomas.map((t) => t.angulo), [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.equal(dibujo.tomas[1].estado, 'siguiente');
  assert.equal(dibujo.tomas.length, TOMAS);
});

test('el trazo de un sector arranca a la izquierda de su centro y va en el sentido del reloj', () => {
  const d = caminoDelSector(0, { exterior: 46, interior: 30, separacion: 0 });
  // A −22,5°: x = 46·sen(−22,5°) = −17,60; y = −46·cos(−22,5°) = −42,50.
  assert.match(d, /^M-17\.60 -42\.50 A46 46 0 0 1 17\.60 -42\.50 L/);
  assert.match(d, /A30 30 0 0 0 -11\.48 -27\.72 Z$/);
});

test('la etiqueta de cada foto', () => {
  assert.equal(etiquetaDeLaFoto(foto(1, 47)), 'Foto 2 · noreste, 47°');
  assert.equal(etiquetaDeLaFoto(foto(3, null)), 'Foto 4 · sin rumbo');
});

test('las pastillas del GPS y de la brújula', () => {
  const ahora = Date.parse('2026-11-17T15:00:00Z');
  assert.deepEqual(textoDelGps({ precision: 6.4, hora: new Date(ahora - 2000) }, null, ahora), { texto: 'GPS ±6\u00a0m', estado: 'bien' });
  assert.equal(textoDelGps({ precision: 48, hora: new Date(ahora - 2000) }, null, ahora).estado, 'mal');
  // Una lectura vieja ya no dice dónde está la persona.
  assert.equal(textoDelGps({ precision: 6, hora: new Date(ahora - 60000) }, null, ahora).texto, 'Buscando GPS…');
  assert.equal(textoDelGps(null, 1, ahora).texto, 'Sin GPS');
  assert.equal(textoDelGps(null, 'sinHttps', ahora).texto, 'Sin GPS');
  assert.equal(textoDelGps(null, 3, ahora).texto, 'Buscando GPS…');

  assert.deepEqual(textoDeLaBrujula({ rumbo: 10, precisionRumbo: 15 }), { texto: 'Brújula ±15°', estado: 'bien' });
  assert.deepEqual(textoDeLaBrujula({ rumbo: 10, precisionRumbo: null }), { texto: 'Brújula', estado: 'bien' });
  assert.equal(textoDeLaBrujula({ rumbo: 10, precisionRumbo: 45 }).estado, 'mal');
  assert.equal(textoDeLaBrujula({ rumbo: null, brujulaDudosa: true }).texto, 'Brújula: muévela en 8');
  assert.equal(textoDeLaBrujula({ rumbo: null }, { esperando: true }).texto, 'Buscando brújula…');
  assert.equal(textoDeLaBrujula({ rumbo: null }).texto, 'Sin brújula');
  assert.equal(textoDeLaBrujula({ rumbo: null }, { permiso: 'denied' }).texto, 'Brújula sin permiso');
});

test('la distancia al punto que se marcó en el mapa', () => {
  const punto = { lat: 4.65, lon: -74.05 };
  assert.equal(textoDeLaDistancia(null, punto), null);
  assert.equal(textoDeLaDistancia({ lat: 4.65, lon: -74.05 }, null), null);
  // Un diezmilésimo de grado de latitud son unos 11 m.
  assert.deepEqual(textoDeLaDistancia({ lat: 4.6501, lon: -74.05 }, punto), { texto: 'A 11\u00a0m del punto que marcaste en el mapa.', lejos: false });
  const lejos = textoDeLaDistancia({ lat: 4.651, lon: -74.05 }, punto);
  assert.equal(lejos.lejos, true);
  assert.match(lejos.texto, /^Estás a 111\u00a0m del punto/);
  assert.match(textoDeLaDistancia({ lat: 4.6612, lon: -74.05 }, punto).texto, /a 1,2\u00a0km/);
  assert.ok(LEJOS_DEL_PUNTO >= 20);
});
