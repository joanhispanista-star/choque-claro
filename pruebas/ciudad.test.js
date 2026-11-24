// La ciudad de la vista realista, en números: las paredes, los techos y qué casas tapan lo que hay que ver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { areaConSigno, armarCiudad, azar, estaAdentro, queTapan, PRETIL_M, PISO_M, TRAMO_M } from '../js/ciudad.js';

const cuadrado = (x, y, lado) => [[x, y], [x + lado, y], [x + lado, y + lado], [x, y + lado]];
const casa = (x, y, lado, h) => ({ h, a: cuadrado(x, y, lado) });
const triangulos = (m) => m.indice.length / 3;
const FACHADAS = ['ladrillo', 'estuco', 'apto'];
const deFachada = (mallas) => FACHADAS.reduce((s, t) => s + triangulos(mallas[t]) / 2, 0);
// Los vértices de una malla, en filas de tres.
const puntos = (m) => Array.from({ length: m.posicion.length / 3 }, (_, i) => m.posicion.slice(i * 3, i * 3 + 3));

test('una casa suelta: cuatro fachadas con una celda por piso y por tramo, y su techo', () => {
  const { lista, mallas } = armarCiudad([casa(10, 10, 9.9, 5.6)], { medios: [50] });
  assert.equal(lista.length, 1);
  const pisos = Math.round((5.6 + PRETIL_M) / PISO_M);
  const tramos = Math.round(9.9 / TRAMO_M);
  assert.equal(deFachada(mallas), 4 * pisos * tramos);
  assert.equal(triangulos(mallas.techos[0]), 2);
  // El techo mira hacia arriba y va a la altura de la casa.
  for (const [, y] of puntos(mallas.techos[0])) assert.equal(y, 5.6);
  assert.deepEqual(mallas.techos[0].normal.slice(0, 3), [0, 1, 0]);
});

test('el orden de los triángulos del techo mira al cielo, venga la planta como venga', () => {
  for (const a of [cuadrado(0, 0, 8), [...cuadrado(0, 0, 8)].reverse()]) {
    const { mallas } = armarCiudad([{ h: 6, a }], { medios: [50] });
    const p = puntos(mallas.techos[0]);
    for (let i = 0; i < mallas.techos[0].indice.length; i += 3) {
      const [u, v, w] = mallas.techos[0].indice.slice(i, i + 3).map((k) => p[k]);
      const y = (v[2] - u[2]) * (w[0] - u[0]) - (v[0] - u[0]) * (w[2] - u[2]);
      assert.ok(y > 0, 'un triángulo del techo mira al piso');
    }
  }
});

test('las paredes miran hacia afuera, venga la planta al derecho o al revés', () => {
  for (const a of [cuadrado(20, 20, 10), [...cuadrado(20, 20, 10)].reverse()]) {
    const { mallas } = armarCiudad([{ h: 6, a }], { medios: [50] });
    for (const t of FACHADAS) {
      puntos(mallas[t]).forEach(([x, , z], i) => {
        const [nx, , nz] = mallas[t].normal.slice(i * 3, i * 3 + 3);
        assert.ok((x - 25) * nx + (z + 25) * nz > 0, 'una pared mira hacia adentro');
      });
    }
  }
});

test('las celdas de la hoja de textura nunca se salen de ella', () => {
  const { mallas } = armarCiudad([casa(0, 0, 12, 9), casa(30, 0, 14, 40), casa(-40, 10, 8, 3)], { medios: [50] });
  for (const t of [...FACHADAS]) for (const v of mallas[t].uv) assert.ok(v >= 0 && v <= 1, `${t}: ${v}`);
  for (const v of mallas.techos[0].uv) assert.ok(v >= 0 && v <= 1);
});

test('el último punto repetido se quita y lo que no es una casa no se dibuja', () => {
  const a = cuadrado(0, 0, 8);
  const { lista } = armarCiudad([{ h: 6, a: [...a, a[0]] }, { h: 6, a: a.slice(0, 2) }, { h: 6, a: cuadrado(0, 0, 1) }, { h: 6 }], { medios: [50] });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].a.length, 4);
  assert.ok(areaConSigno(lista[0].a) > 0);
});

test('una casa sin altura en el mapa mide lo mínimo, no cero', () => {
  const { lista } = armarCiudad([{ a: cuadrado(0, 0, 8) }], {});
  assert.ok(lista[0].alto > 2);
});

test('la pared pegada a otra casa no lleva ventanas: solo se ve lo que sobresale', () => {
  // Dos casas de 8 m pegadas, de 5 y de 12 m de alto.
  const sola = deFachada(armarCiudad([casa(0, 0, 8, 12)], { medios: [50] }).mallas);
  const { mallas } = armarCiudad([casa(0, 0, 8, 12), casa(8, 0, 8, 5)], { medios: [50] });
  const pisos = Math.round((12 + PRETIL_M) / PISO_M);
  const tramos = Math.round(8 / TRAMO_M);
  const deLaBaja = 3 * Math.round((5 + PRETIL_M) / PISO_M) * tramos;
  assert.equal(deFachada(mallas), sola - pisos * tramos + deLaBaja);
  // Lo que sobresale de la alta, contra la baja, arranca donde termina la baja.
  const x8 = puntos(mallas.culata).filter(([x], i) => Math.abs(x - 8) < 1e-9 && mallas.culata.normal[i * 3] > 0.9 && mallas.culata.edificio[i] === 0);
  assert.ok(x8.some(([, y]) => Math.abs(y - 5) < 1e-9), 'la culata no arranca en el techo de la vecina');
  assert.ok(x8.every(([, y]) => y >= 5 - 1e-9));
});

test('si la vecina solo tapa una punta, la pared conserva su fachada', () => {
  const { mallas: sin } = armarCiudad([casa(0, 0, 20, 6)], { medios: [50] });
  const { mallas: con } = armarCiudad([casa(0, 0, 20, 6), { h: 6, a: [[20, 0], [24, 0], [24, 5], [20, 5]] }], { medios: [50] });
  const pared = (m) => FACHADAS.reduce((s, t) => s + m[t].edificio.filter((e) => e === 0).length / 4, 0);
  assert.equal(pared(con), pared(sin));
});

test('cada techo toma la foto más nítida donde cabe entero', () => {
  const { mallas } = armarCiudad([casa(0, 0, 10, 5), casa(60, 0, 10, 5), casa(300, 0, 10, 5)], { medios: [50, 200, 1000] });
  assert.deepEqual(mallas.techos.map(triangulos), [2, 2, 2]);
  assert.deepEqual(mallas.techos.map((m) => m.edificio[0]), [0, 1, 2]);
  // En el centro del plano, la mitad de la foto.
  const { mallas: m } = armarCiudad([casa(0, 0, 10, 5)], { medios: [50] });
  assert.deepEqual(m.techos[0].uv.slice(0, 2), [0.5, 0.5]);
});

test('una casa que no cabe en ninguna foto lleva techo de cemento, no el color de la orilla', () => {
  // Pasó en Chapinero el 24-nov-2026: sin la foto de 2 km, los techos de lejos salían negros.
  const { mallas } = armarCiudad([casa(300, 0, 10, 5)], { medios: [50, 200] });
  assert.deepEqual(mallas.techos.map(triangulos), [0, 0]);
  const arriba = puntos(mallas.culata).filter(([, y], i) => y === 5 && mallas.culata.normal[i * 3 + 1] === 1);
  assert.equal(arriba.length, 4);
});

test('sin foto del lugar, los techos llevan una de las tejas', () => {
  const { mallas } = armarCiudad([casa(0, 0, 10, 5), casa(30, 0, 10, 5)], { tejas: 9 });
  assert.equal(mallas.tejas.reduce((s, m) => s + triangulos(m), 0), 4);
});

test('un edificio alto es de apartamentos, y la base baja del piso para las cuestas', () => {
  const { mallas } = armarCiudad([casa(0, 0, 12, 30)], { medios: [50] });
  assert.ok(triangulos(mallas.apto) > 0);
  assert.equal(triangulos(mallas.ladrillo) + triangulos(mallas.estuco), 0);
  assert.equal(Math.min(...puntos(mallas.culata).map((p) => p[1])), -2.5);
});

test('lejos, una casa igual gasta menos dibujo', () => {
  const cerca = deFachada(armarCiudad([casa(0, 0, 12, 9)], {}).mallas);
  const lejos = deFachada(armarCiudad([casa(300, 0, 12, 9)], {}).mallas);
  assert.ok(lejos < cerca / 2, `${lejos} contra ${cerca}`);
});

test('la misma casa sale igual cada vez', () => {
  const armar = () => JSON.stringify(armarCiudad([casa(0, 0, 12, 9), casa(12, 0, 9, 4)], { medios: [50] }).mallas.estuco.uv);
  assert.equal(armar(), armar());
  assert.ok(azar(7) >= 0 && azar(7) < 1 && azar(7) === azar(7) && azar(7) !== azar(8));
});

test('adentro y afuera', () => {
  assert.ok(estaAdentro(5, 5, cuadrado(0, 0, 10)));
  assert.ok(!estaAdentro(15, 5, cuadrado(0, 0, 10)));
});

test('se baja la casa que queda entre el ojo y el carro, y solo esa', () => {
  const { lista } = armarCiudad([casa(20, -5, 10, 6), casa(20, 40, 10, 6), casa(-30, -5, 10, 6)], {});
  const carro = [{ x: 0, y: 0, z: 0.8 }];
  // A ras: la de enfrente tapa; la de al lado y la de atrás del carro, no.
  assert.deepEqual([...queTapan(lista, { x: 60, y: 0, z: 10 }, carro)], [0]);
  // Desde muy arriba se ve por encima de todas.
  assert.deepEqual([...queTapan(lista, { x: 60, y: 0, z: 300 }, carro)], []);
  // Con el suelo de esa casa 100 m más arriba, vuelve a tapar.
  assert.deepEqual([...queTapan(lista, { x: 60, y: 0, z: 100 }, carro, (k) => (k === 0 ? 100 : 0))], [0]);
  // Sin nada que ver, no se baja ninguna.
  assert.equal(queTapan(lista, { x: 60, y: 0, z: 10 }, []).size, 0);
});

test('si la cámara queda metida en una casa, esa casa estorba', () => {
  const { lista } = armarCiudad([casa(20, -5, 10, 6)], {});
  assert.ok(queTapan(lista, { x: 25, y: 0, z: 3 }, [{ x: 0, y: 0, z: 0.8 }]).has(0));
});

test('la ciudad del ejemplo: todas las casas caben en su foto y es liviana', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../datos/ejemplo-teusaquillo-ciudad.json', import.meta.url), 'utf8'));
  assert.ok(d.casas.length > 500 && d.arboles.length > 300);
  const { lista, mallas } = armarCiudad(d.casas, { medios: [49.944, 199.776, 998.88] });
  assert.ok(d.casas.length - lista.length <= 5, 'se descartan demasiadas casas');
  assert.ok(lista.every((e) => Math.max(...e.caja.map(Math.abs)) < 998.88 * 0.6), 'una casa llega a la orilla difuminada de la foto');
  const total = [...Object.values(mallas)].flat().reduce((s, m) => s + triangulos(m), 0);
  assert.ok(total > 10000 && total < 80000, `${total} triángulos`);
  for (const a of d.arboles) assert.ok(a.alto > 1 && a.alto < 30 && Number.isFinite(a.x) && Number.isFinite(a.y));
});

test('mil cuatrocientas casas apretadas se arman en menos de un segundo', () => {
  const muchas = Array.from({ length: 1400 }, (_, i) => casa((i % 40) * 8, Math.floor(i / 40) * 8, 8, 4 + (i % 5)));
  const t = performance.now();
  armarCiudad(muchas, { medios: [50, 200, 600] });
  assert.ok(performance.now() - t < 1000);
});
