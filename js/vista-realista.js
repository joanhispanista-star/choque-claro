// La vista realista de la zona en 3D: el mismo lugar de la maqueta abierta, vestido. La pidió Joan el
// mar 24-nov-2026 («que mejores los escenarios y el mapa con imágenes IA para que se vea más realista»).
// Es un botón, y se puede apagar: la maqueta neutra de siempre sigue debajo.
//
// Qué es de verdad y qué no, que es lo único que le importa a un abogado:
//  - Dónde está cada casa, su planta y su altura: OpenStreetMap, lo mismo de la maqueta.
//  - El piso y los techos, en Bogotá: la foto aérea de 2017 del Catastro y la FAC (CC BY 4.0). En un
//    reporte va la foto con el color corregido, sin IA. En el EJEMPLO (que es inventado) va aclarada con
//    IA, y la pantalla lo dice: lo fino puede no ser exacto.
//  - Fuera de Bogotá no hay foto abierta: el piso es el del mapa y los techos son genéricos.
//  - Las fachadas, los árboles y el cielo: imágenes genéricas hechas con IA. No muestran cómo es el lugar.
//    Los árboles, además, solo salen en el ejemplo: en un reporte de verdad, un árbol inventado en la
//    esquina diría que tapaba la vista.
// Por eso en el ejemplo se enciende sola y en un reporte arranca apagada, y siempre lleva su sello encima
// del mapa: un pantallazo no puede salir sin él. Nada de esto entra al expediente en PDF.
//
// Apagarla deja el mapa exactamente como estaba: todo lo que cambia se anota antes de cambiarlo.
import { planoLocal } from './geo.js';
import { EJEMPLO, esElLugarDelEjemplo } from './ejemplo.js';
import { CREDITO_DE_LA_FOTO, dentroDeLaFoto, fotosDeBogota, pisoDeTeselas } from './foto-aerea.js';
import { registrarPiso } from './piso-realista.js';

const HOJAS = 'img/realista/';
const ARCHIVO_DE_LA_CIUDAD = 'datos/ejemplo-teusaquillo-ciudad.json';
// Medio lado de cada foto del piso del ejemplo, en metros del plano de la app (geo.js), de la más nítida a
// la más amplia. Son 50, 200 y 1.000 m de los de Web Mercator, que toma una Tierra un 0,11 % más grande.
const MEDIOS_DEL_EJEMPLO = [49.944, 199.776, 998.88];
// Hasta dónde se visten las casas. Más allá, la foto y la neblina.
export const RADIO_DE_LAS_CASAS = 430;
const MAXIMO_DE_CASAS = 1400;
// Qué parte del lado de una foto de Bogotá se difumina, para que no se note dónde empieza.
const PLUMA = 0.07;

// Las casas de los rasgos del mapa (polígonos y montones de polígonos, en grados), en metros alrededor
// del punto: sin repetidas (una casa en el borde de dos teselas sale dos veces) y solo las cercanas.
export function casasDeLosRasgos(rasgos, plano, radio = RADIO_DE_LAS_CASAS, maximo = MAXIMO_DE_CASAS) {
  const casas = [];
  const vistas = new Set();
  for (const r of rasgos ?? []) {
    const g = r?.geometry;
    if (g?.type !== 'Polygon' && g?.type !== 'MultiPolygon') continue;
    for (const poligono of g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) {
      const a = (poligono[0] ?? []).map(([lon, lat]) => {
        const p = plano.aMetros({ lat, lon });
        return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
      });
      if (a.length < 4) continue;
      const cx = a.reduce((s, p) => s + p[0], 0) / a.length;
      const cy = a.reduce((s, p) => s + p[1], 0) / a.length;
      const d = Math.hypot(cx, cy);
      if (d > radio) continue;
      const llave = `${Math.round(cx * 2)}|${Math.round(cy * 2)}|${a.length}`;
      if (vistas.has(llave)) continue;
      vistas.add(llave);
      casas.push({ h: Number(r.properties?.render_height) || 0, a, d });
    }
  }
  return casas
    .sort((u, v) => u.d - v.d)
    .slice(0, maximo)
    .map(({ h, a }) => ({ h, a }));
}

// Qué dice la pantalla con la vista encendida: el sello de encima del mapa, la frase de debajo del botón
// y el párrafo del final. `tipo`: 'ejemplo'; 'bogota' (con la foto aérea); 'mapa' (donde no hay foto
// abierta) o 'sin-foto' (la hay, pero no llegó).
export function textosDeLaVista(tipo) {
  const ejemplo = tipo === 'ejemplo';
  const inventado = ejemplo
    ? ['Fachadas, árboles y cielo', 'Las fachadas, los árboles y el cielo']
    : tipo === 'bogota'
      ? ['Fachadas y cielo', 'Las fachadas y el cielo']
      : ['Fachadas, techos y cielo', 'Las fachadas, los techos y el cielo'];
  const piso = {
    ejemplo: 'El piso y los techos son la foto aérea de 2017 del Catastro de Bogotá y la FAC, aclarada con IA: lo fino puede no ser exacto.',
    bogota: 'El piso y los techos son la foto aérea de 2017 del Catastro de Bogotá y la FAC, con el color corregido: no es del día del choque.',
    mapa: 'Aquí no hay foto aérea abierta: el piso es el del mapa, con otros colores.',
    'sin-foto': 'La foto aérea de Catastro no llegó: el piso es el del mapa, con otros colores. Apágala y enciéndela para intentarlo otra vez.',
  }[tipo];
  return {
    sello: `${inventado[0]}: ilustración con IA`,
    corto: `${piso} ${inventado[1]} son imágenes genéricas hechas con IA: no muestran cómo es el lugar.`,
    nota: [
      'Es la maqueta del mapa abierto, vestida.',
      piso,
      tipo === 'bogota' ? 'Desde entonces se pudo repintar una línea, cambiar una vía o tumbar una casa.' : '',
      `Dónde está cada casa y qué tan alta es sale de OpenStreetMap${ejemplo ? ' (a las de la esquina se les ajustó la planta a la foto)' : ''}: puede faltar alguna o sobrar una que ya no está. El relieve viene de datos de satélite (más o menos un punto cada 30 m).`,
      `${inventado[1]} son imágenes genéricas hechas con IA: no muestran cómo es el lugar.`,
      ejemplo ? 'Los árboles van donde hay verde en la foto; su forma y su altura no son las de verdad.' : 'No lleva árboles, para no tapar con uno inventado lo que sí se veía.',
      'Las casas que quedan entre la cámara y los carros se bajan solas para poder ver.',
      'Lo que pasó lo cuentan las fotos de la escena y el croquis. La app no decide quién tuvo la culpa.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Las capas que se apagan: las casas grises (las vestidas van en su lugar), los iconos de los negocios y
// la sombra del relieve; con foto, también la franja gris del tramo, que la taparía.
export function capasQueSeApagan(capas, conFoto) {
  return (capas ?? [])
    .filter((c) => {
      if (c.id === 'relieve-sombra') return true;
      if (c.id === 'choque-asfalto') return conFoto;
      if (c.source !== 'openmaptiles') return false;
      return c.type === 'fill-extrusion' || (c.type === 'symbol' && /poi|shield|one_way/.test(c.id));
    })
    .map((c) => c.id);
}

// Los colores del dibujo del mapa, más parecidos a los de una calle: es el piso donde no hay foto, y lo
// que se ve más allá de ella. Y los nombres de las calles, en blanco con borde. (No se apaga el dibujo: la foto llega a 1 km, y alejando el mapa el resto
// de la ciudad quedaba en blanco.)
export function coloresDelMapa(capas) {
  const cambios = [];
  for (const c of capas ?? []) {
    if (c.type === 'background') cambios.push([c.id, 'background-color', '#b5b0a5']);
    if (c.source !== 'openmaptiles') continue;
    const que = c['source-layer'];
    if (c.type === 'fill' && (que === 'landuse' || que === 'landcover' || que === 'park')) cambios.push([c.id, 'fill-color', /park|grass|wood|pitch|cemetery|track/.test(c.id) ? '#87986b' : '#b9b4a9']);
    if (c.type === 'fill' && que === 'building') cambios.push([c.id, 'fill-color', '#9a968d']);
    if (c.type === 'line' && que === 'transportation' && !/rail/.test(c.id)) cambios.push([c.id, 'line-color', /casing/.test(c.id) ? '#d2cdc2' : /path|pedestrian/.test(c.id) ? '#c4bfb3' : '#75787c']);
    // Los nombres de las calles son grises y sin borde: sobre una foto no se leen.
    if (c.type === 'symbol' && que === 'transportation_name') cambios.push([c.id, 'text-color', '#ffffff'], [c.id, 'text-halo-color', 'rgba(20,24,29,0.8)'], [c.id, 'text-halo-width', 1.4], [c.id, 'text-halo-blur', 0.4]);
  }
  return cambios;
}

// La capa antes de la cual va la foto: encima de todo el dibujo del mapa y debajo de los nombres.
export function encimaDelDibujo(capas) {
  const ultima = (capas ?? []).map((c) => c.source === 'openmaptiles' && c.type !== 'symbol').lastIndexOf(true);
  return capas?.[ultima + 1]?.id;
}

const pequena = () => !!globalThis.matchMedia?.('(max-width: 720px)')?.matches;

function cargarImagen(url) {
  return new Promise((bien, mal) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => bien(img);
    img.onerror = () => mal(new Error('No llegó la imagen ' + url));
    img.src = url;
  });
}

function lienzoDe(lado) {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  return c;
}

// Las nueve tejas genéricas vienen en una sola hoja de 3 × 3.
async function tejasGenericas() {
  const hoja = await cargarImagen(HOJAS + 'tejas.webp');
  const lado = Math.floor(hoja.width / 3);
  return Array.from({ length: 9 }, (_, i) => {
    const c = lienzoDe(512);
    c.getContext('2d').drawImage(hoja, (i % 3) * lado + 3, Math.floor(i / 3) * lado + 3, lado - 6, lado - 6, 0, 0, 512, 512);
    return c;
  });
}

async function escenarioDelEjemplo() {
  const m = pequena() ? '-m' : '';
  const [datos, ...pisos] = await Promise.all([
    fetch(ARCHIVO_DE_LA_CIUDAD).then((r) => (r.ok ? r.json() : Promise.reject(new Error('No llegaron las casas del ejemplo')))),
    cargarImagen(`${HOJAS}ejemplo/suelo-100${m}.webp`),
    cargarImagen(`${HOJAS}ejemplo/suelo-400${m}.webp`),
    cargarImagen(`${HOJAS}ejemplo/suelo-2000.webp`),
  ]);
  return { tipo: 'ejemplo', casas: datos.casas, arboles: datos.arboles, pisos, origen: EJEMPLO, medios: MEDIOS_DEL_EJEMPLO };
}

async function escenarioDelPunto(centro, casas, alMejorar) {
  const lados = pequena() ? [768, 1440, 768] : [1024, 2048, 1024];
  const enBogota = dentroDeLaFoto(centro) ? await fotosDeBogota(centro, { lados, alMejorar }) : { falta: 'mapa' };
  if (enBogota.lienzos) return { tipo: 'bogota', casas, arboles: [], pisos: enBogota.lienzos, origen: centro, medios: enBogota.medios, tablas: enBogota.tablas };
  return { tipo: enBogota.falta, casas, arboles: [], pisos: [], tejas: await tejasGenericas(), origen: centro, medios: [] };
}

let cuantos = 0; // para que el protocolo del piso tenga un nombre propio en cada montaje

// Se monta con el mapa ya cargado. `donde()`: lo que tiene que verse en este momento (los carros de la
// recreación, o el punto del choque), [{ lat, lon }]. Devuelve { encendida, tipo, capa, poner(si) };
// `poner` devuelve { encendida, tipo, textos } y revienta si algo no llegó (sin señal, por ejemplo).
export function montarVistaRealista({ mapa, centro, ejemplo = false, sol = null, donde = () => [] }) {
  const plano = planoLocal(centro);
  const delEjemplo = ejemplo && esElLugarDelEjemplo(centro);
  let preparada = null; // la promesa de lo que se bajó y se armó: una sola vez
  let escenario = null;
  let capa = null;
  let encendida = false;
  let antes = null; // cómo estaba el mapa
  let nombre = ''; // el del protocolo del piso
  let mejoras = 0;
  // Una foto que llegó tarde: los techos y el piso se vuelven a pintar con ella.
  const mejorar = (cuales) => {
    for (const k of cuales) capa?.refrescarPiso(k);
    mapa.getSource('piso-realista')?.setTiles([`${nombre}://${++mejoras}/{z}/{x}/{y}`]);
  };

  // Las casas se van anotando mientras la cámara está cerca del punto: el mapa suelta las teselas de
  // donde ya no está mirando, y al tocar el botón desde otro barrio no habría ninguna.
  let casas = [];
  const juntarCasas = () => {
    if (!mapa.getSource('openmaptiles')) return;
    const c = mapa.getCenter();
    const p = plano.aMetros({ lat: c.lat, lon: c.lng });
    if (mapa.getZoom() < 14 || Math.hypot(p.x, p.y) > 600) return;
    const ahora = casasDeLosRasgos(mapa.querySourceFeatures('openmaptiles', { sourceLayer: 'building' }), plano);
    if (ahora.length > casas.length) casas = ahora;
  };
  if (!delEjemplo) {
    mapa.on('idle', juntarCasas);
    juntarCasas();
  }

  const preparar = () => {
    preparada ??= (async () => {
      if (!delEjemplo) juntarCasas();
      escenario = delEjemplo ? await escenarioDelEjemplo() : await escenarioDelPunto(centro, casas, mejorar);
      if (escenario.tipo !== 'sin-foto') mapa.off('idle', juntarCasas);
      const suyo = planoLocal(escenario.origen);
      const { capaDeLaCiudad } = await import('./maqueta-ciudad.js');
      capa = await capaDeLaCiudad({
        maplibregl: globalThis.maplibregl,
        origen: escenario.origen,
        plano: suyo,
        edificios: escenario.casas,
        arboles: escenario.arboles,
        medios: escenario.medios,
        sol,
        imagenes: {
          ladrillo: HOJAS + 'ladrillo.webp',
          estuco: HOJAS + 'estuco.webp',
          apto: HOJAS + 'apto.webp',
          culata: HOJAS + 'culata.webp',
          cielo: HOJAS + 'cielo.webp',
          arboles: HOJAS + 'arboles.webp',
          pisos: escenario.pisos,
          tejas: escenario.tejas ?? [],
        },
        objetivos: () => donde().map((g) => ({ ...suyo.aMetros(g), z: 0.8 })),
      });
      if (escenario.pisos.length) {
        const c = globalThis.maplibregl.MercatorCoordinate.fromLngLat([escenario.origen.lon, escenario.origen.lat], 0);
        const u = c.meterInMercatorCoordinateUnits();
        const deBogota = escenario.tipo === 'bogota';
        nombre = `pisocc${++cuantos}`;
        // En Bogotá, de la foto amplia solo se usan los techos: el piso de lejos va tesela por tesela.
        const fotos = escenario.pisos.map((imagen, i) => ({ imagen, medioMercator: escenario.medios[i] * u, pluma: deBogota ? PLUMA : 0 })).slice(0, deBogota ? 2 : 3).reverse();
        registrarPiso(globalThis.maplibregl, nombre, { x: c.x, y: c.y }, fotos, { grano: !deBogota, base: deBogota ? pisoDeTeselas(escenario.tablas) : null });
        // Hasta z22, 3,7 cm por píxel: la foto de cerca tiene 4,9.
        mapa.addSource('piso-realista', { type: 'raster', tiles: [nombre + '://0/{z}/{x}/{y}'], tileSize: 256, minzoom: 12, maxzoom: 22, attribution: CREDITO_DE_LA_FOTO });
      }
    })();
    // Si algo no llegó, que el próximo toque lo intente otra vez.
    preparada.catch(() => {
      preparada = null;
    });
    return preparada;
  };

  const encender = () => {
    const capas = mapa.getStyle().layers;
    const conFoto = escenario.pisos.length > 0;
    antes = { visibles: [], colores: [], cielo: mapa.getSky() };
    for (const id of capasQueSeApagan(capas, conFoto)) {
      antes.visibles.push([id, mapa.getLayoutProperty(id, 'visibility') ?? 'visible']);
      mapa.setLayoutProperty(id, 'visibility', 'none');
    }
    for (const [id, propiedad, color] of coloresDelMapa(capas)) {
      antes.colores.push([id, propiedad, mapa.getPaintProperty(id, propiedad)]);
      mapa.setPaintProperty(id, propiedad, color);
    }
    if (conFoto) mapa.addLayer({ id: 'piso-realista', type: 'raster', source: 'piso-realista', paint: { 'raster-fade-duration': 0 } }, encimaDelDibujo(capas));
    mapa.setSky({ 'sky-color': '#9cc4e8', 'horizon-color': '#dfe9f3', 'fog-color': '#dfe9f3', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.93 });
    // Debajo de los carros y de los puntos del choque.
    mapa.addLayer(capa, ['choque-carros', 'choque-carros-3d'].find((id) => mapa.getLayer(id)));
    encendida = true;
  };
  const apagar = () => {
    for (const id of ['choque-ciudad', 'piso-realista']) if (mapa.getLayer(id)) mapa.removeLayer(id);
    for (const [id, visible] of antes.visibles) if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', visible);
    for (const [id, propiedad, valor] of antes.colores) if (mapa.getLayer(id)) mapa.setPaintProperty(id, propiedad, valor);
    mapa.setSky(antes.cielo);
    antes = null;
    encendida = false;
    // Si la foto no llegó, la próxima vez se pide otra vez.
    if (escenario.tipo === 'sin-foto') preparada = null;
  };
  const estado = () => ({ encendida, tipo: escenario?.tipo ?? null, textos: encendida ? textosDeLaVista(escenario.tipo) : null });

  return {
    get encendida() {
      return encendida;
    },
    get tipo() {
      return escenario?.tipo ?? null;
    },
    get capa() {
      return capa;
    },
    // Lo que se baja, antes de prenderla (el ejemplo la trae mientras la cámara entra al 3D).
    preparar,
    async poner(si) {
      if (si && !encendida) {
        await preparar();
        if (!encendida) encender();
      } else if (!si && encendida) {
        apagar();
      }
      return estado();
    },
  };
}
