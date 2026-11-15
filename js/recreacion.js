// La recreación del choque: el croquis del paso 7 en movimiento sobre la maqueta 3D, para mirar lo
// declarado desde donde se quiera: con todos los carros en el cuadro o detrás de cada uno.
// Joan la pidió el vie 13-nov-2026 («recrear un video del accidente») y otra vez el sáb 14-nov
// («videos interactivos»). Un video hecho con IA inventa lo que no sabe; esto no inventa nada.
//
// Qué declara el croquis (croquis.js): dónde iba cada carro JUSTO ANTES del golpe y con la trompa
// hacia dónde, de dónde venía (su flecha) y dónde fue el golpe. De ahí sale la película, y nada más:
//  - Cada carro va por su flecha, suavizada, y pasa EXACTAMENTE por donde lo puso el croquis, con la
//    trompa como la puso. La trompa mira hacia donde se mueve el carro, salvo que el croquis lo deje
//    atravesado respecto de su flecha (más de LADEA_DESDE): entonces va por la flecha y se va
//    ladeando en los últimos metros, y la página lo dice.
//  - El que va hacia el golpe (su flecha pasa por él o termina cerca) sigue hasta tocar al otro. El
//    que no (el golpe le quedó al lado o detrás: le pegaron) llega justo a donde lo puso el croquis.
//    Antes del 14-nov (noche) ese seguía de largo hasta la punta de su flecha, que en el modo guiado
//    va metro y medio más allá de su trompa, y en «Al cambiar de carril» los carros nunca se tocaban.
//  - Nadie declaró velocidades. Por eso todos arrancan a la misma distancia de donde los puso el
//    croquis y, siempre que se puede, van a la MISMA rapidez y pasan a la vez por el croquis. Antes
//    cada uno recorría su flecha entera en el mismo tiempo, y el de la flecha larga se veía más rápido
//    (16 % en la curva del ejemplo). Hay un caso en que así no se tocan nunca: por detrás con los dos
//    andando. Ahí ('alcance') el de atrás va más rápido, lo justo para alcanzar al otro donde lo dejó
//    el croquis, y la página lo dice. Cada uno arranca detrás de su pose, como en el croquis: si cada
//    uno arrancara al comienzo de su flecha, una flecha larga ponía al de adelante detrás del otro y
//    la película invertía quién le pegó a quién (revisión del 14-nov).
//  - El golpe es el primer instante en que los contornos de dos carros se tocan. Si no se tocan (un
//    poste, un croquis a mano que no los junta), la película para cuando todos llegan a su meta.
//  - Después del golpe la película se queda quieta: cómo quedaron los carros lo cuentan las fotos de
//    la escena, no una física inventada.
// Todo en metros sobre el plano local del golpe (geo.js: x al este, y al norte). Puro: se prueba en
// Node; la página (pantalla-recreacion.js) lo pone en la maqueta con maqueta-carros.js.
import { planoLocal } from './geo.js';

const GRADO = Math.PI / 180;

// La fracción de la película en que llega el golpe; el resto es el golpe quieto, para mirarlo.
export const GOLPE_EN = 0.8;
export const DURACION_MS = 9000;

// Cada cuánto se toma un punto del camino de un carro (m).
const PASO = 0.25;
// El suavizado del camino, en metros a cada lado. Las flechas del modo guiado siguen la vía por
// tramos rectos (puntoDeLaVia) y en la curva del ejemplo se quiebran 10 a 30° cada 4 m: la trompa
// iba de lado hasta 22° (revisión del 14-nov).
const SUAVE = 1.5;
// En cuántos metros entra el carro a su pose del croquis y sale de ella.
const EMPALME = 6;
// Menos que esto de camino hasta su meta y el carro no tiene de dónde venir: la flecha arranca en
// él (alguien la dibujó hacia adelante) o es más corta que medio carro.
export const RECORRIDO_MINIMO = 2;
// Una flecha «llega al golpe» si, más allá del carro, pasa a menos de esto de él y más cerca que el
// carro. Si su punta ya está así de cerca, se estira derecho otro tanto: a mano, la flecha suele
// quedarse un metro antes de la estrella.
const LLEGA_AL_GOLPE = 3.5;
// Hasta esto de torcido respecto de su flecha, el carro gira por su camino hacia la pose del croquis,
// como cualquiera que se cierra (en el modo guiado no pasa de 40°). Más, y ese giro se volvía un
// trompo inventado en el último metro: hasta 190° de ida y vuelta con un carro a 100° (revisión del
// 14-nov). Entonces el carro va por su flecha y se ladea en los últimos EMPALME metros.
const LADEA_DESDE = 45;
// Más girado que esto (casi al revés), lo más probable es que la flecha esté dibujada al revés: el
// carro va por la flecha con la trompa hacia adelante, y se dice.
const TORCIDO_MAXIMO = 110;
// Lo que se acepta como «llegó al golpe» para un carro solo contra algo quieto.
const EN_EL_GOLPE = 0.6;

const normalizar = (r) => ((r % 360) + 360) % 360;
const rumboDe = (dx, dy) => normalizar(Math.atan2(dx, dy) / GRADO);
const vector = (rumbo) => ({ x: Math.sin(rumbo * GRADO), y: Math.cos(rumbo * GRADO) });
// De `a` hacia `b`, entre -180 y 180.
const giro = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
const entre01 = (v) => Math.min(1, Math.max(0, v));

// ------------------------------------------------------------------------------- los caminos

// Un camino: sus puntos, el largo recorrido hasta cada uno y la dirección en cada uno. Los puntos de
// un empalme traen la suya (dx, dy), exacta; los demás, la de la diferencia centrada. Con la cuerda
// entre dos puntos, en la pose del croquis la trompa salía hasta 7° torcida en un carro girado.
function camino(puntos) {
  const limpios = puntos.filter((p, i) => i === 0 || Math.hypot(p.x - puntos[i - 1].x, p.y - puntos[i - 1].y) > 1e-6);
  const acum = [0];
  for (let i = 1; i < limpios.length; i++) acum.push(acum[i - 1] + Math.hypot(limpios[i].x - limpios[i - 1].x, limpios[i].y - limpios[i - 1].y));
  const dirs = limpios.map((p, i) => {
    if (p.dx !== undefined) return { x: p.dx, y: p.dy };
    const a = limpios[Math.max(0, i - 1)];
    const b = limpios[Math.min(limpios.length - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  });
  // `salida`: hacia dónde sigue derecho más allá del final (el que no iba al golpe sigue andando un
  // poco si el otro todavía no lo alcanza).
  return { puntos: limpios, acum, dirs, largo: acum.at(-1), salida: dirs.at(-1) };
}

// El tramo donde cae `s`: i tal que acum[i] <= s <= acum[i + 1]. Búsqueda binaria: la cámara pide
// muchas poses por cuadro.
function tramoEn(c, s) {
  let i = 0;
  let j = c.puntos.length - 1;
  while (j - i > 1) {
    const m = (i + j) >> 1;
    if (c.acum[m] <= s) i = m;
    else j = m;
  }
  return { i, f: Math.min(1, Math.max(0, (s - c.acum[i]) / (c.acum[i + 1] - c.acum[i] || 1))) };
}

function puntoEn(c, s) {
  if (s >= c.largo) {
    const fin = c.puntos.at(-1);
    return { x: fin.x + c.salida.x * (s - c.largo), y: fin.y + c.salida.y * (s - c.largo) };
  }
  const { i, f } = tramoEn(c, Math.max(0, s));
  const a = c.puntos[i];
  const b = c.puntos[i + 1] || a;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Hacia dónde se avanza en `s`: la dirección del camino, mezclada entre punto y punto.
function direccionEn(c, s) {
  if (s >= c.largo) return c.salida;
  const { i, f } = tramoEn(c, Math.max(0, s));
  const a = c.dirs[i];
  const b = c.dirs[i + 1] || a;
  const x = a.x + (b.x - a.x) * f;
  const y = a.y + (b.y - a.y) * f;
  const d = Math.hypot(x, y);
  return d > 1e-9 ? { x: x / d, y: y / d } : a;
}

// El largo recorrido hasta el punto del camino más cercano a `p`.
function proyectar(c, p) {
  let mejor = { s: 0, d: Infinity };
  for (let i = 0; i < c.puntos.length - 1; i++) {
    const a = c.puntos[i];
    const dx = c.puntos[i + 1].x - a.x;
    const dy = c.puntos[i + 1].y - a.y;
    const largo = c.acum[i + 1] - c.acum[i];
    const f = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (largo * largo || 1)));
    const d = Math.hypot(a.x + dx * f - p.x, a.y + dy * f - p.y);
    if (d < mejor.d) mejor = { s: c.acum[i] + f * largo, d };
  }
  return mejor.s;
}

function remuestrear(c) {
  const n = Math.max(1, Math.round(c.largo / PASO));
  return Array.from({ length: n + 1 }, (_, k) => puntoEn(c, (c.largo * k) / n));
}

// Promedio móvil con la ventana encogida en las puntas: el comienzo y el final quedan donde estaban
// (el final de una flecha al golpe ES el golpe).
function suavizar(puntos) {
  const k = Math.round(SUAVE / PASO);
  return puntos.map((p, i) => {
    const r = Math.min(k, i, puntos.length - 1 - i);
    if (r <= 0) return p;
    let x = 0;
    let y = 0;
    for (let j = i - r; j <= i + r; j++) {
      x += puntos[j].x;
      y += puntos[j].y;
    }
    return { x: x / (2 * r + 1), y: y / (2 * r + 1) };
  });
}

// Una curva de Hermite de `p0` a `p1` que sale con la dirección `d0` y llega con `d1` (unitarias),
// sin `p0` y con `p1`. Cada punto lleva la dirección exacta de la curva: en `p1` es `d1`.
function empalme(p0, d0, p1, d1) {
  const L = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const n = Math.max(2, Math.ceil(L / PASO));
  const salida = [];
  for (let k = 1; k <= n; k++) {
    const u = k / n;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    // La derivada, para la dirección.
    const g00 = 6 * u2 - 6 * u;
    const g10 = 3 * u2 - 4 * u + 1;
    const g01 = -6 * u2 + 6 * u;
    const g11 = 3 * u2 - 2 * u;
    const dx = g00 * p0.x + g10 * L * d0.x + g01 * p1.x + g11 * L * d1.x;
    const dy = g00 * p0.y + g10 * L * d0.y + g01 * p1.y + g11 * L * d1.y;
    const largo = Math.hypot(dx, dy) || 1;
    salida.push({ x: h00 * p0.x + h10 * L * d0.x + h01 * p1.x + h11 * L * d1.x, y: h00 * p0.y + h10 * L * d0.y + h01 * p1.y + h11 * L * d1.y, dx: dx / largo, dy: dy / largo });
  }
  return salida;
}

// El camino por el que se mueve un carro: su flecha suavizada, que entra a la pose del croquis
// (`C`, avanzando hacia `avance`) y sale de ella por curvas suaves. Si la persona giró el carro con
// ⟳ (B se cerró en la curva), el carro va girando hacia esa pose en los últimos metros, como
// cualquier carro que se cierra; no llega «derrapando» de lado. Si lo dejó atravesado (más de
// LADEA_DESDE), el camino sigue la flecha y `ladeo` dice cuánto se ladea el carro al llegar a su pose.
// Devuelve el camino y `sDeclarado`, el largo recorrido al pasar por la pose del croquis.
function caminoDelCarro(flecha, C, avance) {
  const suave = camino(suavizar(remuestrear(flecha)));
  const sC = proyectar(suave, C);
  const enLaFlecha = direccionEn(suave, sC);
  const torcido = giro(rumboDe(enLaFlecha.x, enLaFlecha.y), avance);
  const girado = Math.abs(torcido) > TORCIDO_MAXIMO;
  const ladeo = !girado && Math.abs(torcido) > LADEA_DESDE ? torcido : 0;
  const u = girado || ladeo ? enLaFlecha : vector(avance);
  const antes = Math.min(EMPALME, sC * 0.6);
  const despues = Math.min(EMPALME, (suave.largo - sC) * 0.6);
  const puntos = suave.puntos.filter((_, k) => suave.acum[k] < sC - antes - 1e-6);
  if (antes > 0.05) {
    const Q0 = puntoEn(suave, sC - antes);
    puntos.push(Q0, ...empalme(Q0, direccionEn(suave, sC - antes), C, u));
  } else {
    puntos.push({ x: C.x, y: C.y, dx: u.x, dy: u.y });
  }
  let sDeclarado = 0;
  for (let i = 1; i < puntos.length; i++) sDeclarado += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
  if (despues > 0.05) {
    const Q1 = puntoEn(suave, sC + despues);
    puntos.push(...empalme(C, u, Q1, direccionEn(suave, sC + despues)));
    puntos.push(...suave.puntos.filter((_, k) => suave.acum[k] > sC + despues + 1e-6));
  }
  return { ...camino(puntos), sDeclarado, girado, ladeo };
}

// Cuánto se ladea el carro (en grados, sobre la dirección en que avanza) cuando lleva `s` metros: nada
// hasta EMPALME metros antes de su pose del croquis, todo desde ella, y en medio una curva suave.
function ladeoEn(c, s) {
  if (!c.ladeo) return 0;
  const desde = Math.max(0, c.sDeclarado - EMPALME);
  const k = entre01((s - desde) / (c.sDeclarado - desde || 1));
  return c.ladeo * k * k * (3 - 2 * k);
}

// ------------------------------------------------------------------------------- los carros

// El contorno de un carro visto desde arriba: sus cuatro esquinas, la trompa hacia `rumbo`.
export function contornoDelCarro({ x, y, rumbo }, largo, ancho) {
  const u = vector(rumbo);
  const d = { x: u.y, y: -u.x };
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({ x: x + (u.x * largo * a + d.x * ancho * b) / 2, y: y + (u.y * largo * a + d.y * ancho * b) / 2 }));
}

// Dos rectángulos se tocan si ninguno de sus lados los separa (ejes separadores).
export function seTocan(p, q) {
  for (const poligono of [p, q]) {
    for (let i = 0; i < poligono.length; i++) {
      const a = poligono[i];
      const b = poligono[(i + 1) % poligono.length];
      const eje = { x: a.y - b.y, y: b.x - a.x };
      const pp = p.map((v) => v.x * eje.x + v.y * eje.y);
      const qq = q.map((v) => v.x * eje.x + v.y * eje.y);
      if (Math.max(...pp) < Math.min(...qq) || Math.max(...qq) < Math.min(...pp)) return false;
    }
  }
  return true;
}

const poseDeclarada = (c) => ({ ...c.declarado, avance: normalizar(c.declarado.rumbo + (c.reversa ? 180 : 0)) });

// Dónde va un carro cuando ha recorrido `s` metros de su camino.
function poseEn(carro, s) {
  if (!carro.camino) return poseDeclarada(carro);
  const p = puntoEn(carro.camino, s);
  const d = direccionEn(carro.camino, s);
  const avance = rumboDe(d.x, d.y);
  return { x: p.x, y: p.y, rumbo: normalizar(avance + ladeoEn(carro.camino, s) + (carro.reversa ? 180 : 0)), avance };
}

// Cuánto camino lleva el carro en el instante `tau`. En tau = 0 todos arrancan `recorrido` metros
// antes de su pose del croquis, por su flecha.
//  - A la misma rapidez ('parejo'): en tau = 1 TODOS están en su pose del croquis, a la vez. Después
//    siguen a la misma rapidez hasta que se tocan. Así la película pasa por el croquis tal cual, en un
//    instante que la página sabe (tCroquis).
//  - Para alcanzarlo ('alcance'): los que no van al golpe, igual que a la misma rapidez; los que van,
//    lo justo más rápido para llegar a su meta en tau = 1, tocando al otro donde lo dejó el croquis.
function estacion(rec, c, tau) {
  const inicio = c.camino.sDeclarado - rec.recorrido;
  const llegada = rec.ritmo === 'alcance' ? c.meta : c.camino.sDeclarado;
  const s = inicio + (llegada - inicio) * tau;
  // El que va al golpe no se pasa del final de su flecha (más allá ya no hay nada declarado), salvo
  // lo justo para tocar al otro (su `meta`).
  return c.alGolpe ? Math.min(Math.max(c.camino.largo, c.meta), s) : s;
}

// Por qué un carro que no estaba quieto no se mueve en la película.
//  'sin-flecha': no tiene flecha (modo libre).
//  'sin-recorrido': su flecha no dice de dónde venía (arranca en él o es muy corta).
// Los quietos de verdad (`movimiento: 'quieto'`) no llevan motivo: así lo declaró la persona.

// El croquis guardado (croquis.js, croquisParaGuardar) listo para moverse, o null si no hay nada
// que mover: sin golpe, sin carros o con todos declarados quietos. Si ninguno puede moverse por
// otra razón, devuelve la recreación con `nadaSeMueve` para que la página diga por qué.
export function recreacionDelCroquis(croquis) {
  const g = croquis?.golpe;
  if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon) || !Array.isArray(croquis.carros) || !croquis.carros.length) return null;
  if (croquis.carros.every((c) => c.movimiento === 'quieto')) return null;
  const plano = planoLocal(g);
  const carros = croquis.carros.map((c) => {
    const C = plano.aMetros(c);
    const reversa = c.movimiento === 'reversa';
    const base = { letra: c.letra, largo: c.largo || 4.2, ancho: c.ancho || 1.8, reversa, movimiento: c.movimiento, declarado: { x: C.x, y: C.y, rumbo: normalizar(c.rumbo) }, camino: null, motivo: null };
    if (c.movimiento === 'quieto') return base;
    const flecha = (croquis.flechas || []).find((f) => f.letra === c.letra);
    if (!flecha || !Array.isArray(flecha.puntos) || flecha.puntos.length < 2) return { ...base, motivo: 'sin-flecha' };
    const cruda = camino(flecha.puntos.map((p) => plano.aMetros(p)));
    if (!(cruda.largo >= 0.5)) return { ...base, motivo: 'sin-flecha' };
    const cam = caminoDelCarro(cruda, C, normalizar(c.rumbo + (reversa ? 180 : 0)));
    // ¿La flecha sigue hasta el golpe? Dónde pasa más cerca de él, de medio metro más allá del carro
    // en adelante (estirada si su punta ya está cerca), y si eso queda cerca del golpe y más cerca
    // que el carro. En el modo guiado es la flecha de flechaAutomatica con alGolpe, que termina en él.
    // Antes solo se miraba la punta: una flecha a mano que se pasaba del golpe más de 3,5 m (por
    // encima del otro carro) ya no chocaba (revisión del 14-nov).
    const punta = cam.puntos.at(-1);
    const estirar = Math.hypot(punta.x, punta.y) <= LLEGA_AL_GOLPE ? LLEGA_AL_GOLPE : 0;
    let sCerca = null;
    let dCerca = Infinity;
    for (let s = cam.sDeclarado + 0.5; s <= cam.largo + estirar + 1e-9; s += 0.05) {
      const p = puntoEn(cam, s);
      const d = Math.hypot(p.x, p.y);
      if (d < dCerca) {
        dCerca = d;
        sCerca = s;
      }
    }
    const alGolpe = sCerca !== null && dCerca <= LLEGA_AL_GOLPE && dCerca < Math.hypot(C.x, C.y) - 0.3;
    // La meta: la trompa (la cola, en reversa) donde la flecha pasa más cerca del golpe; si no va al
    // golpe, donde lo puso el croquis.
    const meta = alGolpe ? Math.max(cam.sDeclarado, sCerca - base.largo / 2) : cam.sDeclarado;
    // Sin camino antes de su pose del croquis no se sabe de dónde venía: la pantalla del croquis pide
    // dibujar «por dónde venía, hasta el golpe», y una flecha que arranca en el carro no lo dice.
    if (cam.sDeclarado < RECORRIDO_MINIMO) return { ...base, motivo: 'sin-recorrido' };
    return { ...base, camino: cam, alGolpe, meta, girado: cam.girado, ladeo: cam.ladeo };
  });
  const movidos = carros.filter((c) => c.camino);
  const quieta = { plano, carros, ritmo: 'parejo', recorrido: 0, tauGolpe: 0, toque: false, tCroquis: null, pareja: null, hayGolpe: false, nadaSeMueve: true };
  if (!movidos.length) return quieta;

  // La meta del que va al golpe, si hay a quién pegarle: el primer toque contra los demás puestos
  // donde los dejó el croquis (el quieto, o el que no iba al golpe: a ese le pegaron ahí). Puede
  // pasarse de la punta de su flecha hasta medio carro: en una curva el croquis deja al de adelante
  // hasta un metro más allá de la estrella (medido el 14-nov), y sin eso, con los dos andando, el
  // de atrás se quedaba a 30 cm de alcanzarlo.
  for (const c of movidos.filter((x) => x.alGolpe)) {
    const otros = carros.filter((o) => o !== c && !(o.camino && o.alGolpe)).map((o) => contornoDelCarro(poseDeclarada(o), o.largo, o.ancho));
    for (let s = c.camino.sDeclarado; otros.length && s <= c.meta + c.largo; s += 0.05) {
      if (otros.some((o) => seTocan(contornoDelCarro(poseEn(c, s), c.largo, c.ancho), o))) {
        c.meta = s;
        break;
      }
    }
  }

  const recorrido = Math.min(...movidos.map((c) => c.camino.sDeclarado));
  const alGolpe = movidos.filter((c) => c.alGolpe);
  // Hasta dónde se busca el toque: hasta que el centro de los que van al golpe llega a la punta de su
  // flecha (o a su meta). Y dónde para la película si nadie se toca: con su trompa en la punta (un
  // poste).
  const inicioDe = (c) => c.camino.sDeclarado - recorrido;
  const finDeLaBusqueda = (ritmo) => Math.max(1, ...alGolpe.map((c) => (ritmo === 'parejo' ? 1 + (Math.max(c.camino.largo, c.meta) - c.camino.sDeclarado) / recorrido : (Math.max(c.camino.largo, c.meta) - inicioDe(c)) / (c.meta - inicioDe(c)))));
  const sinToque = (ritmo) => (ritmo === 'parejo' ? Math.max(1, ...alGolpe.map((c) => 1 + (c.meta - c.camino.sDeclarado) / recorrido)) : 1);
  const contornosEn = (rec, tau) =>
    carros.map((c) => {
      const pose = poseEn(c, c.camino ? estacion(rec, c, tau) : 0);
      return contornoDelCarro(pose, c.largo, c.ancho);
    });
  // Las letras de los dos que se tocan en `tau`, o null.
  const quienesSeTocan = (rec, tau) => {
    const contornos = contornosEn(rec, tau);
    for (let i = 0; i < carros.length; i++) {
      for (let j = i + 1; j < carros.length; j++) {
        // Dos que no se mueven y se tocan (dos parqueados pegados) no son el golpe.
        if ((carros[i].camino || carros[j].camino) && seTocan(contornos[i], contornos[j])) return [carros[i].letra, carros[j].letra];
      }
    }
    return null;
  };
  // El primer toque, a pasos de 1/250 hasta el fin de la búsqueda, afinado después a la mitad doce
  // veces.
  const buscar = (ritmo) => {
    const rec = { ritmo, recorrido };
    const fin = finDeLaBusqueda(ritmo);
    const pasos = Math.ceil(250 * fin);
    let antes = 0;
    for (let k = 0; k <= pasos; k++) {
      const tau = (fin * k) / pasos;
      let pareja = quienesSeTocan(rec, tau);
      if (pareja) {
        if (k === 0) return { toque: true, tau: 0, pareja };
        let a = antes;
        let b = tau;
        for (let n = 0; n < 12; n++) {
          const m = (a + b) / 2;
          const enM = quienesSeTocan(rec, m);
          if (enM) {
            b = m;
            pareja = enM;
          } else a = m;
        }
        return { toque: true, tau: b, pareja };
      }
      antes = tau;
    }
    return { toque: false, tau: sinToque(ritmo), pareja: null };
  };
  // Primero a la misma rapidez. Si así no se tocan (por detrás con los dos andando, la distancia entre
  // ellos no cambia nunca), el de atrás lo alcanza; si tampoco, se queda la misma rapidez y nadie se
  // toca. El toque del alcance cae cerca de tau = 1 (ahí cada uno está en su meta): uno mucho antes
  // es un dibujo que los cruza por otro lado, y no se acepta.
  let ritmo = 'parejo';
  let r = buscar('parejo');
  if (movidos.length > 1 && !r.toque) {
    const otro = buscar('alcance');
    if (otro.toque && otro.tau >= 0.5) {
      ritmo = 'alcance';
      r = otro;
    }
  }
  // Se tocan desde que arrancan: el dibujo los pone encima uno del otro todo el camino.
  if (r.toque && r.tau < 0.02) return { ...quieta, ritmo, recorrido, toque: true, pareja: r.pareja, yaSeTocan: true };
  // El instante de la película en que los carros quedan tal cual el croquis (solo a la misma rapidez,
  // y si no se tocaron antes de llegar a él).
  const tCroquis = ritmo === 'parejo' && r.tau >= 1 ? GOLPE_EN / r.tau : null;
  // Sin toque, ¿alguien llegó al golpe? Un carro solo contra un poste sí, si su flecha va hasta él;
  // si su flecha se queda corta, la película no puede decir «el golpe» (revisión del 14-nov).
  const enLaMeta = { ritmo, recorrido };
  const llega = movidos.some((c) => distanciaAlCarro(poseEn(c, estacion(enLaMeta, c, r.tau)), c, { x: 0, y: 0 }) < EN_EL_GOLPE);
  const hayGolpe = r.toque || (carros.length === 1 && llega);
  return { plano, carros, ritmo, recorrido, tauGolpe: r.tau, toque: r.toque, tCroquis, pareja: r.pareja, hayGolpe, nadaSeMueve: false };
}

// Lo que hay de un punto al contorno de un carro (0 si cae adentro).
function distanciaAlCarro(pose, carro, punto) {
  const u = vector(pose.rumbo);
  const dx = punto.x - pose.x;
  const dy = punto.y - pose.y;
  const aLoLargo = Math.abs(dx * u.x + dy * u.y) - carro.largo / 2;
  const aLoAncho = Math.abs(dx * u.y - dy * u.x) - carro.ancho / 2;
  return Math.hypot(Math.max(0, aLoLargo), Math.max(0, aLoAncho));
}

// Dónde está cada carro en el momento `t` de la película (0 a 1). `golpe`: si ya pasó y hubo golpe
// (se tocaron, o el carro solo llegó a lo que tenía al frente): entonces se encienden el anillo y las
// piezas dañadas. Si el dibujo no los junta, no se enciende nada que diga «aquí se pegaron».
export function fotograma(rec, t) {
  const tau = rec.tauGolpe * Math.min(1, Math.max(0, t) / GOLPE_EN);
  return {
    carros: rec.carros.map((c) => ({ letra: c.letra, largo: c.largo, ancho: c.ancho, ...poseEn(c, c.camino ? estacion(rec, c, tau) : 0) })),
    golpe: t >= GOLPE_EN && rec.hayGolpe,
  };
}

// Los carros tal cual los puso el croquis, justo antes del golpe. Es lo que se ve antes de reproducir:
// la zona muestra lo declarado, no el primer cuadro de la película (12 m más atrás).
export function fotogramaDelCroquis(rec) {
  return { carros: rec.carros.map((c) => ({ letra: c.letra, largo: c.largo, ancho: c.ancho, ...poseDeclarada(c) })), golpe: false };
}

// --------------------------------------------------------------------------------- las cámaras

// Las dos cámaras de la película, en metros del plano del golpe.
//
// La que sigue a un carro va 12 m detrás de su cola y 4,5 m arriba, en la línea que va del golpe
// (el origen del plano) al carro, mirando al golpe: el carro queda en medio del cuadro, el golpe
// al fondo, y el otro carro entra al acercarse. Un teléfono en vertical solo abre 26° a lo ancho,
// y en la curva del ejemplo se probaron las otras dos (medido el 14-nov): mirando derecho al frente
// el otro carro no salía nunca, y puesta justo detrás de la cola mirando al golpe se salía el
// propio carro. A 8 m el carro tapaba media pantalla. El punto al que se mira va en el suelo
// (alto 0): MapLibre pone el centro de la vista sobre el relieve.
//
// Si el golpe no le queda al frente (a más de 60° de la trompa, de costado o ya detrás), la cámara
// se va poniendo detrás de la cola y mira al carro: del todo a 90°. El cambio se mide en ángulo y en
// metros, y además la cámara se promedia en medio segundo de película a cada lado. Con la entrada
// medida solo en metros, en una glorieta dibujada a mano giraba 102° en medio segundo, con picos de
// 36° en un cuadro (revisión del 14-nov); con esto, 29° y 1,1°. En un retorno en U de 5 m de radio
// todavía gira 41° en medio segundo: ahí el carro mismo da media vuelta.
//
// No hay cámara «desde los ojos del conductor», y es a propósito. Se construyó y se quitó el 14-nov:
// la maqueta abierta no tiene árboles, barrancos ni carros parqueados, así que mostraba una vía
// despejada y daba a entender que el conductor veía al otro. Sobre qué se alcanzaba a ver solo
// hablan las fotos de la escena.
const DETRAS = 12;
const ALTO_DE_LA_CAMARA = 4.5;
const PROMEDIO = { pasos: 5, ancho: 0.012 };

function camaraSinPromedio(rec, carro, t) {
  const pose = fotograma(rec, t).carros.find((c) => c.letra === carro.letra);
  const u = vector(pose.avance);
  const atras = carro.largo / 2 + DETRAS;
  // Del carro al golpe, y cuánto de eso le queda al frente.
  const g = { x: -pose.x, y: -pose.y };
  const lejos = Math.hypot(g.x, g.y);
  const alFrente = lejos > 1e-6 ? entre01(Math.min((g.x * u.x + g.y * u.y) / 2, (g.x * u.x + g.y * u.y) / lejos / 0.5)) : 0;
  const peso = Math.min(1, lejos / 6) * alFrente;
  // Entre «detrás de la cola» y «en la línea del golpe». Las dos apuntan al frente, así que la
  // mezcla nunca se anula.
  const d = { x: u.x * (1 - peso) + (g.x / (lejos || 1)) * peso, y: u.y * (1 - peso) + (g.y / (lejos || 1)) * peso };
  const largo = Math.hypot(d.x, d.y) || 1;
  return {
    desde: { x: pose.x - (d.x / largo) * atras, y: pose.y - (d.y / largo) * atras },
    hacia: { x: pose.x + g.x * alFrente, y: pose.y + g.y * alFrente },
  };
}

export function camaraQueSigue(rec, letra, t) {
  const carro = rec.carros.find((c) => c.letra === letra);
  if (!carro) return null;
  const desde = { x: 0, y: 0 };
  const hacia = { x: 0, y: 0 };
  let n = 0;
  for (let k = -PROMEDIO.pasos; k <= PROMEDIO.pasos; k++) {
    const c = camaraSinPromedio(rec, carro, entre01(t + k * PROMEDIO.ancho));
    desde.x += c.desde.x;
    desde.y += c.desde.y;
    hacia.x += c.hacia.x;
    hacia.y += c.hacia.y;
    n++;
  }
  return { desde: { x: desde.x / n, y: desde.y / n, alto: ALTO_DE_LA_CAMARA }, hacia: { x: hacia.x / n, y: hacia.y / n, alto: 0 } };
}

// La que los muestra a todos: el centro y el radio (en metros) del círculo donde caben los carros
// en ese momento y el golpe, con aire para un carro alrededor. Como los carros se van juntando, el
// círculo se cierra solo: la película empieza abierta y termina encima del golpe, sin que nadie
// escoja un acercamiento.
export const AIRE_DEL_ENCUADRE = 5;
export function encuadreDeLosCarros(rec, t) {
  const puntos = [{ x: 0, y: 0 }, ...fotograma(rec, t).carros];
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const centro = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  return { centro, radio: Math.max(...puntos.map((p) => Math.hypot(p.x - centro.x, p.y - centro.y))) + AIRE_DEL_ENCUADRE };
}

// ---------------------------------------------------------------------------------- en palabras

// Lo que la página dice debajo de la película: cómo se mueven y por qué alguno no. Sin velocidades:
// solo lo que la película hace y de dónde sale.
const enLista = (letras) => (letras.length < 2 ? letras.join('') : `${letras.slice(0, -1).join(', ')} y ${letras.at(-1)}`);
// «4,8 m», con el espacio que no parte el renglón.
const metros = (m) => `${m.toFixed(1).replace('.', ',')} m`;
const MISMA_RAPIDEZ = 'porque nadie declaró velocidades: la película no dice quién iba más rápido ni si alguien frenó.';

// Cada frase nombra a los carros de los que habla: con tres carros, «todos» y «el otro» dejaban de
// ser ciertos (revisión del 14-nov).
export function avisosDeLaRecreacion(rec) {
  const avisos = [];
  const movidos = rec.carros.filter((c) => c.camino);
  if (!rec.nadaSeMueve) {
    // Lo que recorre cada uno en la película hasta tau = 1: los que no van al golpe, `recorrido`.
    const recorre = (c) => (rec.ritmo === 'alcance' ? c.meta - c.camino.sDeclarado : 0) + rec.recorrido;
    if (rec.ritmo === 'alcance') {
      // Solo los dos que se tocan: un tercero que pasa por el otro carril no tiene que ir ni más
      // rápido ni más despacio que nadie.
      const pareja = movidos.filter((c) => rec.pareja?.includes(c.letra));
      const lento = Math.min(...pareja.map(recorre));
      const rapidos = pareja.filter((c) => recorre(c) > lento + 0.05).map((c) => c.letra);
      const lentos = pareja.filter((c) => recorre(c) <= lento + 0.05).map((c) => c.letra);
      if (rapidos.length && lentos.length) avisos.push(`Para alcanzarse donde quedaron en el croquis, ${enLista(rapidos)} ${rapidos.length > 1 ? 'tienen' : 'tiene'} que ir más rápido que ${enLista(lentos)}. Cuánto más, nadie lo declaró: la película lo saca de qué tan lejos los dejó el dibujo.`);
      else avisos.push(`${enLista(movidos.map((c) => c.letra))} van a la misma rapidez, ${MISMA_RAPIDEZ}`);
    } else if (movidos.length > 1) {
      avisos.push(`${enLista(movidos.map((c) => c.letra))} van a la misma rapidez, ${MISMA_RAPIDEZ}`);
    } else if (movidos.length === 1) {
      avisos.push('Nadie declaró la velocidad: la película no dice qué tan rápido iba ni si frenó.');
    }
    // Quién arranca adentro de su flecha, y por qué: todos arrancan a la misma distancia de donde los
    // puso el croquis, y una flecha que trae más camino detrás del carro no se recorre entera.
    const adentro = movidos.filter((c) => c.camino.sDeclarado - rec.recorrido > 1);
    if (adentro.length) {
      const cuanto = enLista(adentro.map((c) => metros(c.camino.sDeclarado - rec.recorrido)));
      avisos.push(
        `${enLista(adentro.map((c) => c.letra))} ${adentro.length > 1 ? `arrancan adentro de su flecha (${cuanto})` : `arranca ${cuanto} adentro de su flecha`}: la película arranca a cada carro a ${metros(rec.recorrido)} de donde lo puso el croquis.`,
      );
    }
  }
  for (const c of rec.carros) {
    if (c.motivo === 'sin-flecha') avisos.push(`${c.letra} no tiene flecha: se queda donde lo puso el croquis, no porque estuviera quieto.`);
    if (c.motivo === 'sin-recorrido') avisos.push(`La flecha de ${c.letra} no muestra de dónde venía (arranca en el carro o es muy corta): la película lo deja donde lo puso el croquis.`);
    if (c.girado) avisos.push(`${c.letra} quedó en el croquis casi al revés de su flecha: la película lo mueve por la flecha.`);
    if (c.ladeo) avisos.push(`${c.letra} quedó en el croquis atravesado respecto de su flecha (unos ${Math.round(Math.abs(c.ladeo))}°): la película lo va girando en los últimos metros sin cambiarle el camino. Si derrapó, y cómo, nadie lo declaró.`);
  }
  if (rec.yaSeTocan) avisos.push('Así como quedaron dibujados, los carros se tocan desde que arrancan: no hay película que mostrar.');
  return avisos;
}

// El renglón que acompaña cada momento. `t` null: lo que se ve antes de reproducir (el croquis).
export function textoDeLaFase(rec, t) {
  if (rec.yaSeTocan) return 'Así quedaron en el croquis. Dibujados así, se tocan desde que arrancan: no hay película que mostrar.';
  if (rec.nadaSeMueve) return 'Así quedaron en el croquis. Ningún carro tiene por dónde moverse (abajo dice por qué).';
  if (t === null) return 'Así quedaron en el croquis, justo antes del golpe. Toca «Ver cómo fue» para verlo andar.';
  if (t < GOLPE_EN) return 'Antes del golpe: cada carro por su flecha.';
  if (rec.toque) return 'El golpe. De aquí en adelante la recreación se queda quieta: cómo quedaron los carros lo cuentan las fotos de la escena.';
  if (rec.carros.length > 1) return 'Así como quedaron dibujados, los carros no alcanzan a tocarse. La recreación para aquí; cómo fue el golpe lo cuentan las fotos de la escena.';
  if (rec.hayGolpe) return 'El golpe, donde lo marcó el croquis. De aquí en adelante la recreación se queda quieta: lo demás lo cuentan las fotos de la escena.';
  return 'Aquí termina lo que dice la flecha: no llega al golpe que marcó el croquis. La recreación para aquí; cómo fue el golpe lo cuentan las fotos de la escena.';
}

// La advertencia que va en el mapa mismo. Sobre el ejemplo o un croquis sin terminar no es «lo
// declarado»: nadie lo declaró (revisión del 14-nov).
export function selloDeLaRecreacion({ ejemplo = false, hecho = true } = {}) {
  if (ejemplo) return 'Recreación de un ejemplo inventado · no es una medición';
  if (!hecho) return 'Recreación de un croquis sin terminar · no es una medición';
  return 'Recreación de lo declarado · no es una medición';
}
