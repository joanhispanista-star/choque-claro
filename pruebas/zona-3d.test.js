// La zona en 3D: la geometría de lo que se dibuja encima de la maqueta, con
// medidas que se pueden comprobar (metros), y la leyenda que dice qué falta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planoLocal, distancia, diferenciaAngular } from '../js/geo.js';
import { analizarVia } from '../js/via.js';
import { camaraDeArranque, camaraDeLaZona, camaraDelCroquis, capasDeLaZona, carrosDelCroquis, circulo, colorDeCarro, conoDeFoto, croquisDeEjemplo, croquisDeEstaZona, desplazar, fotosConCono, leyendaDeLaZona, luzDelSol, rectanguloDeCarro } from '../js/zona-3d.js';
import { armarCaso, cambiarCarro, croquisParaGuardar, viaDesdeElAnalisis } from '../js/croquis.js';

const CENTRO = { lat: 4.6484, lon: -74.0105 };
const plano = planoLocal(CENTRO);
const enMetros = ([lon, lat]) => plano.aMetros({ lat, lon });
const ejemplo = () => {
  const g = JSON.parse(fs.readFileSync(new URL('../datos/ejemplo-verjones-patios.json', import.meta.url), 'utf8'));
  return analizarVia(g.respuesta, g.punto);
};

test('desplazar 100 m al norte y al este', () => {
  const norte = enMetros([desplazar(CENTRO, 0, 100).lon, desplazar(CENTRO, 0, 100).lat]);
  assert.ok(Math.abs(norte.y - 100) < 0.01 && Math.abs(norte.x) < 0.01);
  const este = desplazar(CENTRO, 90, 100);
  assert.ok(Math.abs(enMetros([este.lon, este.lat]).x - 100) < 0.01);
});

test('el círculo de precisión tiene el radio pedido y se cierra', () => {
  const anillo = circulo(CENTRO, 12).coordinates[0];
  assert.deepEqual(anillo[0], anillo.at(-1));
  for (const p of anillo) assert.ok(Math.abs(distancia({ x: 0, y: 0 }, enMetros(p)) - 12) < 0.01);
});

test('el carro mide 4,2 × 1,8 m y mira hacia su rumbo', () => {
  const [a, b, c] = rectanguloDeCarro(CENTRO, 30).coordinates[0].map(enMetros);
  const lados = [distancia(a, b), distancia(b, c)].sort((x, y) => x - y);
  assert.ok(Math.abs(lados[0] - 1.8) < 0.01 && Math.abs(lados[1] - 4.2) < 0.01, JSON.stringify(lados));
  // La punta de adelante (a y b) queda hacia el rumbo 30°.
  const frente = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  assert.ok(diferenciaAngular((Math.atan2(frente.x, frente.y) * 180) / Math.PI, 30) < 0.5);
});

test('el cono de una foto sale de donde se tomó y abre hacia su rumbo', () => {
  const anillo = conoDeFoto(CENTRO, 90).coordinates[0].map(enMetros);
  assert.ok(distancia(anillo[0], { x: 0, y: 0 }) < 0.01);
  const medio = anillo[5]; // el rayo del centro (borde 4 de 0..8, tras el vértice)
  assert.ok(Math.abs(medio.x - 16) < 0.05 && Math.abs(medio.y) < 0.05, JSON.stringify(medio));
});

test('la cámara mira a lo largo de la vía', () => {
  assert.deepEqual(camaraDeLaZona(CENTRO, { estado: 'ok', rumbo: 223.4 }), { center: [-74.0105, 4.6484], zoom: 17.3, pitch: 62, bearing: 223 });
  assert.equal(camaraDeLaZona(CENTRO, null).bearing, 0);
});

test('el mapa arranca desde arriba: con la cámara inclinada, el relieve no calcula la altura', () => {
  assert.deepEqual(camaraDeArranque(CENTRO), { center: [-74.0105, 4.6484], zoom: 15, pitch: 0, bearing: 0 });
});

test('la luz viene de donde estaba el sol; de noche es floja y azulada', () => {
  assert.deepEqual(luzDelSol({ altura: 8, azimut: 251 }).position, [1.5, 251, 82]);
  assert.equal(luzDelSol({ altura: -20, azimut: 300 }).intensity, 0.25);
  assert.equal(luzDelSol(null).intensity, 0.25);
});

test('el croquis de ejemplo pone los dos carros sobre la curva real, uno contra el otro', () => {
  const a = ejemplo();
  const carros = croquisDeEjemplo(a);
  assert.equal(carros.length, 2);
  for (const c of carros) {
    const d = distancia({ x: 0, y: 0 }, plano.aMetros(c.centro));
    assert.ok(d > 10 && d < 40, `${c.nombre} a ${d} m del punto`);
    assert.ok(c.trayectoria.coordinates.length >= 5);
  }
  // Llegan al mismo punto por los dos lados de la vía. En una horquilla los dos
  // pueden ir hacia el mismo rumbo (los dos tramos corren paralelos): lo que
  // importa es que cada uno avance por la vía HACIA el golpe.
  assert.deepEqual(carros[0].trayectoria.coordinates.at(-1), carros[1].trayectoria.coordinates.at(-1));
  assert.notDeepEqual(carros[0].trayectoria.coordinates[0], carros[1].trayectoria.coordinates[0]);
  for (const c of carros) {
    const coords = c.trayectoria.coordinates;
    const k = coords.findIndex(([lon, lat]) => lon === c.centro.lon && lat === c.centro.lat);
    assert.ok(k >= 0 && k < coords.length - 1, `${c.nombre} está sobre su trayectoria`);
    const p = planoLocal(c.centro);
    const siguiente = p.aMetros({ lon: coords[k + 1][0], lat: coords[k + 1][1] });
    assert.ok(diferenciaAngular((Math.atan2(siguiente.x, siguiente.y) * 180) / Math.PI, c.rumbo) < 1, `${c.nombre} mira hacia donde avanza`);
  }
  assert.equal(croquisDeEjemplo({ estado: 'error' }), null);
});

test('las capas: sin análisis no se inventa la vía; sin sol no hay rayo; los conos salen de las fotos con rumbo', () => {
  const sin = capasDeLaZona({ centro: CENTRO, sol: { altura: -10, azimut: 280 } });
  assert.equal(sin.punto.features.length, 1);
  assert.equal(sin.tramo.features.length, 0);
  assert.equal(sin.sol.features.length, 0);
  assert.equal(sin.carros.features.length, 0, 'sin croquis no hay carros');
  const fotos = [
    { paso: 'escena', indice: 0, gps: { lat: 4.6484, lon: -74.0105, precision: 5 }, rumbo: 10 },
    { paso: 'escena', indice: 1, gps: { lat: 4.6484, lon: -74.0105, precision: 5 }, rumbo: null },
    { paso: 'carro', indice: 2, gps: { lat: 4.6484, lon: -74.0105, precision: 5 }, rumbo: 90 },
  ];
  assert.equal(fotosConCono(fotos).length, 1);
  const con = capasDeLaZona({ centro: CENTRO, precision: 8, analisis: ejemplo(), sol: { altura: 5, azimut: 251 }, ejemplo: true, fotos });
  assert.equal(con.tramo.features.length, 1);
  assert.equal(con.precision.features.length, 1);
  assert.equal(con.sol.features.length, 1);
  assert.equal(con.sol.features[0].properties.texto, 'Sol a 5°');
  assert.equal(con.conos.features.length, 1);
  assert.deepEqual(con.carros.features.map((f) => f.properties.nombre), ['A', 'B']);
  assert.equal(con.punto.features[0].properties.texto, 'Choque (ejemplo)');
});

test('la leyenda dice lo que falta: croquis, fotos o el sol', () => {
  const real = Object.fromEntries(leyendaDeLaZona({ analisis: ejemplo(), sol: { altura: -5 } }).map((f) => [f.clave, f.texto]));
  assert.match(real.carros, /salen del croquis \(paso 7\), que todavía no está hecho/);
  assert.equal(real.conos, 'Aún no hay fotos de la escena en este teléfono');
  assert.match(real.sol, /no había sol/);
  assert.match(real.tramo, /curva cerrada, radio 13 m/);
  const demo = Object.fromEntries(leyendaDeLaZona({ ejemplo: true, analisis: { estado: 'error' }, sol: { altura: 5 } }).map((f) => [f.clave, f.texto]));
  assert.match(demo.carros, /INVENTADO/);
  assert.equal(demo.conos, 'El ejemplo no tiene fotos de la escena: el choque es inventado');
  // Mientras llega el análisis, la leyenda no dice que falló.
  const cargando = leyendaDeLaZona({ analisis: { estado: 'cargando' } }).find((f) => f.clave === 'tramo');
  assert.equal(cargando.texto, 'Analizando la vía en el mapa…');
  assert.match(demo.tramo, /no se pudo consultar/);
  assert.match(demo.sol, /5° sobre el horizonte/);
});

// El croquis del paso 7, guardado como lo guarda la pantalla, sobre la curva del ejemplo.
function croquisGuardado({ ejemplo: delEjemplo = true, punto = CENTRO, hecho = null } = {}) {
  const a = ejemplo();
  const via = viaDesdeElAnalisis(a, CENTRO);
  const picanto = { letra: 'A', quien: 'tuyo', linea: { carroceria: 'hatchback', medidas: { largo: 3595, ancho: 1595 } } };
  const c = cambiarCarro(armarCaso('frente', via, [picanto, { letra: 'B', quien: 'otro', linea: null }]), 'B', { movimiento: 'quieto' });
  return croquisParaGuardar(c, via, { punto, ejemplo: delEjemplo, hecho });
}

test('el croquis del teléfono va a la zona solo si es de este lugar y del mismo tipo', () => {
  const g = croquisGuardado();
  assert.equal(croquisDeEstaZona(g, CENTRO, true), g);
  assert.equal(croquisDeEstaZona(g, CENTRO, false), null, 'el del ejemplo no se le pega a un choque de verdad');
  assert.equal(croquisDeEstaZona(croquisGuardado({ ejemplo: false }), CENTRO, true), null, 'ni al revés');
  assert.equal(croquisDeEstaZona(g, desplazar(CENTRO, 0, 149), true), g);
  assert.equal(croquisDeEstaZona(g, desplazar(CENTRO, 0, 151), true), null, 'de otro lugar');
  assert.equal(croquisDeEstaZona({ ...g, carros: [] }, CENTRO, true), null, 'sin carros no hay nada que dibujar');
  assert.equal(croquisDeEstaZona(null, CENTRO, true), null);
});

test('con croquis, la maqueta dibuja sus carros con su tamaño, sus flechas y el golpe; no el inventado', () => {
  const g = croquisGuardado();
  const carros = carrosDelCroquis(g);
  assert.deepEqual(carros.map((c) => [c.nombre, c.color]), [['A', colorDeCarro('A')], ['B', colorDeCarro('B')]]);
  assert.equal(carros[1].trayectoria, null, 'B quieto no tiene flecha');
  const capas = capasDeLaZona({ centro: CENTRO, analisis: ejemplo(), ejemplo: true, croquis: g });
  assert.equal(capas.carros.features.length, 2);
  assert.equal(capas.trayectorias.features.length, 1);
  assert.equal(capas.golpe.features.length, 1);
  // A es un Picanto: 3,6 m, no los 4,2 del carro genérico del ejemplo.
  const [a, b, c] = capas.carros.features[0].geometry.coordinates[0].map(enMetros);
  const lados = [distancia(a, b), distancia(b, c)].sort((x, y) => x - y);
  assert.ok(Math.abs(lados[1] - 3.6) < 0.01 && Math.abs(lados[0] - 1.6) < 0.01, JSON.stringify(lados));
  // Sin croquis, el ejemplo sigue con el inventado y no hay golpe.
  assert.equal(capasDeLaZona({ centro: CENTRO, analisis: ejemplo(), ejemplo: true }).golpe.features.length, 0);
  const leyendaDe = (croquis) => Object.fromEntries(leyendaDeLaZona({ ejemplo: true, analisis: ejemplo(), croquis }).map((f) => [f.clave, f.texto])).carros;
  assert.equal(leyendaDe(croquisGuardado({ hecho: '2026-11-13T15:00:00.000Z' })), 'Carros A y B, sus flechas y el golpe: tu croquis del paso 7, lo que declaraste, no una medición');
  // Antes de «Listo: así fue» es un borrador; y sin flechas (todos quietos), no se nombran.
  assert.equal(leyendaDe(g), 'Carros A y B, sus flechas y el golpe: tu croquis del paso 7, todavía sin terminar, no una medición');
  assert.equal(leyendaDe({ ...g, flechas: [] }), 'Carros A y B, y el golpe: tu croquis del paso 7, todavía sin terminar, no una medición');
  assert.equal(leyendaDe({ carros: [{ letra: 'A' }], flechas: [], hecho: 'ya' }), 'Carro A y el golpe: tu croquis del paso 7, lo que declaraste, no una medición');
  assert.equal(colorDeCarro('Z'), colorDeCarro('F'));
});

test('con croquis, la cámara se acerca al golpe hasta que quepan los carros y sus flechas', () => {
  const g = croquisGuardado();
  const zona = camaraDeLaZona(CENTRO, ejemplo());
  const cam = camaraDelCroquis(CENTRO, ejemplo(), g);
  assert.deepEqual(cam.center, [g.golpe.lon, g.golpe.lat]);
  assert.equal(cam.pitch, zona.pitch);
  assert.equal(cam.bearing, zona.bearing, 'sigue mirando a lo largo de la vía');
  // Lo más lejano del golpe tiene que quedar dentro de los 120 px que se le dan al croquis.
  const plano = planoLocal(g.golpe);
  const radio = Math.max(...g.carros.map((c) => distancia(plano.aMetros(c), { x: 0, y: 0 }) + c.largo / 2), ...g.flechas.flatMap((f) => f.puntos.map((p) => distancia(plano.aMetros(p), { x: 0, y: 0 }))));
  const metrosPorPixel = (78271.517 * Math.cos((g.golpe.lat * Math.PI) / 180)) / 2 ** cam.zoom;
  assert.ok(cam.zoom > zona.zoom + 1, `se acerca: ${cam.zoom}`);
  assert.ok(radio / metrosPorPixel <= 121 && radio / metrosPorPixel > 100, `${(radio / metrosPorPixel).toFixed(1)} px`);
  // Una flecha de 300 m no lo aleja más que la zona; un croquis diminuto no lo acerca más de 19.
  const lejana = { ...g, flechas: [{ letra: 'A', puntos: [g.golpe, desplazar(g.golpe, 90, 300)] }] };
  assert.equal(camaraDelCroquis(CENTRO, ejemplo(), lejana).zoom, zona.zoom);
  assert.equal(camaraDelCroquis(CENTRO, ejemplo(), { ...g, carros: [], flechas: [] }).zoom, 19);
  // Sin golpe, la de la zona.
  assert.deepEqual(camaraDelCroquis(CENTRO, ejemplo(), { ...g, golpe: null }), zona);
});
