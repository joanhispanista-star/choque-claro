// El análisis de la vía en el punto del choque, con OpenStreetMap.
//
// Qué se puede saber y qué no (medido el 12-nov-2026 en 1.074 tramos de vía
// principal de los cerros orientales de Bogotá):
//  - La FORMA de la vía (recta o curva, y su radio) no es un dato que alguien
//    haya escrito: se calcula de la línea dibujada en el mapa. Por eso sale
//    en cualquier vía que esté en el mapa.
//  - Carriles (96 % de esos tramos), sentido (95 %) y velocidad máxima (53 %)
//    son etiquetas que alguien puso: a veces están y a veces no.
//  - "Prohibido adelantar" (la doble línea amarilla) estaba en 0 de 1.074. La
//    doble línea NO sale del mapa: sale de las fotos.
//  - Lo que el mapa no trae se dice "sin dato en el mapa", nunca "no había":
//    un semáforo que nadie mapeó existe igual.
//
// Este módulo es puro (sin DOM ni red): recibe la respuesta de Overpass y
// devuelve el análisis. La consulta la arma `consultaDeLaVia` y la hace
// servicios.js. Se prueba en Node con respuestas reales guardadas.
import { diferenciaAngular, distancia, numero, planoLocal, proyectarEnSegmento, puntoCardinal, rumbo } from './geo.js';

// Radio de la consulta alrededor del pin, en metros. Overpass devuelve las
// vías ENTERAS que pasen a menos de esto, así que casi siempre hay vía de
// sobra a los dos lados para medir la curva.
export const RADIO_CONSULTA = 80;
// La curva se mide con el círculo que pasa por tres puntos de la vía: el del
// choque y dos a MEDIA_CUERDA metros antes y después (50 m de vía). Más
// corto, cualquier quiebre del dibujo parece curva; más largo, una curva
// cerrada se diluye en las rectas que la rodean.
export const MEDIA_CUERDA = 25;
// Hasta dónde se miran las señales, los cruces y las curvas cercanas (m).
export const RADIO_SENALES = 60;
export const RADIO_CRUCE = 40;
export const RADIO_CURVA_CERCANA = 40;
// Un pin a más de esto de la vía seguramente quedó mal puesto (el GPS en la
// ciudad falla de 5 a 30 m): se avisa, no se corrige solo.
export const LEJOS_DE_LA_VIA = 25;

const CLASES_DE_VIA = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|track|busway';

export function consultaDeLaVia(punto, radio = RADIO_CONSULTA) {
  const cerca = `around:${radio},${punto.lat.toFixed(6)},${punto.lon.toFixed(6)}`;
  return `[out:json][timeout:20];
way(${cerca})["highway"~"^(${CLASES_DE_VIA})(_link)?$"];
out body geom;
(
  node(${cerca})["highway"~"^(traffic_signals|stop|give_way|crossing|speed_camera|mini_roundabout)$"];
  node(${cerca})["railway"="level_crossing"];
);
out body;`;
}

// Los cortes son nuestros, no de una norma, y viven solo aquí para poder
// cambiarlos. Como referencia: con el peralte y la fricción típicos de diseño,
// una curva de 60 m de radio ya obliga a ir a menos de unos 40 km/h.
export function tipoDeCurva(radio) {
  if (!Number.isFinite(radio)) return 'recta';
  if (radio < 60) return 'curva cerrada';
  if (radio < 150) return 'curva';
  if (radio < 400) return 'curva suave';
  return 'recta';
}

// Radio del círculo que pasa por tres puntos: R = abc / (4 · área).
export function radioPorTresPuntos(a, b, c) {
  const ab = distancia(a, b);
  const bc = distancia(b, c);
  const ca = distancia(c, a);
  const dobleArea = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  if (dobleArea <= 1e-9 * ab * bc) return Infinity; // alineados: recta
  return (ab * bc * ca) / (2 * dobleArea);
}

// ---------------------------------------------------------------- etiquetas

const CLASES = {
  motorway: 'autopista',
  trunk: 'vía troncal',
  primary: 'vía primaria',
  secondary: 'vía secundaria',
  tertiary: 'vía terciaria',
  unclassified: 'vía sin clasificar',
  residential: 'calle de barrio',
  living_street: 'calle de tráfico calmado',
  service: 'vía de servicio (entrada o parqueadero)',
  road: 'vía sin clasificar',
  track: 'camino destapado',
  busway: 'carril exclusivo de buses',
};

export function claseDeVia(highway = '') {
  const enlace = highway.endsWith('_link');
  const base = enlace ? highway.slice(0, -5) : highway;
  const texto = CLASES[base] || 'vía';
  return enlace ? `enlace de ${texto}` : texto;
}

const SI = new Set(['yes', 'true', '1']);

// El sentido. En OpenStreetMap, una vía sin la etiqueta `oneway` es de doble
// sentido por convención; pero una calle de un sentido que nadie etiquetó
// también sale así. Por eso se dice de dónde sale el dato.
export function sentidoDe(etiquetas) {
  const oneway = etiquetas.oneway;
  if (SI.has(oneway)) return { valor: 'uno', segun: 'mapa' };
  if (oneway === '-1') return { valor: 'uno', segun: 'mapa' };
  if (oneway === 'no') return { valor: 'doble', segun: 'mapa' };
  if (etiquetas.junction === 'roundabout') return { valor: 'uno', segun: 'glorieta' };
  if (etiquetas.highway === 'motorway' || etiquetas.highway === 'motorway_link') return { valor: 'uno', segun: 'autopista' };
  return { valor: 'doble', segun: 'convencion' };
}

export function carrilesDe(etiquetas) {
  const n = Number.parseInt(etiquetas.lanes, 10);
  return Number.isFinite(n) && n > 0 && n < 20 ? n : null;
}

function kmh(valor) {
  if (valor == null) return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(km\/h|kmh|kph)?\s*$/i.exec(valor);
  if (m) return Math.round(Number(m[1]));
  const millas = /^\s*(\d+(?:\.\d+)?)\s*mph\s*$/i.exec(valor);
  if (millas) return Math.round(Number(millas[1]) * 1.609);
  return null;
}

// La velocidad máxima: { kmh, texto, enUnSentido }. Si la etiqueta trae algo
// que no es un número ("CO:urban"), se muestra tal cual: no se adivina.
export function maximaDe(etiquetas) {
  if (etiquetas.maxspeed != null) {
    const v = kmh(etiquetas.maxspeed);
    return v != null ? { kmh: v, texto: `${v} km/h`, enUnSentido: false } : { kmh: null, texto: etiquetas.maxspeed, enUnSentido: false };
  }
  const porSentido = [kmh(etiquetas['maxspeed:forward']), kmh(etiquetas['maxspeed:backward'])].filter((v) => v != null);
  if (porSentido.length) {
    const v = Math.min(...porSentido);
    return { kmh: v, texto: `${v} km/h`, enUnSentido: porSentido.length === 1 };
  }
  return null;
}

// Si estaba prohibido adelantar (la doble línea). 'prohibido', 'prohibido en
// un sentido', 'permitido' o null (sin dato: casi siempre).
export function adelantarDe(etiquetas) {
  const general = etiquetas.overtaking;
  const ida = etiquetas['overtaking:forward'];
  const vuelta = etiquetas['overtaking:backward'];
  if (general === 'no' || (ida === 'no' && vuelta === 'no')) return 'prohibido';
  if (ida === 'no' || vuelta === 'no') return 'prohibido en un sentido';
  if (general === 'yes' || general === 'both') return 'permitido';
  if (general === 'forward' || general === 'backward') return 'prohibido en un sentido';
  return null;
}

const SUPERFICIES = {
  asphalt: 'asfalto',
  concrete: 'concreto',
  'concrete:plates': 'placas de concreto',
  paved: 'pavimentada',
  paving_stones: 'adoquín',
  sett: 'adoquín',
  cobblestone: 'empedrado',
  unpaved: 'destapada',
  gravel: 'destapada (gravilla)',
  fine_gravel: 'destapada (gravilla)',
  compacted: 'destapada (compactada)',
  dirt: 'destapada (tierra)',
  ground: 'destapada (tierra)',
  earth: 'destapada (tierra)',
  mud: 'destapada (barro)',
  sand: 'arena',
};

export function superficieDe(etiquetas) {
  if (!etiquetas.surface) return null;
  return SUPERFICIES[etiquetas.surface] || etiquetas.surface;
}

export function alumbradoDe(etiquetas) {
  if (SI.has(etiquetas.lit) || etiquetas.lit === 'automatic' || etiquetas.lit === '24/7') return true;
  if (etiquetas.lit === 'no') return false;
  return null;
}

function siTiene(valor) {
  return valor != null && valor !== 'no';
}

const SENALES = {
  traffic_signals: 'Semáforo',
  stop: 'Pare',
  give_way: 'Ceda el paso',
  crossing: 'Paso peatonal',
  speed_camera: 'Cámara de fotomulta',
  mini_roundabout: 'Glorieta pequeña',
  level_crossing: 'Paso a nivel del tren',
};

function senalDe(etiquetas) {
  const tipo = etiquetas.railway === 'level_crossing' ? 'level_crossing' : etiquetas.highway;
  let texto = SENALES[tipo];
  if (!texto) return null;
  if (tipo === 'crossing' && etiquetas.crossing === 'traffic_signals') texto = 'Paso peatonal con semáforo';
  return { tipo, texto };
}

// ------------------------------------------------------------ la geometría

function acumulados(puntos) {
  const a = [0];
  for (let i = 1; i < puntos.length; i++) a.push(a[i - 1] + distancia(puntos[i - 1], puntos[i]));
  return a;
}

// El punto que está a `s` metros del comienzo de la línea.
function puntoA(puntos, acum, s) {
  if (s <= 0) return puntos[0];
  for (let i = 1; i < puntos.length; i++) {
    if (acum[i] >= s) {
      const tramo = acum[i] - acum[i - 1] || 1;
      const t = (s - acum[i - 1]) / tramo;
      return { x: puntos[i - 1].x + t * (puntos[i].x - puntos[i - 1].x), y: puntos[i - 1].y + t * (puntos[i].y - puntos[i - 1].y) };
    }
  }
  return puntos[puntos.length - 1];
}

function prepararVias(respuesta, plano) {
  const vias = [];
  for (const e of respuesta?.elements ?? []) {
    if (e.type !== 'way' || !Array.isArray(e.geometry) || e.geometry.length < 2) continue;
    if (e.geometry.some((g) => !g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon))) continue;
    const nodos = Array.isArray(e.nodes) && e.nodes.length === e.geometry.length ? e.nodes : e.geometry.map(() => null);
    vias.push({ id: e.id, etiquetas: e.tags ?? {}, nodos, puntos: e.geometry.map((g) => plano.aMetros(g)) });
  }
  return vias;
}

// La vía más cercana al pin. Las entradas y los parqueaderos (service) y los
// caminos destapados (track) cargan 10 m de castigo: si el pin cae entre la
// avenida y la entrada de un edificio, el choque casi siempre fue en la
// avenida.
function laMasCercana(vias, p) {
  let mejor = null;
  for (const via of vias) {
    const castigo = /^(service|track)$/.test(via.etiquetas.highway) ? 10 : 0;
    for (let i = 0; i < via.puntos.length - 1; i++) {
      const pr = proyectarEnSegmento(p, via.puntos[i], via.puntos[i + 1]);
      const puntaje = pr.distancia + castigo;
      if (!mejor || puntaje < mejor.puntaje) mejor = { via, segmento: i, t: pr.t, punto: pr.punto, distancia: pr.distancia, puntaje };
    }
  }
  return mejor;
}

// La vía que sigue a la cadena por su punta (`fin` o `inicio`), si la hay. En
// OpenStreetMap una calle se parte en muchos tramos, a veces justo en la
// curva: sin unirlos, una curva partida en dos parecería dos rectas.
// Se sigue por el mismo nombre (o la misma ruta) si no gira más de 60°; por
// otro nombre, solo si casi no gira (30°): es la misma calle, mal etiquetada.
function continuacion(cadena, punta, etiquetas, vias, usadas) {
  const { puntos, nodos } = cadena;
  const n = puntos.length;
  const nodo = punta === 'fin' ? nodos[n - 1] : nodos[0];
  if (nodo == null) return null;
  const haciaAfuera = punta === 'fin' ? rumbo(puntos[n - 2], puntos[n - 1]) : rumbo(puntos[1], puntos[0]);
  let mejor = null;
  for (const via of vias) {
    if (usadas.has(via.id)) continue;
    const k = via.nodos.length - 1;
    let sale;
    if (via.nodos[0] === nodo) sale = { puntos: via.puntos, nodos: via.nodos };
    else if (via.nodos[k] === nodo) sale = { puntos: via.puntos.slice().reverse(), nodos: via.nodos.slice().reverse() };
    else continue;
    const giro = diferenciaAngular(haciaAfuera, rumbo(sale.puntos[0], sale.puntos[1]));
    const mismoNombre = Boolean(etiquetas.name) && via.etiquetas.name === etiquetas.name;
    const mismaRuta = Boolean(etiquetas.ref) && via.etiquetas.ref === etiquetas.ref;
    if (mismoNombre || mismaRuta ? giro > 60 : giro > 30) continue;
    const puntaje = (mismoNombre ? 0 : mismaRuta ? 10 : via.etiquetas.highway === etiquetas.highway ? 40 : 80) + giro;
    if (!mejor || puntaje < mejor.puntaje) mejor = { via, ...sale, puntaje };
  }
  if (!mejor) return null;
  // `sale` arranca en el nodo de unión y se aleja; para pegarla al comienzo
  // de la cadena tiene que TERMINAR en ese nodo.
  if (punta === 'inicio') return { via: mejor.via, puntos: mejor.puntos.slice().reverse(), nodos: mejor.nodos.slice().reverse() };
  return mejor;
}

// La vía elegida más las que la continúan, hasta tener `necesarios` metros a
// cada lado del punto (o hasta que no haya más). `posicion` es dónde queda el
// punto proyectado, en metros desde el comienzo de la cadena.
function cadenaDeVia(elegida, vias, necesarios) {
  const etiquetas = elegida.via.etiquetas;
  const usadas = new Set([elegida.via.id]);
  const cadena = { puntos: elegida.via.puntos.slice(), nodos: elegida.via.nodos.slice() };
  const acum0 = acumulados(cadena.puntos);
  let posicion = acum0[elegida.segmento] + elegida.t * (acum0[elegida.segmento + 1] - acum0[elegida.segmento]);
  for (let vueltas = 0; vueltas < 8; vueltas++) {
    const total = acumulados(cadena.puntos).at(-1);
    if (total - posicion >= necesarios) break;
    const sigue = continuacion(cadena, 'fin', etiquetas, vias, usadas);
    if (!sigue) break;
    usadas.add(sigue.via.id);
    cadena.puntos = cadena.puntos.concat(sigue.puntos.slice(1));
    cadena.nodos = cadena.nodos.concat(sigue.nodos.slice(1));
  }
  for (let vueltas = 0; vueltas < 8; vueltas++) {
    if (posicion >= necesarios) break;
    const antes = continuacion(cadena, 'inicio', etiquetas, vias, usadas);
    if (!antes) break;
    usadas.add(antes.via.id);
    posicion += acumulados(antes.puntos).at(-1);
    cadena.puntos = antes.puntos.slice(0, -1).concat(cadena.puntos);
    cadena.nodos = antes.nodos.slice(0, -1).concat(cadena.nodos);
  }
  return { ...cadena, posicion, usadas };
}

// La forma de la vía en el punto y, si la hay, una curva más cerrada cerca.
function formaDeLaVia(puntos, acum, posicion) {
  const total = acum.at(-1);
  if (total < 2 * MEDIA_CUERDA) return { forma: { radio: null, tipo: null, motivo: 'tramo-corto' }, curvaCercana: null };
  const radioEn = (s) => radioPorTresPuntos(puntoA(puntos, acum, s - MEDIA_CUERDA), puntoA(puntos, acum, s), puntoA(puntos, acum, s + MEDIA_CUERDA));
  const enPunto = Math.min(Math.max(posicion, MEDIA_CUERDA), total - MEDIA_CUERDA);
  const radio = radioEn(enPunto);
  let minimo = { radio, s: enPunto };
  const desde = Math.max(MEDIA_CUERDA, posicion - RADIO_CURVA_CERCANA);
  const hasta = Math.min(total - MEDIA_CUERDA, posicion + RADIO_CURVA_CERCANA);
  for (let s = desde; s <= hasta; s += 5) {
    const r = radioEn(s);
    if (r < minimo.radio) minimo = { radio: r, s };
  }
  const forma = { radio: Number.isFinite(radio) ? radio : null, tipo: tipoDeCurva(radio), motivo: null };
  let curvaCercana = null;
  const tipoMinimo = tipoDeCurva(minimo.radio);
  const lejos = Math.abs(minimo.s - posicion);
  if (lejos > 10 && minimo.radio < 0.7 * radio && (tipoMinimo === 'curva' || tipoMinimo === 'curva cerrada')) {
    curvaCercana = { radio: minimo.radio, tipo: tipoMinimo, distancia: lejos };
  }
  return { forma, curvaCercana };
}

// El cruce más cercano: un nodo de la cadena que también es de otra vía que
// NO es la misma calle.
function cruceMasCercano(vias, cadena, puntoEnVia) {
  const viasPorNodo = new Map();
  for (const via of vias) {
    via.nodos.forEach((nodo, i) => {
      if (nodo == null) return;
      if (!viasPorNodo.has(nodo)) viasPorNodo.set(nodo, { punto: via.puntos[i], vias: new Set() });
      viasPorNodo.get(nodo).vias.add(via);
    });
  }
  let mejor = null;
  for (const nodo of new Set(cadena.nodos)) {
    const info = viasPorNodo.get(nodo);
    if (!info) continue;
    const otras = [...info.vias].filter((v) => !cadena.usadas.has(v.id));
    if (!otras.length) continue;
    const d = distancia(info.punto, puntoEnVia);
    if (d > RADIO_CRUCE || (mejor && d >= mejor.distancia)) continue;
    const deVerdad = otras.filter((v) => !/^(service|track)$/.test(v.etiquetas.highway));
    const nombrada = deVerdad.find((v) => v.etiquetas.name);
    const con = nombrada ? nombrada.etiquetas.name : deVerdad.length ? claseDeVia(deVerdad[0].etiquetas.highway) : 'una entrada o vía de servicio';
    mejor = { distancia: d, con, soloEntrada: deVerdad.length === 0 };
  }
  return mejor;
}

// Una avenida con separador está dibujada como DOS vías de un sentido, una por
// calzada (la Carrera 7 con Calle 60 sale así). Sin esto, "un solo sentido"
// haría creer que toda la avenida es de un sentido. Se busca otra vía con el
// mismo nombre o ruta, paralela, de 6 a 40 m al lado (no adelante ni atrás).
function calzadaHermana(vias, cadena, elegida, rumboVia) {
  const e = elegida.via.etiquetas;
  if (!e.name && !e.ref) return null;
  const u = { x: Math.sin((rumboVia * Math.PI) / 180), y: Math.cos((rumboVia * Math.PI) / 180) };
  let mejor = null;
  for (const via of vias) {
    if (cadena.usadas.has(via.id)) continue;
    const misma = (e.name && via.etiquetas.name === e.name) || (e.ref && via.etiquetas.ref === e.ref);
    if (!misma) continue;
    for (let i = 0; i < via.puntos.length - 1; i++) {
      const pr = proyectarEnSegmento(elegida.punto, via.puntos[i], via.puntos[i + 1]);
      const dx = pr.punto.x - elegida.punto.x;
      const dy = pr.punto.y - elegida.punto.y;
      const aLoLargo = Math.abs(dx * u.x + dy * u.y);
      const alLado = Math.abs(dx * u.y - dy * u.x);
      const dir = rumbo(via.puntos[i], via.puntos[i + 1]);
      const eje = Math.min(diferenciaAngular(dir, rumboVia), diferenciaAngular(dir, rumboVia + 180));
      if (eje > 25 || aLoLargo > 25 || alLado < 6 || alLado > 40) continue;
      if (!mejor || alLado < mejor.distancia) mejor = { distancia: alLado };
    }
  }
  return mejor;
}

function senalesCerca(respuesta, plano, puntoEnVia) {
  const lista = [];
  for (const e of respuesta?.elements ?? []) {
    if (e.type !== 'node' || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
    const senal = senalDe(e.tags ?? {});
    if (!senal) continue;
    const d = distancia(plano.aMetros(e), puntoEnVia);
    if (d <= RADIO_SENALES) lista.push({ ...senal, distancia: d, lat: e.lat, lon: e.lon });
  }
  return lista.sort((a, b) => a.distancia - b.distancia);
}

// ---------------------------------------------------------- el análisis

// `respuesta`: lo que devuelve Overpass para `consultaDeLaVia(punto)`.
// Devuelve { estado: 'sin-vias' } o { estado: 'ok', ... } con todo lo que se
// sabe de la vía en ese punto. Los datos que el mapa no trae quedan en null.
export function analizarVia(respuesta, punto) {
  const plano = planoLocal(punto);
  const vias = prepararVias(respuesta, plano);
  if (!vias.length) return { estado: 'sin-vias', punto, radio: RADIO_CONSULTA };
  const p = plano.aMetros(punto);
  const elegida = laMasCercana(vias, p);
  const cadena = cadenaDeVia(elegida, vias, MEDIA_CUERDA + RADIO_CURVA_CERCANA + 20);
  const acum = acumulados(cadena.puntos);
  const { forma, curvaCercana } = formaDeLaVia(cadena.puntos, acum, cadena.posicion);
  const total = acum.at(-1);
  const rumboVia = rumbo(puntoA(cadena.puntos, acum, Math.max(0, cadena.posicion - 5)), puntoA(cadena.puntos, acum, Math.min(total, cadena.posicion + 5)));
  const etiquetas = elegida.via.etiquetas;
  // El tramo que se dibuja en el mapa: 60 m a cada lado.
  const tramo = [];
  for (let s = Math.max(0, cadena.posicion - 60); s <= Math.min(total, cadena.posicion + 60); s += 4) {
    const g = plano.aGrados(puntoA(cadena.puntos, acum, s));
    tramo.push([g.lat, g.lon]);
  }
  return {
    estado: 'ok',
    punto,
    enLaVia: plano.aGrados(elegida.punto),
    distanciaALaVia: elegida.distancia,
    via: {
      id: elegida.via.id,
      nombre: etiquetas.name || null,
      ruta: etiquetas.ref || null,
      clase: etiquetas.highway || null,
      claseTexto: claseDeVia(etiquetas.highway),
    },
    forma,
    curvaCercana,
    rumbo: rumboVia,
    sentido: sentidoDe(etiquetas),
    calzadaHermana: sentidoDe(etiquetas).valor === 'uno' ? calzadaHermana(vias, cadena, elegida, rumboVia) : null,
    // El tramo va en el orden en que está dibujada la vía elegida: en una vía
    // de un sentido, ese es el sentido en que se circula (o el contrario si
    // la etiqueta es oneway=-1).
    alReves: etiquetas.oneway === '-1',
    carriles: carrilesDe(etiquetas),
    maxima: maximaDe(etiquetas),
    adelantar: adelantarDe(etiquetas),
    superficie: superficieDe(etiquetas),
    alumbrado: alumbradoDe(etiquetas),
    puente: siTiene(etiquetas.bridge),
    tunel: siTiene(etiquetas.tunnel),
    glorieta: etiquetas.junction === 'roundabout' || etiquetas.junction === 'circular',
    cruce: cruceMasCercano(vias, cadena, elegida.punto),
    senales: senalesCerca(respuesta, plano, elegida.punto),
    tramo,
  };
}

// ------------------------------------------------------------ los textos

const SIN_DATO = 'Sin dato en el mapa';

function metros(m) {
  return `${Math.round(m)} m`;
}

// Las filas que se muestran (y que irán al expediente de la aseguradora):
// { clave, etiqueta, valor, nota, aviso: null | 'sin-dato' | 'atencion' }.
export function filasDeLaVia(a) {
  if (!a || a.estado !== 'ok') return [];
  const filas = [];
  const nombre = a.via.nombre || (a.via.ruta ? `Ruta ${a.via.ruta}` : 'Vía sin nombre en el mapa');
  const lejos = a.distanciaALaVia > LEJOS_DE_LA_VIA;
  filas.push({
    clave: 'via',
    etiqueta: 'Vía',
    valor: nombre,
    nota: lejos ? `El pin está a ${metros(a.distanciaALaVia)} de esta vía: si el choque fue en ella, arrástralo encima.` : a.via.claseTexto,
    aviso: lejos ? 'atencion' : null,
  });
  const especial = [a.puente && 'un puente', a.tunel && 'un túnel', a.glorieta && 'una glorieta'].filter(Boolean);
  if (especial.length) filas.push({ clave: 'especial', etiqueta: 'Ojo', valor: `Es ${especial.join(' y ')}`, nota: 'según el mapa', aviso: 'atencion' });
  if (a.forma.tipo == null) {
    filas.push({ clave: 'forma', etiqueta: 'Forma', valor: SIN_DATO, nota: 'el tramo dibujado es muy corto para medir la curva', aviso: 'sin-dato' });
  } else if (a.forma.tipo === 'recta') {
    filas.push({ clave: 'forma', etiqueta: 'Forma', valor: 'Recta', nota: 'medida sobre 50 m de la vía dibujada en el mapa', aviso: null });
  } else {
    const tipo = a.forma.tipo[0].toUpperCase() + a.forma.tipo.slice(1);
    filas.push({ clave: 'forma', etiqueta: 'Forma', valor: `${tipo}, radio ${metros(a.forma.radio)}`, nota: 'medida sobre 50 m de la vía dibujada en el mapa', aviso: a.forma.tipo === 'curva cerrada' ? 'atencion' : null });
  }
  if (a.curvaCercana) {
    filas.push({ clave: 'curva-cercana', etiqueta: 'Curva cerca', valor: `${a.curvaCercana.tipo[0].toUpperCase() + a.curvaCercana.tipo.slice(1)} de radio ${metros(a.curvaCercana.radio)}, a ${metros(a.curvaCercana.distancia)}`, nota: 'por la misma vía', aviso: 'atencion' });
  }
  const notaSentido = { mapa: 'según el mapa', glorieta: 'es una glorieta', autopista: 'es autopista', convencion: 'el mapa no dice lo contrario' }[a.sentido.segun];
  if (a.sentido.valor === 'uno') {
    const hacia = puntoCardinal(a.alReves ? a.rumbo + 180 : a.rumbo);
    const partes = [notaSentido];
    if (!a.glorieta) partes.push(`se circula hacia el ${hacia}`);
    if (a.calzadaHermana) partes.push(`es una calzada: la otra, en sentido contrario, va a ${metros(a.calzadaHermana.distancia)}`);
    filas.push({ clave: 'sentido', etiqueta: 'Sentido', valor: a.calzadaHermana ? 'Un sentido en esta calzada' : 'Un solo sentido', nota: partes.join(' · '), aviso: null });
  } else {
    filas.push({ clave: 'sentido', etiqueta: 'Sentido', valor: 'Doble sentido', nota: `${notaSentido} · la vía corre de ${puntoCardinal(a.rumbo + 180)} a ${puntoCardinal(a.rumbo)}`, aviso: null });
  }
  filas.push(a.carriles ? { clave: 'carriles', etiqueta: 'Carriles', valor: String(a.carriles), nota: 'según el mapa', aviso: null } : { clave: 'carriles', etiqueta: 'Carriles', valor: SIN_DATO, nota: '', aviso: 'sin-dato' });
  filas.push(a.maxima ? { clave: 'maxima', etiqueta: 'Velocidad máxima', valor: a.maxima.texto, nota: a.maxima.enUnSentido ? 'según el mapa, en un sentido' : 'según el mapa', aviso: null } : { clave: 'maxima', etiqueta: 'Velocidad máxima', valor: SIN_DATO, nota: '', aviso: 'sin-dato' });
  const adelantar = {
    prohibido: { valor: 'Prohibido adelantar', nota: 'según el mapa', aviso: 'atencion' },
    'prohibido en un sentido': { valor: 'Prohibido adelantar en un sentido', nota: 'según el mapa', aviso: 'atencion' },
    permitido: { valor: 'Se permite adelantar', nota: 'según el mapa', aviso: null },
  }[a.adelantar] || { valor: SIN_DATO, nota: 'hay que verla en las fotos', aviso: 'sin-dato' };
  filas.push({ clave: 'adelantar', etiqueta: 'Doble línea', ...adelantar });
  if (a.cruce) {
    filas.push({ clave: 'cruce', etiqueta: 'Cruce', valor: a.cruce.soloEntrada ? `Entrada o vía de servicio a ${metros(a.cruce.distancia)}` : `Con ${a.cruce.con} a ${metros(a.cruce.distancia)}`, nota: 'según el mapa', aviso: a.cruce.soloEntrada ? null : 'atencion' });
  } else {
    filas.push({ clave: 'cruce', etiqueta: 'Cruce', valor: `Ninguno en el mapa a menos de ${RADIO_CRUCE} m`, nota: '', aviso: null });
  }
  if (a.senales.length) {
    const vistas = new Set();
    const cercanas = a.senales.filter((s) => (vistas.has(s.texto) ? false : vistas.add(s.texto)));
    filas.push({ clave: 'senales', etiqueta: 'Señales cerca', valor: cercanas.map((s) => `${s.texto} a ${metros(s.distancia)}`).join(' · '), nota: 'según el mapa', aviso: null });
  } else {
    filas.push({ clave: 'senales', etiqueta: 'Señales cerca', valor: `Ninguna en el mapa a menos de ${RADIO_SENALES} m`, nota: 'que no estén en el mapa no quiere decir que no haya', aviso: 'sin-dato' });
  }
  filas.push(a.superficie ? { clave: 'superficie', etiqueta: 'Superficie', valor: a.superficie[0].toUpperCase() + a.superficie.slice(1), nota: 'según el mapa', aviso: null } : { clave: 'superficie', etiqueta: 'Superficie', valor: SIN_DATO, nota: '', aviso: 'sin-dato' });
  const alumbrado = a.alumbrado === true ? { valor: 'Con alumbrado público', nota: 'según el mapa', aviso: null } : a.alumbrado === false ? { valor: 'Sin alumbrado público', nota: 'según el mapa', aviso: 'atencion' } : { valor: SIN_DATO, nota: '', aviso: 'sin-dato' };
  filas.push({ clave: 'alumbrado', etiqueta: 'Alumbrado', ...alumbrado });
  return filas;
}

// Una línea de estado para encima de las filas.
export function resumenDeLaVia(a) {
  if (!a) return '';
  if (a.estado === 'sin-vias') return `No hay vías en el mapa a menos de ${a.radio} m de este punto. Revisa que el pin esté donde fue el choque.`;
  if (a.estado !== 'ok') return '';
  return `Pin a ${metros(a.distanciaALaVia)} de la vía${a.distanciaALaVia > LEJOS_DE_LA_VIA ? ': revisa que esté en el punto del choque' : ''}.`;
}

export { numero };
