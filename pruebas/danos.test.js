// Los daños (paso 6): marcar, cambiar y quitar; la foto de cerca vigente de
// cada pieza; lo que dice la lista; y una revisión que no castiga mirar abajo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIEZAS_CON_DANO,
  TIPOS_DE_DANO,
  coloresDelCarro,
  danoDe,
  danosDelCarro,
  filasDeDanos,
  fotosDeLosDanos,
  marcarDano,
  quitarDano,
  resumenDeDanos,
  revisarFotoDeCerca,
} from '../js/danos.js';
import { UMBRALES } from '../js/calidad.js';

const CUANDO = new Date('2026-11-18T15:00:00Z');
const fotoDeDano = (carro, pieza, dano, huella) => ({ paso: 'danos', carro, pieza, dano, sector: null, huella });

test('cuatro tipos con colores distintos, y solo las piezas de afuera', () => {
  assert.deepEqual(TIPOS_DE_DANO.map((t) => t.id), ['rayon', 'abolladura', 'roto', 'suelto']);
  assert.equal(new Set(TIPOS_DE_DANO.map((t) => t.color)).size, 4);
  assert.ok(PIEZAS_CON_DANO.includes('bomper-del'));
  assert.ok(PIEZAS_CON_DANO.includes('espejo-izq'));
  assert.ok(!PIEZAS_CON_DANO.some((id) => id.endsWith('-int') || id.startsWith('vano-') || id.startsWith('marco-') || id.startsWith('base-')));
  assert.equal(PIEZAS_CON_DANO.length, 17);
});

test('una pieza tiene un solo daño: marcarla otra vez le cambia el tipo', () => {
  let danos = marcarDano([], { carro: 'A', pieza: 'bomper-del', tipo: 'rayon', cuando: CUANDO });
  danos = marcarDano(danos, { carro: 'B', pieza: 'bomper-del', tipo: 'roto', cuando: CUANDO });
  danos = marcarDano(danos, { carro: 'A', pieza: 'bomper-del', tipo: 'abolladura', cuando: CUANDO });
  danos = marcarDano(danos, { carro: 'A', pieza: 'capo', tipo: 'abolladura', cuando: CUANDO });
  assert.equal(danos.length, 3);
  assert.equal(danoDe(danos, 'A', 'bomper-del').tipo, 'abolladura');
  assert.equal(danoDe(danos, 'B', 'bomper-del').tipo, 'roto');
  // En el orden de las piezas, no en el que se marcaron.
  assert.deepEqual(danosDelCarro(danos, 'A').map((d) => d.pieza), ['capo', 'bomper-del']);
  assert.deepEqual(quitarDano(danos, 'A', 'capo').map((d) => d.pieza), ['bomper-del', 'bomper-del']);
  assert.equal(coloresDelCarro(danos, 'A').get('capo'), TIPOS_DE_DANO[1].color);
  assert.throws(() => marcarDano([], { carro: 'A', pieza: 'capo', tipo: 'quemado', cuando: CUANDO }), /Tipo de daño desconocido/);
  assert.throws(() => marcarDano([], { carro: 'A', pieza: 'vano-motor', tipo: 'roto', cuando: CUANDO }), /no se marca/);
});

test('la foto vigente de cada pieza es la última, y la lista dice si se tomó con otro tipo', () => {
  const registros = [
    { paso: 'escena', sector: 0, huella: 'e0' },
    fotoDeDano('A', 'bomper-del', 'rayon', 'd1'),
    fotoDeDano('B', 'bomper-del', 'roto', 'd2'),
    fotoDeDano('A', 'bomper-del', 'abolladura', 'd3'),
  ];
  assert.equal(fotosDeLosDanos(registros, 'A').get('bomper-del').huella, 'd3');
  let danos = marcarDano([], { carro: 'A', pieza: 'bomper-del', tipo: 'roto', cuando: CUANDO });
  danos = marcarDano(danos, { carro: 'A', pieza: 'baul', tipo: 'rayon', cuando: CUANDO });
  const filas = filasDeDanos(danos, registros, 'A', 'hatchback');
  assert.deepEqual(
    filas.map((f) => [f.nombre, f.nombreDelTipo, f.foto && f.foto.huella, f.fotoComoOtroTipo]),
    [
      // En un hatchback el baúl es la compuerta (carrocerias.js).
      ['Compuerta trasera', 'Rayón', null, null],
      ['Bómper delantero', 'Roto', 'd3', 'Abolladura'],
    ],
  );
  assert.equal(resumenDeDanos(filas), '2 piezas marcadas; falta 1 foto de cerca.');
  assert.equal(resumenDeDanos(filas.slice(1)), '1 pieza marcada, todas con su foto de cerca.');
  assert.equal(resumenDeDanos([]), 'Sin daños marcados.');
});

test('la foto de cerca se revisa por borrosa y oscura, no por mirar al piso ni por torcida', () => {
  assert.deepEqual(revisarFotoDeCerca({ nitidez: 500, brillo: 120, elevacion: -80, giro: 40 }), { ok: true, problemas: [] });
  assert.deepEqual(revisarFotoDeCerca({ nitidez: UMBRALES.nitidez - 1, brillo: 120 }).problemas, ['borrosa']);
  assert.deepEqual(revisarFotoDeCerca({ nitidez: 500, brillo: UMBRALES.brillo - 1 }).problemas, ['oscura']);
});
