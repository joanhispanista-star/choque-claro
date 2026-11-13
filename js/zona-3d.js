// La zona del choque en 3D: la opción B del plan, que Joan eligió el
// 13-nov-2026. Es una maqueta con el relieve y los edificios del mapa abierto,
// y encima lo que sabemos del choque. Este módulo es puro: arma los GeoJSON,
// la cámara y la luz; la página (pantalla-zona-3d.js) se los da a MapLibre.
//
// Tiene dos capas que no se mezclan, igual que en el expediente:
//  - El CONTEXTO, que no es del día: el relieve (datos de satélite, más o menos
//    un punto cada 30 m) y los edificios que alguien dibujó en OpenStreetMap.
//    Puede faltar un edificio o sobrar uno que ya tumbaron.
//  - Lo DEL CHOQUE: el punto y su precisión, el tramo analizado, las señales del
//    mapa, la dirección del sol a esa hora y, si las hay en este teléfono, los
//    conos de las fotos de la escena (paso 4).
// Los carros y sus trayectorias van a salir del croquis (paso 7, que todavía no
// existe). Mientras tanto se dibujan SOLO en el ejemplo, marcados como inventados.
import { planoLocal, rumbo as rumboEntre } from './geo.js';

const GRADO = Math.PI / 180;

export const COLORES = {
  punto: '#b42318',
  precision: '#2f6fb7',
  tramo: '#1d9e75',
  conos: '#1d9e75',
  sol: '#ef9f27',
  senales: '#8a4b00',
  carroA: '#0f6e56',
  carroB: '#d85a30',
};

const punto = (lon, lat) => ({ type: 'Point', coordinates: [lon, lat] });
const rasgo = (geometry, properties = {}) => ({ type: 'Feature', geometry, properties });
export const coleccion = (features) => ({ type: 'FeatureCollection', features });

// El punto que queda a `metros` de `origen` hacia `rumbo` (0 = norte, 90 = este).
export function desplazar(origen, rumbo, metros) {
  return planoLocal(origen).aGrados({ x: Math.sin(rumbo * GRADO) * metros, y: Math.cos(rumbo * GRADO) * metros });
}

export function circulo(centro, radio, lados = 48) {
  const anillo = [];
  for (let i = 0; i <= lados; i++) {
    const p = desplazar(centro, (360 * i) / lados, radio);
    anillo.push([p.lon, p.lat]);
  }
  return { type: 'Polygon', coordinates: [anillo] };
}

// Un carro visto desde arriba: un rectángulo centrado en `centro`, mirando a
// `rumbo`. 4,2 × 1,8 m es un carro mediano (la Captiva mide 4,67 × 1,85).
export function rectanguloDeCarro(centro, rumbo, largo = 4.2, ancho = 1.8) {
  const plano = planoLocal(centro);
  const adelante = { x: Math.sin(rumbo * GRADO), y: Math.cos(rumbo * GRADO) };
  const derecha = { x: adelante.y, y: -adelante.x };
  const esquinas = [[1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]].map(([a, b]) => {
    const g = plano.aGrados({
      x: (adelante.x * largo * a + derecha.x * ancho * b) / 2,
      y: (adelante.y * largo * a + derecha.y * ancho * b) / 2,
    });
    return [g.lon, g.lat];
  });
  return { type: 'Polygon', coordinates: [esquinas] };
}

// El cono de una foto: desde donde se tomó, abierto hacia donde apuntaba.
// 50° es más o menos lo que ve la cámara de atrás de un celular en vertical.
export function conoDeFoto(desde, rumbo, { largo = 16, apertura = 50 } = {}) {
  const borde = [];
  for (let i = 0; i <= 8; i++) borde.push(desplazar(desde, rumbo - apertura / 2 + (apertura * i) / 8, largo));
  const anillo = [desde, ...borde, desde].map((p) => [p.lon, p.lat]);
  return { type: 'Polygon', coordinates: [anillo] };
}

// La cámara: encima del punto, inclinada, mirando a lo largo de la vía.
export function camaraDeLaZona(centro, analisis) {
  const rumbo = analisis?.estado === 'ok' ? analisis.rumbo : 0;
  return { center: [centro.lon, centro.lat], zoom: 17.3, pitch: 62, bearing: Math.round(rumbo) % 360 };
}

// La cámara con la que ARRANCA el mapa: desde arriba, sin inclinar. Si el relieve se enciende con
// la cámara ya inclinada (como estaba hasta el 13-nov-2026), MapLibre 4.7 nunca pide la tesela
// del relieve que hay debajo del punto: calcula la altura del terreno en 0 m, la cámara queda
// dentro de la montaña (en Los Verjones el suelo está a 2.921 m) y el mapa sale gris, en zoom
// 14,35 y 7°, en cualquier navegador. Desde arriba sí la pide; con la altura ya calculada, la
// cámara de camaraDeLaZona entra al 3D sin problema (medido en el Edge oculto con la tarjeta
// gráfica del PC).
export function camaraDeArranque(centro) {
  return { center: [centro.lon, centro.lat], zoom: 15, pitch: 0, bearing: 0 };
}

// La luz de los edificios viene de donde estaba el sol a esa hora (MapLibre:
// posición [radio, rumbo desde el norte, ángulo desde la vertical]). De noche,
// una luz azulada y floja: no hay sol que ilumine nada.
export function luzDelSol(sol) {
  if (!sol || !(sol.altura > 0)) return { anchor: 'map', position: [1.5, 0, 30], color: '#9fb0cc', intensity: 0.25 };
  return { anchor: 'map', position: [1.5, Math.round(sol.azimut) % 360, Math.round(90 - sol.altura)], color: '#ffffff', intensity: 0.5 };
}

// El croquis del EJEMPLO, inventado: el carro A sube hacia la curva, el B baja,
// y se encuentran en el punto. Sale del tramo analizado (de -60 a +60 m del
// punto, un punto cada 4 m), así que los dos quedan sobre la vía de verdad.
export function croquisDeEjemplo(analisis) {
  if (analisis?.estado !== 'ok' || !Array.isArray(analisis.tramo) || analisis.tramo.length < 12) return null;
  const tramo = analisis.tramo.map(([lat, lon]) => ({ lat, lon }));
  const medio = Math.floor(tramo.length / 2);
  const rumboDe = (i, j) => {
    const plano = planoLocal(tramo[i]);
    return rumboEntre(plano.aMetros(tramo[i]), plano.aMetros(tramo[j]));
  };
  const iA = Math.max(1, medio - 6);
  const iB = Math.min(tramo.length - 2, medio + 5);
  const linea = (desde, hasta) => {
    const paso = desde < hasta ? 1 : -1;
    const coordenadas = [];
    for (let i = desde; i !== hasta + paso; i += paso) coordenadas.push([tramo[i].lon, tramo[i].lat]);
    return { type: 'LineString', coordinates: coordenadas };
  };
  return [
    { nombre: 'A', color: COLORES.carroA, centro: tramo[iA], rumbo: rumboDe(iA, iA + 1), trayectoria: linea(Math.max(0, iA - 6), medio) },
    { nombre: 'B', color: COLORES.carroB, centro: tramo[iB], rumbo: rumboDe(iB, iB - 1), trayectoria: linea(Math.min(tramo.length - 1, iB + 6), medio) },
  ];
}

// Las fotos de la escena que sirven para un cono: con GPS y con rumbo.
export function fotosConCono(registros = []) {
  return registros.filter((r) => r && r.paso === 'escena' && r.gps && Number.isFinite(r.gps.lat) && Number.isFinite(r.gps.lon) && Number.isFinite(r.rumbo));
}

// Todo lo que se dibuja encima de la maqueta, en GeoJSON.
export function capasDeLaZona({ centro, precision = null, analisis = null, sol = null, ejemplo = false, fotos = [] }) {
  const via = analisis?.estado === 'ok' ? analisis : null;
  const carros = ejemplo ? croquisDeEjemplo(via) ?? [] : [];
  const conSol = sol && sol.altura > 0;
  const finDelRayo = conSol ? desplazar(centro, sol.azimut, 70) : null;
  return {
    punto: coleccion([rasgo(punto(centro.lon, centro.lat), { texto: ejemplo ? 'Choque (ejemplo)' : 'Choque' })]),
    precision: coleccion(precision > 0 ? [rasgo(circulo(centro, precision))] : []),
    tramo: coleccion(via ? [rasgo({ type: 'LineString', coordinates: via.tramo.map(([lat, lon]) => [lon, lat]) })] : []),
    senales: coleccion((via?.senales ?? []).map((s) => rasgo(punto(s.lon, s.lat), { texto: s.texto }))),
    sol: coleccion(conSol ? [rasgo({ type: 'LineString', coordinates: [[centro.lon, centro.lat], [finDelRayo.lon, finDelRayo.lat]] }, { texto: `Sol a ${Math.round(sol.altura)}°` })] : []),
    conos: coleccion(fotosConCono(fotos).map((r) => rasgo(conoDeFoto(r.gps, r.rumbo), { indice: r.indice }))),
    carros: coleccion(carros.map((c) => rasgo(rectanguloDeCarro(c.centro, c.rumbo), { nombre: c.nombre, color: c.color, altura: 1.5 }))),
    nombresDeCarros: coleccion(carros.map((c) => rasgo(punto(c.centro.lon, c.centro.lat), { nombre: c.nombre }))),
    trayectorias: coleccion(carros.map((c) => rasgo(c.trayectoria, { nombre: c.nombre, color: c.color }))),
  };
}

// La leyenda, en palabras: dice qué hay y, sobre todo, qué NO hay todavía.
export function leyendaDeLaZona({ ejemplo = false, analisis = null, fotos = [], sol = null }) {
  const filas = [{ clave: 'punto', color: COLORES.punto, texto: ejemplo ? 'Punto del choque (ejemplo)' : 'Punto del choque' }];
  if (analisis?.estado === 'ok') {
    const forma = analisis.forma.tipo ? analisis.forma.tipo + (analisis.forma.radio ? `, radio ${Math.round(analisis.forma.radio)} m` : '') : 'forma sin dato';
    filas.push({ clave: 'tramo', color: COLORES.tramo, texto: `Tramo analizado: ${forma}` });
  } else if (analisis?.estado === 'cargando') {
    filas.push({ clave: 'tramo', color: null, texto: 'Analizando la vía en el mapa…' });
  } else {
    filas.push({ clave: 'tramo', color: null, texto: 'Sin análisis de la vía: el mapa no se pudo consultar' });
  }
  if (analisis?.estado === 'ok' && analisis.senales.length) filas.push({ clave: 'senales', color: COLORES.senales, texto: 'Señales que están en el mapa' });
  const conCono = fotosConCono(fotos).length;
  filas.push(
    ejemplo
      ? { clave: 'conos', color: null, texto: 'El ejemplo no tiene fotos de la escena: el choque es inventado' }
      : conCono
        ? { clave: 'conos', color: COLORES.conos, texto: `Fotos de la escena: ${conCono}, cada una hacia donde apuntaba (con brújula, dirección aproximada)` }
        : { clave: 'conos', color: null, texto: 'Aún no hay fotos de la escena en este teléfono' },
  );
  filas.push(
    sol && sol.altura > 0
      ? { clave: 'sol', color: COLORES.sol, texto: `Hacia dónde estaba el sol a esa hora (${Math.round(sol.altura)}° sobre el horizonte)` }
      : { clave: 'sol', color: null, texto: 'A esa hora no había sol: no se dibuja su dirección' },
  );
  filas.push(
    ejemplo
      ? { clave: 'carros', color: COLORES.carroA, texto: 'Carros A y B: un croquis INVENTADO para el ejemplo' }
      : { clave: 'carros', color: null, texto: 'Los carros saldrán del croquis (paso 7, todavía en construcción)' },
  );
  return filas;
}
