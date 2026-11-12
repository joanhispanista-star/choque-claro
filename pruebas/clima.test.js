import test from 'node:test';
import assert from 'node:assert/strict';
import { climaALaHora, filasDelClima, horaDeReloj, textoDelCodigo, urlDelClima } from '../js/clima.js';

const PUNTO = { lat: 4.6484, lon: -74.0105 };
const AHORA = new Date('2026-11-12T10:00:00-05:00');

test('la URL pide los días hacia atrás que hagan falta, en la hora del lugar', () => {
  const hoy = new URL(urlDelClima(PUNTO, new Date('2026-11-12T08:00:00-05:00'), AHORA));
  assert.equal(hoy.searchParams.get('past_days'), '2');
  assert.equal(hoy.searchParams.get('timezone'), 'auto');
  assert.equal(hoy.searchParams.get('latitude'), '4.648');
  assert.match(hoy.searchParams.get('hourly'), /precipitation/);
  // 10 días y 2 horas: se redondea hacia arriba (11) y se pide uno más de
  // margen, por si la fecha del lugar no es la del celular.
  const hace10 = new URL(urlDelClima(PUNTO, new Date('2026-11-02T08:00:00-05:00'), AHORA));
  assert.equal(hace10.searchParams.get('past_days'), '12');
  assert.equal(urlDelClima(PUNTO, new Date('2026-07-01T08:00:00-05:00'), AHORA), null, 'más de 92 días: no se puede');
});

// Como responde Open-Meteo con timezone=auto en Bogotá.
const RESPUESTA = {
  utc_offset_seconds: -18000,
  hourly: {
    time: ['2026-11-11T16:00', '2026-11-11T17:00', '2026-11-11T18:00'],
    precipitation: [0, 0.1, 2.4],
    cloud_cover: [50, 89, 100],
    visibility: [24000, 18680, 800],
    weather_code: [2, 3, 63],
  },
};

test('un choque a las 5:15 cae en la lluvia de 5 a 6 (la que Open-Meteo guarda a las 6)', () => {
  const c = climaALaHora(RESPUESTA, new Date('2026-11-11T17:15:00-05:00'));
  assert.deepEqual(c, { desde: '17:00', hasta: '18:00', lluvia: 2.4, nubes: 100, visibilidad: 800, codigo: 63, texto: 'Lluvia' });
});

test('un choque a las 5:00 en punto cae en el bloque de 4 a 5', () => {
  const c = climaALaHora(RESPUESTA, new Date('2026-11-11T17:00:00-05:00'));
  assert.equal(c.desde, '16:00');
  assert.equal(c.hasta, '17:00');
  assert.equal(c.lluvia, 0.1);
});

test('la hora del lugar manda, no la del celular', () => {
  // El mismo instante escrito en UTC: 22:15 UTC = 5:15 p. m. en Bogotá.
  const c = climaALaHora(RESPUESTA, new Date('2026-11-11T22:15:00Z'));
  assert.equal(c.hasta, '18:00');
});

test('si la hora no viene en la respuesta, null', () => {
  assert.equal(climaALaHora(RESPUESTA, new Date('2026-11-11T23:30:00-05:00')), null);
  assert.equal(climaALaHora({}, new Date()), null);
});

test('la hora como se lee en Colombia', () => {
  assert.equal(horaDeReloj('17:00'), '5:00 p. m.');
  assert.equal(horaDeReloj('00:00'), '12:00 a. m.');
  assert.equal(horaDeReloj('12:00'), '12:00 p. m.');
  assert.equal(horaDeReloj('09:00'), '9:00 a. m.');
});

test('los códigos del cielo', () => {
  assert.equal(textoDelCodigo(0), 'Despejado');
  assert.equal(textoDelCodigo(45), 'Niebla');
  assert.equal(textoDelCodigo(95), 'Tormenta');
  assert.equal(textoDelCodigo(1234), null);
});

test('las filas: la lluvia, la niebla y de dónde sale el dato', () => {
  const filas = Object.fromEntries(filasDelClima(climaALaHora(RESPUESTA, new Date('2026-11-11T17:15:00-05:00'))).map((f) => [f.clave, f]));
  assert.equal(filas.lluvia.valor, '2,4 mm entre las 5:00 p. m. y las 6:00 p. m.');
  assert.match(filas.lluvia.nota, /modelo del clima, no una estación/);
  assert.equal(filas.lluvia.aviso, 'atencion');
  assert.equal(filas.cielo.valor, 'Lluvia');
  assert.equal(filas.cielo.nota, 'nubes: 100 %');
  assert.equal(filas.visibilidad.valor, '800 m');
  assert.equal(filas.visibilidad.aviso, 'atencion');
  const seco = Object.fromEntries(filasDelClima(climaALaHora(RESPUESTA, new Date('2026-11-11T16:00:00-05:00'))).map((f) => [f.clave, f]));
  assert.equal(seco.lluvia.valor, 'Sin lluvia entre las 3:00 p. m. y las 4:00 p. m.');
  assert.equal(seco.visibilidad.valor, '24 km');
});

test('si el clima no se pudo consultar, se dice', () => {
  const [fila] = filasDelClima({ error: 'Sin conexión con el servicio.' });
  assert.equal(fila.valor, 'No se pudo consultar');
  assert.equal(fila.nota, 'Sin conexión con el servicio.');
  assert.deepEqual(filasDelClima(null), []);
});
