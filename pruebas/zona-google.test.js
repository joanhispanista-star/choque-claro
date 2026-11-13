// La zona en el 3D de Google: la cámara convertida desde la de la maqueta (el croquis tiene que salir
// del mismo tamaño), la altura del suelo de los mosaicos terrarium, y la lista de lo que va encima,
// con las coordenadas al derecho (Google pide lat/lng; el GeoJSON viene lon/lat).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planoLocal, distancia } from '../js/geo.js';
import { analizarVia } from '../js/via.js';
import { camaraDeLaZona, camaraDelCroquis, capasDeLaZona, carrosDeLaZona, colorDeCarro, COLORES } from '../js/zona-3d.js';
import { armarCaso, cambiarCarro, croquisParaGuardar, viaDesdeElAnalisis } from '../js/croquis.js';
import { ALTURAS, CAMPO_DE_VISION, alturaTerrarium, camaraDeGoogle, camaraDesdeArriba, conTransparencia, elementosDeGoogle, metrosPorPixelMapLibre, motivoDeGoogle, orientacionDelCarro, pixelDelSuelo } from '../js/zona-google.js';

const CENTRO = { lat: 4.6484, lon: -74.0105 };
const ejemplo = () => {
  const g = JSON.parse(fs.readFileSync(new URL('../datos/ejemplo-verjones-patios.json', import.meta.url), 'utf8'));
  return analizarVia(g.respuesta, g.punto);
};
function croquisGuardado() {
  const via = viaDesdeElAnalisis(ejemplo(), CENTRO);
  const picanto = { letra: 'A', quien: 'tuyo', linea: { carroceria: 'hatchback', medidas: { largo: 3595, ancho: 1595 } } };
  const c = cambiarCarro(armarCaso('frente', via, [picanto, { letra: 'B', quien: 'otro', linea: null }]), 'B', { movimiento: 'quieto' });
  return croquisParaGuardar(c, via, { punto: CENTRO, ejemplo: true });
}

test('la cámara de Google deja el croquis del mismo tamaño que en la maqueta', () => {
  const g = croquisGuardado();
  const maqueta = camaraDelCroquis(CENTRO, ejemplo(), g);
  const altoPx = 523; // 62vh de un iPhone de 844 px
  const cam = camaraDeGoogle(maqueta, { altoPx, suelo: 2921.37 });
  // Google pide lat/lng y la altura del centro sobre el nivel del mar.
  assert.deepEqual(cam.center, { lat: g.golpe.lat, lng: g.golpe.lon, altitude: 2921.4 });
  assert.equal(cam.tilt, maqueta.pitch);
  assert.equal(cam.heading, maqueta.bearing);
  // En el centro de la pantalla, un píxel mide lo mismo en las dos (con el redondeo de `range` a 1 m).
  const enGoogle = (2 * cam.range * Math.tan(((CAMPO_DE_VISION / 2) * Math.PI) / 180)) / altoPx;
  const enMapLibre = metrosPorPixelMapLibre(g.golpe.lat, maqueta.zoom);
  assert.ok(Math.abs(enGoogle / enMapLibre - 1) < 0.01, `${enGoogle} contra ${enMapLibre}`);
  // La de la zona (zoom 17,3) queda unas tres veces más lejos que la del croquis.
  const zona = camaraDeGoogle(camaraDeLaZona(CENTRO, ejemplo()), { altoPx, suelo: 2921 });
  assert.ok(zona.range > 2.5 * cam.range && zona.range < 500, `${zona.range} m y ${cam.range} m`);
});

test('desde arriba: mirando hacia abajo, con el norte arriba y un poco más lejos', () => {
  const cam = { center: { lat: 4.6, lng: -74, altitude: 2600 }, range: 200, tilt: 62, heading: 130 };
  assert.deepEqual(camaraDesdeArriba(cam), { center: cam.center, range: 250, tilt: 0, heading: 0 });
});

test('el píxel del suelo es el de la tesela que contiene el punto', () => {
  // La inversa de la proyección de las teselas (Web Mercator).
  const lonDe = (x, n) => (x / n) * 360 - 180;
  const latDe = (y, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  for (const [lat, lon] of [[CENTRO.lat, CENTRO.lon], [4.6453213, -74.0613437], [-33.45, -70.66], [0.0001, 0.0001]]) {
    const p = pixelDelSuelo(lat, lon);
    const n = 2 ** p.z;
    assert.equal(p.z, 15);
    assert.ok(lonDe(p.x, n) <= lon && lon < lonDe(p.x + 1, n), `lon ${lon}`);
    assert.ok(latDe(p.y, n) >= lat && lat > latDe(p.y + 1, n), `lat ${lat}`);
    // El píxel cae dentro de la tesela y a menos de un píxel (unos 4,8 m) del punto.
    assert.ok(p.px >= 0 && p.px <= 255 && p.py >= 0 && p.py <= 255);
    assert.ok(Math.abs(lonDe(p.x + (p.px + 0.5) / 256, n) - lon) <= 360 / n / 256);
  }
  // El cero: lat 0, lon 0 cae en la esquina de cuatro teselas.
  assert.deepEqual(pixelDelSuelo(0, 0, 1), { z: 1, x: 1, y: 1, px: 0, py: 0 });
});

test('la altura terrarium: R × 256 + G + B / 256 − 32768', () => {
  assert.equal(alturaTerrarium(128, 0, 0), 0);
  assert.equal(alturaTerrarium(138, 105, 0), 2665);
  assert.equal(alturaTerrarium(128, 0, 128), 0.5);
  assert.equal(alturaTerrarium(127, 255, 0), -1);
});

test('lo que va encima: los carros del croquis, la flecha con su punta y el golpe, en lat/lng', () => {
  const g = croquisGuardado();
  const analisis = ejemplo();
  const capas = capasDeLaZona({ centro: CENTRO, precision: 8, analisis, ejemplo: true, croquis: g, sol: { altura: 30, azimut: 250 } });
  const lista = elementosDeGoogle(capas, carrosDeLaZona({ croquis: g, ejemplo: true, analisis }));
  const de = (tipo, clave) => lista.filter((e) => e.tipo === tipo && e.clave === clave);

  // Un carro 3D por carro del croquis, en su sitio, a su rumbo, con su tamaño y el color de su letra.
  const carros = de('carro', 'carros');
  assert.deepEqual(carros.map((c) => c.letra), ['A', 'B']);
  for (const c of carros) {
    const delCroquis = g.carros.find((x) => x.letra === c.letra);
    assert.deepEqual(c.position, { lat: delCroquis.lat, lng: delCroquis.lon });
    assert.equal(c.rumbo, delCroquis.rumbo);
    assert.equal(c.largo, delCroquis.largo);
    assert.equal(c.color, colorDeCarro(c.letra));
  }
  assert.equal(carros[0].largo, 3.6, 'A es un Picanto');
  assert.deepEqual(de('letrero', 'carros').map((l) => [l.texto, l.position.altitude]), [['A', ALTURAS.letrero], ['B', ALTURAS.letrero]]);

  // B está quieto: solo A tiene flecha. La línea sigue los puntos del croquis y la punta termina en
  // el último.
  const [linea, punta] = lista.filter((e) => e.clave === 'flechas');
  const puntos = g.flechas.find((f) => f.letra === 'A').puntos;
  assert.equal(linea.tipo, 'linea');
  assert.equal(linea.letra, 'A');
  assert.equal(linea.path.length, puntos.length);
  assert.deepEqual(linea.path[0], { lat: puntos[0].lat, lng: puntos[0].lon, altitude: ALTURAS.flecha });
  assert.equal(punta.tipo, 'poligono');
  const plano = planoLocal(CENTRO);
  const fin = plano.aMetros(puntos.at(-1));
  assert.ok(distancia(plano.aMetros({ lat: punta.path[0].lat, lon: punta.path[0].lng }), fin) < 0.01);
  assert.equal(lista.filter((e) => e.clave === 'flechas').length, 2);

  // El golpe, y el pin del paso 3 sin letrero: con croquis caía encima del carro A.
  assert.equal(de('marcador', 'golpe').length, 1);
  assert.deepEqual(de('marcador', 'golpe')[0].position, { lat: g.golpe.lat, lng: g.golpe.lon, altitude: ALTURAS.golpe });
  assert.equal(de('marcador', 'punto')[0].texto, '');

  // El tramo, la precisión y el sol, con sus colores (Google acepta rgba).
  assert.equal(de('linea', 'tramo')[0].strokeColor, 'rgba(29, 158, 117, 0.6)');
  assert.equal(de('linea', 'tramo')[0].path.length, analisis.tramo.length);
  assert.equal(de('poligono', 'precision').length, 1);
  assert.equal(de('letrero', 'sol')[0].texto, 'Sol a 30°');
  // Lo de abajo va primero y el pin del choque al final, encima de todo.
  assert.equal(lista[0].clave, 'precision');
  assert.equal(lista.at(-1).clave, 'punto');
});

test('sin croquis y sin ser el ejemplo: ni carros ni golpe, y el pin dice «Choque»', () => {
  const capas = capasDeLaZona({ centro: CENTRO, analisis: ejemplo() });
  const lista = elementosDeGoogle(capas, carrosDeLaZona({ analisis: ejemplo() }));
  assert.equal(lista.filter((e) => e.tipo === 'carro').length, 0);
  assert.equal(lista.filter((e) => e.clave === 'golpe').length, 0);
  assert.equal(lista.find((e) => e.clave === 'punto').texto, 'Choque');
  // El ejemplo sin croquis tiene sus carros inventados solo cuando llega el análisis (salen del tramo).
  assert.equal(carrosDeLaZona({ ejemplo: true, analisis: null }).length, 0);
  assert.equal(carrosDeLaZona({ ejemplo: true, analisis: ejemplo() }).length, 2);
});

test('cuando Google no acepta la clave, el motivo en palabras y con su código', () => {
  // La línea exacta que escribió Google el 13-nov-2026 con una clave que no existe.
  assert.equal(motivoDeGoogle('Google Maps JavaScript API error: InvalidKeyMapError\nhttps://developers.google.com/maps/documentation/javascript/error-messages#invalid-key-map-error'), 'Google no aceptó la clave del 3D (InvalidKeyMapError).');
  assert.equal(motivoDeGoogle('Google Maps JavaScript API error: RefererNotAllowedMapError'), 'La clave de Google no está autorizada para este sitio (RefererNotAllowedMapError).');
  assert.equal(motivoDeGoogle('Google Maps JavaScript API error: OverQuotaMapError'), 'Se acabó el cupo de hoy del 3D de Google (OverQuotaMapError).');
  assert.equal(motivoDeGoogle('Google Maps JavaScript API error'), 'Google no aceptó la clave del 3D.');
});

test('el color con transparencia y el rumbo del carro, entre 0 y 360', () => {
  assert.equal(conTransparencia(COLORES.precision, 0.12), 'rgba(47, 111, 183, 0.12)');
  assert.equal(orientacionDelCarro(-30).heading, 330);
  assert.equal(orientacionDelCarro(370).heading, 10);
  assert.deepEqual(orientacionDelCarro(90), { heading: 90, tilt: 0, roll: 0 });
});
