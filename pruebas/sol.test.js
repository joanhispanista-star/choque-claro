// El sol: se comprueba contra reglas de la astronomía que no dependen de cómo
// esté escrito el cálculo (la altura al mediodía y el rumbo de la puesta),
// no contra números sacados del mismo código.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encandilamiento, filasDelSol, momentoDelDia, posicionDelSol } from '../js/sol.js';

const GRADO = Math.PI / 180;

// La mayor altura del sol en un día, buscando minuto a minuto.
function alturaMaxima(dia, lat, lon) {
  let max = -90;
  for (let m = 0; m < 24 * 60; m++) max = Math.max(max, posicionDelSol(new Date(dia.getTime() + m * 60000), lat, lon).altura);
  return max;
}

test('al mediodía del equinoccio en Bogotá el sol sube a 90° - latitud', () => {
  // Equinoccio: 20-mar-2026 (declinación casi 0).
  const max = alturaMaxima(new Date('2026-03-20T00:00:00-05:00'), 4.711, -74.072);
  assert.ok(Math.abs(max - (90 - 4.711)) < 0.6, `altura ${max}`);
});

test('en el ecuador, al mediodía del equinoccio, el sol queda casi encima', () => {
  assert.ok(alturaMaxima(new Date('2026-03-20T00:00:00Z'), 0, 0) > 89.4);
});

test('la puesta del sol del 11-nov en los cerros de Bogotá es al oeste-suroeste (~252°)', () => {
  const lat = 4.6484;
  const lon = -74.0105;
  // El minuto en que el centro del sol cruza el horizonte por la tarde.
  let cruce = null;
  for (let m = 15 * 60; m < 20 * 60; m++) {
    const antes = posicionDelSol(new Date(Date.parse('2026-11-11T00:00:00-05:00') + m * 60000), lat, lon);
    const despues = posicionDelSol(new Date(Date.parse('2026-11-11T00:00:00-05:00') + (m + 1) * 60000), lat, lon);
    if (antes.altura > 0 && despues.altura <= 0) {
      cruce = { minuto: m, ...antes };
      break;
    }
  }
  assert.ok(cruce, 'el sol tiene que ponerse esa tarde');
  // Rumbo de la puesta: arccos(sen δ / cos φ), con la declinación de ese día
  // (-17,6°, de las tablas). No sale de posicionDelSol.
  const esperado = 360 - Math.acos(Math.sin(-17.6 * GRADO) / Math.cos(lat * GRADO)) / GRADO;
  assert.ok(Math.abs(cruce.azimut - esperado) < 1, `azimut ${cruce.azimut} esperado ${esperado}`);
  // Y pasa entre las 5:25 y las 5:45 p. m. (sin refracción, unos minutos
  // antes de la hora oficial de la puesta).
  assert.ok(cruce.minuto >= 17 * 60 + 25 && cruce.minuto <= 17 * 60 + 45, `minuto ${cruce.minuto}`);
});

test('el momento del día por la altura', () => {
  assert.equal(momentoDelDia({ altura: 40 }), 'dia');
  assert.equal(momentoDelDia({ altura: 3 }), 'sol-bajo');
  assert.equal(momentoDelDia({ altura: -3 }), 'crepusculo');
  assert.equal(momentoDelDia({ altura: -20 }), 'noche');
});

test('encandila: sol bajo y en la línea de la vía', () => {
  assert.deepEqual(encandilamiento({ altura: 8, azimut: 251 }, 71), { haciaRumbo: 251, diferencia: 0 });
  assert.equal(encandilamiento({ altura: 8, azimut: 251 }, 251).haciaRumbo, 251);
  assert.equal(encandilamiento({ altura: 8, azimut: 251 }, 160), null, 'vía atravesada al sol');
  assert.equal(encandilamiento({ altura: 40, azimut: 251 }, 71), null, 'sol alto');
  assert.equal(encandilamiento({ altura: -2, azimut: 251 }, 71), null, 'ya se puso');
  assert.equal(encandilamiento({ altura: 8, azimut: 251 }, undefined), null, 'sin vía');
});

test('las filas del sol', () => {
  const tarde = filasDelSol({ altura: 8, azimut: 251 }, 71);
  assert.equal(tarde[0].valor, 'De día');
  assert.match(tarde[0].nota, /a 8° sobre el horizonte, hacia el oeste-suroeste/);
  assert.equal(tarde[1].etiqueta, 'Sol de frente');
  assert.equal(tarde[1].valor, 'Para quien iba hacia el oeste-suroeste');
  assert.equal(tarde[1].aviso, 'atencion');
  // Con el cielo cubierto no se afirma el encandilamiento.
  const nublado = filasDelSol({ altura: 8, azimut: 251 }, 71, { nubes: 97 });
  assert.match(nublado[1].nota, /cielo estaba cubierto \(97\u00a0% de nubes\): es menos probable/);
  assert.equal(nublado[1].aviso, null);
  assert.equal(filasDelSol({ altura: 8, azimut: 251 }, 71, { nubes: 40 })[1].aviso, 'atencion');
  assert.equal(filasDelSol({ altura: 8, azimut: 251 }, 160).length, 1);
  assert.equal(filasDelSol({ altura: -20, azimut: 300 }, 71)[0].valor, 'De noche');
  assert.equal(filasDelSol({ altura: -3, azimut: 250 }, 71)[0].valor, 'Anochecer');
  assert.equal(filasDelSol({ altura: 3, azimut: 110 }, 71)[0].valor, 'Amaneciendo, sol muy bajo');
});
