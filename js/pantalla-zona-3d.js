// La página de la zona en 3D (zona-3d.html), sobre MapLibre 4.7.1 (BSD,
// copiado en js/vendor/maplibre, sin CDN). La lógica pura está en zona-3d.js.
//
// Se abre desde "¿Dónde fue?" con el punto en la dirección:
//   zona-3d.html?lat=4.648400&lon=-74.010500&t=<ISO>&p=<precisión m>&ejemplo=1
// Fuentes, todas sin clave ni tarjeta (Joan eligió esta opción el 13-nov-2026):
//  - Calles y edificios: el estilo "liberty" de OpenFreeMap (datos de
//    OpenStreetMap), que ya trae los edificios levantados en 3D.
//  - Relieve: los mosaicos "terrarium" de AWS (Terrain Tiles, de Mapzen).
//  - La vía: el mismo análisis de "¿Dónde fue?" (via.js). El ejemplo usa la
//    respuesta guardada, para que no falle; un punto real se consulta en vivo.
// Las fotos de la escena se leen de este teléfono (reporte-bd.js): si el
// reporte se hizo en otro, aquí no aparecen, y la leyenda lo dice.
//
// NADA espera al análisis de la vía (13-nov-2026): con los servidores públicos
// lentos tardaba hasta 75 s y la página se quedaba en blanco, sin 360° ni mapa.
// El mapa y el 360° salen de una vez; el tramo, las señales y la cámara a lo
// largo de la vía se agregan cuando llega el análisis.
import { analizarVia, consultaDeLaVia } from './via.js';
import { consultarJson, consultarOverpass } from './servicios.js';
import { posicionDelSol } from './sol.js';
import { abrirBaseDelReporte } from './reporte-bd.js';
import { COLORES, camaraDeLaZona, capasDeLaZona, leyendaDeLaZona, luzDelSol } from './zona-3d.js';
import { montarEscena360 } from './pantalla-escena-360.js';

const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';
const RELIEVE = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
const FUENTE = ['Noto Sans Bold'];

const $ = (selector) => document.querySelector(selector);

function avisar(texto, esError = false) {
  const p = $('#zona-estado');
  p.textContent = texto;
  p.classList.toggle('error', esError);
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

// Las fotos del reporte de este teléfono: { id, registro, miniatura } y, solo
// las de la escena, también `archivo` (la grande), que va en el círculo del
// 360°. Se cargan antes de cerrar la base: iOS la cierra sola en segundo plano.
async function fotosDelReporte() {
  try {
    const base = await abrirBaseDelReporte();
    try {
      const reporte = await base.reporteEnCurso();
      const fotos = await base.fotos(reporte.id);
      for (const f of fotos) if (f.registro.paso === 'escena') f.archivo = await base.foto(f.id);
      return fotos;
    } finally {
      base.cerrar();
    }
  } catch {
    return [];
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

function ponerCapas(mapa, capas) {
  for (const [nombre, datos] of Object.entries(capas)) mapa.addSource('choque-' + nombre, { type: 'geojson', data: datos });
  mapa.addLayer({ id: 'choque-precision', type: 'fill', source: 'choque-precision', paint: { 'fill-color': COLORES.precision, 'fill-opacity': 0.12 } });
  mapa.addLayer({ id: 'choque-precision-borde', type: 'line', source: 'choque-precision', paint: { 'line-color': COLORES.precision, 'line-width': 2, 'line-dasharray': [2, 2] } });
  mapa.addLayer({ id: 'choque-tramo', type: 'line', source: 'choque-tramo', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLORES.tramo, 'line-width': 10, 'line-opacity': 0.6 } });
  mapa.addLayer({ id: 'choque-conos', type: 'fill', source: 'choque-conos', paint: { 'fill-color': COLORES.conos, 'fill-opacity': 0.25, 'fill-outline-color': COLORES.conos } });
  mapa.addLayer({ id: 'choque-trayectorias', type: 'line', source: 'choque-trayectorias', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [1.5, 1.5] } });
  mapa.addLayer({ id: 'choque-carros', type: 'fill-extrusion', source: 'choque-carros', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'altura'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.95 } });
  mapa.addLayer({ id: 'choque-sol', type: 'line', source: 'choque-sol', layout: { 'line-cap': 'round' }, paint: { 'line-color': COLORES.sol, 'line-width': 5 } });
  mapa.addLayer({ id: 'choque-sol-texto', type: 'symbol', source: 'choque-sol', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'texto'], 'text-font': FUENTE, 'text-size': 13 }, paint: { 'text-color': '#633806', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  mapa.addLayer({ id: 'choque-senales', type: 'circle', source: 'choque-senales', paint: { 'circle-radius': 7, 'circle-color': COLORES.senales, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
  mapa.addLayer({ id: 'choque-carros-nombre', type: 'symbol', source: 'choque-nombresDeCarros', layout: { 'text-field': ['get', 'nombre'], 'text-font': FUENTE, 'text-size': 16, 'text-offset': [0, -1.4], 'text-allow-overlap': true }, paint: { 'text-color': '#14181d', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  mapa.addLayer({ id: 'choque-punto', type: 'circle', source: 'choque-punto', paint: { 'circle-radius': 9, 'circle-color': COLORES.punto, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  mapa.addLayer({ id: 'choque-punto-texto', type: 'symbol', source: 'choque-punto', layout: { 'text-field': ['get', 'texto'], 'text-font': FUENTE, 'text-size': 14, 'text-offset': [0, 1.5], 'text-allow-overlap': true }, paint: { 'text-color': '#7a1a10', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
}

async function iniciar() {
  const datos = leerDireccion();
  if (!datos) {
    avisar('Falta el punto del choque. Abre la zona en 3D desde «¿Dónde fue el choque?».', true);
    return;
  }
  const { centro, fecha, precision, ejemplo } = datos;
  const sol = posicionDelSol(fecha, centro.lat, centro.lon);
  avisar(ejemplo ? 'Ejemplo: una curva real de la vía Los Verjones–Patios, con un choque inventado.' : 'Armando la zona; el análisis de la vía llega en unos segundos.');
  const promesaDelAnalisis = analisisDeLaVia(centro, ejemplo);

  // Las fotos son de este teléfono: llegan rápido. El ejemplo es un choque
  // inventado: las fotos de un reporte de verdad no se le pegan.
  const fotosDelTelefono = await fotosDelReporte();
  const fotosDelChoque = ejemplo ? [] : fotosDelTelefono;
  const fotos = fotosDelChoque.map((f) => f.registro);
  let analisis = { estado: 'cargando' };
  pintarLeyenda(leyendaDeLaZona({ ejemplo, analisis, fotos, sol }));
  // El 360° no necesita WebGL ni el análisis: sale ya.
  const escena360 = montarEscena360($('#escena-360'), fotosDelChoque, { ejemplo });
  addEventListener('pagehide', () => escena360?.cerrar());

  if (!globalThis.maplibregl) {
    avisar('El motor del mapa 3D no cargó. Recarga la página.', true);
    return;
  }
  let camara = camaraDeLaZona(centro, null);
  let mapa;
  try {
    mapa = new maplibregl.Map({ container: 'mapa-3d', style: ESTILO, ...camara, maxPitch: 75, attributionControl: { compact: true } });
  } catch {
    // Sin WebGL, MapLibre no arranca: se dice, no se deja la caja en blanco.
    avisar('Este teléfono no puede dibujar mapas en 3D (le falta WebGL). La leyenda y la escena en 360° siguen sirviendo.', true);
    return;
  }
  mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  mapa.on('error', (e) => {
    // Una tesela que no llega no tumba el mapa; solo se cuenta si no hay nada.
    if (!mapa.loaded()) console.warn('Mapa 3D:', e?.error?.message);
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

  mapa.on('load', async () => {
    mapa.addSource('relieve', { type: 'raster-dem', tiles: [RELIEVE], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: 'Relieve: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles (Mapzen, AWS)</a>' });
    // Exageración 1: el relieve como es. Una pendiente aumentada sería mentir sobre la vía.
    mapa.setTerrain({ source: 'relieve', exaggeration: 1 });
    // Sin sombreado, el relieve en 3D se ve plano desde arriba (se comprobó el
    // 13-nov): la sombra de las laderas deja ver dónde sube y baja la vía. Va
    // con su propia fuente, como recomienda MapLibre, y debajo de las vías y
    // los nombres. La luz del sombreado es la de siempre (del noroeste), no la
    // del sol: no son sombras de esa hora.
    mapa.addSource('relieve-sombra', { type: 'raster-dem', tiles: [RELIEVE], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
    const debajoDe = mapa.getStyle().layers.find((capa) => capa.type === 'line' || capa.type === 'symbol')?.id;
    mapa.addLayer({ id: 'relieve-sombra', type: 'hillshade', source: 'relieve-sombra', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#4a4a4a' } }, debajoDe);
    mapa.setLight(luzDelSol(sol));
    ponerCapas(mapa, capasDeLaZona({ centro, precision, analisis: null, sol, ejemplo, fotos }));

    analisis = await promesaDelAnalisis;
    for (const [nombre, datosDeLaCapa] of Object.entries(capasDeLaZona({ centro, precision, analisis, sol, ejemplo, fotos }))) mapa.getSource('choque-' + nombre).setData(datosDeLaCapa);
    pintarLeyenda(leyendaDeLaZona({ ejemplo, analisis, fotos, sol }));
    camara = camaraDeLaZona(centro, analisis);
    if (!tocado) mapa.easeTo({ bearing: camara.bearing, duration: 1500 });
    if (analisis.estado === 'error') avisar(`${analisis.error} La maqueta y la escena salen igual, sin el tramo analizado.`, true);
    else if (!ejemplo) avisar('Lista. Arrastra para moverte; con dos dedos giras e inclinas.');
  });

  $('#vista-3d').addEventListener('click', () => {
    detenerGiro();
    mapa.easeTo({ center: camara.center, zoom: camara.zoom, pitch: camara.pitch, bearing: camara.bearing, duration: 1200 });
  });
  $('#vista-arriba').addEventListener('click', () => {
    detenerGiro();
    mapa.easeTo({ center: camara.center, zoom: camara.zoom + 0.4, pitch: 0, bearing: 0, duration: 1200 });
  });
  $('#dar-vuelta').addEventListener('click', () => {
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
  });
  globalThis.__zona3d = { mapa, analisis: () => analisis, fotos, sol, escena360 };
}

iniciar();
