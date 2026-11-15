// La recreación del choque (recreacion.js): el croquis en movimiento, sin inventar velocidades ni lo
// que pasó después del golpe. Las pruebas de los casos corren en una vía recta y en la curva real
// del ejemplo (Los Verjones): en la recta las flechas no tienen quiebres y escondían defectos
// (revisión del 14-nov).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analizarVia } from '../js/via.js';
import { armarCaso, cambiarCarro, croquisParaGuardar, viaDelCroquis, viaDesdeElAnalisis } from '../js/croquis.js';
import { croquisGuardadoDeEjemplo } from '../js/zona-3d.js';
import {
  AIRE_DEL_ENCUADRE,
  GOLPE_EN,
  avisosDeLaRecreacion,
  camaraQueSigue,
  contornoDelCarro,
  encuadreDeLosCarros,
  fotograma,
  fotogramaDelCroquis,
  recreacionDelCroquis,
  selloDeLaRecreacion,
  seTocan,
  textoDeLaFase,
} from '../js/recreacion.js';

const CENTRO = { lat: 4.6484, lon: -74.0105 };
const analisisDelEjemplo = () => {
  const g = JSON.parse(fs.readFileSync(new URL('../datos/ejemplo-verjones-patios.json', import.meta.url), 'utf8'));
  return analizarVia(g.respuesta, g.punto);
};
const VIAS = {
  recta: viaDelCroquis({ centro: CENTRO, rumbo: 90 }),
  curva: (() => {
    const a = analisisDelEjemplo();
    return viaDesdeElAnalisis(a, a.enLaVia);
  })(),
};
const DOS = [{ letra: 'A', quien: 'tuyo' }, { letra: 'B', quien: 'otro' }];
// El caso del croquis puesto como lo pone el paso 7, con `cambios` por carro (lo que la persona corrige).
function armado(caso, nombreDeVia = 'recta', { carros = DOS, cambios = {} } = {}) {
  const via = VIAS[nombreDeVia];
  let croquis = armarCaso(caso, via, carros);
  for (const [letra, cambio] of Object.entries(cambios)) {
    const c = croquis.carros.find((x) => x.letra === letra);
    croquis = cambiarCarro(croquis, letra, typeof cambio === 'function' ? cambio(c) : cambio);
  }
  return croquisParaGuardar(croquis, via, {});
}
const contornos = (f) => f.carros.map((c) => contornoDelCarro(c, c.largo, c.ancho));
const tocan = (f) => seTocan(...contornos(f));
const trompa = (c) => ({ x: c.x + Math.sin((c.rumbo * Math.PI) / 180) * (c.largo / 2), y: c.y + Math.cos((c.rumbo * Math.PI) / 180) * (c.largo / 2) });
const giro = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
const deLetra = (f, letra) => f.carros.find((c) => c.letra === letra);

// Todos los casos de dos carros, en las dos vías, más lo que la persona suele corregir: B andando
// en un trancón y B girado con ⟳ porque se cerró.
const CASOS_DE_DOS = [];
for (const via of ['recta', 'curva']) {
  for (const caso of ['frente', 'detras', 'cruce', 'carril', 'reversa']) CASOS_DE_DOS.push({ nombre: `${via} ${caso}`, croquis: armado(caso, via) });
  CASOS_DE_DOS.push({ nombre: `${via} detrás con B andando`, croquis: armado('detras', via, { cambios: { B: { movimiento: 'adelante' } } }) });
  CASOS_DE_DOS.push({ nombre: `${via} frente con B girado 25°`, croquis: armado('frente', via, { cambios: { B: (c) => ({ rumbo: c.rumbo + 25 }) } }) });
}

test('de frente en la curva del ejemplo: se tocan en el golpe y no antes, y vienen de lejos', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisisDelEjemplo()));
  assert.equal(rec.toque, true);
  assert.equal(rec.ritmo, 'parejo');
  const golpe = fotograma(rec, GOLPE_EN);
  assert.equal(golpe.golpe, true);
  assert.ok(tocan(golpe), 'en el golpe los contornos se tocan');
  assert.ok(!tocan(fotograma(rec, GOLPE_EN - 0.01)), 'un instante antes, todavía no');
  for (const c of golpe.carros) assert.ok(Math.hypot(trompa(c).x, trompa(c).y) < 1.5, `${c.letra}: ${Math.hypot(trompa(c).x, trompa(c).y).toFixed(2)} m del golpe`);
  for (const c of fotograma(rec, 0).carros) assert.ok(Math.hypot(c.x, c.y) > 12, `${c.letra} empieza lejos`);
});

test('después del golpe la película se queda quieta: no inventa cómo quedaron', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisisDelEjemplo()));
  assert.deepEqual(fotograma(rec, 1).carros, fotograma(rec, GOLPE_EN).carros);
  assert.equal(fotograma(rec, GOLPE_EN - 0.001).golpe, false);
});

test('en todos los casos de dos carros los carros se tocan, también en la curva', () => {
  // Hasta el 14-nov por la noche «Al cambiar de carril» nunca se tocaba: B seguía de largo hasta la punta de su
  // flecha. Y por detrás con B andando terminaban a 2 m.
  for (const { nombre, croquis } of CASOS_DE_DOS) {
    const rec = recreacionDelCroquis(croquis);
    assert.equal(rec.toque, true, nombre);
    assert.ok(tocan(fotograma(rec, GOLPE_EN)), `${nombre}: en el golpe se tocan`);
    assert.ok(!tocan(fotograma(rec, GOLPE_EN - 0.02)), `${nombre}: y no antes`);
  }
});

test('la película pasa por el croquis tal cual: en tCroquis cada carro está donde lo pusieron, con su trompa', () => {
  for (const { nombre, croquis } of CASOS_DE_DOS) {
    const rec = recreacionDelCroquis(croquis);
    if (rec.ritmo !== 'parejo') continue; // por detrás con los dos andando: lo prueba la siguiente
    assert.ok(rec.tCroquis > 0 && rec.tCroquis < GOLPE_EN, `${nombre}: ${rec.tCroquis}`);
    const f = fotograma(rec, rec.tCroquis);
    for (const c of croquis.carros) {
      const p = deLetra(f, c.letra);
      const C = rec.plano.aMetros(c);
      assert.ok(Math.hypot(p.x - C.x, p.y - C.y) < 0.005, `${nombre} ${c.letra}: ${Math.hypot(p.x - C.x, p.y - C.y)} m`);
      assert.ok(Math.abs(giro(p.rumbo, c.rumbo)) < 0.3, `${nombre} ${c.letra}: ${p.rumbo} contra ${c.rumbo}`);
    }
    // Y es lo mismo que se muestra antes de reproducir.
    for (const p of fotogramaDelCroquis(rec).carros) {
      const q = deLetra(f, p.letra);
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 0.005);
    }
  }
});

test('nadie declaró velocidades: a la misma rapidez siempre que se puede, y si no, se dice quién va más rápido', () => {
  // En la curva del ejemplo A va por el carril de afuera: antes se veía 16 % más rápido.
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisisDelEjemplo()));
  const paso = (letra, t0, t1) => Math.hypot(deLetra(fotograma(rec, t1), letra).x - deLetra(fotograma(rec, t0), letra).x, deLetra(fotograma(rec, t1), letra).y - deLetra(fotograma(rec, t0), letra).y);
  for (const [t0, t1] of [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]) {
    const a = paso('A', t0, t1);
    const b = paso('B', t0, t1);
    assert.ok(Math.abs(a - b) / Math.max(a, b) < 0.03, `en ${t0}-${t1}: A ${a.toFixed(2)} m, B ${b.toFixed(2)} m`);
  }
  assert.match(avisosDeLaRecreacion(rec).join(' '), /misma rapidez/);
  // Por detrás con los dos andando, a la misma rapidez nunca se alcanzan: A va más rápido, y se dice.
  for (const via of ['recta', 'curva']) {
    const detras = recreacionDelCroquis(armado('detras', via, { cambios: { B: { movimiento: 'adelante' } } }));
    assert.equal(detras.ritmo, 'alcance');
    assert.equal(detras.tCroquis, null);
    assert.match(avisosDeLaRecreacion(detras).join(' '), /A tiene que ir más rápido que B\. Cuánto más, nadie lo declaró/);
    // B recibe el golpe donde lo puso el croquis (a menos de medio metro).
    const B = deLetra(fotograma(detras, GOLPE_EN), 'B');
    const C = detras.plano.aMetros(armado('detras', via, { cambios: { B: { movimiento: 'adelante' } } }).carros.find((c) => c.letra === 'B'));
    assert.ok(Math.hypot(B.x - C.x, B.y - C.y) < 0.5, `${via}: ${Math.hypot(B.x - C.x, B.y - C.y).toFixed(2)} m`);
  }
});

test('la trompa mira hacia donde se mueve el carro: nada de ir de lado', () => {
  // En el ejemplo iban hasta 22° de lado, y un carro girado con ⟳ parecía derrapar hasta 47°.
  for (const { nombre, croquis } of CASOS_DE_DOS) {
    const rec = recreacionDelCroquis(croquis);
    const antes = {};
    for (let k = 0; k <= 400; k++) {
      const f = fotograma(rec, (k / 400) * GOLPE_EN);
      for (const c of f.carros) {
        const p = antes[c.letra];
        antes[c.letra] = c;
        if (!p || Math.hypot(c.x - p.x, c.y - p.y) < 0.02) continue;
        const reversa = rec.carros.find((x) => x.letra === c.letra).reversa;
        const movimiento = (Math.atan2(c.x - p.x, c.y - p.y) * 180) / Math.PI + (reversa ? 180 : 0);
        assert.ok(Math.abs(giro(movimiento, c.rumbo)) < 6, `${nombre} ${c.letra} en ${k}: ${giro(movimiento, c.rumbo).toFixed(1)}°`);
      }
    }
  }
});

test('por detrás: B quieto no se mueve y A para cuando su trompa toca la cola de B', () => {
  const rec = recreacionDelCroquis(armado('detras'));
  assert.equal(rec.toque, true);
  assert.deepEqual(deLetra(fotograma(rec, 0), 'B'), deLetra(fotograma(rec, GOLPE_EN), 'B'));
  const f = fotograma(rec, GOLPE_EN);
  const A = deLetra(f, 'A');
  const B = deLetra(f, 'B');
  // Hacia el este: la trompa de A llega a la cola de B (a 2 cm, por el afinado).
  assert.ok(Math.abs(trompa(A).x - (B.x - B.largo / 2)) < 0.05, `${trompa(A).x} contra ${B.x - B.largo / 2}`);
});

test('en reversa la trompa mira al revés de hacia donde se mueve', () => {
  const rec = recreacionDelCroquis(armado('reversa'));
  const A = deLetra(fotograma(rec, 0.3), 'A');
  assert.ok(Math.abs(giro(A.avance, A.rumbo)) > 179, `${A.rumbo} y ${A.avance}`);
  assert.ok(tocan(fotograma(rec, GOLPE_EN)));
});

test('contra algo quieto (un poste): para cuando la trompa llega al golpe', () => {
  const rec = recreacionDelCroquis(armado('quieto', 'recta', { carros: [DOS[0]] }));
  assert.equal(rec.toque, false);
  const A = fotograma(rec, GOLPE_EN).carros[0];
  assert.ok(Math.hypot(trompa(A).x, trompa(A).y) < 0.05, 'la trompa queda en el golpe');
  assert.match(textoDeLaFase(rec, GOLPE_EN), /^El golpe, donde lo marcó el croquis/);
});

test('sin golpe, sin carros o con todos quietos no hay nada que recrear', () => {
  assert.equal(recreacionDelCroquis(null), null);
  assert.equal(recreacionDelCroquis({ golpe: null, carros: [{ letra: 'A' }] }), null);
  assert.equal(recreacionDelCroquis({ golpe: CENTRO, carros: [] }), null);
  const quietos = { golpe: CENTRO, carros: [{ letra: 'A', lat: CENTRO.lat, lon: CENTRO.lon, rumbo: 0, movimiento: 'quieto', largo: 4, ancho: 1.8 }], flechas: [] };
  assert.equal(recreacionDelCroquis(quietos), null);
});

// Un croquis a mano en metros alrededor de CENTRO (x al este, y al norte).
const al = (x, y) => ({ lat: CENTRO.lat + y / 111320, lon: CENTRO.lon + x / (111320 * Math.cos((CENTRO.lat * Math.PI) / 180)) });
const carroEn = (letra, x, y, rumbo, movimiento = 'adelante') => ({ letra, ...al(x, y), rumbo, movimiento, largo: 4.2, ancho: 1.8 });
const flecha = (letra, puntos) => ({ letra, puntos: puntos.map(([x, y]) => al(x, y)) });

test('un carro en marcha sin flecha no aparece «parqueado» sin aviso, y una flecha que arranca en el carro tampoco', () => {
  // Modo libre: B en marcha sin flecha. Antes quedaba quieto toda la película y nadie lo decía.
  const sinFlecha = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -8, 0, 90), carroEn('B', 3, 0, 270)], flechas: [flecha('A', [[-20, 0], [0, 0]])] });
  assert.equal(sinFlecha.carros.find((c) => c.letra === 'B').motivo, 'sin-flecha');
  assert.match(avisosDeLaRecreacion(sinFlecha).join(' '), /B no tiene flecha: se queda donde lo puso el croquis, no porque estuviera quieto/);
  // Las dos flechas dibujadas desde el carro hacia adelante: no dicen de dónde venían.
  const haciaAdelante = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -2.2, 0, 90), carroEn('B', 2.2, 0, 270)], flechas: [flecha('A', [[-2.2, 0], [10, 0]]), flecha('B', [[2.2, 0], [-10, 0]])] });
  assert.equal(haciaAdelante.nadaSeMueve, true);
  assert.ok(haciaAdelante.carros.every((c) => c.motivo === 'sin-recorrido'));
  assert.match(textoDeLaFase(haciaAdelante, 0), /Ningún carro tiene por dónde moverse/);
  assert.match(avisosDeLaRecreacion(haciaAdelante).join(' '), /La flecha de A no muestra de dónde venía/);
});

test('la cámara que sigue a un carro va detrás de él y mira hacia el golpe', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisisDelEjemplo()));
  for (const letra of ['A', 'B']) {
    for (const t of [0.1, 0.3]) {
      const camara = camaraQueSigue(rec, letra, t);
      const pose = deLetra(fotograma(rec, t), letra);
      const lejos = Math.hypot(camara.desde.x - pose.x, camara.desde.y - pose.y);
      assert.ok(lejos > pose.largo / 2 + 10 && lejos < pose.largo / 2 + 14, `${letra} en ${t}: a ${lejos.toFixed(1)} m`);
      assert.equal(camara.desde.alto, 4.5);
      assert.equal(camara.hacia.alto, 0);
      // El carro queda entre la cámara y lo que mira, y lo que mira es el golpe.
      const u = { x: camara.hacia.x - camara.desde.x, y: camara.hacia.y - camara.desde.y };
      assert.ok((pose.x - camara.desde.x) * u.x + (pose.y - camara.desde.y) * u.y > 0, `${letra}: la cámara no le da la espalda`);
      assert.ok(Math.hypot(camara.hacia.x, camara.hacia.y) < 1, `${letra} en ${t}: mira a ${Math.hypot(camara.hacia.x, camara.hacia.y).toFixed(2)} m del golpe`);
    }
  }
  assert.equal(camaraQueSigue(rec, 'Z', 0.5), null);
});

// Cuánto gira la cámara que sigue, en grados, por cuadro de 1/60 s a ritmo normal y en medio segundo.
function giroDeLaCamara(rec, letra) {
  const N = 540; // 9 s × 60
  const rumbos = [];
  let porCuadro = 0;
  for (let k = 0; k <= N; k++) {
    const c = camaraQueSigue(rec, letra, k / N);
    rumbos.push((Math.atan2(c.hacia.x - c.desde.x, c.hacia.y - c.desde.y) * 180) / Math.PI);
    if (k) porCuadro = Math.max(porCuadro, Math.abs(giro(rumbos[k - 1], rumbos[k])));
  }
  let medioSegundo = 0;
  for (let k = 30; k <= N; k++) {
    let suma = 0;
    for (let j = k - 29; j <= k; j++) suma += giro(rumbos[j - 1], rumbos[j]);
    medioSegundo = Math.max(medioSegundo, Math.abs(suma));
  }
  return { porCuadro, medioSegundo };
}

test('la cámara que sigue no da latigazos: ni en los casos del croquis ni en una glorieta dibujada a mano', () => {
  for (const { nombre, croquis } of CASOS_DE_DOS) {
    const rec = recreacionDelCroquis(croquis);
    for (const c of rec.carros.filter((x) => x.camino)) {
      const { porCuadro } = giroDeLaCamara(rec, c.letra);
      assert.ok(porCuadro < 0.5, `${nombre} ${c.letra}: ${porCuadro.toFixed(2)}° en un cuadro`);
    }
  }
  // La glorieta (media vuelta de 12 m de radio) y un retorno en U de 5 m, con el golpe de lado. Antes:
  // 102° y 124° en medio segundo, con picos de 36° en un solo cuadro.
  const arco = (radio, desde, hasta, n) => Array.from({ length: n + 1 }, (_, k) => {
    const th = desde + ((hasta - desde) * k) / n;
    return [radio * Math.sin(th), radio + radio * Math.cos(th)];
  });
  const enArco = (radio, th) => [radio * Math.sin(th), radio + radio * Math.cos(th), (Math.atan2(radio * Math.cos(th), -radio * Math.sin(th)) * 180) / Math.PI];
  const glorieta = arco(12, 0, Math.PI, 36);
  const retorno = [...Array.from({ length: 21 }, (_, k) => [k - 20, 10]), ...arco(5, 0, Math.PI, 24).slice(1)];
  for (const [nombre, puntos, A] of [['glorieta', glorieta, enArco(12, 0.8 * Math.PI)], ['retorno', retorno, enArco(5, 0.75 * Math.PI)]]) {
    const rec = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', A[0], A[1], A[2]), carroEn('B', -3.2, 0, 0, 'quieto')], flechas: [flecha('A', puntos)] });
    assert.equal(rec.toque, true, nombre);
    const { porCuadro, medioSegundo } = giroDeLaCamara(rec, 'A');
    assert.ok(porCuadro < 2, `${nombre}: ${porCuadro.toFixed(2)}° en un cuadro`);
    assert.ok(medioSegundo < 60, `${nombre}: ${medioSegundo.toFixed(0)}° en medio segundo`);
  }
});

test('si el golpe quedó detrás del carro, la cámara mira al carro y no le da la espalda', () => {
  // Una flecha a mano que se pasa del golpe: A arranca en el golpe y sigue 20 m al este; B, quieto.
  const rec = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', 10, 0, 90), carroEn('B', 40, 0, 90, 'quieto')], flechas: [flecha('A', [[0, 0], [20, 0]])] });
  const A = deLetra(fotograma(rec, 0.6), 'A');
  assert.ok(A.x > 1, 'A ya pasó del golpe');
  const camara = camaraQueSigue(rec, 'A', 0.6);
  assert.ok(Math.hypot(camara.hacia.x - A.x, camara.hacia.y - A.y) < 1e-6);
  assert.ok(camara.desde.x < A.x);
});

test('el encuadre de todos los carros se cierra solo a medida que se juntan', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisisDelEjemplo()));
  const radios = [0, 0.2, 0.4, 0.6, GOLPE_EN].map((t) => encuadreDeLosCarros(rec, t).radio);
  for (let i = 1; i < radios.length; i++) assert.ok(radios[i] < radios[i - 1], `el radio baja: ${radios.map((r) => r.toFixed(1)).join(' > ')}`);
  assert.ok(radios[0] > 12);
  assert.ok(radios.at(-1) < AIRE_DEL_ENCUADRE + 4, `en el golpe: ${radios.at(-1).toFixed(1)} m`);
  // Con un solo carro contra algo quieto también hay encuadre: el carro y el golpe.
  const solo = recreacionDelCroquis(armado('quieto', 'recta', { carros: [DOS[0]] }));
  assert.ok(encuadreDeLosCarros(solo, 0).radio > encuadreDeLosCarros(solo, GOLPE_EN).radio);
});

test('la advertencia del mapa no le dice «lo declarado» a lo que nadie declaró', () => {
  assert.equal(selloDeLaRecreacion({ ejemplo: true }), 'Recreación de un ejemplo inventado · no es una medición');
  assert.equal(selloDeLaRecreacion({ hecho: false }), 'Recreación de un croquis sin terminar · no es una medición');
  assert.equal(selloDeLaRecreacion({ hecho: true }), 'Recreación de lo declarado · no es una medición');
});

test('el renglón de cada momento: el croquis antes de reproducir, el golpe, y cuando no se tocan', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(analisisDelEjemplo()));
  assert.match(textoDeLaFase(rec, null), /^Así quedaron en el croquis, justo antes del golpe/);
  assert.match(textoDeLaFase(rec, 0.3), /^Antes del golpe/);
  assert.match(textoDeLaFase(rec, GOLPE_EN), /^El golpe\. De aquí en adelante/);
  // Dos carros que el dibujo no junta: lo dice el renglón, sin culpar a nadie.
  const lejos = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -8, 0, 90), carroEn('B', 8, 6, 270)], flechas: [flecha('A', [[-20, 0], [0, 0]]), flecha('B', [[20, 6], [6, 6]])] });
  assert.equal(lejos.toque, false);
  assert.match(textoDeLaFase(lejos, GOLPE_EN), /no alcanzan a tocarse/);
});

// ---------------------------------------------------------------- la segunda revisión (14-nov, noche)

test('para alcanzarlo, el de atrás sigue detrás: una flecha larga del de adelante no invierte quién le pegó a quién', () => {
  // Por detrás con los dos andando, a mano. Antes cada uno arrancaba al comienzo de su flecha: con la
  // de B de 40 m, B arrancaba 20 m detrás de A y le pegaba él.
  for (const largoDeB of [16, 40, 60]) {
    const rec = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -5.1, 0, 90), carroEn('B', 2.4, 0, 90)], flechas: [flecha('A', [[-17.1, 0], [0, 0]]), flecha('B', [[2.4 - largoDeB + 3.6, 0], [6, 0]])] });
    assert.equal(rec.ritmo, 'alcance', `B de ${largoDeB} m`);
    assert.equal(rec.toque, true);
    for (let k = 0; k <= 100; k++) {
      const f = fotograma(rec, (k / 100) * GOLPE_EN);
      assert.ok(deLetra(f, 'A').x < deLetra(f, 'B').x, `B de ${largoDeB} m, en ${k}: A en ${deLetra(f, 'A').x.toFixed(2)}, B en ${deLetra(f, 'B').x.toFixed(2)}`);
    }
    // B recibe el golpe donde lo dejó el croquis.
    assert.ok(Math.abs(deLetra(fotograma(rec, GOLPE_EN), 'B').x - 2.4) < 0.2);
    assert.match(avisosDeLaRecreacion(rec).join(' '), /A tiene que ir más rápido que B\./);
  }
});

test('una flecha a mano que se pasa del golpe (por encima del otro carro) sí choca', () => {
  for (const pasa of [2, 4, 10]) {
    const rec = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -5, 0, 90), carroEn('B', 2, 0, 0, 'quieto')], flechas: [flecha('A', [[-20, 0], [pasa, 0]])] });
    assert.equal(rec.toque, true, `pasa ${pasa} m`);
    assert.ok(tocan(fotograma(rec, GOLPE_EN)));
  }
});

test('un carro solo cuya flecha no llega al golpe: la película no dice «el golpe» ni enciende los daños', () => {
  const corta = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -8, 0, 90)], flechas: [flecha('A', [[-25, 0], [-6, 0]])] });
  assert.equal(corta.hayGolpe, false);
  assert.equal(fotograma(corta, 1).golpe, false);
  assert.match(textoDeLaFase(corta, GOLPE_EN), /^Aquí termina lo que dice la flecha: no llega al golpe/);
  // Si se queda un metro corta, se estira hasta el golpe: a mano, nadie le atina a la estrella.
  const casi = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -8, 0, 90)], flechas: [flecha('A', [[-25, 0], [-1, 0]])] });
  assert.equal(casi.hayGolpe, true);
  assert.ok(Math.hypot(trompa(fotograma(casi, GOLPE_EN).carros[0]).x, 0) < 0.05);
  assert.match(textoDeLaFase(casi, GOLPE_EN), /^El golpe, donde lo marcó el croquis/);
});

test('los avisos nombran a los carros de los que hablan: con tres, y con dos casi pegados', () => {
  // A alcanza a B, y C pasa lejos por el otro carril: C no tiene que ir más despacio que nadie.
  const tres = recreacionDelCroquis({
    golpe: CENTRO,
    carros: [carroEn('A', -2.4, 0, 90), carroEn('B', 2.4, 0, 90), carroEn('C', 0, 12, 90)],
    flechas: [flecha('A', [[-14.4, 0], [0, 0]]), flecha('B', [[-9.6, 0], [6, 0]]), flecha('C', [[-12, 12], [4, 12]])],
  });
  assert.equal(tres.ritmo, 'alcance');
  assert.deepEqual([...tres.pareja].sort(), ['A', 'B']);
  const dicho = avisosDeLaRecreacion(tres).join(' ');
  assert.match(dicho, /A tiene que ir más rápido que B\./);
  assert.doesNotMatch(dicho, /que B y C|que C/);
  // Por detrás con A a 20 cm de B: ninguna frase a medias («… más rápido que .»).
  for (const hueco of [0.2, 0.4, 0.6]) {
    const B = (c) => ({ movimiento: 'adelante' });
    const croquis = armado('detras', 'recta', { cambios: { B } });
    const b = croquis.carros.find((c) => c.letra === 'B');
    const a = croquis.carros.find((c) => c.letra === 'A');
    const rec = recreacionDelCroquis({ ...croquis, carros: croquis.carros.map((c) => (c === a ? { ...a, lon: b.lon - ((b.largo + hueco) / (111320 * Math.cos((CENTRO.lat * Math.PI) / 180))) } : c)) });
    for (const aviso of avisosDeLaRecreacion(rec)) assert.doesNotMatch(aviso, /que \.|tiene que ir más rápido que\s*$|^\s*van/, `hueco ${hueco}: ${aviso}`);
  }
  // A la misma rapidez, con uno parqueado: «A y C», no «todos».
  const conParqueado = recreacionDelCroquis({
    golpe: CENTRO,
    carros: [carroEn('A', -2.2, 0, 90), carroEn('B', 8, -4, 0, 'quieto'), carroEn('C', 2.2, 0, 270)],
    flechas: [flecha('A', [[-20, 0], [0, 0]]), flecha('C', [[20, 0], [0, 0]])],
  });
  assert.match(avisosDeLaRecreacion(conParqueado)[0], /^A y C van a la misma rapidez/);
});

test('quien arranca adentro de su flecha lo dice con su letra y cuánto', () => {
  const rec = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -2.2, 0, 90), carroEn('B', 2.2, 0, 270)], flechas: [flecha('A', [[-12, 0], [0, 0]]), flecha('B', [[20, 0], [0, 0]])] });
  assert.equal(rec.ritmo, 'parejo');
  const dicho = avisosDeLaRecreacion(rec).join(' ');
  assert.match(dicho, /B arranca 8,0\u00a0m adentro de su flecha: la película arranca a cada carro a 9,8\u00a0m de donde lo puso el croquis\./);
  assert.doesNotMatch(dicho, /Si una flecha es más larga/);
});

test('un carro atravesado respecto de su flecha se ladea en los últimos metros, sin trompos inventados', () => {
  // A a 100° de su flecha. Antes el empalme lo hacía girar 190° de ida y vuelta en un metro.
  for (const torcido of [60, 100]) {
    const rec = recreacionDelCroquis({ golpe: CENTRO, carros: [carroEn('A', -5, 0, 90 + torcido), carroEn('B', 2, 0, 0, 'quieto')], flechas: [flecha('A', [[-20, 0], [0, 0]])] });
    const A = rec.carros.find((c) => c.letra === 'A');
    assert.equal(A.ladeo, torcido);
    assert.match(avisosDeLaRecreacion(rec).join(' '), new RegExp(String.raw`A quedó en el croquis atravesado respecto de su flecha \(unos ${torcido}°\)`));
    // Va por su flecha (sin salirse de la raya) y en tCroquis está tal cual lo pusieron.
    let antes = null;
    for (let k = 0; k <= 540; k++) {
      const p = deLetra(fotograma(rec, (k / 540) * GOLPE_EN), 'A');
      assert.ok(Math.abs(p.y) < 0.02, `${torcido}° en ${k}: se sale ${p.y.toFixed(2)} m`);
      if (antes) assert.ok(Math.abs(giro(antes.rumbo, p.rumbo)) < 1.5, `${torcido}° en ${k}: ${giro(antes.rumbo, p.rumbo).toFixed(2)}° en un cuadro`);
      antes = p;
    }
    const enElCroquis = deLetra(fotograma(rec, rec.tCroquis), 'A');
    assert.ok(Math.hypot(enElCroquis.x - A.declarado.x, enElCroquis.y - A.declarado.y) < 0.005);
    assert.ok(Math.abs(giro(enElCroquis.rumbo, 90 + torcido)) < 0.3);
  }
});
