// La zona en el 3D fotorrealista de Google (Map3DElement, librería maps3d de Maps JavaScript), con
// lo que se sabe del choque encima. La lógica pura está en zona-google.js; esto lo usa
// pantalla-zona-3d.js cuando hay clave (clave-de-google.js).
//
// Si algo falla, se avisa con alFallar y la página vuelve a la maqueta abierta. Puede fallar también
// DESPUÉS de dibujarse: Google dice que no acepta la clave cuando el mapa ya está puesto (ver
// motivoDeGoogle). Al fallar, el mapa de Google se quita entero antes de que salga el otro: Google
// no deja su 3D junto a un mapa que no sea suyo.
import { acercarALosCarros, alturaTerrarium, camaraDeGoogle, camaraDesdeArriba, elementosDeGoogle, motivoDeGoogle, orientacionDelCarro, pixelDelSuelo, svgDeLetrero, svgDePin } from './zona-google.js';

// El canal de Maps JavaScript que trae el 3D: el de la guía de Google («v=beta&libraries=maps3d»).
const CANAL = 'beta';
const RELIEVE = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
// Lo que se espera a Google antes de rendirse. Más, y la persona mira una caja vacía demasiado tiempo.
const ESPERA_MS = 20000;

export const MOTIVOS = {
  'sin-conexion': 'El 3D de Google no cargó: no hubo conexión con Google.',
  clave: 'Google no aceptó la clave del 3D.',
  mapa: 'El 3D de Google no pudo arrancar en este teléfono.',
  relieve: 'No llegó la altura del suelo: sin ella, la cámara del 3D de Google apuntaría bajo tierra.',
};

// La altura del suelo en metros sobre el nivel del mar, leída del píxel del mosaico terrarium.
export async function alturaDelSuelo({ lat, lon }) {
  const p = pixelDelSuelo(lat, lon);
  const respuesta = await fetch(RELIEVE.replace('{z}', p.z).replace('{x}', p.x).replace('{y}', p.y));
  if (!respuesta.ok) throw new Error('relieve ' + respuesta.status);
  // Sin corrección de color: aquí el color ES la altura, y corregirlo la cambiaría.
  const imagen = await createImageBitmap(await respuesta.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const lienzo = document.createElement('canvas');
  lienzo.width = imagen.width;
  lienzo.height = imagen.height;
  const contexto = lienzo.getContext('2d', { willReadFrequently: true });
  contexto.drawImage(imagen, 0, 0);
  const [r, g, b] = contexto.getImageData(p.px, p.py, 1, 1).data;
  imagen.close?.();
  return alturaTerrarium(r, g, b);
}

let guion = null;
function cargarGoogle(clave) {
  guion ??= new Promise((resolver, fallar) => {
    const listo = '__choqueClaroGoogle';
    globalThis[listo] = () => resolver();
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key: clave, v: CANAL, libraries: 'maps3d', language: 'es', region: 'CO', loading: 'async', callback: listo });
    s.async = true;
    s.onerror = () => fallar(new Error('sin-conexion'));
    document.head.append(s);
    setTimeout(() => fallar(new Error('sin-conexion')), ESPERA_MS);
  });
  return guion;
}

// El .glb del carro va como data: y no como blob:. Por blob: el Map3DElement no dibujó el carro, y
// el mismo .glb por data: o por http sí (medido el 14-nov-2026 con la clave de Joan): seguramente lo
// baja otro contexto, que no ve los blob de la página. Son unos 800 KB de texto por carro.
const comoDataUrl = (glb) =>
  new Promise((resolver, fallar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => fallar(lector.error);
    lector.readAsDataURL(new Blob([glb], { type: 'model/gltf-binary' }));
  });

// Un <template> con un SVG: así pide Google lo que va dentro de un marcador propio.
function plantilla(svg) {
  const t = document.createElement('template');
  t.innerHTML = svg;
  return t;
}

// Monta el 3D de Google en `caja`. Devuelve el motor (los mismos botones que la maqueta abierta) o
// null si no se pudo; en los dos casos de falla, alFallar ya recibió el motivo en palabras.
// `camaraDeLaMaqueta`: la de camaraDeLaZona o camaraDelCroquis. `lineas`: la línea de cada carro
// del paso 5, por letra, para dibujarlo con su carrocería.
export async function montarZonaGoogle(caja, { clave, centro, camaraDeLaMaqueta, capas, carros, lineas = {}, alFallar }) {
  let caido = false;
  let mapa = null;
  const glbs = new Map();
  // `motivo`: una clave de MOTIVOS o ya la frase.
  const fallar = (motivo) => {
    if (caido) return;
    caido = true;
    mapa?.remove();
    glbs.clear();
    alFallar(MOTIVOS[motivo] || motivo || MOTIVOS.mapa);
  };
  // Google llama a gm_authFailure cuando no acepta la clave de un mapa 2D. Con el 3D no la llama: solo
  // escribe el error en la consola (medido el 13-nov-2026, ver motivoDeGoogle). Se escuchan las dos.
  globalThis.gm_authFailure = () => fallar('clave');
  const errorDeConsola = console.error;
  console.error = function (...partes) {
    const texto = String(partes[0] ?? '');
    if (texto.startsWith('Google Maps JavaScript API error')) fallar(motivoDeGoogle(texto));
    return errorDeConsola.apply(this, partes);
  };

  const suelo = alturaDelSuelo(centro).catch(() => null);
  try {
    await cargarGoogle(clave);
  } catch {
    fallar('sin-conexion');
    return null;
  }
  const altura = await suelo;
  if (altura === null) {
    fallar('relieve');
    return null;
  }
  let biblioteca;
  try {
    biblioteca = await google.maps.importLibrary('maps3d');
  } catch {
    fallar('mapa');
    return null;
  }
  if (caido) return null;
  const { Map3DElement, Marker3DElement, Model3DElement, Polygon3DElement, Polyline3DElement, MapMode } = biblioteca;

  const altoPx = () => caja.clientHeight || 400;
  const anchoPx = () => caja.clientWidth || 360;
  const camaraPara = (deLaMaqueta, losCarros) => acercarALosCarros(camaraDeGoogle(deLaMaqueta, { altoPx: altoPx(), suelo: altura }), losCarros, { anchoPx: anchoPx(), altoPx: altoPx() });
  let camara = camaraPara(camaraDeLaMaqueta, carros);
  try {
    // Satélite, sin los nombres de las calles encima: la vía la dicen el tramo y la leyenda.
    mapa = new Map3DElement({ ...camara, mode: MapMode?.SATELLITE ?? 'SATELLITE' });
  } catch {
    fallar('mapa');
    return null;
  }
  mapa.className = 'mapa-google';
  mapa.addEventListener('gmp-error', () => fallar('mapa'));
  // `append` y no `replaceChildren`: en la caja viven también el sello de la recreación y su botón
  // (escondidos mientras está Google). Si Google se cae ya dibujado, la maqueta de respaldo los
  // necesita; con replaceChildren se iban con él y la recreación reventaba (revisión del 14-nov).
  caja.append(mapa);

  // El .glb de cada carro se arma una vez (carro-glb.js trae Three.js solo si hay carros).
  const urlDelCarro = (e) => {
    const linea = lineas[e.letra] || null;
    const carroceria = linea?.carroceria || 'sedan';
    const medidas = linea?.medidas || { largo: e.largo, ancho: e.ancho };
    const llave = [e.color, carroceria, medidas.largo, medidas.ancho].join('|');
    if (!glbs.has(llave)) {
      glbs.set(
        llave,
        import('./carro-glb.js')
          .then(({ glbDelCarro }) => glbDelCarro({ color: e.color, carroceria, medidas }))
          .then(comoDataUrl),
      );
    }
    return glbs.get(llave);
  };

  function crear(e) {
    // Todo a unos centímetros del suelo y visible aunque lo tape la malla de la foto (un árbol, un
    // alero): un pedazo de flecha que desaparece cambia lo que se lee.
    const comun = { altitudeMode: 'RELATIVE_TO_GROUND', drawsOccludedSegments: true };
    if (e.tipo === 'poligono') return new Polygon3DElement({ ...comun, path: e.path, fillColor: e.fillColor, strokeColor: e.strokeColor, strokeWidth: e.strokeWidth });
    if (e.tipo === 'linea') {
      const borde = e.outerColor ? { outerColor: e.outerColor, outerWidth: e.outerWidth } : {};
      return new Polyline3DElement({ ...comun, ...borde, path: e.path, strokeColor: e.strokeColor, strokeWidth: e.strokeWidth });
    }
    // Los marcadores y letreros, del mismo tamaño a cualquier distancia y visibles aunque los tape un
    // árbol de la foto. Los que van colgados (el pin, el golpe, la letra de cada carro) bajan con una
    // raya hasta el suelo: así se ve sobre qué punto de la vía están.
    if (e.tipo === 'marcador') {
      const m = new Marker3DElement({ position: e.position, altitudeMode: 'RELATIVE_TO_GROUND', extruded: true, sizePreserved: true, drawsWhenOccluded: true });
      m.append(plantilla(svgDePin(e.texto, e.color, e.clave === 'golpe' ? 'golpe' : 'pin')));
      return m;
    }
    if (e.tipo === 'letrero') {
      const m = new Marker3DElement({ position: e.position, altitudeMode: 'RELATIVE_TO_GROUND', extruded: Boolean(e.colgado), sizePreserved: true, drawsWhenOccluded: true });
      m.append(plantilla(svgDeLetrero(e.texto, e.color)));
      return m;
    }
    if (e.tipo === 'carro') {
      const m = new Model3DElement({ position: e.position, orientation: orientacionDelCarro(e.rumbo), scale: 1, altitudeMode: 'CLAMP_TO_GROUND' });
      // Si el carro 3D no se arma, quedan su letrero y su flecha: el croquis se sigue leyendo.
      urlDelCarro(e).then((url) => (m.src = url), (error) => console.warn('Carro 3D:', error?.message));
      return m;
    }
    return null;
  }
  const puestos = [];
  function poner(lista) {
    for (const el of puestos.splice(0)) el.remove();
    for (const e of lista) {
      const el = crear(e);
      if (!el) continue;
      mapa.append(el);
      puestos.push(el);
    }
  }
  poner(elementosDeGoogle(capas, carros));

  // Si la persona ya movió el mapa, el análisis no le cambia la vista.
  let tocado = false;
  let girando = false;
  let quieto = false;
  const boton = document.querySelector('#dar-vuelta');
  const soltarBoton = () => {
    girando = false;
    boton?.setAttribute('aria-pressed', 'false');
  };
  const detenerGiro = () => {
    if (girando) mapa.stopCameraAnimation();
    soltarBoton();
  };
  for (const evento of ['pointerdown', 'wheel', 'touchstart']) {
    mapa.addEventListener(evento, () => {
      tocado = true;
      detenerGiro();
    }, { passive: true });
  }
  mapa.addEventListener('gmp-animationend', () => girando && soltarBoton());
  mapa.addEventListener('gmp-steadychange', (evento) => {
    if (evento.isSteady) quieto = true;
  });

  return {
    nombre: 'google',
    mapa,
    get quieto() {
      return quieto;
    },
    // Google puede fallar justo antes de que la página tome este motor: entonces ya está la maqueta.
    get caido() {
      return caido;
    },
    get camara() {
      return camara;
    },
    // Llega el análisis de la vía: el tramo, las señales, la cámara a lo largo de la vía y, en el
    // ejemplo, los carros inventados (salen del tramo).
    actualizar({ camaraDeLaMaqueta: nueva, capas: otras, carros: otros }) {
      if (caido) return;
      camara = camaraPara(nueva, otros);
      poner(elementosDeGoogle(otras, otros));
      if (!tocado) mapa.flyCameraTo({ endCamera: camara, durationMillis: 1500 });
    },
    vista3d() {
      detenerGiro();
      mapa.flyCameraTo({ endCamera: camara, durationMillis: 1200 });
    },
    desdeArriba() {
      detenerGiro();
      mapa.flyCameraTo({ endCamera: camaraDesdeArriba(camara), durationMillis: 1200 });
    },
    darLaVuelta() {
      if (girando) return detenerGiro();
      girando = true;
      boton?.setAttribute('aria-pressed', 'true');
      mapa.flyCameraAround({ camera: { center: camara.center, range: mapa.range ?? camara.range, tilt: mapa.tilt ?? camara.tilt, heading: mapa.heading ?? camara.heading }, durationMillis: 16000, repeatCount: 1 });
    },
  };
}
