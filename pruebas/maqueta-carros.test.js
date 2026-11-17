// El carro nuevo de la recreación (maqueta-carros.js con js/generico, copiado del Taller de Pintura el
// 16-nov-2026). Sus pruebas de forma y de pintura viven allá; aquí se prueba lo que solo importa aquí:
// que traiga todas las piezas que se marcan en el paso 6 (si falta una, su daño no se enciende y nadie
// se entera), que la laca del Taller se deje poner en el sitio de cada carro, que el daño salga en
// pantalla con SU color y que se distinga de la lata de su carro. En el Taller la pieza marcada lleva
// un 22 % del color del carro, y la abolladura azul sobre el naranja de B salía lila (revisión del
// 15-nov); y sin el brillo encima, la abolladura sobre el azul de C no se distinguía (revisión del
// 16-nov). Ninguna de las dos cosas la ve una prueba que solo compara los cuatro colores entre sí
// (danos.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { construirCarroNuevo } from '../js/generico/carro-nuevo.js';
import { PIEZAS } from '../js/piezas.js';
import { PIEZAS_CON_DANO, TIPOS_DE_DANO } from '../js/danos.js';
import { colorDeCarro } from '../js/zona-3d.js';
import { diferenciaEnLab, diferenciaPercibida } from '../js/diferencia-de-color.js';
import { CAMBIOS_EN_LA_LACA, capaDeLosCarros, colorDeLaSenal, pinturaEnSuSitio, tenir } from '../js/maqueta-carros.js';
import { aclaradoEn } from '../js/pantalla-recreacion.js';
import { VISTAS, aHex, lacaEnPantalla } from './laca-a-mano.js';

const CARROCERIAS = ['sedan', 'hatchback', 'suv', 'camioneta'];
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];
const hexDe = (color) => new THREE.Color(color).getHex();

// Lo que three le pasa a onBeforeCompile: el sombreador físico con sus #include sin resolver.
function compilar(material) {
  const s = { uniforms: {}, fragmentShader: THREE.ShaderLib.physical.fragmentShader, vertexShader: THREE.ShaderLib.physical.vertexShader };
  const avisos = [];
  const avisar = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try {
    material.onBeforeCompile(s, {});
  } finally {
    console.warn = avisar;
  }
  return { s, avisos };
}

function lacaPuesta(carroceria = 'sedan', pieza = 'capo', color = colorDeCarro('B')) {
  const carro = construirCarroNuevo({ colorBase: hexDe(color), carroceria });
  const malla = carro.porId.get(pieza);
  const local = { value: new THREE.Matrix4() };
  pinturaEnSuSitio(malla.material, local);
  return { carro, malla, local };
}

// Un carro con toda su laca puesta en su sitio, como lo arma capaDeLosCarros.
function carroPuesto(color) {
  const carro = construirCarroNuevo({ colorBase: hexDe(color), carroceria: 'sedan' });
  const local = { value: new THREE.Matrix4() };
  const puestos = new Set();
  carro.grupo.traverse((malla) => {
    if (malla.isMesh && !puestos.has(malla.material) && malla.material.customProgramCacheKey?.() === 'laca') {
      pinturaEnSuSitio(malla.material, local);
      puestos.add(malla.material);
    }
  });
  return carro;
}
const lineal = (material) => [material.color.r, material.color.g, material.color.b];

test('las cuatro carrocerías traen las 29 piezas: todo daño del paso 6 tiene dónde encenderse', () => {
  for (const carroceria of CARROCERIAS) {
    const { porId } = construirCarroNuevo({ colorBase: hexDe(colorDeCarro('B')), carroceria });
    assert.deepEqual([...porId.keys()].sort(), PIEZAS.map((p) => p.id).sort(), carroceria);
    for (const pieza of PIEZAS_CON_DANO) assert.ok(porId.get(pieza)?.isMesh, `${carroceria}: ${pieza}`);
  }
});

test('la laca del Taller se deja poner en el sitio de cada carro: los cambios calzan todos', () => {
  for (const pieza of ['capo', 'puerta-del-izq', 'bomper-tras', 'capo-int']) {
    const { malla, local } = lacaPuesta('sedan', pieza);
    const { s, avisos } = compilar(malla.material);
    assert.deepEqual(avisos, [], pieza);
    assert.equal(s.uniforms.uLocal, local, pieza);
    assert.equal(malla.material.customProgramCacheKey(), 'laca-maqueta');
    assert.ok(s.fragmentShader.includes('uniform mat4 uLocal;'));
    assert.ok(s.fragmentShader.includes('mat3( uLocal )'));
    assert.ok(s.fragmentShader.includes('uLocal * vec4( cameraPosition, 1.0 )'));
    // La marcada, con su color calibrado, sin el emissive encima y con el cielo teñido de su color.
    assert.ok(s.fragmentShader.includes('colorBase = diffuseColor.rgb;'));
    assert.ok(s.fragmentShader.includes('totalEmissiveRadiance = vec3( 0.0 );'));
    assert.ok(!s.fragmentShader.includes('uPropio, 0.22'));
    assert.ok(!s.fragmentShader.includes('tinte = vec3( 1.0 );'), pieza);
    // diffuseColor ya trae el color por vértice de las piezas de adentro: multiplicarlo otra vez las oscurecía.
    assert.ok(!s.fragmentShader.includes('colorBase *= vColor'), pieza);
  }
  assert.equal(CAMBIOS_EN_LA_LACA.length, 5);
});

test('la cuenta a mano de la laca (pruebas/laca-a-mano.js) sigue siendo la del sombreador', () => {
  // La huella del texto que copia laca-a-mano.js, con los cambios de la maqueta ya puestos. Si el
  // Taller cambia su pintura o la maqueta sus cambios, esto falla: hay que rehacer laca-a-mano.js
  // contra el sombreador nuevo y, solo entonces, poner aquí la huella nueva.
  const { malla } = lacaPuesta('sedan', 'capo');
  const texto = compilar(malla.material).s.fragmentShader;
  const desde = texto.indexOf('vec3 nM = normalize(');
  const hasta = texto.indexOf('reflectedLight.indirectSpecular = reflejo * fresnel;');
  assert.ok(desde > 0 && hasta > desde);
  const huella = createHash('sha256').update(texto.slice(desde, hasta).replace(/\s+/g, ' ')).digest('hex').slice(0, 16);
  assert.equal(huella, '525571fea247aaa3');
  // Y la respuesta de la laca que la cuenta a mano da por hecha.
  assert.ok(texto.includes('colorBase * luz * 0.760'));
});

test('el daño sale en pantalla con su color desde las cámaras de la película, contando el reflejo', () => {
  // Los seis colores de las letras y los dos extremos (un blanco y un negro, que el Taller arma con
  // otra luz). Lo que se pide es el color de la señal: el del daño, o más claro donde se parece al
  // del carro (ver la prueba siguiente).
  const colores = [...LETRAS.map(colorDeCarro), '#f1f3f5', '#15171a'];
  for (const colorDelCarro of colores) {
    const carro = carroPuesto(colorDelCarro);
    for (const vista of VISTAS) {
      const malla = carro.porId.get(vista.pieza);
      const { s } = compilar(malla.material);
      for (const tipo of TIPOS_DE_DANO) {
        const senal = colorDeLaSenal(tipo.color, colorDelCarro);
        tenir(malla, senal);
        const visto = lacaEnPantalla({ uniformes: s.uniforms, color: lineal(malla.material), marcada: true, vista });
        // Medido el 16-nov: lo peor, 6,9, es el techo visto casi a ras (8°), en una tira de pocos
        // píxeles; de 14° para arriba no pasa de 5,1. Un 2 apenas se nota lado a lado.
        const lejos = diferenciaPercibida(aHex(visto), senal);
        assert.ok(lejos <= 8, `${tipo.id} sobre ${colorDelCarro}, ${vista.nombre}: ${visto} contra ${senal} (ΔE00 ${lejos.toFixed(1)})`);
        // Lo de antes, la pieza marcada como la hacía el Taller (más el brillo encima que se le
        // ponía aquí), para que quede escrito por qué se cambió: desde cualquier cámara, peor.
        if (senal === tipo.color) {
          const e = new THREE.Color(tipo.color);
          const antes = lacaEnPantalla({ uniformes: s.uniforms, color: lineal(malla.material), comoElTaller: { emissive: [e.r, e.g, e.b].map((x) => x * 0.45) }, vista });
          assert.ok(diferenciaPercibida(aHex(antes), tipo.color) > lejos, `${tipo.id} sobre ${colorDelCarro}, ${vista.nombre}`);
        }
        tenir(malla, null);
      }
    }
  }
});

test('el daño se distingue de la lata de su carro, sobre los seis colores de las letras', () => {
  for (const letra of LETRAS) {
    const carro = carroPuesto(colorDeCarro(letra));
    for (const vista of VISTAS) {
      const malla = carro.porId.get(vista.pieza);
      const { s } = compilar(malla.material);
      const lata = lacaEnPantalla({ uniformes: s.uniforms, color: lineal(malla.material), vista });
      for (const tipo of TIPOS_DE_DANO) {
        tenir(malla, colorDeLaSenal(tipo.color, colorDeCarro(letra)));
        const marcada = lacaEnPantalla({ uniformes: s.uniforms, color: lineal(malla.material), marcada: true, vista });
        tenir(malla, null);
        // 10 es lo del rojo de «roto» sobre el naranja de B, que sí se distingue (lo más cerca: 10,2).
        // Sin aclarar, la abolladura sobre C quedaba a 3,4 y el «suelto» sobre D a 5,3.
        const d = diferenciaPercibida(aHex(marcada), aHex(lata));
        assert.ok(d >= 10, `${tipo.id} sobre ${letra}, ${vista.nombre}: lata ${lata}, marcada ${marcada} (ΔE00 ${d.toFixed(1)})`);
      }
    }
  }
});

test('solo se aclara lo que se parece: el ejemplo de A y B sale con los colores del paso 6', () => {
  const aclarados = [];
  for (const letra of LETRAS) {
    for (const tipo of TIPOS_DE_DANO) {
      const senal = colorDeLaSenal(tipo.color, colorDeCarro(letra));
      if (senal === tipo.color) continue;
      aclarados.push(`${letra} ${tipo.id}`);
      // Más claro, y sin confundirse con otro daño de la leyenda.
      assert.ok(new THREE.Color(senal).getHSL({}).l > new THREE.Color(tipo.color).getHSL({}).l, `${letra} ${tipo.id}: ${senal} no es más claro`);
      for (const otro of TIPOS_DE_DANO) if (otro !== tipo) assert.ok(diferenciaPercibida(senal, otro.color) >= 15, `${letra} ${tipo.id} (${senal}) se parece a ${otro.id}`);
    }
  }
  assert.deepEqual(aclarados, ['C abolladura', 'D suelto']);
});

test('la diferencia de color es la CIEDE2000 publicada (casos de Sharma, Wu y Dalal, 2005)', () => {
  const casos = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [58, 24, 15], 19.4535],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  ];
  for (const [a, b, esperado] of casos) {
    assert.ok(Math.abs(diferenciaEnLab(a, b) - esperado) < 1e-4, `${a} / ${b}: ${diferenciaEnLab(a, b)}`);
    assert.ok(Math.abs(diferenciaEnLab(b, a) - esperado) < 1e-4, 'en los dos sentidos');
  }
  assert.equal(diferenciaPercibida('#1e6fd9', '#1e6fd9'), 0);
});

test('quitar la marca devuelve el color exacto de la lata, también en el estribo de plástico', () => {
  const { malla } = lacaPuesta('sedan', 'capo');
  const base = malla.userData.colorBase.clone();
  tenir(malla, '#1e6fd9');
  assert.ok(!malla.material.color.equals(base));
  assert.ok(!malla.material.color.equals(new THREE.Color('#1e6fd9')), 'la laca lleva el color calibrado, no el pedido tal cual');
  assert.ok(malla.material.emissiveIntensity > 0);
  tenir(malla, null);
  assert.ok(malla.material.color.equals(base));
  assert.equal(malla.material.emissive.getHex(), 0);

  // En una SUV el estribo es de plástico, no de laca: lleva el color tal cual.
  const suv = construirCarroNuevo({ colorBase: hexDe(colorDeCarro('B')), carroceria: 'suv' });
  const estribo = suv.porId.get('estribo-der');
  assert.ok(!estribo.material.userData.lacaEnSuSitio);
  const baseEstribo = estribo.userData.colorBase.clone();
  tenir(estribo, '#d0312d');
  assert.ok(estribo.material.color.equals(new THREE.Color('#d0312d')));
  tenir(estribo, null);
  assert.ok(estribo.material.color.equals(baseEstribo));
});

test('la capa arma los carros de las cuatro carrocerías, sin sombra del sol, y dice qué daño aclaró', () => {
  // Lo único del navegador que la capa toca al armarse son lienzos: la mancha de debajo del carro y
  // las texturas del carro nuevo (faros, parrilla). Aquí, un lienzo que acepta todo y no dibuja nada.
  const habia = globalThis.document;
  const cualquiera = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : cualquiera()), apply: () => cualquiera(), set: () => true });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => cualquiera() }) };
  try {
    const maplibregl = { MercatorCoordinate: { fromLngLat: () => ({ x: 0.29, y: 0.49, meterInMercatorCoordinateUnits: () => 2.5e-8 }) } };
    const sol = { altura: 40, azimut: 120 };
    const carros = CARROCERIAS.map((carroceria, i) => ({ letra: 'ABCD'[i], color: colorDeCarro('ABCD'[i]), carroceria }));
    const danos = [
      { carro: 'C', pieza: 'estribo-der', tipo: 'roto' },
      { carro: 'A', pieza: 'capo', tipo: 'abolladura' },
      { carro: 'C', pieza: 'capo', tipo: 'abolladura' },
    ];
    const capa = capaDeLosCarros({ maplibregl, origen: { lat: 4.65, lon: -74.01 }, plano: {}, carros, danos, sol });
    assert.equal(capa.id, 'choque-carros-3d');
    assert.equal(typeof capa.render, 'function');
    // La sombra del sol iba en la pasada aparte de MapLibre (prerender): sin ella, no se pide.
    assert.equal(capa.prerender, undefined);
    // La abolladura azul sobre el azul de C va más clara; sobre el verde de A, no.
    assert.deepEqual(capa.aclarados, ['C']);
  } finally {
    globalThis.document = habia;
  }
});

test('la pantalla dice dónde va un daño más claro, y no lo dice si no hubo', () => {
  assert.equal(aclaradoEn([]), '.');
  assert.equal(aclaradoEn(), '.');
  assert.match(aclaradoEn(['C']), /en el carro C ese color va más claro/);
  assert.match(aclaradoEn(['C', 'D']), /en los carros C y D ese color va más claro/);
  assert.match(aclaradoEn(['C', 'D', 'E']), /C, D y E/);
});
