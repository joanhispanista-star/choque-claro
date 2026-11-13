// La zona del choque en el 3D fotorrealista de Google: la opción A, que Joan eligió el vie
// 13-nov-2026 después de ver la hoja con Google Earth en Los Verjones y en Chapinero. Este módulo es
// puro, como zona-3d.js: convierte la cámara y las capas de la maqueta en lo que pide el
// Map3DElement de Google (Maps JavaScript, librería maps3d). La página es pantalla-zona-google.js.
//
// Lo que NO cambia respecto a la maqueta abierta: lo que se dibuja sale de capasDeLaZona (el punto,
// la precisión, el tramo, las señales, el sol, los conos de las fotos y el croquis) y la leyenda es
// la misma. Lo que cambia:
//  - Las fotos de Google son de OTRA fecha (pueden tener años). La pantalla lo dice siempre.
//  - Google no deja poner su 3D junto a un mapa que no sea suyo (términos de Google Maps Platform,
//    «No Use With Non-Google Maps»): con el 3D de Google, el mapa abierto se apaga entero. Lo que va
//    encima son datos (el croquis, el tramo, las señales), no otro mapa.
//  - El 3D de Google no tiene la luz de la hora del choque: sus fotos traen su propia sombra. El sol
//    se queda como la raya hacia donde estaba.
//  - Los carros del croquis dejan de ser cajas: son el carro 3D del paso 6 (carro-glb.js), a su
//    tamaño y pintado con el color de su letra, para que nadie lo confunda con un carro de la foto.
import { COLORES } from './zona-3d.js';
import { puntaDeFlecha } from './croquis.js';

const GRADO = Math.PI / 180;

// ------------------------------------------------------------------------------ la cámara

// El campo de visión vertical que trae el Map3DElement (referencia de Maps JavaScript, `fov`: 35°).
export const CAMPO_DE_VISION = 35;

// Metros por píxel en MapLibre (teselas de 512), la medida de las cámaras de zona-3d.js. No es la de
// croquis.js (metrosPorPixel, teselas de 256 de Leaflet): ahí el mismo zoom es el doble de grande.
export function metrosPorPixelMapLibre(lat, zoom) {
  return (78271.517 * Math.cos(lat * GRADO)) / 2 ** zoom;
}

// La cámara de la maqueta (camaraDeLaZona o camaraDelCroquis: centro, zoom, inclinación y rumbo) en
// la forma de Google. Google no tiene zoom: pide la distancia de la cámara al centro (`range`). Se
// toma la que deja en el centro de la pantalla los mismos metros por píxel que el zoom de MapLibre,
// así el croquis queda del mismo tamaño en las dos. `center` va con su altura SOBRE EL NIVEL DEL MAR
// (así lo pide Google): con 0, en Bogotá la cámara miraba a un punto 2.600 m bajo tierra. La
// inclinación y el rumbo significan lo mismo en las dos: 0 = mirando derecho hacia abajo, y rumbo
// 0 = norte, creciendo hacia el este.
export function camaraDeGoogle(camara, { altoPx, suelo, campo = CAMPO_DE_VISION }) {
  const [lng, lat] = camara.center;
  const metros = metrosPorPixelMapLibre(lat, camara.zoom);
  const range = (metros * altoPx) / (2 * Math.tan((campo / 2) * GRADO));
  return { center: { lat, lng, altitude: Math.round(suelo * 10) / 10 }, range: Math.round(range), tilt: camara.pitch, heading: camara.bearing };
}

// «Desde arriba»: la misma cámara mirando derecho hacia abajo, con el norte arriba y un poco más
// lejos, para que entre lo que la inclinación dejaba a los lados.
export function camaraDesdeArriba(camara) {
  return { ...camara, tilt: 0, heading: 0, range: Math.round(camara.range * 1.25) };
}

// ------------------------------------------------------------------------------ la altura del suelo

// La altura del suelo en el punto sale de los mosaicos «terrarium» de AWS, los mismos del relieve de
// la maqueta abierta. En z15 un píxel mide unos 4,8 m, y el dato de fondo es de satélite (más o menos
// un punto cada 30 m): para apuntar la cámara sobra. Google no da la altura con esta clave (su API de
// elevación no está en la clave de demostración).
export const ZOOM_DEL_SUELO = 15;

export function pixelDelSuelo(lat, lon, z = ZOOM_DEL_SUELO) {
  const n = 2 ** z;
  const fx = ((lon + 180) / 360) * n;
  const r = lat * GRADO;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  return { z, x, y, px: Math.min(255, Math.floor((fx - x) * 256)), py: Math.min(255, Math.floor((fy - y) * 256)) };
}

// Terrarium: altura en metros = R × 256 + G + B / 256 − 32768.
export const alturaTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

// ------------------------------------------------------------------------------ lo que va encima

// Cuánto se levanta cada dibujo sobre el suelo, en metros. A ras del suelo, la vía de la foto de
// Google (que es una malla, no el relieve) lo tapaba a pedazos. Las flechas, más arriba que el tramo,
// para que se vean encima de él.
export const ALTURAS = { suelo: 0.3, tramo: 0.4, sol: 0.6, flecha: 0.9, letrero: 2.6, golpe: 3.5 };

export function conTransparencia(hex, alfa) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

const enGoogle = ([lng, lat], altitude) => ({ lat, lng, altitude });
const ruta = (coordenadas, altura) => coordenadas.map((c) => enGoogle(c, altura));

// Todo lo de capasDeLaZona como una lista de elementos para el Map3DElement, en el orden en que se
// ponen (lo de abajo primero). Cada uno dice su `tipo` (poligono, linea, marcador, letrero o carro)
// y su `clave`, la capa de la que viene. Cuando llega el análisis de la vía la página quita todo y lo
// vuelve a poner: los carros del ejemplo salen del tramo, así que también cambian. `carros` es
// carrosDeLaZona (zona-3d.js).
export function elementosDeGoogle(capas, carros = []) {
  const lista = [];
  for (const f of capas.precision.features) {
    lista.push({ tipo: 'poligono', clave: 'precision', path: ruta(f.geometry.coordinates[0], ALTURAS.suelo), fillColor: conTransparencia(COLORES.precision, 0.12), strokeColor: COLORES.precision, strokeWidth: 2 });
  }
  for (const f of capas.tramo.features) {
    lista.push({ tipo: 'linea', clave: 'tramo', path: ruta(f.geometry.coordinates, ALTURAS.tramo), strokeColor: conTransparencia(COLORES.tramo, 0.6), strokeWidth: 10 });
  }
  for (const f of capas.conos.features) {
    lista.push({ tipo: 'poligono', clave: 'conos', path: ruta(f.geometry.coordinates[0], ALTURAS.suelo), fillColor: conTransparencia(COLORES.conos, 0.25), strokeColor: COLORES.conos, strokeWidth: 1 });
  }
  for (const f of capas.sol.features) {
    const coordenadas = f.geometry.coordinates;
    lista.push({ tipo: 'linea', clave: 'sol', path: ruta(coordenadas, ALTURAS.sol), strokeColor: COLORES.sol, strokeWidth: 5 });
    lista.push({ tipo: 'letrero', clave: 'sol', position: enGoogle(coordenadas.at(-1), ALTURAS.letrero), texto: f.properties.texto, color: COLORES.sol });
  }
  for (const f of capas.senales.features) {
    lista.push({ tipo: 'marcador', clave: 'senales', position: enGoogle(f.geometry.coordinates, ALTURAS.letrero), texto: f.properties.texto, color: COLORES.senales });
  }
  for (const f of capas.trayectorias.features) {
    const { nombre, color } = f.properties;
    const coordenadas = f.geometry.coordinates;
    lista.push({ tipo: 'linea', clave: 'flechas', letra: nombre, path: ruta(coordenadas, ALTURAS.flecha), strokeColor: color, strokeWidth: 6, outerColor: '#ffffff', outerWidth: 0.3 });
    // La punta, del mismo largo que en el croquis del paso 7.
    const punta = puntaDeFlecha(coordenadas.map(([lon, lat]) => ({ lat, lon })));
    if (punta) lista.push({ tipo: 'poligono', clave: 'flechas', letra: nombre, path: punta.map((p) => ({ lat: p.lat, lng: p.lon, altitude: ALTURAS.flecha })), fillColor: color, strokeColor: '#ffffff', strokeWidth: 1 });
  }
  for (const c of carros) {
    lista.push({ tipo: 'carro', clave: 'carros', letra: c.nombre, position: { lat: c.centro.lat, lng: c.centro.lon }, rumbo: c.rumbo, largo: c.largo ?? null, ancho: c.ancho ?? null, color: c.color });
    lista.push({ tipo: 'letrero', clave: 'carros', letra: c.nombre, position: { lat: c.centro.lat, lng: c.centro.lon, altitude: ALTURAS.letrero }, texto: c.nombre, color: c.color });
  }
  for (const f of capas.golpe.features) {
    lista.push({ tipo: 'marcador', clave: 'golpe', position: enGoogle(f.geometry.coordinates, ALTURAS.golpe), texto: 'Golpe', color: '#7a1a10' });
  }
  // El pin del paso 3. Con croquis se queda sin letrero, como en la maqueta: caía encima del carro A.
  const conCroquis = carros.length > 0 && capas.golpe.features.length > 0;
  for (const f of capas.punto.features) {
    lista.push({ tipo: 'marcador', clave: 'punto', position: enGoogle(f.geometry.coordinates, ALTURAS.golpe), texto: conCroquis ? '' : f.properties.texto, color: COLORES.punto });
  }
  return lista;
}

// ------------------------------------------------------------------------------ cuando Google falla

// Con el 3D, Google NO llama a gm_authFailure ni dispara gmp-error cuando no acepta la clave (medido
// el 13-nov-2026 con una clave que no existe): pone su tarjeta «¡Vaya! Se ha producido un error»
// dentro del mapa y escribe en la consola «Google Maps JavaScript API error: InvalidKeyMapError».
// La página escucha esa línea y vuelve a la maqueta. Esto la traduce a palabras, con el código al
// final para poder buscarlo (la lista está en la guía de errores de Maps JavaScript).
export function motivoDeGoogle(texto) {
  const codigo = /([A-Za-z]+MapError)/.exec(String(texto))?.[1] ?? null;
  const porCodigo = {
    RefererNotAllowedMapError: 'La clave de Google no está autorizada para este sitio.',
    OverQuotaMapError: 'Se acabó el cupo de hoy del 3D de Google.',
    ApiNotActivatedMapError: 'La clave de Google no tiene el 3D activado.',
    ApiTargetBlockedMapError: 'La clave de Google no tiene el 3D activado.',
    BillingNotEnabledMapError: 'La clave de Google pide facturación para este uso.',
    ExpiredKeyMapError: 'La clave de Google venció.',
  };
  const motivo = porCodigo[codigo] ?? 'Google no aceptó la clave del 3D.';
  return codigo ? `${motivo.slice(0, -1)} (${codigo}).` : motivo;
}

// ------------------------------------------------------------------------------ el carro 3D

// El carro del paso 6 mira hacia -Z, con Y hacia arriba y en metros (carro.js), y el modelo de
// Google es un glTF: Y hacia arriba y en metros también, así que la escala es 1. Lo único que falta
// es girarlo hacia su rumbo. GIRO_DEL_MODELO es lo que hay que sumarle al rumbo para que la punta del
// carro mire hacia allá en el Map3DElement.
// POR MEDIR con la clave de Joan: con un carro a rumbo 0, ¿la punta mira al norte?
export const GIRO_DEL_MODELO = 0;

export function orientacionDelCarro(rumbo) {
  const heading = (((rumbo + GIRO_DEL_MODELO) % 360) + 360) % 360;
  return { heading: Math.round(heading * 10) / 10, tilt: 0, roll: 0 };
}
