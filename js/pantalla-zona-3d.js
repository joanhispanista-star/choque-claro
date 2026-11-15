// La página de la zona en 3D (zona-3d.html), con dos motores que nunca salen juntos:
//  - El 3D fotorrealista de Google (pantalla-zona-google.js), si hay clave en clave-de-google.js.
//    Es la opción A, que Joan eligió el vie 13-nov-2026 al ver la hoja con Google Earth.
//  - La maqueta abierta, sobre MapLibre 4.7.1 (BSD, copiado en js/vendor/maplibre, sin CDN), sin
//    clave ni tarjeta. Sale cuando no hay clave y también si el 3D de Google falla, y la página dice
//    por qué.
// La lógica pura está en zona-3d.js y zona-google.js.
//
// Se abre desde "¿Dónde fue?" con el punto en la dirección:
//   zona-3d.html?lat=4.648400&lon=-74.010500&t=<ISO>&p=<precisión m>&ejemplo=1
// Fuentes de la maqueta abierta, todas sin clave ni tarjeta (la opción B, del 13-nov-2026):
//  - Calles y edificios: el estilo "liberty" de OpenFreeMap (datos de
//    OpenStreetMap), que ya trae los edificios levantados en 3D.
//  - Relieve: los mosaicos "terrarium" de AWS (Terrain Tiles, de Mapzen).
//  - La vía: el mismo análisis de "¿Dónde fue?" (via.js). El ejemplo usa la
//    respuesta guardada, para que no falle; un punto real se consulta en vivo.
// Las fotos de la escena, el croquis (paso 7) y la línea de cada carro (paso 5) se leen de este
// teléfono (reporte-bd.js): si el reporte se hizo en otro, aquí no aparecen, y la leyenda lo dice.
//
// NADA espera al análisis de la vía (13-nov-2026): con los servidores públicos
// lentos tardaba hasta 75 s y la página se quedaba en blanco, sin 360° ni mapa.
// El mapa y el 360° salen de una vez; el tramo, las señales y la cámara a lo
// largo de la vía se agregan cuando llega el análisis.
import { analizarVia, consultaDeLaVia } from './via.js';
import { consultarJson, consultarOverpass } from './servicios.js';
import { posicionDelSol } from './sol.js';
import { abrirBaseDelReporte } from './reporte-bd.js';
import { COLORES, DANOS_DEL_EJEMPLO, anchoDeLaVia, camaraDeArranque, camaraDeLaZona, camaraDelCroquis, capasDeLaZona, carrosDeLaZona, croquisDeEstaZona, croquisDeLaZona, leyendaDeLaZona, luzDelSol } from './zona-3d.js';
import { montarEscena360 } from './pantalla-escena-360.js';
import { montarZonaGoogle } from './pantalla-zona-google.js';
import { montarRecreacion } from './pantalla-recreacion.js';
import { CLAVE_DE_GOOGLE } from './clave-de-google.js';

const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';
const RELIEVE = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
const FUENTE = ['Noto Sans Bold'];

// Lo que dicen los dos párrafos del final con el 3D de Google. Los de la maqueta abierta están en
// zona-3d.html y vuelven si Google falla.
const TEXTOS_DE_GOOGLE = {
  nota: 'El 3D es de Google: lo arma con fotos aéreas de otra fecha, que pueden tener años, y en ese tiempo se repinta una línea o se quita una señal. No es una foto del día del choque. Los carros, a su tamaño y del color de su letra, salen del croquis: son lo que se declaró, no una medición. Lo que pasó lo cuentan las fotos de la escena y el croquis. La app no decide quién tuvo la culpa.',
  fuente: 'Para dibujarla, este punto y la zona se piden a Google (el 3D), a los mosaicos de relieve de AWS (la altura del suelo, para apuntar la cámara) y, si no es el ejemplo, a Overpass (OpenStreetMap). Nada más sale del teléfono.',
};

const $ = (selector) => document.querySelector(selector);

// Si el 3D de Google falló, el porqué va delante de cualquier otro aviso: si no, el siguiente aviso
// lo borraba y la persona veía la maqueta sin saber que debía ser otra cosa.
let motivoDelRespaldo = '';
// Si el teléfono soltó el dibujo del mapa, eso manda sobre cualquier aviso que llegue después: el
// análisis que llegaba tarde lo cambiaba por «Lista. Arrastra para moverte» con el mapa muerto
// (revisión del 14-nov).
let dibujoPerdido = '';
function avisar(texto, esError = false) {
  const p = $('#zona-estado');
  p.textContent = [motivoDelRespaldo, dibujoPerdido || texto].filter(Boolean).join(' ');
  p.classList.toggle('error', esError || !!motivoDelRespaldo || !!dibujoPerdido);
}

function leerDireccion() {
  const q = new URLSearchParams(location.search);
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  if (!q.has('lat') || !q.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const fecha = new Date(q.get('t') || Date.now());
  return {
    centro: { lat, lon },
    fecha: Number.isNaN(fecha.getTime()) ? new Date() : fecha,
    precision: Number(q.get('p')) > 0 ? Number(q.get('p')) : null,
    ejemplo: q.get('ejemplo') === '1',
  };
}

async function analisisDeLaVia(centro, ejemplo) {
  try {
    if (ejemplo) {
      const guardado = await consultarJson('datos/ejemplo-verjones-patios.json', { limiteMs: 8000 });
      return analizarVia(guardado.respuesta, centro);
    }
    return analizarVia(await consultarOverpass(consultaDeLaVia(centro)), centro);
  } catch (error) {
    return { estado: 'error', error: error.message };
  }
}

// La línea de cada carro (paso 5), por letra: el 3D de Google dibuja cada uno con su carrocería.
const lineasDeLosCarros = (carros) => Object.fromEntries((Array.isArray(carros) ? carros : []).filter((c) => c?.letra && c.linea).map((c) => [c.letra, c.linea]));

// Del reporte de este teléfono: las fotos ({ id, registro, miniatura } y, solo
// las de la escena, también `archivo`, la grande, que va en el círculo del
// 360°), el croquis y la línea de cada carro. Se cargan antes de cerrar la base:
// iOS la cierra sola en segundo plano.
async function delReporte() {
  try {
    const base = await abrirBaseDelReporte();
    try {
      const reporte = await base.reporteEnCurso();
      const fotos = await base.fotos(reporte.id);
      for (const f of fotos) if (f.registro.paso === 'escena') f.archivo = await base.foto(f.id);
      return { fotos, croquis: reporte.croquis || null, lineas: lineasDeLosCarros(reporte.carros), danos: Array.isArray(reporte.danos) ? reporte.danos : [] };
    } finally {
      base.cerrar();
    }
  } catch {
    return { fotos: [], croquis: null, lineas: {}, danos: [] };
  }
}

function pintarLeyenda(filas) {
  $('#leyenda').replaceChildren(
    ...filas.map((f) => {
      const li = document.createElement('li');
      const muestra = document.createElement('span');
      muestra.className = 'muestra' + (f.color ? '' : ' sin-muestra');
      if (f.color) muestra.style.background = f.color;
      const texto = document.createElement('span');
      texto.textContent = f.texto;
      if (!f.color) texto.className = 'falta';
      li.append(muestra, texto);
      return li;
    }),
  );
}

// Un ancho en metros como ancho de línea de MapLibre, que va en píxeles: en teselas de 512 un píxel
// mide 78.271,5 × cos(latitud) / 2^zoom metros, y entre dos zooms crece en base 2, así que con dos
// paradas exponenciales queda exacto en cualquier zoom.
function metrosEnPixeles(metros, lat) {
  const px = (zoom) => metros / ((78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom);
  return ['interpolate', ['exponential', 2], ['zoom'], 14, px(14), 22, px(22)];
}

// El tramo analizado se dibuja como la vía: asfalto del ancho que le da el mapa (anchoDeLaVia) con
// sus dos bordes en verde, el color del tramo en la leyenda. Hasta el 14-nov era una raya verde de
// 10 px encima de la calle del mapa. Sin líneas pintadas en el medio, a propósito: el mapa no sabe si
// la del día era doble o punteada (sale en las fotos), y dibujarla sería afirmar si se podía adelantar.
function pintarElTramo(mapa, ancho, lat) {
  mapa.setPaintProperty('choque-asfalto', 'line-width', metrosEnPixeles(ancho, lat));
  mapa.setPaintProperty('choque-tramo', 'line-gap-width', metrosEnPixeles(ancho, lat));
}

function ponerCapas(mapa, capas, { conCroquis = false, lat = 0 } = {}) {
  for (const [nombre, datos] of Object.entries(capas)) mapa.addSource('choque-' + nombre, { type: 'geojson', data: datos });
  mapa.addLayer({ id: 'choque-precision', type: 'fill', source: 'choque-precision', paint: { 'fill-color': COLORES.precision, 'fill-opacity': 0.12 } });
  mapa.addLayer({ id: 'choque-precision-borde', type: 'line', source: 'choque-precision', paint: { 'line-color': COLORES.precision, 'line-width': 2, 'line-dasharray': [2, 2] } });
  mapa.addLayer({ id: 'choque-asfalto', type: 'line', source: 'choque-tramo', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#5b6067', 'line-width': metrosEnPixeles(anchoDeLaVia(null), lat) } });
  mapa.addLayer({ id: 'choque-tramo', type: 'line', source: 'choque-tramo', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': COLORES.tramo, 'line-width': 2.5, 'line-gap-width': metrosEnPixeles(anchoDeLaVia(null), lat) } });
  mapa.addLayer({ id: 'choque-conos', type: 'fill', source: 'choque-conos', paint: { 'fill-color': COLORES.conos, 'fill-opacity': 0.25, 'fill-outline-color': COLORES.conos } });
  mapa.addLayer({ id: 'choque-trayectorias', type: 'line', source: 'choque-trayectorias', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [1.5, 1.5] } });
  mapa.addLayer({ id: 'choque-carros', type: 'fill-extrusion', source: 'choque-carros', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'altura'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.95 } });
  mapa.addLayer({ id: 'choque-sol', type: 'line', source: 'choque-sol', layout: { 'line-cap': 'round' }, paint: { 'line-color': COLORES.sol, 'line-width': 5 } });
  mapa.addLayer({ id: 'choque-sol-texto', type: 'symbol', source: 'choque-sol', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'texto'], 'text-font': FUENTE, 'text-size': 13 }, paint: { 'text-color': '#633806', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  mapa.addLayer({ id: 'choque-senales', type: 'circle', source: 'choque-senales', paint: { 'circle-radius': 7, 'circle-color': COLORES.senales, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
  mapa.addLayer({ id: 'choque-punto', type: 'circle', source: 'choque-punto', paint: { 'circle-radius': 9, 'circle-color': COLORES.punto, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  // Con croquis, el letrero «Choque» caía encima del carro A (medido el 13-nov en el ejemplo): el
  // punto se queda, la leyenda dice qué es, y el letrero se apaga.
  mapa.addLayer({ id: 'choque-punto-texto', type: 'symbol', source: 'choque-punto', layout: { 'text-field': ['get', 'texto'], 'text-font': FUENTE, 'text-size': 14, 'text-offset': [0, 1.5], 'text-allow-overlap': true, visibility: conCroquis ? 'none' : 'visible' }, paint: { 'text-color': '#7a1a10', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  // El golpe del croquis: más chico y más oscuro que el punto del choque, que es el pin del paso 3.
  // Va encima del punto: los dos suelen caer casi en el mismo sitio y el punto lo tapaba.
  mapa.addLayer({ id: 'choque-golpe', type: 'circle', source: 'choque-golpe', paint: { 'circle-radius': 6, 'circle-color': '#7a1a10', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
  mapa.addLayer({ id: 'choque-carros-nombre', type: 'symbol', source: 'choque-nombresDeCarros', layout: { 'text-field': ['get', 'nombre'], 'text-font': FUENTE, 'text-size': 16, 'text-offset': [0, -1.4], 'text-allow-overlap': true }, paint: { 'text-color': '#14181d', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
}

// La maqueta abierta. Devuelve el motor (los mismos botones que el 3D de Google) o null si este
// teléfono no puede dibujarla, y entonces ya lo dijo.
function montarMaqueta({ centro, sol, croquis, camaraDe, capasCon, alCargar }) {
  if (!globalThis.maplibregl) {
    avisar('El motor del mapa 3D no cargó. Recarga la página.', true);
    return null;
  }
  let camara = camaraDe(null);
  let mapa;
  try {
    // Arranca desde arriba y entra al 3D cuando el relieve ya llegó: con la cámara inclinada
    // desde el principio, el mapa salía gris (ver camaraDeArranque).
    // `antialias`: suaviza los bordes de los carros 3D de la recreación, que en una pantalla de
    // computador salían en escalera. En las pantallas de 3 píxeles por punto (los iPhone) no se nota
    // la escalera y sí el costo, que es nueve veces más píxeles: ahí va apagado.
    mapa = new maplibregl.Map({ container: 'mapa-3d', style: ESTILO, ...camaraDeArranque(centro), maxPitch: 75, attributionControl: { compact: true }, antialias: (globalThis.devicePixelRatio || 1) < 2.5 });
  } catch {
    // Sin WebGL, MapLibre no arranca: se dice, no se deja la caja en blanco.
    avisar('Este teléfono no puede dibujar mapas en 3D (le falta WebGL). La leyenda y la escena en 360° siguen sirviendo.', true);
    return null;
  }
  mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  mapa.on('error', (e) => {
    // Una tesela que no llega no tumba el mapa; solo se cuenta si no hay nada.
    if (!mapa.loaded()) console.warn('Mapa 3D:', e?.error?.message);
  });
  // El estilo de OpenFreeMap nombra iconos que su hoja no trae (treinta en el ejemplo, medido el
  // 14-nov: «office», «gate», «atm»…). MapLibre avisa en la consola por cada uno y lo repite con
  // cada tesela. Un icono vacío de 1 px lo calla sin dibujar nada que no estuviera.
  mapa.on('styleimagemissing', (e) => {
    if (!mapa.hasImage(e.id)) mapa.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  // Safari suelta el dibujo del mapa (el contexto WebGL) al volver de otra app o con poca memoria, y
  // MapLibre 4.7 no lo rehace entero al devolverlo: el relieve y los carros quedan colgados del dibujo
  // viejo. No se puede arreglar en caliente; sí decirlo, en vez de dejar un mapa quieto o en blanco.
  mapa.on('webglcontextlost', () => {
    dibujoPerdido = 'El teléfono soltó el dibujo del mapa 3D (pasa al volver de otra app o con poca memoria). Recarga la página para volverlo a ver; el reporte no se pierde.';
    avisar('', true);
  });

  // Si la persona ya movió el mapa, el análisis no le cambia la vista.
  let tocado = false;
  let giro = null;
  const detenerGiro = () => {
    if (giro) cancelAnimationFrame(giro);
    giro = null;
    $('#dar-vuelta').setAttribute('aria-pressed', 'false');
  };
  for (const evento of ['mousedown', 'touchstart', 'wheel']) {
    mapa.on(evento, () => {
      tocado = true;
      detenerGiro();
    });
  }

  let cargado = false;
  let pendiente = null;
  let enTresD = false;
  const aplicar = (analisis) => {
    const capas = capasCon(analisis);
    for (const [nombre, datosDeLaCapa] of Object.entries(capas)) mapa.getSource('choque-' + nombre).setData(datosDeLaCapa);
    if (analisis?.estado === 'ok') pintarElTramo(mapa, anchoDeLaVia(analisis.carriles), centro.lat);
    // El croquis inventado del ejemplo llega con el análisis: su golpe cae junto al letrero
    // «Choque (ejemplo)», que tapaba al carro A. Con golpe, el letrero se apaga, como con un croquis.
    if (capas.golpe.features.length) mapa.setLayoutProperty('choque-punto-texto', 'visibility', 'none');
    camara = camaraDe(analisis);
    // La cámara entera, no solo el rumbo: si la entrada al 3D va a medio camino, un easeTo de
    // solo el rumbo la cortaría y dejaría el mapa a media inclinación.
    if (!tocado && enTresD) mapa.easeTo({ ...camara, duration: 1500 });
  };

  mapa.on('load', () => {
    // Hasta z14, el tope de las teselas de OpenFreeMap: con el relieve hasta z15, de zoom 15 para
    // arriba MapLibre 4.7 no sabía colgar las teselas de calles sobre el relieve («cannot calculate
    // elevation if elevation maxzoom > source.maxzoom», medido el 14-nov con la recreación de cerca).
    // Debajo hay datos de unos 30 m: z14 (unos 9,5 m por píxel) no pierde nada.
    mapa.addSource('relieve', { type: 'raster-dem', tiles: [RELIEVE], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Relieve: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles (Mapzen, AWS)</a>' });
    // Exageración 1: el relieve como es. Una pendiente aumentada sería mentir sobre la vía.
    mapa.setTerrain({ source: 'relieve', exaggeration: 1 });
    // Sin sombreado, el relieve en 3D se ve plano desde arriba (se comprobó el
    // 13-nov): la sombra de las laderas deja ver dónde sube y baja la vía. Va
    // con su propia fuente, como recomienda MapLibre, y debajo de las vías y
    // los nombres. La luz del sombreado es la de siempre (del noroeste), no la
    // del sol: no son sombras de esa hora.
    mapa.addSource('relieve-sombra', { type: 'raster-dem', tiles: [RELIEVE], encoding: 'terrarium', tileSize: 256, maxzoom: 14 });
    const debajoDe = mapa.getStyle().layers.find((capa) => capa.type === 'line' || capa.type === 'symbol')?.id;
    mapa.addLayer({ id: 'relieve-sombra', type: 'hillshade', source: 'relieve-sombra', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#4a4a4a' } }, debajoDe);
    mapa.setLight(luzDelSol(sol));
    // El cielo: sin él, con la cámara inclinada el horizonte era un corte gris. La neblina del
    // horizonte esconde dónde se acaban las teselas.
    mapa.setSky({ 'sky-color': '#9cc4e8', 'horizon-color': '#e3edf5', 'fog-color': '#eef2f5', 'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.6 });
    ponerCapas(mapa, capasCon(null), { conCroquis: !!croquis, lat: centro.lat });

    // El primer "quieto" del mapa después de encender el relieve es cuando ya llegaron sus
    // teselas: ahí se entra al 3D. Se lee `camara` en ese momento, así que si el análisis llegó
    // antes, ya entra mirando a lo largo de la vía.
    mapa.once('idle', () => {
      enTresD = true;
      if (!tocado) mapa.easeTo({ ...camara, duration: 1800 });
    });
    cargado = true;
    if (pendiente) aplicar(pendiente);
    alCargar?.();
  });

  return {
    nombre: 'abierto',
    mapa,
    get cargado() {
      return cargado;
    },
    // Las capas no se pueden tocar antes del 'load': si el análisis llega antes, espera.
    conAnalisis(analisis) {
      if (cargado) aplicar(analisis);
      else pendiente = analisis;
    },
    // La recreación tomó la cámara: cuenta como si la persona la hubiera movido. El análisis que
    // llegue después no se la quita, y la vuelta deja de girar (las dos movían la cámara a la vez).
    tocar() {
      tocado = true;
      detenerGiro();
    },
    vista3d() {
      detenerGiro();
      mapa.easeTo({ center: camara.center, zoom: camara.zoom, pitch: camara.pitch, bearing: camara.bearing, duration: 1200 });
    },
    desdeArriba() {
      detenerGiro();
      mapa.easeTo({ center: camara.center, zoom: camara.zoom + 0.4, pitch: 0, bearing: 0, duration: 1200 });
    },
    darLaVuelta() {
      if (giro) return detenerGiro();
      $('#dar-vuelta').setAttribute('aria-pressed', 'true');
      const inicio = performance.now();
      const desde = mapa.getBearing();
      const paso = (ahora) => {
        const avance = (ahora - inicio) / 16000;
        if (avance >= 1) return detenerGiro();
        mapa.setBearing(desde + 360 * avance);
        giro = requestAnimationFrame(paso);
      };
      giro = requestAnimationFrame(paso);
    },
  };
}

async function iniciar() {
  const datos = leerDireccion();
  if (!datos) {
    avisar('Falta el punto del choque. Abre la zona en 3D desde «¿Dónde fue el choque?».', true);
    return;
  }
  const { centro, fecha, precision, ejemplo } = datos;
  const sol = posicionDelSol(fecha, centro.lat, centro.lon);
  const bienvenida = ejemplo ? 'Ejemplo: una curva real de la vía Los Verjones–Patios, con un choque inventado.' : 'Armando la zona; el análisis de la vía llega en unos segundos.';
  avisar(bienvenida);
  const promesaDelAnalisis = analisisDeLaVia(centro, ejemplo);

  // Las fotos y el croquis son de este teléfono: llegan rápido. El ejemplo es
  // un choque inventado: las fotos de un reporte de verdad no se le pegan. El
  // croquis sí, si se hizo sobre el ejemplo (croquisDeEstaZona); y con él, la
  // línea de cada carro, que en el ejemplo sin croquis no es de nadie.
  const delTelefono = await delReporte();
  const fotosDelChoque = ejemplo ? [] : delTelefono.fotos;
  const croquis = croquisDeEstaZona(delTelefono.croquis, centro, ejemplo);
  const lineas = croquis ? delTelefono.lineas : {};
  // Las piezas que se encienden en el golpe de la recreación, cada una con el color de su daño: las
  // del paso 6 de este reporte si el croquis es suyo; las inventadas si es el croquis del ejemplo.
  const danos = croquis ? delTelefono.danos : ejemplo ? DANOS_DEL_EJEMPLO : [];
  const fotos = fotosDelChoque.map((f) => f.registro);
  let analisis = { estado: 'cargando' };
  pintarLeyenda(leyendaDeLaZona({ ejemplo, analisis, fotos, sol, croquis }));
  // El 360° no necesita WebGL ni el análisis: sale ya.
  const escena360 = montarEscena360($('#escena-360'), fotosDelChoque, { ejemplo });
  addEventListener('pagehide', () => escena360?.cerrar());

  // Con croquis, la cámara se acerca al golpe: a la distancia de la zona sus carros eran una mota. El
  // del ejemplo también, en cuanto llega el análisis que lo arma.
  const camaraDe = (deLaVia) => {
    const delCroquis = croquisDeLaZona({ croquis, ejemplo, analisis: deLaVia });
    return delCroquis ? camaraDelCroquis(centro, deLaVia, delCroquis) : camaraDeLaZona(centro, deLaVia);
  };
  const capasCon = (deLaVia) => capasDeLaZona({ centro, precision, analisis: deLaVia, sol, ejemplo, fotos, croquis });
  const carrosCon = (deLaVia) => carrosDeLaZona({ croquis, ejemplo, analisis: deLaVia });

  let motor = null;
  // La recreación va en la maqueta abierta cuando hay croquis (el del teléfono o el del ejemplo, que
  // espera al análisis) y el mapa ya cargó: lo que llegue de último la monta.
  // Se intenta UNA vez, cuando ya hay croquis y mapa. Si este teléfono no pudo dibujar los carros, un
  // segundo intento (al llegar el análisis) apagaba las cajas y no dibujaba ningún carro (revisión
  // del 14-nov); y el croquis del teléfono no cambia con el análisis, así que no hay nada que ganar.
  let recreacion = null;
  let intentado = false;
  const intentarRecrear = async () => {
    if (intentado || motor?.nombre !== 'abierto' || !motor.cargado) return;
    const delCroquis = croquisDeLaZona({ croquis, ejemplo, analisis });
    if (!delCroquis) return;
    intentado = true;
    try {
      recreacion = await montarRecreacion({ mapa: motor.mapa, croquis: delCroquis, sol, lineas, danos, ejemplo: !croquis && ejemplo, camaraGeneral: () => camaraDe(analisis), alTomarLaCamara: () => motor.tocar() });
    } catch (error) {
      // Lo que no se esperaba no tumba la zona: quedan el mapa, las cajas y la escena en 360°.
      console.warn('Recreación:', error?.message ?? error);
    }
  };
  // Los botones de la zona mueven la cámara: primero dejan de seguir a un carro de la recreación.
  $('#vista-3d').addEventListener('click', () => {
    recreacion?.soltar();
    motor?.vista3d();
  });
  $('#vista-arriba').addEventListener('click', () => {
    recreacion?.soltar();
    motor?.desdeArriba();
  });
  $('#dar-vuelta').addEventListener('click', () => {
    recreacion?.soltar();
    motor?.darLaVuelta();
  });

  const textosAbiertos = { nota: $('#zona-nota').textContent, fuente: $('#zona-fuente').textContent };
  const ponerTextos = (t) => {
    $('#zona-nota').textContent = t.nota;
    $('#zona-fuente').textContent = t.fuente;
  };
  const yaLlegoElAnalisis = () => analisis.estado !== 'cargando';
  const abrirMaqueta = () => {
    ponerTextos(textosAbiertos);
    motor = montarMaqueta({ centro, sol, croquis, camaraDe, capasCon, alCargar: () => intentarRecrear() });
    if (motor && yaLlegoElAnalisis()) motor.conAnalisis(analisis);
  };

  if (CLAVE_DE_GOOGLE) {
    ponerTextos(TEXTOS_DE_GOOGLE);
    avisar(`${bienvenida} El 3D es de Google, con fotos de otra fecha: no es del día del choque.`);
    const deGoogle = await montarZonaGoogle($('#mapa-3d'), {
      clave: CLAVE_DE_GOOGLE,
      centro,
      camaraDeLaMaqueta: camaraDe(null),
      capas: capasCon(null),
      carros: carrosCon(null),
      lineas,
      // Puede llegar en cualquier momento, también con el 3D de Google ya dibujado.
      alFallar: (motivo) => {
        motivoDelRespaldo = `${motivo} Esta es la maqueta abierta.`;
        avisar('');
        abrirMaqueta();
      },
    });
    if (deGoogle && !deGoogle.caido) {
      deGoogle.conAnalisis = (a) => deGoogle.actualizar({ camaraDeLaMaqueta: camaraDe(a), capas: capasCon(a), carros: carrosCon(a) });
      motor = deGoogle;
      if (yaLlegoElAnalisis()) motor.conAnalisis(analisis);
    }
  } else {
    abrirMaqueta();
  }

  promesaDelAnalisis.then((llegado) => {
    analisis = llegado;
    pintarLeyenda(leyendaDeLaZona({ ejemplo, analisis, fotos, sol, croquis }));
    motor?.conAnalisis(analisis);
    intentarRecrear();
    // Con el 3D de Google, el aviso de junto al mapa sigue diciendo que sus fotos no son del día.
    const deGoogle = motor?.nombre === 'google';
    const queSale = deGoogle ? 'El 3D' : 'La maqueta';
    if (analisis.estado === 'error') avisar(`${analisis.error} ${queSale} y la escena salen igual, sin el tramo analizado.`, true);
    else if (!ejemplo) avisar(`Lista.${deGoogle ? ' El 3D es de Google, con fotos de otra fecha: no es del día del choque.' : ''} Arrastra para moverte; con dos dedos giras e inclinas.`);
  });

  globalThis.__zona3d = {
    get motor() {
      return motor?.nombre ?? null;
    },
    get mapa() {
      return motor?.mapa ?? null;
    },
    get google() {
      return motor?.nombre === 'google' ? motor : null;
    },
    get recreacion() {
      return recreacion;
    },
    analisis: () => analisis,
    fotos,
    sol,
    escena360,
  };
}

iniciar();
