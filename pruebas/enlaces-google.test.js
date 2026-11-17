import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { enlacesDeGoogle, fechaCorta } from '../js/enlaces-google.js';
import { analizarVia } from '../js/via.js';
import { EJEMPLO } from '../js/pantalla-donde.js';

test('el enlace al mapa pone un pin en el punto, sin clave de Google', () => {
  const { mapa } = enlacesDeGoogle({ lat: 4.6484, lon: -74.0105 });
  const u = new URL(mapa);
  assert.equal(u.origin + u.pathname, 'https://www.google.com/maps/search/');
  assert.equal(u.searchParams.get('api'), '1');
  assert.equal(u.searchParams.get('query'), '4.648400,-74.010500');
  assert.equal(u.searchParams.get('key'), null);
});

test('Street View mira a lo largo de la vía si se sabe su rumbo', () => {
  const sin = new URL(enlacesDeGoogle({ lat: 4.6484, lon: -74.0105 }).calle);
  assert.equal(sin.searchParams.get('map_action'), 'pano');
  assert.equal(sin.searchParams.get('viewpoint'), '4.648400,-74.010500');
  assert.equal(sin.searchParams.get('heading'), null);
  const con = new URL(enlacesDeGoogle({ lat: 4.6484, lon: -74.0105 }, { rumbo: 223.4 }).calle);
  assert.equal(con.searchParams.get('heading'), '223');
  assert.equal(new URL(enlacesDeGoogle({ lat: 0, lon: 0 }, { rumbo: -90 }).calle).searchParams.get('heading'), '270');
});

test('la fecha de los datos guardados, en la hora de Colombia', () => {
  assert.equal(fechaCorta('2026-11-12T22:30:59.045Z'), '12-nov-2026');
  assert.equal(fechaCorta('2026-11-13T03:00:00Z'), '12-nov-2026', 'las 10 p. m. en Bogotá siguen siendo el 12');
  assert.equal(fechaCorta('no es fecha'), '');
});

test('el ejemplo guardado para la app es el de la esquina real, y se analiza igual', () => {
  const guardado = JSON.parse(fs.readFileSync(new URL('../datos/ejemplo-teusaquillo.json', import.meta.url), 'utf8'));
  assert.deepEqual(guardado.punto, EJEMPLO);
  assert.match(guardado.fuente, /OpenStreetMap/);
  const a = analizarVia(guardado.respuesta, EJEMPLO);
  assert.equal(a.via.nombre, 'Carrera 20');
  assert.equal(a.forma.tipo, 'recta');
  assert.equal(a.cruce?.con, 'Calle 44');
  assert.ok(a.cruce.distancia < 3, 'el punto está a pasos del cruce');
});
