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

// Con carros (los del croquis o los inventados del ejemplo), la cámara de Google se acerca hasta que
// se vean como carros. La de la maqueta los dejaba en una mota: el ejemplo quedaba a 397 m, donde un
// carro de 4,4 m mide 6 px (medido el 14-nov-2026 en el Edge oculto). Mira al mismo centro, con la
// misma inclinación y el mismo rumbo, pero desde la distancia en la que el carro más lejano del
// centro (más medio largo) cabe de lado a lado con un cuarto de margen. Las colas de las flechas
// pueden quedar fuera: lo que cuenta el croquis es dónde iba cada carro y dónde se dieron, y con dos
// dedos se aleja. Nunca más lejos que la maqueta ni más cerca de RANGO_MINIMO: más cerca, la foto
// de Google en el campo es una mancha (en Los Verjones, a 22 m no se distingue la vía).
export const RANGO_MINIMO = 80;
const metrosEntre = (a, b) => Math.hypot((b.lng - a.lng) * 111320 * Math.cos(a.lat * GRADO), (b.lat - a.lat) * 110574);

export function acercarALosCarros(camara, carros, { anchoPx, altoPx, campo = CAMPO_DE_VISION }) {
  if (!carros?.length || !(anchoPx > 0) || !(altoPx > 0)) return camara;
  let radio = 0;
  for (const c of carros) radio = Math.max(radio, metrosEntre(camara.center, { lat: c.centro.lat, lng: c.centro.lon }) + (c.largo || 4.5) / 2);
  const mitadDelAncho = Math.tan((campo / 2) * GRADO) * (anchoPx / altoPx);
  const range = Math.round((radio * 1.25) / mitadDelAncho);
  return { ...camara, range: Math.min(camara.range, Math.max(RANGO_MINIMO, range)) };
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
// para que se vean encima de él. La letra de cada carro va a 5 m, colgada de una raya hasta el
// suelo: a 2,6 m la pastilla (28 px) tapaba el carro, que de cerca mide unos 30 px.
export const ALTURAS = { suelo: 0.3, tramo: 0.4, sol: 0.6, flecha: 0.9, letrero: 2.6, letra: 5, golpe: 3.5 };

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
    // Solo el rayo, a la mitad del de la maqueta (35 m), sin la pastilla «Sol a 5°». Con la cámara
    // inclinada, lo que se aleja sube en la pantalla: la pastilla quedaba detrás del botón de Google
    // de arriba a la derecha, o encima de la del golpe si se acercaba (medido el 14-nov). La leyenda
    // ya lo dice con el mismo color: «Hacia dónde estaba el sol a esa hora (5° sobre el horizonte)».
    const [desde, hasta] = [f.geometry.coordinates[0], f.geometry.coordinates.at(-1)];
    const mitad = [desde[0] + (hasta[0] - desde[0]) / 2, desde[1] + (hasta[1] - desde[1]) / 2];
    lista.push({ tipo: 'linea', clave: 'sol', path: ruta([desde, mitad], ALTURAS.sol), strokeColor: COLORES.sol, strokeWidth: 5 });
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
    lista.push({ tipo: 'letrero', clave: 'carros', letra: c.nombre, position: { lat: c.centro.lat, lng: c.centro.lon, altitude: ALTURAS.letra }, texto: c.nombre, color: c.color, colgado: true });
  }
  for (const f of capas.golpe.features) {
    lista.push({ tipo: 'marcador', clave: 'golpe', position: enGoogle(f.geometry.coordinates, ALTURAS.golpe), texto: 'Golpe', color: '#7a1a10' });
  }
  // El pin del paso 3. Con croquis se queda sin letrero, como en la maqueta: caía encima del carro A.
  // Y si el golpe quedó a menos de 5 m del punto (así arranca el croquis), el pin no se pone: la
  // estrella y el pin salían uno encima del otro, con dos rayas hasta el suelo (14-nov). La
  // estrella ya marca ese sitio.
  const conCroquis = carros.length > 0 && capas.golpe.features.length > 0;
  const golpe = capas.golpe.features[0]?.geometry.coordinates;
  for (const f of capas.punto.features) {
    const [lng, lat] = f.geometry.coordinates;
    if (conCroquis && golpe && metrosEntre({ lat, lng }, { lat: golpe[1], lng: golpe[0] }) < 5) continue;
    lista.push({ tipo: 'marcador', clave: 'punto', position: enGoogle(f.geometry.coordinates, ALTURAS.golpe), texto: conCroquis ? '' : f.properties.texto, color: COLORES.punto });
  }
  return lista;
}

// ------------------------------------------------------------------------------ las marcas

// Google dibuja un SVG dentro de un <template> como imagen, sin clases ni estilos de la página, y lo
// cuelga de su punto por el borde de abajo, al centro.
const escapar = (texto) => String(texto).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const anchoDePastilla = (texto) => Math.max(28, Math.round(14 + String(texto).length * 8.6));
const pastilla = (texto, color, ancho, x = 0) =>
  `<rect x="${x + 1}" y="1" width="${ancho - 2}" height="26" rx="13" fill="${color}" stroke="#ffffff" stroke-width="2"/><text x="${x + ancho / 2}" y="19" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${escapar(texto)}</text>`;

// La pastilla con la letra del carro o con el texto del sol, del color de su letra.
export function svgDeLetrero(texto, color) {
  const ancho = anchoDePastilla(texto);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="28" viewBox="0 0 ${ancho} 28">${pastilla(texto, color, ancho)}</svg>`;
}

// El pin del punto y de las señales, y la estrella del golpe (la del croquis del paso 7), con su
// texto en una pastilla encima si lo tiene. Antes era el pin de Google con su `label`, y Google
// escribía el texto DOS veces, encima y al lado (medido el 14-nov-2026): con el dibujo propio sale
// una vez, y del color de la leyenda.
export function svgDePin(texto, color, forma = 'pin') {
  const alto = forma === 'golpe' ? 34 : 38;
  const conTexto = Boolean(texto);
  const deLaPastilla = conTexto ? anchoDePastilla(texto) : 0;
  const ancho = Math.max(34, deLaPastilla);
  const arriba = conTexto ? 32 : 0;
  const cx = ancho / 2;
  const figura =
    forma === 'golpe'
      ? `<polygon points="${estrella(cx, arriba + 17, 16, 7)}" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>`
      : `<path d="M${cx} ${arriba + 37} C${cx - 4} ${arriba + 29} ${cx - 12} ${arriba + 23} ${cx - 12} ${arriba + 13} A12 12 0 1 1 ${cx + 12} ${arriba + 13} C${cx + 12} ${arriba + 23} ${cx + 4} ${arriba + 29} ${cx} ${arriba + 37} Z" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="${cx}" cy="${arriba + 13}" r="4.5" fill="#ffffff"/>`;
  const encima = conTexto ? pastilla(texto, color, deLaPastilla, (ancho - deLaPastilla) / 2) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${arriba + alto}" viewBox="0 0 ${ancho} ${arriba + alto}">${encima}${figura}</svg>`;
}

// Las puntas de una estrella de 8, alternando radio grande y chico, empezando arriba.
function estrella(cx, cy, grande, chico) {
  const puntos = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? chico : grande;
    const a = (i * Math.PI) / 8;
    puntos.push(`${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`);
  }
  return puntos.join(' ');
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

// El carro del paso 6 mira hacia -Z, con Y hacia arriba y en metros (carro.js), y así queda en el
// .glb: la escala es 1. Pero el Map3DElement tiene Z hacia arriba, no Y: con la orientación en 0 el
// carro salía parado sobre la cola (medido el 14-nov-2026 con la clave de demostración de Joan, en
// el ejemplo de Los Verjones). Con tilt 270 queda sobre sus ruedas (con 90 queda con el techo abajo,
// enterrado en la malla), y entonces el heading es el rumbo tal cual: con heading 0 los faros miran
// al norte y con 90 al oriente.
export const TILT_DEL_MODELO = 270;
export const GIRO_DEL_MODELO = 0;

export function orientacionDelCarro(rumbo) {
  const heading = (((rumbo + GIRO_DEL_MODELO) % 360) + 360) % 360;
  return { heading: Math.round(heading * 10) / 10, tilt: TILT_DEL_MODELO, roll: 0 };
}
