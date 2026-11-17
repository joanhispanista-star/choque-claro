// El ejemplo en la esquina de Teusaquillo (desde el mar 17-nov-2026): que sus datos guardados sean de
// su punto, que un enlace viejo no los use, que el croquis inventado quede en el sentido de las calles
// y que los daños inventados caigan donde la recreación hace tocarse a los carros.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ARCHIVO_DEL_EJEMPLO, CASO_DEL_EJEMPLO, EJEMPLO, LUGAR_DEL_EJEMPLO, esElLugarDelEjemplo } from '../js/ejemplo.js';
import { EJEMPLO as EJEMPLO_DE_LA_PANTALLA } from '../js/pantalla-donde.js';
import { analizarVia } from '../js/via.js';
import { planoLocal, diferenciaAngular } from '../js/geo.js';
import { DANOS_DEL_EJEMPLO, DANOS_DE_FRENTE_DEL_EJEMPLO, carrosDeLaZona, casoDelEjemplo, croquisGuardadoDeEjemplo, danosDelEjemplo, leyendaDeLaZona } from '../js/zona-3d.js';
import { contornoDelCarro, fotograma, recreacionDelCroquis, seTocan } from '../js/recreacion.js';
import { PIEZAS_POR_ID } from '../js/piezas.js';

const guardado = JSON.parse(fs.readFileSync(new URL('../' + ARCHIVO_DEL_EJEMPLO, import.meta.url), 'utf8'));
const analisis = () => analizarVia(guardado.respuesta, EJEMPLO);

test('el ejemplo es uno solo: la pantalla del lugar usa el mismo punto', () => {
  assert.deepEqual(EJEMPLO_DE_LA_PANTALLA, EJEMPLO);
  assert.deepEqual(guardado.punto, EJEMPLO);
  assert.match(LUGAR_DEL_EJEMPLO, /Carrera 20 con Calle 44/);
  assert.equal(CASO_DEL_EJEMPLO, 'cruce');
});

test('los datos guardados solo sirven cerca del punto del ejemplo', () => {
  const plano = planoLocal(EJEMPLO);
  const a = (x, y) => plano.aGrados({ x, y });
  assert.equal(esElLugarDelEjemplo(EJEMPLO), true);
  assert.equal(esElLugarDelEjemplo(a(20, 0)), true, 'un pin corrido unos pasos');
  assert.equal(esElLugarDelEjemplo(a(0, 29)), true);
  assert.equal(esElLugarDelEjemplo(a(0, 31)), false);
  // El enlace viejo del ejemplo, en la curva de Los Verjones: se consulta en vivo.
  assert.equal(esElLugarDelEjemplo({ lat: 4.6484, lon: -74.0105 }), false);
  for (const malo of [null, undefined, {}, { lat: NaN, lon: 1 }, { lat: '4.63', lon: '-74.07' }]) assert.equal(esElLugarDelEjemplo(malo), false);
});

test('en la esquina, el ejemplo dice lo que hay en el mapa: Carrera 20, Calle 44 y los Pare', () => {
  const a = analisis();
  assert.equal(a.estado, 'ok');
  assert.equal(a.via.nombre, 'Carrera 20');
  assert.equal(a.cruce?.con, 'Calle 44');
  assert.equal(a.alReves, false, 'la Carrera 20 está dibujada en el sentido en que se va');
  assert.ok(a.senales.filter((s) => s.texto === 'Pare').length >= 2, JSON.stringify(a.senales));
  assert.ok(!a.senales.some((s) => /Semáforo/.test(s.texto) && s.distancia < 25), 'sin semáforo en la esquina');
  // En una recta no se dice el radio: «recta, radio 1299 m» no le dice nada a nadie.
  const tramo = leyendaDeLaZona({ ejemplo: true, analisis: a }).find((f) => f.clave === 'tramo');
  assert.equal(tramo.texto, 'Tramo analizado: recta');
  // Los carros inventados salen del análisis: sin él, la leyenda no los nombra como si estuvieran.
  const carros = (estado) => leyendaDeLaZona({ ejemplo: true, analisis: estado === 'ok' ? a : { estado } }).find((f) => f.clave === 'carros');
  assert.equal(carros('ok').texto, 'Carros A y B: un croquis INVENTADO para el ejemplo');
  assert.ok(carros('ok').color);
  assert.match(carros('cargando').texto, /en cuanto llegue el análisis/);
  assert.match(carros('error').texto, /^Sin carros/);
  assert.equal(carros('error').color, null);
});

test('el croquis inventado del ejemplo: A sube por la Carrera 20, B cruza por la Calle 44 desde su izquierda', () => {
  const croquis = croquisGuardadoDeEjemplo(analisis());
  assert.equal(croquis.ejemplo, true);
  const [A, B] = croquis.carros;
  assert.deepEqual([A.letra, B.letra], ['A', 'B']);
  // La Carrera 20 es de un solo sentido hacia el norte (unos 10°): A va en ese sentido.
  assert.ok(diferenciaAngular(A.rumbo, 10) < 10, `A: ${A.rumbo}`);
  // B, atravesado: de la izquierda de A hacia su derecha.
  assert.ok(diferenciaAngular(B.rumbo, A.rumbo + 90) < 10, `B: ${B.rumbo}`);
  assert.equal(carrosDeLaZona({ ejemplo: true, analisis: analisis() }).length, 2);
});

test('lejos de la esquina (un enlace viejo, en la curva), el ejemplo va de frente y con sus daños', () => {
  // Con el caso del cruce, B saldría atravesado de una calle que no existe.
  const g = JSON.parse(fs.readFileSync(new URL('./datos/ejemplo-verjones-patios.json', import.meta.url), 'utf8'));
  const curva = analizarVia(g.respuesta, g.punto);
  assert.equal(curva.estado, 'ok');
  assert.equal(casoDelEjemplo(curva), 'frente');
  assert.equal(danosDelEjemplo(curva), DANOS_DE_FRENTE_DEL_EJEMPLO);
  // El mismo croquis que pidiendo «de frente» a mano (en la curva cerrada los dos siguen la curva: sus
  // rumbos no quedan opuestos, y eso está bien).
  assert.deepEqual(croquisGuardadoDeEjemplo(curva), croquisGuardadoDeEjemplo(curva, 'frente'));
  assert.notDeepEqual(croquisGuardadoDeEjemplo(curva).carros, croquisGuardadoDeEjemplo(curva, 'cruce').carros);
  // En la esquina, el del ejemplo; y sin análisis, de frente (no hay cruce que valga).
  assert.equal(casoDelEjemplo(analisis()), 'cruce');
  assert.equal(danosDelEjemplo(analisis()), DANOS_DEL_EJEMPLO);
  assert.equal(casoDelEjemplo(null), 'frente');
  assert.equal(casoDelEjemplo({ ...analisis(), cruce: { ...analisis().cruce, distancia: 30 } }), 'frente');
});

test('los daños inventados caen donde la recreación hace tocarse a los carros', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisis()));
  assert.ok(rec?.toque, 'en la recreación se tocan');
  let toque = null;
  for (let t = 0; t <= 1 && !toque; t += 0.0005) {
    const [a, b] = fotograma(rec, t).carros;
    if (seTocan(contornoDelCarro(a, a.largo, a.ancho), contornoDelCarro(b, b.largo, b.ancho))) toque = fotograma(rec, Math.min(1, t + 0.002)).carros;
  }
  assert.ok(toque, 'hay un primer instante de contacto');
  // Qué esquina de un carro quedó dentro del otro, en las coordenadas de cada uno.
  const dentro = (pol, p) => {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const u = pol[i];
      const v = pol[(i + 1) % 4];
      s += (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x) > 0 ? 1 : -1;
    }
    return Math.abs(s) === 4;
  };
  const enElCarro = (c, p) => {
    const r = (c.rumbo * Math.PI) / 180;
    const u = { x: Math.sin(r), y: Math.cos(r) };
    const q = { x: p.x - c.x, y: p.y - c.y };
    return { adelante: q.x * u.x + q.y * u.y, derecha: q.x * u.y - q.y * u.x };
  };
  const [a, b] = toque;
  const ca = contornoDelCarro(a, a.largo, a.ancho);
  const cb = contornoDelCarro(b, b.largo, b.ancho);
  const puntos = [...ca.filter((p) => dentro(cb, p)), ...cb.filter((p) => dentro(ca, p))];
  assert.ok(puntos.length >= 1, 'una esquina entra en el otro carro');
  const lado = { A: new Set(), B: new Set() };
  for (const p of puntos) {
    for (const c of [a, b]) {
      const m = enElCarro(c, p);
      assert.ok(m.adelante > c.largo / 2 - 0.3, `el toque es en la trompa de ${c.letra}: ${JSON.stringify(m)}`);
      lado[c.letra].add(m.derecha < 0 ? 'izq' : 'der');
    }
  }
  // Medido el 17-nov-2026: la esquina delantera izquierda de A contra la delantera derecha de B.
  assert.deepEqual([...lado.A], ['izq']);
  assert.deepEqual([...lado.B], ['der']);
  for (const d of DANOS_DEL_EJEMPLO) {
    const pieza = PIEZAS_POR_ID.get(d.pieza);
    assert.ok(pieza, d.pieza);
    assert.ok(/-del|capo/.test(d.pieza), `${d.carro}: ${d.pieza} no está en la trompa`);
    assert.ok(pieza.lado === null || lado[d.carro].has(pieza.lado), `${d.carro}: ${d.pieza} está del lado que no se tocó`);
  }
  assert.deepEqual([...new Set(DANOS_DEL_EJEMPLO.map((d) => d.carro))].sort(), ['A', 'B']);
});
