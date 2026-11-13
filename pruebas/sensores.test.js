// Los sensores con navegadores de mentira: la brújula de un iPhone y la de un
// Android, el GPS continuo y la cámara. Lo que no se puede probar aquí (que
// Safari de verdad pida el permiso y entregue webkitCompassHeading) se prueba
// en el iPhone de Joan: ver LEEME.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ESPERA_DE_LA_BRUJULA_MS, anguloDeLaPantalla, escucharBrujula, pedirPermisoBrujula } from '../js/brujula.js';
import { vigilarUbicacion } from '../js/ubicacion.js';
import { MENSAJES_CAMARA, abrirCamara, mensajeDeLaCamara } from '../js/camara.js';

function evento(tipo, campos) {
  return Object.assign(new Event(tipo), campos);
}

function relojDePrueba() {
  let ahora = 1000;
  const reloj = () => ahora;
  reloj.pasar = (ms) => (ahora += ms);
  return reloj;
}

test('el permiso del iPhone: se pide si existe, y un error cuenta como negado', async () => {
  assert.equal(await pedirPermisoBrujula(undefined), 'no-hace-falta');
  assert.equal(await pedirPermisoBrujula(function Evento() {}), 'no-hace-falta');
  assert.equal(await pedirPermisoBrujula({ requestPermission: async () => 'granted' }), 'granted');
  assert.equal(await pedirPermisoBrujula({ requestPermission: async () => { throw new Error('sin toque'); } }), 'denied');
  assert.equal(await pedirPermisoBrujula({ requestPermission: () => { throw new Error('síncrono'); } }), 'denied');
});

test('iPhone: el rumbo llega por webkitCompassHeading y se apaga si se queda viejo', () => {
  const ventana = new EventTarget();
  const reloj = relojDePrueba();
  const brujula = escucharBrujula({ ventana, reloj, angulo: () => 0 });
  assert.equal(brujula.leer().esperando, true);
  ventana.dispatchEvent(evento('deviceorientation', { alpha: 3, beta: 90, gamma: 0, webkitCompassHeading: 120, webkitCompassAccuracy: 12 }));
  let l = brujula.leer();
  assert.equal(l.rumbo, 120);
  assert.equal(l.fuente, 'iphone');
  assert.equal(l.precisionRumbo, 12);
  assert.equal(l.esperando, false);
  assert.ok(Math.abs(l.giro) < 1e-9);
  reloj.pasar(2000);
  l = brujula.leer();
  assert.equal(l.rumbo, null, 'una lectura de hace 2 s no dice hacia dónde se apunta ahora');
  assert.equal(l.giro, null);
  brujula.detener();
  ventana.dispatchEvent(evento('deviceorientation', { beta: 90, gamma: 0, webkitCompassHeading: 10 }));
  assert.equal(brujula.leer().rumbo, null, 'ya no escucha');
});

test('Android: solo el evento absoluto da rumbo, y se suaviza', () => {
  const ventana = new EventTarget();
  const reloj = relojDePrueba();
  const brujula = escucharBrujula({ ventana, reloj, angulo: () => 0 });
  ventana.dispatchEvent(evento('deviceorientation', { alpha: 50, beta: 90, gamma: 0, absolute: false }));
  assert.equal(brujula.leer().rumbo, null);
  ventana.dispatchEvent(evento('deviceorientationabsolute', { alpha: 270, beta: 90, gamma: 0, absolute: true }));
  assert.ok(Math.abs(brujula.leer().rumbo - 90) < 1e-9);
  reloj.pasar(50);
  ventana.dispatchEvent(evento('deviceorientationabsolute', { alpha: 260, beta: 90, gamma: 0, absolute: true }));
  // Suavizado: de 90 hacia 100, un 30 %.
  assert.ok(Math.abs(brujula.leer().rumbo - 93) < 1e-9);
  assert.equal(brujula.leer().fuente, 'android');
});

test('sin brújula: pasados los segundos de espera, ya no está "buscando"', () => {
  const ventana = new EventTarget();
  const reloj = relojDePrueba();
  const brujula = escucharBrujula({ ventana, reloj, angulo: () => 0 });
  ventana.dispatchEvent(evento('deviceorientation', { alpha: null, beta: null, gamma: null }));
  assert.equal(brujula.leer().esperando, true);
  reloj.pasar(ESPERA_DE_LA_BRUJULA_MS + 1);
  assert.deepEqual(brujula.leer(), { rumbo: null, fuente: null, precisionRumbo: null, brujulaDudosa: false, elevacion: null, giro: null, esperando: false });
});

test('la brújula dudosa del iPhone se dice mientras dura', () => {
  const ventana = new EventTarget();
  const reloj = relojDePrueba();
  const brujula = escucharBrujula({ ventana, reloj, angulo: () => 0 });
  ventana.dispatchEvent(evento('deviceorientation', { beta: 90, gamma: 0, webkitCompassHeading: 33, webkitCompassAccuracy: -1 }));
  assert.equal(brujula.leer().brujulaDudosa, true);
  assert.equal(brujula.leer().rumbo, null);
});

test('el ángulo de la pantalla sale de screen.orientation o de window.orientation', () => {
  assert.equal(typeof anguloDeLaPantalla(), 'number');
});

test('el GPS continuo entrega cada lectura y dice por qué no hay', () => {
  const lecturas = [];
  let fallo = null;
  let parado = null;
  const geo = {
    watchPosition(bien, mal) {
      bien({ coords: { latitude: 4.65, longitude: -74.05, accuracy: 6 }, timestamp: Date.parse('2026-11-17T20:00:00Z') });
      mal({ code: 1 });
      return 7;
    },
    clearWatch(id) {
      parado = id;
    },
  };
  const dejar = vigilarUbicacion({ alLeer: (l) => lecturas.push(l), alFallar: (c) => (fallo = c), geo, seguro: true });
  assert.deepEqual(lecturas, [{ lat: 4.65, lon: -74.05, precision: 6, hora: new Date('2026-11-17T20:00:00Z') }]);
  assert.equal(fallo, 1);
  dejar();
  assert.equal(parado, 7);
  vigilarUbicacion({ alLeer: () => {}, alFallar: (c) => (fallo = c), geo, seguro: false });
  assert.equal(fallo, 'sinHttps');
  vigilarUbicacion({ alLeer: () => {}, alFallar: (c) => (fallo = c), geo: null, seguro: true });
  assert.equal(fallo, 'sinGeo');
});

function videoDePrueba({ falla = null } = {}) {
  return {
    srcObject: null,
    muted: false,
    playsInline: false,
    async play() {
      if (falla) throw falla;
    },
  };
}

function mediosDePrueba(respuestas) {
  const pedidos = [];
  const pistas = [];
  return {
    pedidos,
    pistas,
    async getUserMedia(pedido) {
      pedidos.push(pedido);
      const r = respuestas.shift();
      if (r instanceof Error) throw r;
      const pista = { parada: false, stop() { this.parada = true; } };
      pistas.push(pista);
      return { getTracks: () => [pista] };
    },
  };
}

const errorDe = (nombre) => Object.assign(new Error(nombre), { name: nombre });

test('la cámara: la de atrás, sin audio, en línea y muda (iPhone)', async () => {
  const medios = mediosDePrueba([null]);
  const video = videoDePrueba();
  const camara = await abrirCamara(video, { medios, seguro: true });
  assert.equal(medios.pedidos[0].audio, false);
  assert.deepEqual(medios.pedidos[0].video.facingMode, { ideal: 'environment' });
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.ok(video.srcObject);
  camara.detener();
  assert.equal(medios.pistas[0].parada, true);
  assert.equal(video.srcObject, null);
});

test('la cámara: si no tiene esa medida, pide cualquiera de atrás', async () => {
  const medios = mediosDePrueba([errorDe('OverconstrainedError'), null]);
  await abrirCamara(videoDePrueba(), { medios, seguro: true });
  assert.deepEqual(medios.pedidos[1].video, { facingMode: 'environment' });
});

test('la cámara: si el video no arranca, se apaga antes de avisar', async () => {
  const medios = mediosDePrueba([null]);
  await assert.rejects(abrirCamara(videoDePrueba({ falla: errorDe('NotAllowedError') }), { medios, seguro: true }), { name: 'NotAllowedError' });
  assert.equal(medios.pistas[0].parada, true);
});

test('la cámara: sin https, sin cámara o sin permiso, lo dice en español', async () => {
  await assert.rejects(abrirCamara(videoDePrueba(), { medios: mediosDePrueba([]), seguro: false }), (e) => e.message === MENSAJES_CAMARA.sinHttps);
  await assert.rejects(abrirCamara(videoDePrueba(), { medios: undefined, seguro: true }), (e) => e.name === 'sinCamara');
  assert.match(mensajeDeLaCamara(errorDe('NotAllowedError')), /«aA»/);
  assert.match(mensajeDeLaCamara(errorDe('NotReadableError')), /Otra app/);
  assert.match(mensajeDeLaCamara(errorDe('RaroError')), /RaroError/);
});
