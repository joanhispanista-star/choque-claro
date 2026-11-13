// El croquis (paso 7): dónde iba cada carro justo antes del golpe, hacia dónde y dónde fue el
// golpe, dibujado sobre la vía del mapa.
//
// Joan eligió el 13-nov-2026 la manera GUIADA (se le mostraron dos con pantallazos): la persona
// escoge uno de seis casos («De frente», «Por detrás»…) y la app los arma sobre la vía que se
// analizó en el paso 3; ella solo corrige. «Ninguno se parece» abre el modo LIBRE: los carros se
// ponen a mano y las flechas se dibujan con el dedo. Alguien que tiembla al lado de la vía toca una
// tarjeta más fácil de lo que dibuja, y el caso le llega a la aseguradora como un dato que se lee
// de primero, no como un dibujo para interpretar.
//
// Lo que esto NO es: una reconstrucción. El croquis es lo que la persona declara; la app no lo
// mide ni decide de quién fue la culpa, y la pantalla lo dice. Un caso solo arma un punto de
// partida, y lo que la persona no cambie queda declarado igual (en «Por detrás», el de adelante
// sale quieto porque así lo pinta la tarjeta). Por eso relatoDelCroquis dice en palabras lo que
// quedó dibujado, antes de darlo por hecho: que nadie firme un dibujo que no leyó.
//
// Todo puro, en metros sobre un plano local alrededor del golpe (geo.js). Se prueba en Node con
// las vías reales guardadas en pruebas/datos.
import { diferenciaAngular, distancia, planoLocal, proyectarEnSegmento, puntoCardinal, rumbo as rumboEntre } from './geo.js';
import { medidasParaDibujar } from './carrocerias.js';

const GRADO = Math.PI / 180;

export const VERSION_DEL_CROQUIS = 1;

// En el orden de las tarjetas. Los textos son los de las maquetas que Joan aprobó.
export const CASOS = [
  { id: 'detras', titulo: 'Por detrás', detalle: 'Uno le pegó al de adelante' },
  { id: 'frente', titulo: 'De frente', detalle: 'Venían en sentidos contrarios' },
  { id: 'cruce', titulo: 'En un cruce', detalle: 'Uno salió de la otra vía' },
  { id: 'carril', titulo: 'Al cambiar de carril', detalle: 'Iban para el mismo lado' },
  { id: 'reversa', titulo: 'En reversa', detalle: 'Uno iba hacia atrás o parqueando' },
  { id: 'quieto', titulo: 'Contra algo quieto', detalle: 'Un poste, un muro, un carro parqueado' },
];
export const LIBRE = 'libre';

export function tituloDelCaso(id) {
  const caso = CASOS.find((c) => c.id === id);
  return caso ? caso.titulo : 'Dibujado a mano';
}

export const MOVIMIENTOS = ['adelante', 'reversa', 'quieto'];

// Un carril en Colombia mide de 3,0 a 3,65 m: con medio carril de 1,65 cada carro queda en el
// medio del suyo. Se circula por la derecha.
export const MEDIO_CARRIL = 1.65;
// Lo que se dibuja detrás de cada carro para decir de dónde venía (m).
export const COLA = 12;
// Más lejos que esto del eje de la vía, un carro (o el golpe) ya no va por ella: su flecha va derecha.
export const LEJOS_DE_LA_VIA = 8;
// Un carro va «a lo largo de la vía» si su rumbo no se aparta más que esto del de la vía.
const ALINEADO = 40;

// --------------------------------------------------------------------------- vectores

const unitario = (rumbo) => ({ x: Math.sin(rumbo * GRADO), y: Math.cos(rumbo * GRADO) });
const mas = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const normalizar = (r) => ((r % 360) + 360) % 360;
const rumboDeVector = (v) => normalizar(Math.atan2(v.x, v.y) / GRADO);
// La derecha de quien mira en la dirección unitaria `u`.
const derechaDe = (u) => ({ x: u.y, y: -u.x });

function bezier(a, control, b, t) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * control.y + t * t * b.y };
}

// ----------------------------------------------------------------------------- la vía

// La vía sobre la que se arma el croquis, en metros alrededor de `centro` (el punto de la vía más
// cercano al pin del paso 3). `tramo`: [[lat, lon], ...] como lo da via.js: 60 m a cada lado, uno
// cada 4 m, en el orden en que está dibujada la vía.
//
// Sin tramo (el mapa no respondió, o no hay vías cerca), una recta imaginaria de 120 m con rumbo
// `rumbo` (o hacia el norte): los casos salen igual, la persona los gira, y la pantalla lo dice.
export function viaDelCroquis({ centro, tramo = null, rumbo = null, nombre = null }) {
  const plano = planoLocal(centro);
  let puntos = null;
  if (Array.isArray(tramo) && tramo.length >= 2) {
    // Dos puntos en el mismo lugar no tienen dirección: se quita el repetido.
    puntos = [];
    for (const [lat, lon] of tramo) {
      const p = plano.aMetros({ lat, lon });
      if (!puntos.length || distancia(puntos.at(-1), p) > 0.01) puntos.push(p);
    }
  }
  const real = !!puntos && puntos.length >= 2;
  if (!real) {
    const u = unitario(Number.isFinite(rumbo) ? rumbo : 0);
    puntos = [mas({ x: 0, y: 0 }, u, -60), mas({ x: 0, y: 0 }, u, 60)];
  }
  const acum = [0];
  const dirs = [];
  for (let i = 1; i < puntos.length; i++) {
    const d = distancia(puntos[i - 1], puntos[i]);
    acum.push(acum[i - 1] + d);
    dirs.push({ x: (puntos[i].x - puntos[i - 1].x) / d, y: (puntos[i].y - puntos[i - 1].y) / d });
  }
  // La dirección en cada vértice es el promedio de los dos pedazos que se juntan ahí. En la curva
  // del ejemplo (radio 13 m, un punto cada 4 m) cada vértice quiebra 18°: sin el promedio, el
  // borde de un carril y las flechas saltaban medio metro en cada vértice.
  const tangentes = puntos.map((_, k) => {
    const a = dirs[Math.max(0, k - 1)];
    const b = dirs[Math.min(dirs.length - 1, k)];
    const suma = { x: a.x + b.x, y: a.y + b.y };
    const largo = Math.hypot(suma.x, suma.y);
    return largo < 1e-6 ? b : { x: suma.x / largo, y: suma.y / largo };
  });
  const via = {
    centro: { lat: centro.lat, lon: centro.lon },
    plano,
    puntos,
    acum,
    dirs,
    tangentes,
    total: acum.at(-1),
    real,
    nombre: nombre || null,
    tramo: real ? tramo.map(([lat, lon]) => [lat, lon]) : null,
    rumbo: real ? null : Number.isFinite(rumbo) ? rumbo : 0,
  };
  via.s0 = proyectarEnLaVia(via, { x: 0, y: 0 }).s;
  return via;
}

// La vía del croquis a partir del análisis del paso 3 (via.js). Sin análisis, la recta imaginaria
// alrededor del pin.
export function viaDesdeElAnalisis(analisis, punto) {
  const a = analisis?.estado === 'ok' ? analisis : null;
  if (!a) return viaDelCroquis({ centro: punto });
  return viaDelCroquis({ centro: a.enLaVia, tramo: a.tramo, nombre: a.via.nombre || (a.via.ruta ? `Ruta ${a.via.ruta}` : null) });
}

// La vía de un croquis guardado: el croquis lleva la suya, para no depender de que el paso 3 siga
// en la memoria del teléfono (iOS recarga la página cuando quiere).
export function viaDesdeGuardado(guardado) {
  const v = guardado.via || {};
  return viaDelCroquis({ centro: guardado.centro, tramo: v.real ? v.tramo : null, rumbo: v.rumbo ?? null, nombre: v.nombre ?? null });
}

function segmentoEn(via, s) {
  let i = 0;
  while (i < via.puntos.length - 2 && s > via.acum[i + 1]) i++;
  return i;
}

// La dirección de la vía en `s`, suave entre vértice y vértice. Fuera del tramo, la de la punta.
export function tangenteEn(via, s) {
  const i = segmentoEn(via, s);
  const largo = via.acum[i + 1] - via.acum[i];
  const f = Math.max(0, Math.min(1, (s - via.acum[i]) / largo));
  const a = via.tangentes[i];
  const b = via.tangentes[i + 1];
  const t = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  const n = Math.hypot(t.x, t.y) || 1;
  return { x: t.x / n, y: t.y / n };
}

export const rumboDeLaVia = (via, s) => rumboDeVector(tangenteEn(via, s));

// El punto a `s` metros a lo largo de la vía y `lado` metros a su derecha (negativo: a la
// izquierda), mirando en el orden en que está dibujada. Fuera del tramo sigue derecho: la vía de
// verdad sigue, el tramo guardado no.
export function puntoDeLaVia(via, s, lado = 0) {
  const i = segmentoEn(via, s);
  const base = mas(via.puntos[i], via.dirs[i], s - via.acum[i]);
  return mas(base, derechaDe(tangenteEn(via, s)), lado);
}

// Dónde cae un punto (en metros) respecto de la vía: { s, lado, rumbo }.
export function proyectarEnLaVia(via, p) {
  let mejor = null;
  for (let i = 0; i < via.puntos.length - 1; i++) {
    const r = proyectarEnSegmento(p, via.puntos[i], via.puntos[i + 1]);
    if (!mejor || r.distancia < mejor.distancia) mejor = { i, t: r.t, distancia: r.distancia };
  }
  const { i } = mejor;
  let { t } = mejor;
  const largo = via.acum[i + 1] - via.acum[i];
  const libre = ((p.x - via.puntos[i].x) * via.dirs[i].x + (p.y - via.puntos[i].y) * via.dirs[i].y) / largo;
  if ((i === 0 && libre < 0) || (i === via.puntos.length - 2 && libre > 1)) t = libre;
  const s = via.acum[i] + t * largo;
  const base = puntoDeLaVia(via, s, 0);
  const tangente = tangenteEn(via, s);
  const d = derechaDe(tangente);
  return { s, lado: (p.x - base.x) * d.x + (p.y - base.y) * d.y, rumbo: rumboDeVector(tangente) };
}

function enLaVia(via, s, lado, sentido) {
  const rumbo = rumboDeLaVia(via, s);
  return { ...via.plano.aGrados(puntoDeLaVia(via, s, lado)), rumbo: normalizar(sentido > 0 ? rumbo : rumbo + 180) };
}

// ---------------------------------------------------------------------------- los carros

// El largo y el ancho con que se dibuja un carro: los de su línea (paso 5) si la persona la eligió,
// los típicos de su carrocería si no. Un Picanto y una Hilux no ocupan lo mismo en la vía.
export function medidasDelCarro(carro) {
  const m = medidasParaDibujar(carro?.linea?.carroceria, carro?.linea?.medidas || {});
  return { largo: Math.round(m.largo * 100) / 100, ancho: Math.round(m.ancho * 100) / 100 };
}

export function quienEs(carro) {
  if (carro.quien === 'tuyo') return 'tu carro';
  return carro.letra === 'B' ? 'el otro' : 'otro carro';
}

function carroDelCroquis(carro, lugar, movimiento) {
  const m = medidasDelCarro(carro);
  return { letra: carro.letra, quien: carro.quien, lat: lugar.lat, lon: lugar.lon, rumbo: lugar.rumbo, movimiento, largo: m.largo, ancho: m.ancho };
}

// ------------------------------------------------------------------------------ los casos

// Cada caso, en metros desde el golpe a lo largo de la vía (s), a la derecha de su eje (lado) y en
// un sentido (+1: el orden en que está dibujada). Los carros quedan JUSTO ANTES del golpe, a unos
// metros, para que se vean los dos y sus flechas. LA y LB son los largos de A y de B.
const PLANTILLAS = {
  frente: (LA, LB) => ({
    golpe: { s: 0, lado: 0 },
    A: { s: -(LA / 2 + 5), lado: MEDIO_CARRIL, sentido: 1, movimiento: 'adelante' },
    B: { s: LB / 2 + 5, lado: -MEDIO_CARRIL, sentido: -1, movimiento: 'adelante' },
  }),
  detras: (LA, LB) => ({
    golpe: { s: 0, lado: MEDIO_CARRIL },
    A: { s: -(LA / 2 + 3), lado: MEDIO_CARRIL, sentido: 1, movimiento: 'adelante' },
    B: { s: LB / 2 + 0.3, lado: MEDIO_CARRIL, sentido: 1, movimiento: 'quieto' },
  }),
  // B sale de la otra vía, atravesado, desde la izquierda de A. El análisis sabe a cuántos metros
  // hay un cruce pero no hacia dónde va la otra vía: B sale en ángulo recto y la persona lo gira.
  cruce: (LA, LB) => ({
    golpe: { s: 0, lado: MEDIO_CARRIL },
    A: { s: -(LA / 2 + 5), lado: MEDIO_CARRIL, sentido: 1, movimiento: 'adelante' },
    B: { atravesado: LB / 2 + 5, movimiento: 'adelante' },
  }),
  // A, en el carril de la izquierda, se mete al de B.
  carril: () => ({
    golpe: { s: -0.6, lado: 0.55 },
    A: { s: -3, lado: -MEDIO_CARRIL + 0.6, sentido: 1, giro: 14, movimiento: 'adelante' },
    B: { s: 1, lado: MEDIO_CARRIL, sentido: 1, movimiento: 'adelante' },
  }),
  reversa: (LA, LB) => ({
    golpe: { s: 0.4, lado: MEDIO_CARRIL },
    A: { s: LA / 2 + 1, lado: MEDIO_CARRIL, sentido: 1, movimiento: 'reversa' },
    B: { s: -(LB / 2 + 0.3), lado: MEDIO_CARRIL, sentido: 1, movimiento: 'quieto' },
  }),
  // B no se pone: puede ser un poste. Si fue un carro parqueado, la persona toca su ficha y queda
  // justo pasado el golpe (ponerCarro).
  quieto: (LA) => ({
    golpe: { s: 0, lado: MEDIO_CARRIL },
    A: { s: -(LA / 2 + 4), lado: MEDIO_CARRIL, sentido: 1, movimiento: 'adelante' },
  }),
};

// `carros`: los del reporte (carros.js, carrosDelReporte). Solo A y B se ponen solos; C en
// adelante quedan en sus fichas.
export function armarCaso(caso, via, carros) {
  const plantilla = PLANTILLAS[caso];
  if (!plantilla) throw new Error(`No hay un caso «${caso}»`);
  const carroA = carros.find((c) => c.letra === 'A');
  const carroB = carros.find((c) => c.letra === 'B');
  const p = plantilla(medidasDelCarro(carroA).largo, medidasDelCarro(carroB).largo);
  const golpe = puntoDeLaVia(via, via.s0 + p.golpe.s, p.golpe.lado);
  const colocados = [];
  for (const [pos, carro] of [[p.A, carroA], [p.B, carroB]]) {
    if (!pos || !carro) continue;
    let lugar;
    if (pos.atravesado) {
      const rumbo = normalizar(rumboDeLaVia(via, via.s0 + p.golpe.s) + 90);
      lugar = { ...via.plano.aGrados(mas(golpe, unitario(rumbo), -pos.atravesado)), rumbo };
    } else {
      lugar = enLaVia(via, via.s0 + pos.s, pos.lado, pos.sentido);
      if (pos.giro) lugar.rumbo = normalizar(lugar.rumbo + pos.giro);
    }
    colocados.push(carroDelCroquis(carro, lugar, pos.movimiento));
  }
  return { version: VERSION_DEL_CROQUIS, caso, modo: 'guiado', golpe: via.plano.aGrados(golpe), carros: colocados, flechas: [] };
}

// «Ninguno se parece»: ningún carro puesto y el golpe en el punto del paso 3. Si ya había algo
// armado, se queda: la persona sigue a mano desde ahí.
export function croquisLibre(via, anterior = null) {
  if (anterior) {
    const flechas = anterior.modo === 'libre' ? anterior.flechas : flechasDelCroquis(via, anterior).map((f) => ({ letra: f.letra, puntos: f.puntos }));
    return { ...anterior, caso: LIBRE, modo: 'libre', flechas };
  }
  return { version: VERSION_DEL_CROQUIS, caso: LIBRE, modo: 'libre', golpe: via.plano.aGrados(puntoDeLaVia(via, via.s0, 0)), carros: [], flechas: [] };
}

// Pone en el mapa un carro que estaba en su ficha: atrás del golpe por su carril o adelante en el
// de enfrente, sin caer encima de otro. En «Contra algo quieto», B queda parqueado justo pasado el
// golpe: es lo que se espera si lo quieto era un carro.
export function ponerCarro(croquis, via, carro) {
  if (croquis.carros.some((c) => c.letra === carro.letra)) return croquis;
  const sGolpe = croquis.golpe ? proyectarEnLaVia(via, via.plano.aMetros(croquis.golpe)).s : via.s0;
  const ocupados = croquis.carros.map((c) => via.plano.aMetros(c));
  const libre = (lugar) => ocupados.every((o) => distancia(o, via.plano.aMetros(lugar)) > 4.5);
  let lugar = null;
  let movimiento = 'adelante';
  if (croquis.caso === 'quieto' && carro.letra === 'B') {
    lugar = enLaVia(via, sGolpe + medidasDelCarro(carro).largo / 2 + 0.3, MEDIO_CARRIL, 1);
    movimiento = 'quieto';
  }
  for (let k = 1; (!lugar || !libre(lugar)) && k <= 16; k++) {
    const atras = k % 2 === 1;
    const s = sGolpe + (atras ? -1 : 1) * (Math.ceil(k / 2) * 7 + 2);
    lugar = enLaVia(via, s, atras ? MEDIO_CARRIL : -MEDIO_CARRIL, atras ? 1 : -1);
    movimiento = 'adelante';
  }
  return { ...croquis, carros: [...croquis.carros, carroDelCroquis(carro, lugar, movimiento)] };
}

export function quitarCarro(croquis, letra) {
  return { ...croquis, carros: croquis.carros.filter((c) => c.letra !== letra), flechas: croquis.flechas.filter((f) => f.letra !== letra) };
}

// `cambio`: lo que se mezcla en el carro (lat, lon, rumbo, movimiento).
export function cambiarCarro(croquis, letra, cambio) {
  return {
    ...croquis,
    carros: croquis.carros.map((c) => (c.letra === letra ? { ...c, ...cambio, ...(cambio.rumbo != null ? { rumbo: normalizar(cambio.rumbo) } : {}) } : c)),
  };
}

// «Cambiar A y B»: se intercambian dónde iban y cómo, no quiénes son.
export function intercambiar(croquis, a = 'A', b = 'B') {
  const ca = croquis.carros.find((c) => c.letra === a);
  const cb = croquis.carros.find((c) => c.letra === b);
  if (!ca || !cb) return croquis;
  const pose = (c) => ({ lat: c.lat, lon: c.lon, rumbo: c.rumbo, movimiento: c.movimiento });
  return {
    ...croquis,
    carros: croquis.carros.map((c) => (c.letra === a ? { ...c, ...pose(cb) } : c.letra === b ? { ...c, ...pose(ca) } : c)),
    flechas: croquis.flechas.map((f) => (f.letra === a ? { ...f, letra: b } : f.letra === b ? { ...f, letra: a } : f)),
  };
}

// La flecha a mano de un carro (modo libre): una por carro, la nueva reemplaza la vieja.
export function ponerFlecha(croquis, letra, puntos) {
  return { ...croquis, flechas: [...croquis.flechas.filter((f) => f.letra !== letra), { letra, puntos }] };
}

// ----------------------------------------------------------------------------- las flechas

function recortarFinal(puntos, metros) {
  const salida = puntos.slice();
  let quedan = metros;
  while (salida.length >= 2 && quedan > 0) {
    const b = salida.at(-1);
    const a = salida.at(-2);
    const d = distancia(a, b);
    if (d > quedan) {
      salida[salida.length - 1] = mas(b, { x: (a.x - b.x) / d, y: (a.y - b.y) / d }, quedan);
      return salida;
    }
    if (salida.length === 2) return salida; // no se come la flecha entera
    quedan -= d;
    salida.pop();
  }
  return salida;
}

// La flecha de un carro en el modo guiado: de dónde venía (COLA metros detrás de él, por su
// carril) hasta el golpe si el golpe le queda adelante; si no, hasta un poco más allá de su
// trompa. Si el carro va a lo largo de la vía, la flecha sigue la curva de la vía; si va atravesado
// o fuera de ella, sale derecha y se dobla hacia el golpe. Un carro quieto no tiene flecha.
//
// `recorte`: metros que se le quitan al final cuando llega al golpe, para que la punta no quede
// escondida debajo de la estrella (la pantalla lo calcula con el zoom). Devuelve
// { puntos: [{lat, lon}], alGolpe } o null.
export function flechaAutomatica(via, carro, golpe, { recorte = 0, cola = COLA } = {}) {
  if (!carro || carro.movimiento === 'quieto') return null;
  const avance = normalizar(carro.rumbo + (carro.movimiento === 'reversa' ? 180 : 0));
  const C = via.plano.aMetros(carro);
  const G = golpe ? via.plano.aMetros(golpe) : null;
  const medio = (carro.largo || 4.2) / 2;
  const pc = proyectarEnLaVia(via, C);
  let sentido = 0;
  if (Math.abs(pc.lado) <= LEJOS_DE_LA_VIA) {
    if (diferenciaAngular(avance, pc.rumbo) <= ALINEADO) sentido = 1;
    else if (diferenciaAngular(avance, pc.rumbo + 180) <= ALINEADO) sentido = -1;
  }
  let puntos = [];
  let alGolpe = false;
  if (sentido) {
    const pg = G ? proyectarEnLaVia(via, G) : null;
    alGolpe = !!pg && Math.abs(pg.lado) <= LEJOS_DE_LA_VIA && (pg.s - pc.s) * sentido > 0.5 && Math.abs(pg.s - pc.s) <= 45;
    for (let k = cola; k > 0; k -= 1) puntos.push(puntoDeLaVia(via, pc.s - sentido * k, pc.lado));
    const fin = alGolpe ? pg.s : pc.s + sentido * (medio + 1.5);
    const pasos = Math.max(1, Math.ceil(Math.abs(fin - pc.s)));
    for (let k = 0; k <= pasos; k++) {
      const f = k / pasos;
      puntos.push(puntoDeLaVia(via, pc.s + (fin - pc.s) * f, alGolpe ? pc.lado + (pg.lado - pc.lado) * f : pc.lado));
    }
  } else {
    const u = unitario(avance);
    puntos = [mas(C, u, -cola), C];
    const d = G ? distancia(C, G) : 0;
    alGolpe = !!G && d > 0.5 && diferenciaAngular(rumboEntre(C, G), avance) < 75;
    if (alGolpe) {
      const control = mas(C, u, d / 2);
      for (let k = 1; k <= 12; k++) puntos.push(bezier(C, control, G, k / 12));
    } else {
      puntos.push(mas(C, u, medio + 1.5));
    }
  }
  if (alGolpe && recorte > 0) puntos = recortarFinal(puntos, recorte);
  return { puntos: puntos.map((p) => via.plano.aGrados(p)), alGolpe };
}

// Las flechas que se dibujan y se guardan: las automáticas en el modo guiado, las de la persona
// en el libre. [{ letra, puntos: [{lat, lon}] }]
export function flechasDelCroquis(via, croquis, { recorte = 0 } = {}) {
  if (croquis.modo === 'libre') return croquis.flechas.filter((f) => croquis.carros.some((c) => c.letra === f.letra));
  const salida = [];
  for (const carro of croquis.carros) {
    const flecha = flechaAutomatica(via, carro, croquis.golpe, { recorte });
    if (flecha) salida.push({ letra: carro.letra, puntos: flecha.puntos });
  }
  return salida;
}

// La punta de una flecha, en metros: un triángulo con la punta en el último punto, apuntando como
// el último pedazo de `largo` metros (no como los dos últimos puntos: un trazo a mano tiembla al
// final y la punta salía torcida).
export function puntaDeFlecha(puntos, { largo = 2.4, ancho = largo * 0.9 } = {}) {
  if (!puntos || puntos.length < 2) return null;
  const fin = puntos.at(-1);
  const plano = planoLocal(fin);
  const F = { x: 0, y: 0 };
  let k = puntos.length - 2;
  let A = plano.aMetros(puntos[k]);
  while (k > 0 && distancia(A, F) < largo) A = plano.aMetros(puntos[--k]);
  const d = distancia(A, F);
  if (d < 1e-6) return null;
  const u = { x: (F.x - A.x) / d, y: (F.y - A.y) / d };
  const base = mas(F, u, -largo);
  const r = derechaDe(u);
  return [F, mas(base, r, ancho / 2), mas(base, r, -ancho / 2)].map((p) => plano.aGrados(p));
}

// Douglas-Peucker en metros: un trazo con el dedo trae un punto cada pocos píxeles, temblores
// incluidos. Lo que se aparta menos de `tolerancia` de la línea se quita.
export function simplificarTrazo(puntos, tolerancia = 0.35) {
  if (!Array.isArray(puntos) || puntos.length < 3) return Array.isArray(puntos) ? puntos.slice() : [];
  const plano = planoLocal(puntos[0]);
  const m = puntos.map((p) => plano.aMetros(p));
  const guardar = new Array(m.length).fill(false);
  guardar[0] = true;
  guardar[m.length - 1] = true;
  const pendientes = [[0, m.length - 1]];
  while (pendientes.length) {
    const [i, j] = pendientes.pop();
    let mayor = -1;
    let cual = -1;
    for (let k = i + 1; k < j; k++) {
      const d = proyectarEnSegmento(m[k], m[i], m[j]).distancia;
      if (d > mayor) {
        mayor = d;
        cual = k;
      }
    }
    if (mayor > tolerancia) {
      guardar[cual] = true;
      pendientes.push([i, cual], [cual, j]);
    }
  }
  return puntos.filter((_, k) => guardar[k]);
}

export function largoDelTrazo(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 2) return 0;
  const plano = planoLocal(puntos[0]);
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distancia(plano.aMetros(puntos[i - 1]), plano.aMetros(puntos[i]));
  return total;
}

// -------------------------------------------------------------------------- en palabras

// «la Vía Los Verjones - Patios», «la Avenida Carrera 7», «la vía Puente Aranda».
function conArticulo(nombre) {
  return /^(v[ií]a|avenida|calle|carrera|autopista|diagonal|transversal|ruta|variante|troncal|circunvalar|glorieta|carretera|vereda)\b/i.test(nombre) ? `la ${nombre}` : `la vía ${nombre}`;
}

// Lo que quedó dibujado, en frases cortas, para leerlo antes de darlo por hecho y para el
// expediente. No dice nada que el dibujo no diga: ni velocidades ni culpas.
export function relatoDelCroquis(croquis, via = null) {
  const lineas = [`${tituloDelCaso(croquis.caso)}.`];
  const carros = [...croquis.carros].sort((a, b) => a.letra.localeCompare(b.letra));
  for (const c of carros) {
    const quien = `${c.letra}, ${quienEs(c)},`;
    if (c.movimiento === 'quieto') lineas.push(`${quien} estaba quieto.`);
    else if (c.movimiento === 'reversa') lineas.push(`${quien} iba en reversa hacia el ${puntoCardinal(c.rumbo + 180)}.`);
    else lineas.push(`${quien} iba hacia el ${puntoCardinal(c.rumbo)}.`);
  }
  if (croquis.golpe && via?.real && via.nombre && Math.abs(proyectarEnLaVia(via, via.plano.aMetros(croquis.golpe)).lado) <= LEJOS_DE_LA_VIA) {
    lineas.push(`El golpe fue en ${conArticulo(via.nombre)}.`);
  }
  return lineas;
}

// Lo que falta para poder darlo por hecho. Lo demás es lo que la persona declara: si B no está,
// puede ser que lo quieto fuera un poste, o que el otro se fue.
export function faltaParaTerminar(croquis) {
  const falta = [];
  if (!croquis.carros.some((c) => c.letra === 'A')) falta.push('Falta tu carro (A): toca su ficha, debajo del mapa, para ponerlo.');
  if (!croquis.golpe) falta.push('Falta marcar dónde fue el golpe.');
  return falta;
}

// ---------------------------------------------------------------------------- guardarlo

const r7 = (n) => Math.round(n * 1e7) / 1e7; // 1 cm
const r1 = (n) => Math.round(n * 10) / 10;
const punto7 = (p) => (p ? { lat: r7(p.lat), lon: r7(p.lon) } : null);

// Lo que va al reporte (reporte-bd.js, guardarDatos). Lleva su vía y las flechas ya hechas: la zona
// en 3D y el expediente lo dibujan sin rehacer nada, y sin el paso 3 en la memoria.
// `punto`: el pin del paso 3; `hora`: la del choque (ISO); `hecho`: cuándo la persona dijo «Listo».
export function croquisParaGuardar(croquis, via, { punto = null, ejemplo = false, hora = null, hecho = null } = {}) {
  return {
    version: VERSION_DEL_CROQUIS,
    caso: croquis.caso,
    modo: croquis.modo,
    punto: punto7(punto),
    centro: punto7(via.centro),
    via: { real: via.real, nombre: via.nombre, tramo: via.real ? via.tramo.map(([lat, lon]) => [r7(lat), r7(lon)]) : null, rumbo: via.real ? null : via.rumbo },
    golpe: punto7(croquis.golpe),
    carros: croquis.carros.map((c) => ({ letra: c.letra, quien: c.quien, lat: r7(c.lat), lon: r7(c.lon), rumbo: r1(normalizar(c.rumbo)), movimiento: c.movimiento, largo: c.largo, ancho: c.ancho })),
    flechas: flechasDelCroquis(via, croquis).map((f) => ({ letra: f.letra, puntos: f.puntos.map(punto7) })),
    ejemplo: !!ejemplo,
    hora,
    hecho,
  };
}

// Un croquis guardado vuelve a ser uno que se puede editar.
export function croquisDesdeGuardado(g) {
  return {
    version: g.version,
    caso: g.caso,
    modo: g.modo,
    golpe: g.golpe,
    carros: g.carros.map((c) => ({ ...c })),
    flechas: g.modo === 'libre' ? g.flechas.map((f) => ({ letra: f.letra, puntos: f.puntos.map((p) => ({ ...p })) })) : [],
  };
}

export const croquisUtilizable = (g) => !!g && g.version === VERSION_DEL_CROQUIS && Array.isArray(g.carros) && !!g.centro;

// ------------------------------------------------------------------------ para el mapa

// Metros que mide un píxel de pantalla en el mapa (teselas de 256, la medida de Leaflet).
export function metrosPorPixel(lat, zoom) {
  return (156543.03392 * Math.cos(lat * GRADO)) / 2 ** zoom;
}

// La caja que encierra todo lo dibujado: [[sur, oeste], [norte, este]].
export function limitesDelCroquis(croquis, flechas = []) {
  const puntos = [...croquis.carros, ...flechas.flatMap((f) => f.puntos), ...(croquis.golpe ? [croquis.golpe] : [])];
  if (!puntos.length) return null;
  const lats = puntos.map((p) => p.lat);
  const lons = puntos.map((p) => p.lon);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}
