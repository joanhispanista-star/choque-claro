// El análisis de la vía: con vías de mentira de forma conocida (un círculo
// de radio sabido, una recta, un cruce) y con dos respuestas REALES de
// Overpass guardadas en pruebas/datos/ (ver su LEEME).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planoLocal } from '../js/geo.js';
import { adelantarDe, alumbradoDe, analizarVia, carrilesDe, claseDeVia, consultaDeLaVia, filasDeLaVia, maximaDe, radioPorTresPuntos, resumenDeLaVia, sentidoDe, superficieDe, tipoDeCurva } from '../js/via.js';

const ORIGEN = { lat: 4.65, lon: -74.05 };
const plano = planoLocal(ORIGEN);

let siguienteNodo = 1000;
// Una vía de mentira a partir de puntos en metros alrededor de ORIGEN.
function via(id, metros, etiquetas = {}, nodos = null) {
  const ids = nodos ?? metros.map(() => siguienteNodo++);
  return { type: 'way', id, nodes: ids, geometry: metros.map((m) => plano.aGrados(m)), tags: { highway: 'primary', ...etiquetas } };
}
function nodo(id, m, etiquetas) {
  return { type: 'node', id, ...plano.aGrados(m), tags: etiquetas };
}
function arco(radio, desde, hasta, paso = 3) {
  // Puntos sobre un círculo con centro en (0, -radio): el punto de en medio
  // (ángulo 90°) cae justo en ORIGEN.
  const puntos = [];
  const n = Math.max(2, Math.ceil((Math.abs(hasta - desde) * Math.PI / 180 * radio) / paso));
  for (let i = 0; i <= n; i++) {
    const ang = ((desde + ((hasta - desde) * i) / n) * Math.PI) / 180;
    puntos.push({ x: radio * Math.cos(ang), y: radio * Math.sin(ang) - radio });
  }
  return puntos;
}
const recta = (largo, paso = 10) => Array.from({ length: Math.round(largo / paso) + 1 }, (_, i) => ({ x: -largo / 2 + i * paso, y: 0 }));
const leer = (nombre) => JSON.parse(fs.readFileSync(new URL(`./datos/${nombre}.json`, import.meta.url), 'utf8'));

test('la consulta pide vías y señales alrededor del punto, con 6 decimales', () => {
  const q = consultaDeLaVia({ lat: 4.6484, lon: -74.0105 });
  assert.match(q, /around:80,4\.648400,-74\.010500/);
  assert.match(q, /out body geom;/);
  assert.match(q, /traffic_signals\|stop\|give_way/);
  assert.match(q, /railway"="level_crossing"/);
});

test('el radio por tres puntos da el del círculo, e infinito en una recta', () => {
  const p = arco(50, 60, 120, 1);
  const r = radioPorTresPuntos(p[0], p[Math.floor(p.length / 2)], p.at(-1));
  assert.ok(Math.abs(r - 50) < 0.5, `radio ${r}`);
  assert.equal(radioPorTresPuntos({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }), Infinity);
});

test('los cortes de la curva', () => {
  assert.equal(tipoDeCurva(13), 'curva cerrada');
  assert.equal(tipoDeCurva(59.9), 'curva cerrada');
  assert.equal(tipoDeCurva(100), 'curva');
  assert.equal(tipoDeCurva(250), 'curva suave');
  assert.equal(tipoDeCurva(800), 'recta');
  assert.equal(tipoDeCurva(Infinity), 'recta');
});

for (const [radio, tipo] of [[40, 'curva cerrada'], [100, 'curva'], [250, 'curva suave']]) {
  test(`una curva dibujada de radio ${radio} m sale como ${tipo}`, () => {
    const a = analizarVia({ elements: [via(1, arco(radio, 30, 150))] }, ORIGEN);
    assert.equal(a.estado, 'ok');
    assert.ok(Math.abs(a.forma.radio - radio) < radio * 0.03, `radio ${a.forma.radio}`);
    assert.equal(a.forma.tipo, tipo);
    assert.ok(a.distanciaALaVia < 0.5);
  });
}

test('una recta sale como recta, sin radio', () => {
  const a = analizarVia({ elements: [via(1, recta(300))] }, ORIGEN);
  assert.equal(a.forma.tipo, 'recta');
  assert.equal(a.forma.radio, null);
  assert.ok(Math.abs(a.rumbo - 90) < 1 || Math.abs(a.rumbo - 270) < 1);
});

test('una curva partida en dos tramos del mapa se mide entera (la cadena)', () => {
  // Recta de 100 m, curva cerrada de radio 20 m (un cuarto de vuelta) y otra
  // recta, partida en el nodo de la mitad de la curva.
  const curva = arco(20, 135, 45, 2).map((p) => ({ x: p.x, y: p.y + 20 - 20 }));
  const mitad = Math.floor(curva.length / 2);
  const entrada = [{ x: curva[0].x - 100 * Math.cos(Math.PI / 4), y: curva[0].y - 100 * Math.sin(Math.PI / 4) }, ...curva.slice(0, mitad + 1)];
  const salida = [...curva.slice(mitad), { x: curva.at(-1).x + 100 * Math.cos(Math.PI / 4), y: curva.at(-1).y - 100 * Math.sin(Math.PI / 4) }];
  const idsEntrada = entrada.map(() => siguienteNodo++);
  const idsSalida = salida.map(() => siguienteNodo++);
  idsSalida[0] = idsEntrada.at(-1); // el mismo nodo: están unidas
  const unidas = analizarVia({ elements: [via(1, entrada, { name: 'Vía de prueba' }, idsEntrada), via(2, salida, { name: 'Vía de prueba' }, idsSalida)] }, plano.aGrados(curva[mitad]));
  const sueltas = analizarVia({ elements: [via(1, entrada, { name: 'Vía de prueba' }, idsEntrada), via(2, salida, { name: 'Vía de prueba' })] }, plano.aGrados(curva[mitad]));
  assert.equal(unidas.forma.tipo, 'curva cerrada');
  assert.ok(unidas.forma.radio < sueltas.forma.radio, `unidas ${unidas.forma.radio} sueltas ${sueltas.forma.radio}`);
  // Y no se cuenta como cruce: es la misma calle.
  assert.equal(unidas.cruce, null);
});

test('un cruce a 10 m sale con el nombre de la otra calle', () => {
  const comun = 7;
  const a = via(1, [{ x: -100, y: 0 }, { x: 10, y: 0 }, { x: 100, y: 0 }], { name: 'Carrera 7' }, [5, comun, 9]);
  const b = via(2, [{ x: 10, y: -80 }, { x: 10, y: 0 }, { x: 10, y: 80 }], { name: 'Calle 60', highway: 'secondary' }, [11, comun, 12]);
  const r = analizarVia({ elements: [a, b] }, ORIGEN);
  assert.equal(r.via.nombre, 'Carrera 7');
  assert.ok(Math.abs(r.cruce.distancia - 10) < 0.5);
  assert.equal(r.cruce.con, 'Calle 60');
  assert.equal(r.cruce.soloEntrada, false);
});

test('una entrada de parqueadero no se cuenta como cruce de verdad', () => {
  const a = via(1, [{ x: -100, y: 0 }, { x: 5, y: 0 }, { x: 100, y: 0 }], { name: 'Carrera 7' }, [5, 6, 9]);
  const b = via(2, [{ x: 5, y: 0 }, { x: 5, y: 30 }], { highway: 'service' }, [6, 13]);
  const r = analizarVia({ elements: [a, b] }, ORIGEN);
  assert.equal(r.cruce.soloEntrada, true);
  const fila = filasDeLaVia(r).find((f) => f.clave === 'cruce');
  assert.match(fila.valor, /^Entrada o vía de servicio a 5\u00a0m$/);
  assert.equal(fila.aviso, null);
});

test('entre una avenida a 8 m y una entrada a 3 m, gana la avenida', () => {
  const avenida = via(1, recta(200).map((p) => ({ x: p.x, y: p.y - 8 })), { name: 'Avenida' });
  const entrada = via(2, recta(40).map((p) => ({ x: p.x, y: p.y + 3 })), { highway: 'service' });
  const r = analizarVia({ elements: [entrada, avenida] }, ORIGEN);
  assert.equal(r.via.nombre, 'Avenida');
});

test('las señales cerca, ordenadas, y nada de lo que está a más de 60 m', () => {
  const r = analizarVia({ elements: [via(1, recta(300)), nodo(1, { x: 20, y: 0 }, { highway: 'traffic_signals' }), nodo(2, { x: -8, y: 0 }, { highway: 'crossing', crossing: 'traffic_signals' }), nodo(3, { x: 100, y: 0 }, { highway: 'stop' }), nodo(4, { x: 30, y: 2 }, { railway: 'level_crossing' })] }, ORIGEN);
  assert.deepEqual(r.senales.map((s) => [s.texto, Math.round(s.distancia)]), [['Paso peatonal con semáforo', 8], ['Semáforo', 20], ['Paso a nivel del tren', 30]]);
});

test('sin vías alrededor lo dice, no inventa', () => {
  const r = analizarVia({ elements: [] }, ORIGEN);
  assert.equal(r.estado, 'sin-vias');
  assert.deepEqual(filasDeLaVia(r), []);
  assert.match(resumenDeLaVia(r), /No hay vías en el mapa a menos de 80\u00a0m/);
});

test('una avenida con separador: "un sentido en esta calzada", no "un solo sentido"', () => {
  const ida = via(1, recta(200), { name: 'Avenida Carrera 7', oneway: 'yes' });
  const vuelta = via(2, recta(200).reverse().map((p) => ({ x: p.x, y: p.y + 14 })), { name: 'Avenida Carrera 7', oneway: 'yes' });
  const r = analizarVia({ elements: [ida, vuelta] }, ORIGEN);
  assert.ok(Math.abs(r.calzadaHermana.distancia - 14) < 0.5);
  const fila = filasDeLaVia(r).find((f) => f.clave === 'sentido');
  assert.equal(fila.valor, 'Un sentido en esta calzada');
  assert.match(fila.nota, /se circula hacia el este/);
  assert.match(fila.nota, /la otra, en sentido contrario, va a 14\u00a0m/);
});

test('lo que el mapa no trae sale como "Sin dato en el mapa", nunca como "no había"', () => {
  const r = analizarVia({ elements: [via(1, recta(300), { highway: 'tertiary' })] }, ORIGEN);
  const filas = Object.fromEntries(filasDeLaVia(r).map((f) => [f.clave, f]));
  for (const clave of ['carriles', 'maxima', 'adelantar', 'superficie', 'alumbrado']) {
    assert.equal(filas[clave].valor, 'Sin dato en el mapa', clave);
    assert.equal(filas[clave].aviso, 'sin-dato', clave);
  }
  assert.equal(filas.adelantar.etiqueta, 'Doble línea');
  assert.equal(filas.via.valor, 'Vía sin nombre en el mapa');
  assert.match(filas.senales.nota, /no quiere decir que no haya/);
  assert.equal(filas.sentido.valor, 'Doble sentido');
  assert.match(filas.sentido.nota, /el mapa no dice lo contrario/);
  const todo = JSON.stringify(filasDeLaVia(r));
  assert.doesNotMatch(todo, /no había|no hay semáforo|sin semáforo/i);
});

test('el pin lejos de la vía se avisa', () => {
  const r = analizarVia({ elements: [via(1, recta(300).map((p) => ({ x: p.x, y: p.y + 32 })), { name: 'Calle 10' })] }, ORIGEN);
  const fila = filasDeLaVia(r)[0];
  assert.equal(fila.aviso, 'atencion');
  assert.match(fila.nota, /a 32\u00a0m de esta vía/);
});

test('las etiquetas: sentido, carriles, máxima, adelantar, superficie y alumbrado', () => {
  assert.deepEqual(sentidoDe({ oneway: 'yes' }), { valor: 'uno', segun: 'mapa' });
  assert.deepEqual(sentidoDe({ oneway: 'no' }), { valor: 'doble', segun: 'mapa' });
  assert.deepEqual(sentidoDe({ junction: 'roundabout' }), { valor: 'uno', segun: 'glorieta' });
  assert.deepEqual(sentidoDe({ highway: 'motorway' }), { valor: 'uno', segun: 'autopista' });
  assert.deepEqual(sentidoDe({}), { valor: 'doble', segun: 'convencion' });
  assert.equal(carrilesDe({ lanes: '2' }), 2);
  assert.equal(carrilesDe({ lanes: 'dos' }), null);
  assert.deepEqual(maximaDe({ maxspeed: '30' }), { kmh: 30, texto: '30\u00a0km/h', enUnSentido: false });
  assert.deepEqual(maximaDe({ maxspeed: '60 km/h' }), { kmh: 60, texto: '60\u00a0km/h', enUnSentido: false });
  assert.deepEqual(maximaDe({ maxspeed: 'CO:urban' }), { kmh: null, texto: 'CO:urban', enUnSentido: false });
  assert.deepEqual(maximaDe({ 'maxspeed:forward': '50' }), { kmh: 50, texto: '50\u00a0km/h', enUnSentido: true });
  assert.equal(maximaDe({}), null);
  assert.equal(adelantarDe({ overtaking: 'no' }), 'prohibido');
  assert.equal(adelantarDe({ 'overtaking:forward': 'no' }), 'prohibido en un sentido');
  assert.equal(adelantarDe({ overtaking: 'yes' }), 'permitido');
  assert.equal(adelantarDe({}), null);
  assert.equal(superficieDe({ surface: 'asphalt' }), 'asfalto');
  assert.equal(superficieDe({ surface: 'gravel' }), 'destapada (gravilla)');
  assert.equal(superficieDe({}), null);
  assert.equal(alumbradoDe({ lit: 'yes' }), true);
  assert.equal(alumbradoDe({ lit: 'no' }), false);
  assert.equal(alumbradoDe({}), null);
  assert.equal(claseDeVia('tertiary'), 'vía terciaria');
  assert.equal(claseDeVia('primary_link'), 'enlace de vía primaria');
});

test('la doble línea del mapa, cuando la hay, sale como atención', () => {
  const r = analizarVia({ elements: [via(1, recta(300), { overtaking: 'no' })] }, ORIGEN);
  const fila = filasDeLaVia(r).find((f) => f.clave === 'adelantar');
  assert.equal(fila.valor, 'Prohibido adelantar');
  assert.equal(fila.aviso, 'atencion');
});

test('REAL: la curva de la vía Los Verjones–Patios (radio 13 m el 12-nov-2026)', () => {
  const { punto, respuesta } = leer('curva-verjones-patios');
  const a = analizarVia(respuesta, punto);
  assert.equal(a.via.nombre, 'Vía Los Verjones - Patios');
  assert.equal(a.via.clase, 'tertiary');
  assert.ok(a.forma.radio > 8 && a.forma.radio < 20, `radio ${a.forma.radio}`);
  assert.equal(a.forma.tipo, 'curva cerrada');
  assert.equal(a.carriles, 2);
  assert.equal(a.maxima.kmh, 30);
  assert.equal(a.adelantar, null);
  assert.deepEqual(a.senales, []);
  const filas = filasDeLaVia(a);
  assert.equal(filas.find((f) => f.clave === 'forma').valor, 'Curva cerrada, radio 13\u00a0m');
  assert.ok(a.tramo.length > 10);
});

test('REAL: Carrera 7 con Calle 60, con semáforo y cruce', () => {
  const { punto, respuesta } = leer('semaforo-chapinero');
  const a = analizarVia(respuesta, punto);
  assert.equal(a.via.nombre, 'Avenida Carrera 7');
  assert.ok(a.cruce && a.cruce.distancia < 5, JSON.stringify(a.cruce));
  assert.equal(a.cruce.con, 'Calle 60');
  assert.ok(a.senales.some((s) => s.texto === 'Semáforo' && s.distancia < 5));
  assert.equal(a.maxima.kmh, 50);
});
