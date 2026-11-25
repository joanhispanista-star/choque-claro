// Que Choque Claro abra sin señal: la lista de sw.js al día (si no, la gente se queda con la app de
// ayer), sin nada que no sea de la página, y el service worker corriendo de verdad (en `vm`, con
// cachés y red de mentira): que no guarde un archivo que no cuadra, que no mezcle versiones, que no
// toque los cachés de otros proyectos del mismo dominio y que sin red no deje a nadie atrapado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { RAIZ, archivosDeLaPagina, armarLista, grafoDeModulos, listaEscrita, pesoDe } from '../herramientas/sellar-sw.mjs';
import { crearSinSenal } from '../js/sin-senal.js';

// --- La lista --------------------------------------------------------------------------------

test('la lista de sw.js es la de los archivos de hoy (si falla: npm run sellar)', () => {
  assert.deepEqual(listaEscrita(), armarLista());
});

test('en la lista solo va la página: ni documentos, ni herramientas, ni pruebas, ni el video', () => {
  const { nucleo, despues } = armarLista();
  const todos = [...Object.keys(nucleo), ...Object.keys(despues)];
  assert.ok(todos.length > 100);
  for (const ruta of todos) {
    assert.match(ruta, /^(index\.html|zona-3d\.html|manifest\.webmanifest|(css|js|img|datos)\/.+)$/);
    assert.doesNotMatch(ruta, /\.md$|\.mp4$|^sw\.js$|_fuentes/);
  }
});

test('el núcleo trae los 8 pasos y no pesa más de 3 MB; el lector de placas va aparte', () => {
  const { nucleo } = armarLista();
  const rutas = Object.keys(nucleo);
  for (const ruta of ['index.html', 'css/app.css', 'manifest.webmanifest', 'img/icono-180.png', 'js/app.js', 'js/pantalla-enviar.js', 'js/expediente-pdf.js', 'js/pantalla-danos.js', 'js/vendor/leaflet/leaflet.js', 'js/vendor/three/three.module.min.js']) assert.ok(rutas.includes(ruta), ruta);
  assert.ok(!rutas.some((r) => r.startsWith('js/vendor/placa/')));
  assert.ok(pesoDe(rutas) < 3e6, `${pesoDe(rutas)} bytes`);
});

test('todo módulo que se importa desde app.js existe y queda en el núcleo', () => {
  const { nucleo } = armarLista();
  const todos = new Set(archivosDeLaPagina());
  for (const ruta of grafoDeModulos('js/app.js')) {
    assert.ok(todos.has(ruta), ruta);
    assert.ok(ruta in nucleo, ruta);
  }
});

test('el manifiesto y la página nombran los mismos íconos, y están', () => {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  // Con rutas relativas: la página vive en /choque-claro/, no en la raíz del dominio.
  for (const campo of ['id', 'start_url', 'scope']) assert.doesNotMatch(m[campo], /^\//, campo);
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(RAIZ, i.src)), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  for (const trozo of ['rel="manifest"', 'rel="apple-touch-icon"', 'apple-mobile-web-app-title']) assert.ok(html.includes(trozo), trozo);
});

// --- El service worker -----------------------------------------------------------------------

const sha = (texto) => createHash('sha256').update(texto).digest('hex');
const BASE = 'https://prueba.test/choque-claro/';
const DE_SW = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').replaceAll('\r\n', '\n');

// `lista`: { nucleo: { ruta: contenido }, despues: {…} }. `red(url)`: lo que responde internet.
function servicio({ nucleo = {}, despues = {}, red, almacenes = new Map() }) {
  const conSha = (o) => Object.fromEntries(Object.entries(o).map(([r, t]) => [r, sha(t)]));
  const lista = { version: 'v', nucleo: conSha(nucleo), despues: conSha(despues) };
  const codigo = DE_SW.replace(/\nconst LISTA = [^\n]*;\n/, `\nconst LISTA = ${JSON.stringify(lista)};\n`);
  const oyentes = {};
  const llamadas = [];
  const caches = {
    async open(nombre) {
      if (!almacenes.has(nombre)) almacenes.set(nombre, new Map());
      const datos = almacenes.get(nombre);
      return {
        match: async (url) => datos.get(url)?.clone(),
        put: async (url, respuesta) => void datos.set(url, respuesta),
        keys: async () => [...datos.keys()].map((url) => ({ url })),
        delete: async (peticion) => datos.delete(peticion.url ?? peticion),
      };
    },
    keys: async () => [...almacenes.keys()],
    delete: async (nombre) => almacenes.delete(nombre),
  };
  const self = { registration: { scope: BASE }, skipWaiting: () => llamadas.push('skipWaiting'), addEventListener: (tipo, f) => (oyentes[tipo] = f) };
  const contexto = vm.createContext({
    self,
    caches,
    crypto: webcrypto,
    URL,
    Response,
    Uint8Array,
    console,
    fetch: async (peticion, opciones) => {
      const url = typeof peticion === 'string' ? peticion : peticion.url;
      llamadas.push(opciones?.cache ? `${opciones.cache} ${url.replace(BASE, '')}` : `fetch ${url.replace(BASE, '')}`);
      return red(url.replace(BASE, ''), opciones);
    },
  });
  vm.runInContext(codigo, contexto);
  const esperar = async (tipo) => {
    let promesa;
    oyentes[tipo]({ waitUntil: (p) => (promesa = p) });
    return promesa;
  };
  return {
    almacenes,
    llamadas,
    instalar: () => esperar('install'),
    activar: () => esperar('activate'),
    mensaje: (data) => oyentes.message({ data, ports: [{ postMessage: (m) => llamadas.push(m) }] }),
    // Devuelve la respuesta, o null si el service worker no se metió.
    async pedir(ruta, { mode = 'no-cors', method = 'GET', range = null } = {}) {
      let respuesta = null;
      const colgado = [];
      const url = new URL(ruta, BASE).href;
      oyentes.fetch({ request: { url, mode, method, headers: new Headers(range ? { range } : {}) }, respondWith: (p) => (respuesta = p), waitUntil: (p) => colgado.push(p) });
      const r = await respuesta;
      await Promise.all(colgado);
      return r;
    },
  };
}

const ARCHIVOS = { 'index.html': '<h1>Choque Claro</h1>', 'js/app.js': 'app()' };
const redDe = (archivos) => async (ruta) => (ruta in archivos ? new Response(archivos[ruta], { headers: { 'Content-Type': 'text/plain' } }) : new Response('no', { status: 404 }));
const sinRed = async () => {
  throw new TypeError('Failed to fetch');
};

test('instala el núcleo y después sirve todo sin red, también con «./» y con lo que va tras el «?»', async () => {
  let red = redDe(ARCHIVOS);
  const sw = servicio({ nucleo: ARCHIVOS, red: (...a) => red(...a) });
  await sw.instalar();
  await sw.activar();
  red = sinRed;
  assert.equal(await (await sw.pedir('./', { mode: 'navigate' })).text(), ARCHIVOS['index.html']);
  assert.equal(await (await sw.pedir('index.html?sw=1#enviar', { mode: 'navigate' })).text(), ARCHIVOS['index.html']);
  assert.equal(await (await sw.pedir('js/app.js')).text(), 'app()');
});

test('si un archivo no cuadra con la lista, no se instala (GitHub reparte lo nuevo a pedazos)', async () => {
  const red = redDe({ ...ARCHIVOS, 'js/app.js': 'app de ayer' });
  const sw = servicio({ nucleo: ARCHIVOS, red });
  await assert.rejects(sw.instalar(), /No cuadra con la lista: js\/app\.js/);
  // Lo intentó dos veces: como el navegador lo tuviera y saltándose la caché.
  assert.deepEqual(sw.llamadas.filter((l) => l.endsWith('js/app.js')), ['default js/app.js', 'reload js/app.js']);
});

test('lo viejo en la caché del navegador se vuelve a pedir y entra si ahora sí cuadra', async () => {
  const red = async (ruta, opciones) => new Response(ruta === 'js/app.js' && opciones.cache === 'default' ? 'app de ayer' : ARCHIVOS[ruta]);
  const sw = servicio({ nucleo: ARCHIVOS, red });
  await sw.instalar();
  assert.equal(await (await sw.pedir('js/app.js')).text(), 'app()');
});

test('dos versiones no se mezclan: la vieja sigue entera hasta que manda la nueva, y solo baja lo que cambió', async () => {
  const almacenes = new Map();
  const vieja = servicio({ nucleo: ARCHIVOS, red: redDe(ARCHIVOS), almacenes });
  await vieja.instalar();
  const nuevos = { ...ARCHIVOS, 'js/app.js': 'app nueva()' };
  const nueva = servicio({ nucleo: nuevos, red: redDe(nuevos), almacenes });
  await nueva.instalar();
  assert.deepEqual(nueva.llamadas, ['default js/app.js'], 'index.html no cambió: no se baja otra vez');
  assert.equal(await (await vieja.pedir('js/app.js')).text(), 'app()', 'la de antes sigue con lo suyo');
  await nueva.activar();
  assert.equal(await (await nueva.pedir('js/app.js')).text(), 'app nueva()');
  assert.equal([...almacenes.get('choque-claro-archivos').keys()].length, 2, 'lo viejo se borró');
});

test('no toca los cachés de otros proyectos del mismo dominio', async () => {
  const almacenes = new Map([['tugarantia-v169', new Map([['x', new Response('y')]])], ['choque-claro-viejo', new Map()]]);
  const sw = servicio({ nucleo: ARCHIVOS, red: redDe(ARCHIVOS), almacenes });
  await sw.instalar();
  await sw.activar();
  assert.deepEqual([...almacenes.keys()].sort(), ['choque-claro-archivos', 'tugarantia-v169']);
});

test('lo pesado se guarda la primera vez que se usa, si cuadra', async () => {
  const despues = { 'js/vendor/placa/modelo.onnx': 'MODELO', 'img/foto.jpg': 'FOTO' };
  let red = redDe({ ...despues, 'img/foto.jpg': 'FOTO CAMBIADA' });
  const sw = servicio({ nucleo: ARCHIVOS, despues, red: (...a) => red(...a) });
  assert.equal(await (await sw.pedir('js/vendor/placa/modelo.onnx')).text(), 'MODELO');
  assert.equal(await (await sw.pedir('img/foto.jpg')).text(), 'FOTO CAMBIADA', 'la página recibe lo que mandó la red');
  red = sinRed;
  assert.equal(await (await sw.pedir('js/vendor/placa/modelo.onnx')).text(), 'MODELO');
  await assert.rejects(sw.pedir('img/foto.jpg'), /Failed to fetch/);
});

test('no se mete con otros dominios, ni con el video, ni con lo que no está en la lista', async () => {
  const sw = servicio({ nucleo: ARCHIVOS, red: redDe(ARCHIVOS) });
  assert.equal(await sw.pedir('https://tile.openstreetmap.org/17/1/1.png'), null);
  assert.equal(await sw.pedir('https://prueba.test/tugarantia/index.html', { mode: 'navigate' }), null);
  assert.equal(await sw.pedir('video/choque.mp4'), null);
  assert.equal(await sw.pedir('js/app.js', { range: 'bytes=0-' }), null);
  assert.equal(await sw.pedir('js/app.js', { method: 'POST' }), null);
});

test('una página sin guardar y sin red no deja atrapada a la persona: dice qué pasa y cómo volver', async () => {
  const sw = servicio({ nucleo: ARCHIVOS, despues: { 'zona-3d.html': 'zona' }, red: sinRed });
  const r = await sw.pedir('zona-3d.html?lat=4', { mode: 'navigate' });
  assert.equal(r.status, 503);
  const html = await r.text();
  assert.match(html, /Esta parte necesita internet/);
  assert.match(html, /href="\/choque-claro\/"/);
});

test('la versión nueva no entra sola: espera a que la página la pida', async () => {
  const sw = servicio({ nucleo: ARCHIVOS, red: redDe(ARCHIVOS) });
  await sw.instalar();
  await sw.activar();
  assert.ok(!sw.llamadas.includes('skipWaiting'));
  sw.mensaje('version');
  sw.mensaje('actualizar');
  assert.deepEqual(sw.llamadas.slice(-2), ['v', 'skipWaiting']);
});

// --- La página ---------------------------------------------------------------------------------

function ventanaDePrueba({ hostname = 'ejemplo.github.io', search = '', registro = null, falla = false, seguro = true } = {}) {
  const oyentes = { sw: {}, ventana: {}, documento: {} };
  const recargas = [];
  const registrados = [];
  const borrados = [];
  const sw = {
    controller: null,
    addEventListener: (tipo, f) => (oyentes.sw[tipo] = f),
    register: async (url, opciones) => {
      registrados.push([url, opciones]);
      if (falla) throw new Error('no');
      return registro;
    },
    getRegistrations: async () => [{ unregister: async () => borrados.push(1) }],
  };
  return {
    ventana: {
      navigator: { serviceWorker: sw },
      isSecureContext: seguro,
      location: { hostname, search, reload: () => recargas.push(1) },
      document: { readyState: 'complete', visibilityState: 'visible', addEventListener: (tipo, f) => (oyentes.documento[tipo] = f) },
      addEventListener: (tipo, f) => (oyentes.ventana[tipo] = f),
    },
    sw,
    oyentes,
    recargas,
    registrados,
    borrados,
  };
}
const registroDePrueba = (partes = {}) => ({ active: null, waiting: null, installing: null, addEventListener() {}, update: async () => {}, ...partes });
const unRato = () => new Promise((r) => setTimeout(r, 5));

test('en este PC no se pone (y se quita si quedó uno); publicada, sí', async () => {
  const local = ventanaDePrueba({ hostname: 'localhost' });
  const enLocal = crearSinSenal({ ventana: local.ventana, url: 'sw.js' });
  enLocal.arrancar();
  await unRato();
  assert.equal(enLocal.estado(), 'apagado');
  assert.equal(local.registrados.length, 0);
  assert.equal(local.borrados.length, 1);

  const publica = ventanaDePrueba({ registro: registroDePrueba({ active: {} }) });
  const enPublica = crearSinSenal({ ventana: publica.ventana, url: 'sw.js' });
  enPublica.arrancar();
  await unRato();
  assert.equal(enPublica.estado(), 'lista');
  assert.deepEqual(publica.registrados, [['sw.js', { updateViaCache: 'none' }]]);

  const aProposito = ventanaDePrueba({ hostname: 'localhost', search: '?sw=1', registro: registroDePrueba() });
  const deProposito = crearSinSenal({ ventana: aProposito.ventana, url: 'sw.js' });
  deProposito.arrancar();
  await unRato();
  assert.equal(deProposito.estado(), 'guardando');
});

test('lo que se le dice: guardando, lista, fallo y sin soporte', async () => {
  let cambio;
  const trabajador = { state: 'installing', addEventListener: (_, f) => (cambio = f) };
  const registro = registroDePrueba({ installing: trabajador });
  const v = ventanaDePrueba({ registro });
  const s = crearSinSenal({ ventana: v.ventana, url: 'sw.js' });
  const vistos = [];
  s.alCambiar(() => vistos.push(s.estado()));
  s.arrancar();
  await unRato();
  assert.equal(s.estado(), 'guardando');
  trabajador.state = 'activated';
  cambio();
  assert.equal(s.estado(), 'lista');
  assert.deepEqual(vistos, ['lista']);

  const malo = ventanaDePrueba({ falla: true });
  const m = crearSinSenal({ ventana: malo.ventana, url: 'sw.js' });
  m.arrancar();
  await unRato();
  assert.equal(m.estado(), 'fallo');

  const viejo = ventanaDePrueba({ seguro: false });
  const o = crearSinSenal({ ventana: viejo.ventana, url: 'sw.js' });
  o.arrancar();
  await unRato();
  assert.equal(o.estado(), 'sin-soporte');
});

test('la versión nueva: se ofrece, se recarga solo si la persona la pidió, y en otra pestaña al volver al inicio', async () => {
  const enviados = [];
  const registro = registroDePrueba({ active: {}, waiting: { postMessage: (m) => enviados.push(m) } });
  const v = ventanaDePrueba({ registro });
  v.sw.controller = {};
  const s = crearSinSenal({ ventana: v.ventana, url: 'sw.js' });
  s.arrancar();
  await unRato();
  assert.equal(s.hayNueva(), true);
  // La pidió otra pestaña: aquí no se recarga a mitad de nada.
  v.oyentes.sw.controllerchange();
  assert.equal(v.recargas.length, 0);
  s.alVolverAlInicio();
  assert.equal(v.recargas.length, 1);
  s.actualizar();
  assert.deepEqual(enviados, ['actualizar']);
  v.oyentes.sw.controllerchange();
  assert.equal(v.recargas.length, 2);
});

test('la primera instalación no recarga nada', async () => {
  const v = ventanaDePrueba({ registro: registroDePrueba({ installing: { addEventListener() {} } }) });
  const s = crearSinSenal({ ventana: v.ventana, url: 'sw.js' });
  s.arrancar();
  await unRato();
  v.oyentes.sw.controllerchange();
  s.alVolverAlInicio();
  assert.equal(v.recargas.length, 0);
});
