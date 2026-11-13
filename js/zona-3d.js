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
// Los carros, sus flechas y el golpe salen del croquis (paso 7) que haya en este
// teléfono para este mismo lugar. Sin croquis, solo el ejemplo trae carros, y son
// inventados: la leyenda lo dice.
import { distancia, planoLocal, rumbo as rumboEntre } from './geo.js';

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

// Un color por letra, el mismo en el croquis y en la maqueta. C en adelante son raros (un choque
// en cadena) y van en tonos que no se confunden con el rojo del golpe ni con el verde del tramo.
const COLORES_DE_LOS_CARROS = { A: COLORES.carroA, B: COLORES.carroB, C: '#2c64ad', D: '#7b4fb2', E: '#a3366f', F: '#4a5260' };
export const colorDeCarro = (letra) => COLORES_DE_LOS_CARROS[letra] || COLORES_DE_LOS_CARROS.F;

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

// Con un croquis del teléfono, la cámara se acerca al golpe hasta que quepan los carros y sus
// flechas: a 17,3 (la de la zona) un carro de 4 m mide 9 px, y el enlace «Ver el croquis en la
// zona 3D» del paso 7 llevaba a una mota. El radio se mide en metros desde el golpe y se le dan
// 120 px de pantalla (en un iPhone el mapa mide unos 360 de ancho). Entre 17,3 y 19: más lejos
// que la zona no tiene sentido, y más cerca la vía se sale del cuadro.
export const PIXELES_PARA_EL_CROQUIS = 120;
export function camaraDelCroquis(centro, analisis, croquis) {
  const base = camaraDeLaZona(centro, analisis);
  const golpe = croquis?.golpe;
  if (!golpe || !Number.isFinite(golpe.lat) || !Number.isFinite(golpe.lon)) return base;
  const plano = planoLocal(golpe);
  const lejos = (p) => distancia(plano.aMetros(p), { x: 0, y: 0 });
  let radio = 10;
  for (const c of croquis.carros || []) radio = Math.max(radio, lejos(c) + (c.largo || 4.5) / 2);
  for (const f of croquis.flechas || []) for (const p of f.puntos || []) radio = Math.max(radio, lejos(p));
  // En MapLibre (teselas de 512) un píxel mide 78.271,5 × cos(latitud) / 2^zoom metros.
  const zoom = Math.log2((78271.517 * Math.cos((golpe.lat * Math.PI) / 180) * PIXELES_PARA_EL_CROQUIS) / radio);
  // Hacia abajo: redondear hacia arriba acercaba lo justo para que la punta de una flecha se saliera.
  return { ...base, center: [golpe.lon, golpe.lat], zoom: Math.min(19, Math.max(base.zoom, Math.floor(zoom * 10) / 10)) };
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

// El croquis del teléfono sirve para esta zona si es de este mismo lugar (su pin a menos de 150 m)
// y del mismo tipo: el croquis que alguien hizo sobre el ejemplo no se le pega a un choque de
// verdad, ni al revés (lo mismo que con las fotos de la escena).
export const LEJOS_DEL_CROQUIS = 150;

export function croquisDeEstaZona(croquis, centro, ejemplo = false) {
  if (!croquis || !Array.isArray(croquis.carros) || !croquis.carros.length) return null;
  if (!!croquis.ejemplo !== !!ejemplo) return null;
  const suyo = croquis.punto || croquis.centro;
  if (!suyo || !centro) return null;
  const plano = planoLocal(centro);
  return distancia(plano.aMetros(suyo), { x: 0, y: 0 }) <= LEJOS_DEL_CROQUIS ? croquis : null;
}

// Los carros del croquis (croquis.js, croquisParaGuardar) en la forma de croquisDeEjemplo, con el
// largo y el ancho de su línea. Un carro quieto no trae trayectoria.
export function carrosDelCroquis(croquis) {
  return croquis.carros.map((c) => {
    const flecha = (croquis.flechas || []).find((f) => f.letra === c.letra);
    return {
      nombre: c.letra,
      color: colorDeCarro(c.letra),
      centro: { lat: c.lat, lon: c.lon },
      rumbo: c.rumbo,
      largo: c.largo,
      ancho: c.ancho,
      trayectoria: flecha && flecha.puntos.length >= 2 ? { type: 'LineString', coordinates: flecha.puntos.map((p) => [p.lon, p.lat]) } : null,
    };
  });
}

// Las fotos de la escena que sirven para un cono: con GPS y con rumbo.
export function fotosConCono(registros = []) {
  return registros.filter((r) => r && r.paso === 'escena' && r.gps && Number.isFinite(r.gps.lat) && Number.isFinite(r.gps.lon) && Number.isFinite(r.rumbo));
}

// Todo lo que se dibuja encima de la maqueta, en GeoJSON. `croquis`: el de croquisDeEstaZona.
export function capasDeLaZona({ centro, precision = null, analisis = null, sol = null, ejemplo = false, fotos = [], croquis = null }) {
  const via = analisis?.estado === 'ok' ? analisis : null;
  const carros = croquis ? carrosDelCroquis(croquis) : ejemplo ? croquisDeEjemplo(via) ?? [] : [];
  const conSol = sol && sol.altura > 0;
  const finDelRayo = conSol ? desplazar(centro, sol.azimut, 70) : null;
  return {
    punto: coleccion([rasgo(punto(centro.lon, centro.lat), { texto: ejemplo ? 'Choque (ejemplo)' : 'Choque' })]),
    precision: coleccion(precision > 0 ? [rasgo(circulo(centro, precision))] : []),
    tramo: coleccion(via ? [rasgo({ type: 'LineString', coordinates: via.tramo.map(([lat, lon]) => [lon, lat]) })] : []),
    senales: coleccion((via?.senales ?? []).map((s) => rasgo(punto(s.lon, s.lat), { texto: s.texto }))),
    sol: coleccion(conSol ? [rasgo({ type: 'LineString', coordinates: [[centro.lon, centro.lat], [finDelRayo.lon, finDelRayo.lat]] }, { texto: `Sol a ${Math.round(sol.altura)}°` })] : []),
    conos: coleccion(fotosConCono(fotos).map((r) => rasgo(conoDeFoto(r.gps, r.rumbo), { indice: r.indice }))),
    carros: coleccion(carros.map((c) => rasgo(rectanguloDeCarro(c.centro, c.rumbo, c.largo, c.ancho), { nombre: c.nombre, color: c.color, altura: 1.5 }))),
    nombresDeCarros: coleccion(carros.map((c) => rasgo(punto(c.centro.lon, c.centro.lat), { nombre: c.nombre }))),
    trayectorias: coleccion(carros.filter((c) => c.trayectoria).map((c) => rasgo(c.trayectoria, { nombre: c.nombre, color: c.color }))),
    golpe: coleccion(croquis?.golpe ? [rasgo(punto(croquis.golpe.lon, croquis.golpe.lat))] : []),
  };
}

// La leyenda, en palabras: dice qué hay y, sobre todo, qué NO hay todavía.
export function leyendaDeLaZona({ ejemplo = false, analisis = null, fotos = [], sol = null, croquis = null }) {
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
  const letras = croquis ? croquis.carros.map((c) => c.letra).sort() : [];
  const quienes = letras.length > 1 ? `Carros ${letras.slice(0, -1).join(', ')} y ${letras.at(-1)}` : `Carro ${letras[0]}`;
  // Cada parte de la frase tiene que estar en la maqueta: sin flechas (todos quietos) no se nombran,
  // y antes de «Listo: así fue» el croquis es un borrador, no algo que la persona ya declaró.
  const conFlechas = !!croquis?.flechas?.some((f) => f.puntos?.length >= 2);
  const queSeVe = conFlechas ? ', sus flechas y el golpe' : letras.length > 1 ? ', y el golpe' : ' y el golpe';
  const deQuien = croquis?.hecho ? 'lo que declaraste' : 'todavía sin terminar';
  filas.push(
    croquis
      ? { clave: 'carros', color: COLORES.carroA, texto: `${quienes}${queSeVe}: tu croquis del paso 7, ${deQuien}, no una medición` }
      : ejemplo
        ? { clave: 'carros', color: COLORES.carroA, texto: 'Carros A y B: un croquis INVENTADO para el ejemplo' }
        : { clave: 'carros', color: null, texto: 'Los carros salen del croquis (paso 7), que todavía no está hecho en este teléfono' },
  );
  return filas;
}
