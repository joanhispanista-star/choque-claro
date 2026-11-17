// El croquis (paso 7): los seis casos sobre una vía recta (con cuentas que se pueden hacer a mano)
// y sobre la curva real del ejemplo (radio 13 m), las flechas, el trazo a mano, el relato en
// palabras y lo que se guarda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { diferenciaAngular, distancia, planoLocal } from '../js/geo.js';
import { analizarVia } from '../js/via.js';
import {
  CASOS,
  COLA,
  MEDIO_CARRIL,
  armarCaso,
  cambiarCarro,
  croquisDesdeGuardado,
  croquisLibre,
  croquisParaGuardar,
  croquisUtilizable,
  faltaParaTerminar,
  flechaAutomatica,
  flechasDelCroquis,
  intercambiar,
  largoDelTrazo,
  limitesDelCroquis,
  medidasDelCarro,
  metrosPorPixel,
  ponerCarro,
  ponerFlecha,
  proyectarEnLaVia,
  puntaDeFlecha,
  puntoDeLaVia,
  quitarCarro,
  relatoDelCroquis,
  simplificarTrazo,
  viaDelCroquis,
  viaDesdeElAnalisis,
  viaDesdeGuardado,
} from '../js/croquis.js';

const CENTRO = { lat: 4.6484, lon: -74.0105 };
const CARROS = [
  { letra: 'A', quien: 'tuyo', linea: null },
  { letra: 'B', quien: 'otro', linea: null },
];

// Una vía recta hacia el este que pasa por CENTRO, con el tramo como lo da via.js (uno cada 4 m).
function viaRecta({ nombre = 'Avenida Carrera 7', rumbo = 90 } = {}) {
  const plano = planoLocal(CENTRO);
  const u = { x: Math.sin((rumbo * Math.PI) / 180), y: Math.cos((rumbo * Math.PI) / 180) };
  const tramo = [];
  for (let s = -60; s <= 60; s += 4) {
    const g = plano.aGrados({ x: u.x * s, y: u.y * s });
    tramo.push([g.lat, g.lon]);
  }
  return viaDelCroquis({ centro: CENTRO, tramo, nombre });
}

const leer = (archivo) => JSON.parse(fs.readFileSync(new URL(archivo, import.meta.url), 'utf8'));
function viaDelEjemplo() {
  const g = leer('./datos/ejemplo-verjones-patios.json');
  return viaDesdeElAnalisis(analizarVia(g.respuesta, g.punto), g.punto);
}

const enMetros = (via, p) => via.plano.aMetros(p);
const carroDe = (croquis, letra) => croquis.carros.find((c) => c.letra === letra);

test('la vía recta: el punto y la proyección se deshacen el uno al otro', () => {
  const via = viaRecta();
  assert.ok(via.real);
  assert.ok(Math.abs(via.s0 - 60) < 1e-6, String(via.s0));
  const p = puntoDeLaVia(via, via.s0 + 10, 2);
  // Hacia el este, la derecha es el sur.
  assert.ok(Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y + 2) < 1e-6, JSON.stringify(p));
  const r = proyectarEnLaVia(via, p);
  assert.ok(Math.abs(r.s - (via.s0 + 10)) < 1e-6 && Math.abs(r.lado - 2) < 1e-6 && Math.abs(r.rumbo - 90) < 1e-6, JSON.stringify(r));
  // Fuera del tramo, la vía sigue derecho.
  const lejos = puntoDeLaVia(via, -15, 0);
  assert.ok(Math.abs(lejos.x + 75) < 1e-6 && Math.abs(lejos.y) < 1e-6, JSON.stringify(lejos));
  assert.ok(Math.abs(proyectarEnLaVia(via, { x: 80, y: 1 }).s - 140) < 1e-6);
});

test('de frente en una recta: cada uno por su derecha, mirándose, y el golpe en el medio', () => {
  const via = viaRecta();
  const { largo } = medidasDelCarro(CARROS[0]);
  const c = armarCaso('frente', via, CARROS);
  assert.equal(c.modo, 'guiado');
  const A = carroDe(c, 'A');
  const B = carroDe(c, 'B');
  const mA = enMetros(via, A);
  const mB = enMetros(via, B);
  assert.ok(Math.abs(mA.x + (largo / 2 + 5)) < 0.01 && Math.abs(mA.y + MEDIO_CARRIL) < 0.01, JSON.stringify(mA));
  assert.ok(Math.abs(mB.x - (largo / 2 + 5)) < 0.01 && Math.abs(mB.y - MEDIO_CARRIL) < 0.01, JSON.stringify(mB));
  assert.ok(diferenciaAngular(A.rumbo, 90) < 0.01 && diferenciaAngular(B.rumbo, 270) < 0.01);
  assert.ok(distancia(enMetros(via, c.golpe), { x: 0, y: 0 }) < 0.01);
  assert.deepEqual(relatoDelCroquis(c, via), ['De frente.', 'A, tu carro, iba hacia el este.', 'B, el otro, iba hacia el oeste.', 'El golpe fue en la Avenida Carrera 7.']);
});

test('los seis casos sobre la curva real del ejemplo: cada carro en su carril y mirando como va', () => {
  const via = viaDelEjemplo();
  assert.ok(via.real && via.nombre === 'Vía Los Verjones - Patios');
  for (const { id } of CASOS) {
    const c = armarCaso(id, via, CARROS);
    assert.equal(c.carros.length, id === 'quieto' ? 1 : 2, id);
    assert.ok(Math.abs(proyectarEnLaVia(via, enMetros(via, c.golpe)).s - via.s0) < 1.5, `${id}: el golpe, cerca del punto marcado`);
    for (const carro of c.carros) {
      const p = proyectarEnLaVia(via, enMetros(via, carro));
      const atravesado = id === 'cruce' && carro.letra === 'B';
      if (atravesado) {
        // B sale de la otra vía: en ángulo recto con la del golpe, desde la izquierda de A.
        assert.ok(p.lado < -3, `${id} ${carro.letra}: lado ${p.lado}`);
        continue;
      }
      assert.ok(Math.abs(Math.abs(p.lado) - MEDIO_CARRIL) < (id === 'carril' ? 1.1 : 0.2), `${id} ${carro.letra}: lado ${p.lado}`);
      const conLaVia = Math.min(diferenciaAngular(carro.rumbo, p.rumbo), diferenciaAngular(carro.rumbo, p.rumbo + 180));
      assert.ok(conLaVia < (id === 'carril' && carro.letra === 'A' ? 16 : 4), `${id} ${carro.letra}: ${conLaVia}° con la vía`);
    }
  }
});

test('las flechas siguen la curva, por el carril de cada uno, y llegan al golpe', () => {
  const via = viaDelEjemplo();
  const c = armarCaso('frente', via, CARROS);
  const flechas = flechasDelCroquis(via, c);
  assert.deepEqual(flechas.map((f) => f.letra), ['A', 'B']);
  for (const f of flechas) {
    const carro = carroDe(c, f.letra);
    const inicio = enMetros(via, f.puntos[0]);
    // Empieza COLA metros detrás del carro, MEDIDOS POR LA VÍA: en la curva, en línea recta es menos.
    const sInicio = proyectarEnLaVia(via, inicio).s;
    const sCarro = proyectarEnLaVia(via, enMetros(via, carro)).s;
    assert.ok(Math.abs(Math.abs(sInicio - sCarro) - COLA) < 0.3, `${f.letra}: ${Math.abs(sInicio - sCarro)}`);
    // La cola va por el carril del carro, no cortando la curva.
    for (const p of f.puntos.slice(0, COLA)) {
      const lado = proyectarEnLaVia(via, enMetros(via, p)).lado;
      assert.ok(Math.abs(Math.abs(lado) - MEDIO_CARRIL) < 0.4, `${f.letra}: lado ${lado}`);
    }
    assert.ok(distancia(enMetros(via, f.puntos.at(-1)), enMetros(via, c.golpe)) < 0.05);
  }
  // Con recorte, la punta se queda a esos metros del golpe (para que no la tape la estrella).
  const corta = flechaAutomatica(via, carroDe(c, 'A'), c.golpe, { recorte: 1.5 });
  assert.ok(corta.alGolpe);
  const falta = distancia(enMetros(via, corta.puntos.at(-1)), enMetros(via, c.golpe));
  assert.ok(falta > 1.2 && falta < 1.55, String(falta));
});

test('quieto no tiene flecha; en reversa la flecha viene de adelante del carro; atravesado, derecha', () => {
  const via = viaRecta();
  const c = armarCaso('reversa', via, CARROS);
  const A = carroDe(c, 'A');
  assert.equal(A.movimiento, 'reversa');
  assert.equal(carroDe(c, 'B').movimiento, 'quieto');
  assert.equal(flechaAutomatica(via, carroDe(c, 'B'), c.golpe), null);
  const f = flechaAutomatica(via, A, c.golpe);
  assert.ok(f.alGolpe);
  // A mira al este y va hacia atrás: la flecha arranca al este de él y termina al oeste, en el golpe.
  assert.ok(enMetros(via, f.puntos[0]).x > enMetros(via, A).x + COLA - 0.5);
  assert.ok(enMetros(via, f.puntos.at(-1)).x < enMetros(via, A).x);
  assert.deepEqual(relatoDelCroquis(c, via).slice(1, 3), ['A, tu carro, iba en reversa hacia el oeste.', 'B, el otro, estaba quieto.']);

  // B en el cruce va atravesado: cola recta detrás de él y una curva hasta el golpe.
  const cruce = armarCaso('cruce', via, CARROS);
  const B = carroDe(cruce, 'B');
  assert.ok(diferenciaAngular(B.rumbo, 180) < 0.01, String(B.rumbo));
  const fb = flechaAutomatica(via, B, cruce.golpe);
  assert.ok(fb.alGolpe);
  const mB = enMetros(via, B);
  assert.ok(Math.abs(enMetros(via, fb.puntos[0]).x - mB.x) < 0.01 && Math.abs(enMetros(via, fb.puntos[0]).y - (mB.y + COLA)) < 0.01);
});

test('una flecha no llega a un golpe que el carro tiene detrás: termina en su trompa', () => {
  const via = viaRecta();
  const c = armarCaso('carril', via, CARROS);
  const B = carroDe(c, 'B');
  const f = flechaAutomatica(via, B, c.golpe);
  assert.equal(f.alGolpe, false);
  const fin = enMetros(via, f.puntos.at(-1));
  assert.ok(Math.abs(fin.x - (enMetros(via, B).x + B.largo / 2 + 1.5)) < 0.01);
});

test('el trazo con el dedo: los temblores se van, las esquinas se quedan', () => {
  const plano = planoLocal(CENTRO);
  const tembloroso = [];
  for (let i = 0; i <= 40; i++) tembloroso.push(plano.aGrados({ x: i * 0.5, y: i % 2 ? 0.1 : -0.1 }));
  const recto = simplificarTrazo(tembloroso);
  assert.equal(recto.length, 2);
  const ele = [];
  for (let i = 0; i <= 20; i++) ele.push(plano.aGrados({ x: i * 0.5, y: 0 }));
  for (let i = 1; i <= 20; i++) ele.push(plano.aGrados({ x: 10, y: i * 0.5 }));
  const conEsquina = simplificarTrazo(ele).map((p) => plano.aMetros(p));
  assert.equal(conEsquina.length, 3);
  assert.ok(distancia(conEsquina[1], { x: 10, y: 0 }) < 0.01);
  assert.ok(Math.abs(largoDelTrazo(ele) - 20) < 0.01);
});

test('la punta de la flecha: en el último punto, apuntando como el último pedazo', () => {
  const plano = planoLocal(CENTRO);
  const puntos = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0.3, y: 10.2 }].map((p) => plano.aGrados(p));
  const [punta, a, b] = puntaDeFlecha(puntos, { largo: 2.4 }).map((p) => plano.aMetros(p));
  assert.ok(distancia(punta, { x: 0.3, y: 10.2 }) < 0.01);
  // El temblor del final (0,3 m de lado en 0,36 m) no tuerce la punta: sigue mirando casi al norte.
  const base = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const direccion = (Math.atan2(punta.x - base.x, punta.y - base.y) * 180) / Math.PI;
  assert.ok(Math.abs(direccion) < 12, String(direccion));
  assert.equal(puntaDeFlecha([puntos[0]]), null);
});

test('cambiar A y B intercambia dónde iban, no quiénes son', () => {
  const via = viaDelEjemplo();
  const c = armarCaso('detras', via, CARROS);
  const cambiado = intercambiar(c);
  assert.equal(carroDe(cambiado, 'A').quien, 'tuyo');
  assert.equal(carroDe(cambiado, 'A').lat, carroDe(c, 'B').lat);
  assert.equal(carroDe(cambiado, 'A').movimiento, 'quieto');
  assert.equal(carroDe(cambiado, 'B').movimiento, 'adelante');
  assert.deepEqual(intercambiar(cambiado), c);
  // Sin B en el mapa no hay con quién cambiar.
  const solo = armarCaso('quieto', via, CARROS);
  assert.equal(intercambiar(solo), solo);
});

test('a mano: las fichas caen junto al golpe, sin pisarse; B en «contra algo quieto» queda parqueado', () => {
  const via = viaRecta();
  let c = croquisLibre(via);
  assert.equal(c.modo, 'libre');
  assert.equal(c.carros.length, 0);
  assert.deepEqual(faltaParaTerminar(c), ['Falta tu carro (A): toca su ficha, debajo del mapa, para ponerlo.']);
  c = ponerCarro(c, via, CARROS[1]);
  c = ponerCarro(c, via, CARROS[0]);
  assert.equal(ponerCarro(c, via, CARROS[0]), c, 'un carro puesto no se pone dos veces');
  const [mB, mA] = c.carros.map((x) => enMetros(via, x));
  assert.ok(distancia(mA, mB) > 4.5, `${distancia(mA, mB)}`);
  assert.deepEqual(faltaParaTerminar(c), []);
  // Una flecha por carro: la nueva reemplaza la vieja; quitar el carro quita su flecha.
  const plano = planoLocal(CENTRO);
  const trazo = [plano.aGrados({ x: -20, y: -2 }), plano.aGrados({ x: -1, y: 0 })];
  c = ponerFlecha(c, 'A', trazo);
  c = ponerFlecha(c, 'A', trazo.slice().reverse());
  assert.equal(c.flechas.length, 1);
  assert.deepEqual(flechasDelCroquis(via, c)[0].puntos, trazo.slice().reverse());
  assert.equal(quitarCarro(c, 'A').flechas.length, 0);

  const quieto = ponerCarro(armarCaso('quieto', via, CARROS), via, CARROS[1]);
  const B = carroDe(quieto, 'B');
  assert.equal(B.movimiento, 'quieto');
  const pB = proyectarEnLaVia(via, enMetros(via, B));
  assert.ok(pB.s > via.s0 && Math.abs(pB.lado - MEDIO_CARRIL) < 0.01);
});

test('del guiado a mano: lo armado se queda y sus flechas pasan a ser editables', () => {
  const via = viaDelEjemplo();
  const guiado = armarCaso('frente', via, CARROS);
  const libre = croquisLibre(via, guiado);
  assert.equal(libre.modo, 'libre');
  assert.deepEqual(libre.carros, guiado.carros);
  assert.deepEqual(libre.flechas.map((f) => f.letra), ['A', 'B']);
  assert.deepEqual(flechasDelCroquis(via, libre), flechasDelCroquis(via, guiado));
});

test('girar y mover: el rumbo se guarda entre 0 y 360', () => {
  const via = viaRecta();
  const c = cambiarCarro(armarCaso('frente', via, CARROS), 'A', { rumbo: -30 });
  assert.equal(carroDe(c, 'A').rumbo, 330);
  assert.equal(cambiarCarro(c, 'A', { rumbo: 725 }).carros[0].rumbo, 5);
});

test('lo que se guarda: se puede volver a abrir y dice lo mismo, sin funciones adentro', () => {
  const via = viaDelEjemplo();
  const c = cambiarCarro(armarCaso('frente', via, CARROS), 'B', { movimiento: 'quieto' });
  const guardado = croquisParaGuardar(c, via, { punto: CENTRO, ejemplo: true, hora: '2026-11-12T22:15:00.000Z' });
  assert.deepEqual(JSON.parse(JSON.stringify(guardado)), guardado);
  assert.ok(croquisUtilizable(guardado));
  assert.equal(guardado.via.tramo.length, 31);
  assert.equal(guardado.flechas.length, 1, 'B quieto no tiene flecha');
  assert.equal(guardado.hecho, null);
  const otraVia = viaDesdeGuardado(guardado);
  const abierto = croquisDesdeGuardado(guardado);
  assert.deepEqual(relatoDelCroquis(abierto, otraVia), relatoDelCroquis(c, via));
  for (const carro of abierto.carros) assert.ok(distancia(enMetros(via, carro), enMetros(via, carroDe(c, carro.letra))) < 0.02);
  assert.equal(croquisUtilizable({ ...guardado, version: 99 }), false);
  assert.equal(croquisUtilizable(null), false);
});

test('sin la vía del mapa: una recta imaginaria hacia el norte, y el relato no nombra ninguna vía', () => {
  const via = viaDesdeElAnalisis({ estado: 'error', error: 'El mapa no respondió' }, CENTRO);
  assert.equal(via.real, false);
  const c = armarCaso('frente', via, CARROS);
  assert.ok(diferenciaAngular(carroDe(c, 'A').rumbo, 0) < 0.01);
  assert.deepEqual(relatoDelCroquis(c, via), ['De frente.', 'A, tu carro, iba hacia el norte.', 'B, el otro, iba hacia el sur.']);
  const guardado = croquisParaGuardar(c, via);
  assert.equal(guardado.via.tramo, null);
  assert.equal(viaDesdeGuardado(guardado).real, false);
});

test('el nombre de la vía con su artículo', () => {
  const via = viaRecta({ nombre: 'Puente Aranda' });
  assert.equal(relatoDelCroquis(armarCaso('quieto', via, CARROS), via).at(-1), 'El golpe fue en la vía Puente Aranda.');
});

test('el carro se dibuja con las medidas de su línea, si la persona la eligió', () => {
  const picanto = { letra: 'A', quien: 'tuyo', linea: { marca: 'Kia', linea: 'Picanto', carroceria: 'hatchback', medidas: { largo: 3595, ancho: 1595 } } };
  assert.deepEqual(medidasDelCarro(picanto), { largo: 3.6, ancho: 1.6 });
  const sin = medidasDelCarro({ letra: 'B', quien: 'otro', linea: null });
  assert.ok(sin.largo > 4 && sin.largo < 5 && sin.ancho > 1.6 && sin.ancho < 2, JSON.stringify(sin));
});

test('en el cruce de Chapinero, B sale atravesado a la Carrera 7', () => {
  const g = leer('datos/semaforo-chapinero.json');
  const analisis = analizarVia(g.respuesta, g.punto);
  const via = viaDesdeElAnalisis(analisis, g.punto);
  const c = armarCaso('cruce', via, CARROS);
  assert.ok(diferenciaAngular(carroDe(c, 'B').rumbo, carroDe(c, 'A').rumbo) > 80);
  assert.equal(relatoDelCroquis(c, via).at(-1), 'El golpe fue en la Avenida Carrera 7.');
});

test('para el mapa: metros por píxel y la caja de todo lo dibujado', () => {
  assert.ok(Math.abs(metrosPorPixel(0, 0) - 156543.03392) < 1e-6);
  assert.ok(Math.abs(metrosPorPixel(60, 1) - 156543.03392 / 4) < 1e-6);
  const via = viaDelEjemplo();
  const c = armarCaso('frente', via, CARROS);
  const flechas = flechasDelCroquis(via, c);
  const [[s, o], [n, e]] = limitesDelCroquis(c, flechas);
  for (const p of [...c.carros, c.golpe, ...flechas.flatMap((f) => f.puntos)]) assert.ok(p.lat >= s && p.lat <= n && p.lon >= o && p.lon <= e);
  assert.equal(limitesDelCroquis({ carros: [], golpe: null }), null);
});
