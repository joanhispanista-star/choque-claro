// La recreación del choque (recreacion.js): el croquis en movimiento, sin inventar velocidades ni lo
// que pasó después del golpe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analizarVia } from '../js/via.js';
import { armarCaso, croquisParaGuardar, viaDelCroquis } from '../js/croquis.js';
import { croquisGuardadoDeEjemplo } from '../js/zona-3d.js';
import { AIRE_DEL_ENCUADRE, GOLPE_EN, camaraQueSigue, contornoDelCarro, encuadreDeLosCarros, fotograma, recreacionDelCroquis, seTocan } from '../js/recreacion.js';

const CENTRO = { lat: 4.6484, lon: -74.0105 };
const ejemplo = () => {
  const g = JSON.parse(fs.readFileSync(new URL('../datos/ejemplo-verjones-patios.json', import.meta.url), 'utf8'));
  return analizarVia(g.respuesta, g.punto);
};
// Una vía recta hacia el este, con el caso del croquis puesto como lo pone el paso 7.
function enRecta(caso, carros = [{ letra: 'A', quien: 'tuyo' }, { letra: 'B', quien: 'otro' }]) {
  const via = viaDelCroquis({ centro: CENTRO, rumbo: 90 });
  return croquisParaGuardar(armarCaso(caso, via, carros), via, {});
}
const contornos = (f) => f.carros.map((c) => contornoDelCarro(c, c.largo, c.ancho));
const tocan = (f) => seTocan(...contornos(f));
const trompa = (c) => ({ x: c.x + Math.sin((c.rumbo * Math.PI) / 180) * (c.largo / 2), y: c.y + Math.cos((c.rumbo * Math.PI) / 180) * (c.largo / 2) });

test('de frente en la curva del ejemplo: llegan a la vez, se tocan en el golpe y no antes', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(ejemplo()));
  assert.ok(rec);
  assert.equal(rec.toque, true);
  const golpe = fotograma(rec, GOLPE_EN);
  assert.equal(golpe.golpe, true);
  assert.ok(tocan(golpe), 'en el golpe los contornos se tocan');
  assert.ok(!tocan(fotograma(rec, GOLPE_EN - 0.01)), 'un instante antes, todavía no');
  // Las dos trompas quedan a menos de 1,5 m del golpe del croquis (el origen del plano).
  for (const c of golpe.carros) assert.ok(Math.hypot(trompa(c).x, trompa(c).y) < 1.5, `${c.letra}: ${Math.hypot(trompa(c).x, trompa(c).y).toFixed(2)} m`);
  // Al empezar vienen de lejos, por su flecha (12 m detrás de donde los puso el croquis).
  for (const c of fotograma(rec, 0).carros) assert.ok(Math.hypot(c.x, c.y) > 12, `${c.letra} empieza lejos`);
});

test('después del golpe la película se queda quieta: no inventa cómo quedaron', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(ejemplo()));
  assert.deepEqual(fotograma(rec, 1).carros, fotograma(rec, GOLPE_EN).carros);
  assert.equal(fotograma(rec, GOLPE_EN - 0.001).golpe, false);
});

test('por detrás: B quieto no se mueve y A para cuando su trompa toca la cola de B', () => {
  const croquis = enRecta('detras');
  const rec = recreacionDelCroquis(croquis);
  assert.equal(rec.toque, true);
  const quietoB = (t) => fotograma(rec, t).carros.find((c) => c.letra === 'B');
  assert.deepEqual(quietoB(0), quietoB(GOLPE_EN));
  const f = fotograma(rec, GOLPE_EN);
  assert.ok(tocan(f));
  const A = f.carros.find((c) => c.letra === 'A');
  const B = f.carros.find((c) => c.letra === 'B');
  // Hacia el este: la trompa de A llega a la cola de B (a 2 cm, por el afinado).
  assert.ok(Math.abs(trompa(A).x - (B.x - B.largo / 2)) < 0.05, `${trompa(A).x} contra ${B.x - B.largo / 2}`);
});

test('el croquis se respeta: donde lo puso la persona, el carro pasa tal cual', () => {
  const croquis = enRecta('carril');
  const rec = recreacionDelCroquis(croquis);
  const A = rec.carros.find((c) => c.letra === 'A');
  const declarado = croquis.carros.find((c) => c.letra === 'A');
  // El momento en que A pasa por su punto del croquis.
  const t = (A.sDeclarado / A.camino.largo / rec.tauGolpe) * GOLPE_EN;
  const pose = fotograma(rec, t).carros.find((c) => c.letra === 'A');
  const plano = rec.plano;
  const C = plano.aMetros(declarado);
  assert.ok(Math.hypot(pose.x - C.x, pose.y - C.y) < 0.05);
  assert.ok(Math.abs(((pose.rumbo - declarado.rumbo + 540) % 360) - 180) < 0.5, `${pose.rumbo} contra ${declarado.rumbo}`);
});

test('en reversa la trompa mira al revés de hacia donde se mueve', () => {
  const rec = recreacionDelCroquis(enRecta('reversa'));
  const A = fotograma(rec, 0.3).carros.find((c) => c.letra === 'A');
  assert.ok(Math.abs(((A.rumbo - A.avance + 540) % 360) - 180) > 179, `${A.rumbo} y ${A.avance}`);
  assert.ok(tocan(fotograma(rec, GOLPE_EN)));
});

test('contra algo quieto (un poste): para cuando la trompa llega al final de la flecha', () => {
  const rec = recreacionDelCroquis(enRecta('quieto', [{ letra: 'A', quien: 'tuyo' }]));
  assert.equal(rec.toque, false);
  const A = fotograma(rec, GOLPE_EN).carros[0];
  assert.ok(Math.hypot(trompa(A).x, trompa(A).y) < 0.05, 'la trompa queda en el golpe');
});

test('sin golpe, sin carros o con todos quietos no hay nada que recrear', () => {
  assert.equal(recreacionDelCroquis(null), null);
  assert.equal(recreacionDelCroquis({ golpe: null, carros: [{ letra: 'A' }] }), null);
  assert.equal(recreacionDelCroquis({ golpe: CENTRO, carros: [] }), null);
  const quietos = { golpe: CENTRO, carros: [{ letra: 'A', lat: CENTRO.lat, lon: CENTRO.lon, rumbo: 0, movimiento: 'quieto', largo: 4, ancho: 1.8 }], flechas: [] };
  assert.equal(recreacionDelCroquis(quietos), null);
});

// Cuánto se sale el carro de la línea que va de la cámara al golpe (el origen), en metros.
const fueraDeLinea = (camara, pose) => {
  const largo = Math.hypot(camara.desde.x, camara.desde.y);
  return Math.abs((pose.x - camara.desde.x) * -camara.desde.y - (pose.y - camara.desde.y) * -camara.desde.x) / largo;
};

test('la cámara que sigue a un carro va detrás de él, en la línea del golpe, y mira al golpe', () => {
  const rec = recreacionDelCroquis(enRecta('detras'));
  for (const t of [0, 0.3]) {
    const A = fotograma(rec, t).carros.find((c) => c.letra === 'A');
    const camara = camaraQueSigue(rec, 'A', t);
    // A 12 m de la cola y 4,5 m arriba; va hacia el este, así que la cámara queda al oeste.
    assert.ok(Math.abs(Math.hypot(camara.desde.x - A.x, camara.desde.y - A.y) - (A.largo / 2 + 12)) < 1e-9);
    assert.equal(camara.desde.alto, 4.5);
    assert.ok(camara.desde.x < A.x);
    // Mira al golpe (el origen del plano), en el suelo.
    assert.ok(Math.hypot(camara.hacia.x, camara.hacia.y) < 1e-9);
    assert.equal(camara.hacia.alto, 0);
    assert.ok(fueraDeLinea(camara, A) < 1e-6, `el carro en medio del cuadro: ${fueraDeLinea(camara, A)}`);
  }
  assert.equal(camaraQueSigue(rec, 'Z', 0.5), null);
});

test('en la curva del ejemplo el golpe no queda al frente, y el carro sigue en medio del cuadro', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(ejemplo()));
  for (const letra of ['A', 'B']) {
    const camara = camaraQueSigue(rec, letra, 0.1);
    const pose = fotograma(rec, 0.1).carros.find((c) => c.letra === letra);
    assert.ok(Math.hypot(camara.hacia.x, camara.hacia.y) < 1e-9, `${letra} mira al golpe`);
    // Justo detrás de la cola y mirando al golpe, en esta curva el carro se salía del cuadro.
    assert.ok(fueraDeLinea(camara, pose) < 1e-6, `${letra} en línea con el golpe: ${fueraDeLinea(camara, pose)}`);
    assert.ok(Math.hypot(pose.x, pose.y) < Math.hypot(camara.desde.x, camara.desde.y), `${letra} va delante de su cámara`);
  }
  // Al final, con el golpe en la trompa, el carro no se sale más de un metro de esa línea.
  for (const letra of ['A', 'B']) {
    const pose = fotograma(rec, GOLPE_EN).carros.find((c) => c.letra === letra);
    assert.ok(fueraDeLinea(camaraQueSigue(rec, letra, GOLPE_EN), pose) < 1, `${letra} en el golpe`);
  }
});

test('la cámara que sigue no da latigazos en ningún caso del croquis', () => {
  const dos = [{ letra: 'A', quien: 'tuyo' }, { letra: 'B', quien: 'otro' }];
  for (const [caso, carros] of [['frente', dos], ['detras', dos], ['cruce', dos], ['carril', dos], ['reversa', dos], ['quieto', [dos[0]]]]) {
    const rec = recreacionDelCroquis(enRecta(caso, carros));
    for (const c of rec.carros.filter((x) => x.camino)) {
      let antes = null;
      for (let k = 0; k <= 200; k++) {
        const t = k / 200;
        const camara = camaraQueSigue(rec, c.letra, t);
        const pose = fotograma(rec, t).carros.find((x) => x.letra === c.letra);
        assert.ok(Math.abs(Math.hypot(camara.desde.x - pose.x, camara.desde.y - pose.y) - (c.largo / 2 + 12)) < 1e-9, `${caso} ${c.letra}: a 12 m de la cola`);
        if (antes) {
          // El carro avanza unos 10 cm por paso; un salto de un metro es un latigazo.
          assert.ok(Math.hypot(camara.desde.x - antes.desde.x, camara.desde.y - antes.desde.y) < 1, `${caso} ${c.letra} en ${t}: la cámara saltó`);
          assert.ok(Math.hypot(camara.hacia.x - antes.hacia.x, camara.hacia.y - antes.hacia.y) < 1, `${caso} ${c.letra} en ${t}: la mirada saltó`);
        }
        antes = camara;
      }
    }
  }
});

test('si el golpe quedó detrás del carro, la cámara mira al carro y no le da la espalda', () => {
  // Una flecha a mano que se pasa del golpe: A arranca en el golpe y sigue 20 m al este; B, quieto.
  const al = (x, y) => ({ lat: CENTRO.lat + y / 111320, lon: CENTRO.lon + x / (111320 * Math.cos((CENTRO.lat * Math.PI) / 180)) });
  const croquis = {
    golpe: CENTRO,
    carros: [
      { letra: 'A', ...al(10, 0), rumbo: 90, movimiento: 'adelante', largo: 4.2, ancho: 1.8 },
      { letra: 'B', ...al(40, 0), rumbo: 90, movimiento: 'quieto', largo: 4.2, ancho: 1.8 },
    ],
    flechas: [{ letra: 'A', puntos: [al(0, 0), al(20, 0)] }],
  };
  const rec = recreacionDelCroquis(croquis);
  const A = fotograma(rec, 0.6).carros.find((c) => c.letra === 'A');
  assert.ok(A.x > 1, 'A ya pasó del golpe');
  const camara = camaraQueSigue(rec, 'A', 0.6);
  assert.ok(Math.abs(camara.hacia.x - A.x) < 1e-9 && Math.abs(camara.hacia.y - A.y) < 1e-9);
  assert.ok(camara.desde.x < A.x);
});

test('el encuadre de todos los carros se cierra solo a medida que se juntan', () => {
  const rec = recreacionDelCroquis(croquisGuardadoDeEjemplo(ejemplo()));
  const radios = [0, 0.2, 0.4, 0.6, GOLPE_EN].map((t) => encuadreDeLosCarros(rec, t).radio);
  for (let i = 1; i < radios.length; i++) assert.ok(radios[i] < radios[i - 1], `el radio baja: ${radios.map((r) => r.toFixed(1)).join(' > ')}`);
  // Al empezar caben los dos carros, que vienen de más de 12 m; en el golpe queda encima.
  assert.ok(radios[0] > 12);
  assert.ok(radios.at(-1) < AIRE_DEL_ENCUADRE + 4, `en el golpe: ${radios.at(-1).toFixed(1)} m`);
  // Todos los carros y el golpe quedan adentro, con el aire de un carro, en cualquier momento.
  for (const t of [0, 0.33, GOLPE_EN, 1]) {
    const { centro, radio } = encuadreDeLosCarros(rec, t);
    for (const p of [{ x: 0, y: 0 }, ...fotograma(rec, t).carros]) assert.ok(Math.hypot(p.x - centro.x, p.y - centro.y) <= radio - AIRE_DEL_ENCUADRE + 1e-9);
  }
  // Con un solo carro contra algo quieto también hay encuadre: el carro y el golpe.
  const solo = recreacionDelCroquis(enRecta('quieto', [{ letra: 'A', quien: 'tuyo' }]));
  assert.ok(encuadreDeLosCarros(solo, 0).radio > encuadreDeLosCarros(solo, GOLPE_EN).radio);
});
