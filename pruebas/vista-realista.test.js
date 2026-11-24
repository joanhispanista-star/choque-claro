// La vista realista: de dónde sale cada cosa que se ve, qué dice la pantalla de ella, y que apagada no deje
// rastro. También el video del ejemplo: que exista, que diga qué es y que nunca entre al expediente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planoLocal } from '../js/geo.js';
import { EJEMPLO } from '../js/ejemplo.js';
import { casasDeLosRasgos, capasQueSeApagan, coloresDelMapa, encimaDelDibujo, textosDeLaVista, RADIO_DE_LAS_CASAS } from '../js/vista-realista.js';
import {
  MEDIOS_DE_BOGOTA,
  NIVEL_MAS_FINO,
  corregir,
  cuadroEnMercator,
  dentroDeLaFoto,
  direccionDeLaFoto,
  direccionDeLaTesela,
  estaVacia,
  gamaPara,
  nivelesDe,
  tablaDeNiveles,
  teselasDelCuadro,
} from '../js/foto-aerea.js';
import { degradadoDeLaOrilla, granoDelZoom, rectanguloEnLaTesela, registrarPiso, teselaDeLaDireccion } from '../js/piso-realista.js';

const RAIZ = new URL('../', import.meta.url);
const leer = (r) => fs.readFileSync(new URL(r, RAIZ), 'utf8');
const cerca = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= t, `${a} no es ${b}`);

// --- La foto aérea

test('la foto aérea es solo de Bogotá', () => {
  assert.ok(dentroDeLaFoto(EJEMPLO));
  assert.ok(dentroDeLaFoto({ lat: 4.6675, lon: -74.0583 })); // Chapinero
  assert.ok(!dentroDeLaFoto({ lat: 4.7066, lon: -74.2301 })); // Mosquera
  assert.ok(!dentroDeLaFoto({ lat: 6.2442, lon: -75.5812 })); // Medellín
});

test('la foto a la medida: cuadrada, centrada en el punto y del tamaño pedido', () => {
  const url = new URL(direccionDeLaFoto(EJEMPLO, 49.944, 1024));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'serviciosgis.catastrobogota.gov.co');
  assert.equal(url.searchParams.get('size'), '1024,1024');
  const [x0, y0, x1, y1] = url.searchParams.get('bbox').split(',').map(Number);
  cerca(x1 - x0, y1 - y0, 0.02);
  // En Web Mercator los metros se estiran por 1/cos(lat): de lado, unos 100 m de los suyos.
  cerca(((x1 - x0) * Math.cos((EJEMPLO.lat * Math.PI) / 180)) / 2, 50, 0.01);
  cerca((x0 + x1) / 2, EJEMPLO.lon * (Math.PI / 180) * 6378137, 0.02);
});

test('lo único que viaja a Catastro es el cuadro del mapa', () => {
  for (const d of [direccionDeLaFoto(EJEMPLO, 50, 512), direccionDeLaTesela({ z: 18, x: 1, y: 2 })]) assert.ok(!/placa|nombre|reporte|token|key/i.test(d));
  assert.match(direccionDeLaTesela({ z: 18, x: 77132, y: 127694 }), /\/tile\/18\/127694\/77132$/); // ArcGIS: fila y después columna
});

test('el cuadro en Mercator es el mismo del mapa', () => {
  const q = cuadroEnMercator(EJEMPLO, 100);
  cerca(q.x, (180 + EJEMPLO.lon) / 360);
  cerca(q.y, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (EJEMPLO.lat * Math.PI) / 360))) / 360, 1e-12);
  cerca(q.h, 100 / (2 * Math.PI * 6371008.8 * Math.cos((EJEMPLO.lat * Math.PI) / 180)), 1e-15);
});

test('las teselas de un cuadro lo cubren entero y el recorte mide lo que debe', () => {
  for (const [medio, z] of [[MEDIOS_DE_BOGOTA[1], 18], [MEDIOS_DE_BOGOTA[2], 17]]) {
    const r = teselasDelCuadro(EJEMPLO, medio, z);
    assert.equal(r.teselas.length, r.columnas * r.filas);
    assert.ok(r.desde.x >= 0 && r.desde.x < 1 && r.desde.y >= 0 && r.desde.y < 1);
    assert.ok(r.desde.x + r.lado <= r.columnas && r.desde.y + r.lado <= r.filas, 'el recorte se sale de las teselas');
    // Los metros del recorte: teselas por lo que mide una.
    const metrosPorTesela = (2 * Math.PI * 6371008.8 * Math.cos((EJEMPLO.lat * Math.PI) / 180)) / 2 ** z;
    cerca(r.lado * metrosPorTesela, 2 * medio, 1e-6);
    assert.ok(r.teselas.length <= 49, `${r.teselas.length} teselas son muchas`);
  }
  assert.equal(NIVEL_MAS_FINO, 18);
});

test('los techos de lejos caben en la foto más amplia', () => {
  // Una casa se anota por su centro: puede pasarse unos metros del radio.
  assert.ok(RADIO_DE_LAS_CASAS + 120 < MEDIOS_DE_BOGOTA[2] * 0.985);
});

// Una foto de mentira: `pinta(i)` da el [r, g, b] del píxel i.
const foto = (n, pinta) => {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) d.set([...pinta(i), 255], i * 4);
  return d;
};

test('los niveles quitan la bruma azul', () => {
  // Gris de 60 a 180, con 40 más de azul: lo que le pone la bruma.
  const d = foto(40000, (i) => [60 + (i % 121), 60 + (i % 121), 100 + (i % 121)]);
  const n = nivelesDe(d, 1);
  assert.ok(n[0][0] <= 61 && n[0][1] >= 179 && n[2][0] >= 99);
  const tablas = n.map((x) => tablaDeNiveles(x, { gama: 1 }));
  corregir(d, tablas, 1);
  assert.ok(Math.abs(d[0] - d[2]) <= 2, 'el gris quedó de color');
});

test('una foto de un solo color no se estira', () => {
  assert.deepEqual(nivelesDe(foto(1000, () => [128, 128, 128]), 1), [[0, 255], [0, 255], [0, 255]]);
});

test('una foto oscura se aclara, una clara no se quema, y siempre dentro de los topes', () => {
  const llano = [[0, 255], [0, 255], [0, 255]];
  const de = (v) => gamaPara(foto(4000, (i) => [v + (i % 9), v + (i % 9), v + (i % 9)]), llano, 1);
  assert.ok(de(60) < 0.9);
  assert.ok(de(60) < de(90) && de(90) <= de(140));
  assert.equal(de(10), 0.6);
  assert.equal(de(220), 1.1);
  // La mitad queda con el brillo pedido.
  const gama = de(80);
  const medio = tablaDeNiveles([0, 255], { gama })[84];
  assert.ok(Math.abs(medio - 105) <= 4, `quedó en ${medio}`);
});

test('la tabla sube siempre y deja aire arriba y abajo', () => {
  const t = tablaDeNiveles([40, 200]);
  assert.equal(t[0], 14);
  assert.equal(t[255], 238);
  for (let i = 1; i < 256; i++) assert.ok(t[i] >= t[i - 1]);
});

test('corregir no toca la transparencia', () => {
  const d = foto(4, () => [100, 120, 140]);
  d[3] = 77;
  corregir(d, [0, 1, 2].map(() => tablaDeNiveles([0, 255])));
  assert.equal(d[3], 77);
});

test('donde no hay foto, se nota', () => {
  const n = 997 * 400;
  assert.ok(estaVacia(foto(n, () => [255, 255, 255])));
  const transparente = foto(n, (i) => [i % 251, i % 241, i % 239]);
  for (let i = 3; i < transparente.length; i += 4) transparente[i] = 0;
  assert.ok(estaVacia(transparente));
  assert.ok(!estaVacia(foto(n, (i) => [i % 251, i % 241, i % 239])));
});

// --- El piso

test('una foto cae en su sitio dentro de la tesela', () => {
  // En el nivel 1, la mitad del mundo: una foto de un cuarto de lado centrada en el medio de la tesela 0.
  const r = rectanguloEnLaTesela({ z: 1, x: 0, y: 0 }, { x: 0.25, y: 0.25 }, 0.125);
  assert.deepEqual([r.x, r.y, r.ancho, r.alto, r.toca], [64, 64, 128, 128, true]);
  assert.ok(!rectanguloEnLaTesela({ z: 1, x: 1, y: 1 }, { x: 0.25, y: 0.25 }, 0.125).toca);
});

test('la orilla difuminada sube y baja sin escalón', () => {
  const g = degradadoDeLaOrilla(0.07);
  assert.deepEqual(g[0], [0, 0]);
  assert.deepEqual(g.at(-1), [1, 0]);
  for (let i = 1; i < g.length; i++) assert.ok(g[i][0] >= g[i - 1][0], 'los puntos del degradado van en orden');
  assert.equal(Math.max(...g.map((p) => p[1])), 1);
  assert.ok(g.every(([t, a]) => t >= 0 && t <= 1 && a >= 0 && a <= 1));
});

test('la dirección de una tesela se lee aunque cambie la versión', () => {
  assert.deepEqual(teselaDeLaDireccion('pisocc1://0/18/77132/127694'), { z: 18, x: 77132, y: 127694 });
  assert.deepEqual(teselaDeLaDireccion('pisocc1://3/12/1205/1995'), { z: 12, x: 1205, y: 1995 });
  assert.equal(teselaDeLaDireccion('pisocc1://nada'), null);
});

test('el piso no hace fila detrás de lo que viene de internet', () => {
  // El 24-nov-2026, en un computador, el piso llegaba 6 s tarde: esperaba a que bajara el relieve.
  const registrados = [];
  const falso = { config: { MAX_PARALLEL_IMAGE_REQUESTS: 16, MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 8 }, addProtocol: (n) => registrados.push(n) };
  registrarPiso(falso, 'pisocc1', { x: 0.3, y: 0.5 }, []);
  assert.deepEqual(registrados, ['pisocc1']);
  // Una pantalla de computador pide unas 50 teselas del piso y unas 30 del relieve.
  assert.ok(falso.config.MAX_PARALLEL_IMAGE_REQUESTS >= 96 && falso.config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME >= 96);
  registrarPiso({ addProtocol: (n) => registrados.push(n) }, 'pisocc2', { x: 0.3, y: 0.5 }, []);
  assert.equal(registrados.length, 2);
});

test('la piedrita del asfalto solo de cerca', () => {
  assert.equal(granoDelZoom(18), 0);
  assert.ok(granoDelZoom(22) > granoDelZoom(21) && granoDelZoom(21) > granoDelZoom(20));
});

// --- Las casas

const plano = planoLocal(EJEMPLO);
const rasgo = (x, y, lado, h) => {
  const g = (u, v) => {
    const p = plano.aGrados({ x: u, y: v });
    return [p.lon, p.lat];
  };
  return { properties: { render_height: h }, geometry: { type: 'Polygon', coordinates: [[g(x, y), g(x + lado, y), g(x + lado, y + lado), g(x, y + lado), g(x, y)]] } };
};

test('las casas del mapa: sin repetidas, sin las de lejos y de la más cercana a la más lejana', () => {
  const casas = casasDeLosRasgos([rasgo(100, 0, 10, 9), rasgo(5, 5, 10, 6), rasgo(5, 5, 10, 6), rasgo(900, 0, 10, 5), { geometry: { type: 'Point', coordinates: [0, 0] } }, null], plano);
  assert.deepEqual(casas.map((c) => c.h), [6, 9]);
  cerca(casas[0].a[0][0], 5, 0.02);
  cerca(casas[0].a[0][1], 5, 0.02);
});

test('un montón de polígonos son varias casas, y hay un tope', () => {
  const [u, v] = [rasgo(0, 0, 8, 5), rasgo(30, 0, 8, 5)].map((r) => r.geometry.coordinates);
  assert.equal(casasDeLosRasgos([{ properties: {}, geometry: { type: 'MultiPolygon', coordinates: [u, v] } }], plano).length, 2);
  assert.equal(casasDeLosRasgos([rasgo(0, 0, 8, 5), rasgo(30, 0, 8, 5), rasgo(60, 0, 8, 5)], plano, 430, 2).length, 2);
  assert.deepEqual(casasDeLosRasgos(undefined, plano), []);
});

// --- El estilo del mapa

const CAPAS = [
  { id: 'fondo', type: 'background' },
  { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park' },
  { id: 'landuse_residential', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse' },
  { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building' },
  { id: 'road_casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
  { id: 'road_minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
  { id: 'road_rail', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
  { id: 'relieve-sombra', type: 'hillshade', source: 'relieve-sombra' },
  { id: 'building-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building' },
  { id: 'choque-asfalto', type: 'fill', source: 'choque-asfalto' },
  { id: 'choque-lineas', type: 'line', source: 'choque-lineas' },
  { id: 'highway-name-minor', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name' },
  { id: 'poi_r1', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi' },
  { id: 'road_one_way_arrow', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation' },
  { id: 'choque-punto', type: 'circle', source: 'choque-punto' },
];

test('se apagan las casas grises, los negocios y la sombra; lo del choque, nunca', () => {
  assert.deepEqual(capasQueSeApagan(CAPAS, true), ['relieve-sombra', 'building-3d', 'choque-asfalto', 'poi_r1', 'road_one_way_arrow']);
  // Sin foto, la franja del tramo analizado se queda.
  assert.ok(!capasQueSeApagan(CAPAS, false).includes('choque-asfalto'));
  for (const id of ['choque-lineas', 'choque-punto']) assert.ok(!capasQueSeApagan(CAPAS, true).includes(id));
});

test('los nombres de las calles se leen sobre la foto, y la carrilera no se pinta de calle', () => {
  const c = coloresDelMapa(CAPAS);
  const de = (id) => Object.fromEntries(c.filter(([i]) => i === id).map(([, p, v]) => [p, v]));
  assert.equal(de('highway-name-minor')['text-color'], '#ffffff');
  assert.ok(de('highway-name-minor')['text-halo-width'] > 1);
  assert.deepEqual(de('road_rail'), {});
  assert.ok(de('road_minor')['line-color'] && de('building')['fill-color'] && de('fondo')['background-color']);
  for (const [id] of c) assert.ok(!id.startsWith('choque-'), `cambia de color ${id}`);
});

test('la foto va encima del dibujo del mapa y debajo de los nombres', () => {
  assert.equal(encimaDelDibujo(CAPAS), 'choque-asfalto');
  const ids = CAPAS.map((c) => c.id);
  assert.ok(ids.indexOf(encimaDelDibujo(CAPAS)) < ids.indexOf('highway-name-minor'));
  assert.equal(encimaDelDibujo([]), undefined);
});

// --- Lo que se le dice a la persona

test('siempre dice qué es ilustración, y la app no decide la culpa', () => {
  for (const tipo of ['ejemplo', 'bogota', 'mapa', 'sin-foto']) {
    const t = textosDeLaVista(tipo);
    assert.match(t.sello, /ilustración con IA/);
    assert.match(t.corto, /no muestran cómo es el lugar/);
    assert.match(t.nota, /no muestran cómo es el lugar/);
    assert.match(t.nota, /La app no decide quién tuvo la culpa/);
    assert.ok(t.sello.length <= 50, 'el sello cabe en un renglón del teléfono');
    assert.ok(!/undefined|exact[oa]s? del lugar|real(es)? del lugar/.test(t.corto + t.nota));
  }
});

test('solo el ejemplo lleva IA en el piso y árboles; un reporte, no', () => {
  assert.match(textosDeLaVista('ejemplo').nota, /aclarada con IA/);
  assert.match(textosDeLaVista('ejemplo').sello, /árboles/);
  for (const tipo of ['bogota', 'mapa', 'sin-foto']) {
    const t = textosDeLaVista(tipo);
    assert.ok(!/aclarada con IA/.test(t.nota + t.corto));
    assert.ok(!/árboles/.test(t.sello));
    assert.match(t.nota, /No lleva árboles/);
  }
  assert.match(textosDeLaVista('bogota').nota, /2017/);
  assert.match(textosDeLaVista('bogota').nota, /no es del día del choque/);
  assert.match(textosDeLaVista('sin-foto').corto, /no llegó/);
  assert.match(textosDeLaVista('mapa').corto, /no hay foto aérea abierta/);
  // Los techos son genéricos donde no hay foto, y se dice.
  for (const tipo of ['mapa', 'sin-foto']) assert.match(textosDeLaVista(tipo).sello, /techos/);
});

test('en un reporte no hay árboles inventados', () => {
  // El único escenario con árboles es el del ejemplo, que trae los suyos.
  const s = leer('js/vista-realista.js');
  assert.equal((s.match(/arboles: datos\.arboles/g) ?? []).length, 1);
  assert.equal((s.match(/arboles: \[\]/g) ?? []).length, 2);
});

// --- La página y sus archivos

const PAGINA = leer('zona-3d.html');

test('la página tiene todo lo que la vista busca', () => {
  for (const id of ['vista-realista', 'sello-realista', 'vista-realista-aviso', 'zona-nota', 'video-ejemplo', 'ir-al-video']) assert.ok(PAGINA.includes(`id="${id}"`), id);
  // Nacen escondidos: los prende el código cuando toca.
  for (const id of ['vista-realista', 'sello-realista', 'vista-realista-aviso', 'video-ejemplo', 'ir-al-video']) assert.match(PAGINA, new RegExp(`<[^>]*id="${id}"[^>]*hidden[^>]*>`));
});

test('el video del ejemplo dice qué es, no suena y no se baja solo', () => {
  const v = /<video[^>]*>/.exec(PAGINA)[0];
  for (const a of ['controls', 'muted', 'playsinline', 'preload="none"']) assert.ok(v.includes(a), a);
  assert.ok(!v.includes('autoplay'));
  const trozo = PAGINA.slice(PAGINA.indexOf('id="video-ejemplo"'), PAGINA.indexOf('</section>', PAGINA.indexOf('id="video-ejemplo"')));
  assert.match(trozo, /inteligencia artificial/);
  assert.match(trozo, /El choque, los carros, la calle, los daños y la velocidad son inventados/);
  assert.match(trozo, /Choque Claro no hace videos con IA/);
  for (const r of [/src="([^"]+\.mp4)"/, /poster="([^"]+)"/]) assert.ok(fs.existsSync(new URL(r.exec(v)[1], RAIZ)), r);
});

test('el video solo sale en el choque inventado del ejemplo', () => {
  const s = leer('js/pantalla-zona-3d.js');
  assert.match(s, /const hayVideo = ejemplo && esElLugarDelEjemplo\(centro\) && !croquis;/);
  assert.match(s, /\['#ir-al-video', '#video-ejemplo'\]\) \$\(id\)\?\.toggleAttribute\('hidden', !hayVideo\)/);
});

test('el archivo del video: empieza a verse sin bajarlo entero y no tiene audio', () => {
  const b = fs.readFileSync(new URL('video/choque-ejemplo.mp4', RAIZ));
  assert.ok(b.length < 6e6, `${b.length} bytes`);
  const moov = b.indexOf('moov');
  const mdat = b.indexOf('mdat');
  assert.ok(moov > 0 && moov < mdat, 'el índice va al final: Safari lo bajaría entero');
  assert.equal(b.subarray(moov, mdat).indexOf('soun'), -1, 'tiene una pista de audio');
  assert.ok(b.subarray(moov, mdat).includes('avc1'), 'no es H.264');
});

test('las imágenes existen y en un teléfono bajan menos de 3 MB', () => {
  const peso = (r) => fs.statSync(new URL('img/realista/' + r, RAIZ)).size;
  const comunes = ['ladrillo', 'estuco', 'apto', 'culata', 'cielo', 'arboles'].reduce((s, n) => s + peso(n + '.webp'), 0);
  const enTelefono = comunes + peso('ejemplo/suelo-100-m.webp') + peso('ejemplo/suelo-400-m.webp') + peso('ejemplo/suelo-2000.webp');
  assert.ok(enTelefono < 3e6, `${Math.round(enTelefono / 1024)} KB`);
  assert.ok(comunes + ['suelo-100', 'suelo-400', 'suelo-2000'].reduce((s, n) => s + peso(`ejemplo/${n}.webp`), 0) < 5e6);
  assert.ok(peso('tejas.webp') > 0);
});

test('nada de esto entra al expediente, al sello ni a lo que se envía', () => {
  for (const f of ['expediente.js', 'expediente-pdf.js', 'evidencia.js', 'enviar.js', 'pantalla-enviar.js', 'sello.js', 'pdf.js', 'reporte-bd.js', 'reportes.js', 'reporte-en-curso.js']) {
    assert.ok(!/vista-realista|img\/realista|choque-ejemplo|foto-aerea|maqueta-ciudad/.test(leer('js/' + f)), f);
  }
});
