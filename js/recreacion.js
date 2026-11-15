// La recreación del choque: el croquis del paso 7 en movimiento sobre la maqueta 3D, para mirar lo
// declarado desde donde se quiera: con todos los carros en el cuadro o detrás de cada uno.
// Joan la pidió el vie 13-nov-2026 («recrear un video del accidente») y otra vez el sáb 14-nov
// («videos interactivos»). Un video hecho con IA inventa lo que no sabe; esto no inventa nada.
//
// Es lo declarado y nada más, y la pantalla lo dice:
//  - Cada carro recorre su flecha (de dónde venía hasta el golpe) a ritmo parejo, y todos llegan al
//    golpe a la vez. Nadie declaró velocidades: la recreación no dice quién iba más rápido ni si
//    alguien frenó.
//  - El golpe es el primer instante en que los contornos de dos carros se tocan. Si las flechas no
//    los juntan (un poste, un croquis a mano), la película para cuando la trompa llega al final de
//    su flecha.
//  - Después del golpe la película se queda quieta: cómo quedaron los carros lo cuentan las fotos de
//    la escena, no una física inventada.
// Todo en metros sobre el plano local del golpe (geo.js: x al este, y al norte). Puro: se prueba en
// Node; la página (pantalla-zona-3d.js) lo pone en la maqueta con maqueta-carros.js.
import { planoLocal } from './geo.js';

const GRADO = Math.PI / 180;

// La fracción de la película en que llega el golpe; el resto es el golpe quieto, para mirarlo.
export const GOLPE_EN = 0.8;
export const DURACION_MS = 9000;

const normalizar = (r) => ((r % 360) + 360) % 360;
const rumboDe = (dx, dy) => normalizar(Math.atan2(dx, dy) / GRADO);
const vector = (rumbo) => ({ x: Math.sin(rumbo * GRADO), y: Math.cos(rumbo * GRADO) });
// De `a` hacia `b`, entre -180 y 180.
const giro = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

function camino(puntos) {
  const limpios = puntos.filter((p, i) => i === 0 || Math.hypot(p.x - puntos[i - 1].x, p.y - puntos[i - 1].y) > 1e-6);
  const acum = [0];
  for (let i = 1; i < limpios.length; i++) acum.push(acum[i - 1] + Math.hypot(limpios[i].x - limpios[i - 1].x, limpios[i].y - limpios[i - 1].y));
  return { puntos: limpios, acum, largo: acum.at(-1) };
}

function puntoEn(c, s) {
  const t = Math.min(c.largo, Math.max(0, s));
  let i = 0;
  while (i < c.puntos.length - 2 && t > c.acum[i + 1]) i++;
  const a = c.puntos[i];
  const b = c.puntos[i + 1];
  const f = (t - c.acum[i]) / (c.acum[i + 1] - c.acum[i] || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Hacia dónde se avanza en `s`: la cuerda de un metro antes a uno después. Con la tangente del
// tramo, el carro daba un tirón en cada vértice de la flecha (vienen cada metro, cada 4 en el ejemplo).
function avanceEn(c, s) {
  const a = puntoEn(c, s - 1);
  const b = puntoEn(c, s + 1);
  return rumboDe(b.x - a.x, b.y - a.y);
}

// El largo recorrido hasta el punto de la flecha más cercano a `p`.
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

// Dónde va un carro cuando ha recorrido `s` metros de su flecha. Donde el croquis lo puso queda tal
// cual (posición y rumbo): la flecha a mano puede no pasar justo por él, y en un cambio de carril
// la trompa va torcida respecto a la flecha. Antes de ese punto el torcido se le va quitando (en 6 m),
// para que no llegue de lado desde lejos; de ahí al golpe lo conserva, porque así lo declaró.
function poseEn(carro, s) {
  if (!carro.camino) return { ...carro.quieto, avance: carro.quieto.rumbo };
  const p = puntoEn(carro.camino, s);
  const avance = avanceEn(carro.camino, s);
  const peso = s >= carro.sDeclarado ? 1 : Math.max(0, 1 - (carro.sDeclarado - s) / 6);
  const rumbo = normalizar(avance + (carro.reversa ? 180 : 0) + carro.torcido * peso);
  return { x: p.x + carro.desfase.x * peso, y: p.y + carro.desfase.y * peso, rumbo, avance };
}

// El croquis guardado (croquis.js, croquisParaGuardar) listo para moverse, o null si no hay nada
// que mover: sin golpe, sin carros o con todos quietos.
export function recreacionDelCroquis(croquis) {
  const g = croquis?.golpe;
  if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon) || !Array.isArray(croquis.carros) || !croquis.carros.length) return null;
  const plano = planoLocal(g);
  const carros = croquis.carros.map((c) => {
    const C = plano.aMetros(c);
    const largo = c.largo || 4.2;
    const ancho = c.ancho || 1.8;
    const reversa = c.movimiento === 'reversa';
    const base = { letra: c.letra, largo, ancho, reversa, movimiento: c.movimiento, camino: null, quieto: { x: C.x, y: C.y, rumbo: normalizar(c.rumbo) } };
    const flecha = (croquis.flechas || []).find((f) => f.letra === c.letra);
    if (c.movimiento === 'quieto' || !flecha || !Array.isArray(flecha.puntos) || flecha.puntos.length < 2) return base;
    const cam = camino(flecha.puntos.map((p) => plano.aMetros(p)));
    if (!(cam.largo >= 0.5)) return base;
    const sDeclarado = proyectar(cam, C);
    const P = puntoEn(cam, sDeclarado);
    const torcido = giro(normalizar(avanceEn(cam, sDeclarado) + (reversa ? 180 : 0)), normalizar(c.rumbo));
    return { ...base, camino: cam, sDeclarado, desfase: { x: C.x - P.x, y: C.y - P.y }, torcido };
  });
  if (!carros.some((c) => c.camino)) return null;

  const posesEn = (tau) => carros.map((c) => poseEn(c, c.camino ? tau * c.camino.largo : 0));
  const hayToque = (tau) => {
    const poses = posesEn(tau);
    const contornos = poses.map((p, i) => contornoDelCarro(p, carros[i].largo, carros[i].ancho));
    for (let i = 0; i < carros.length; i++) {
      for (let j = i + 1; j < carros.length; j++) {
        // Dos quietos que se tocan (dos parqueados pegados) no son el golpe.
        if ((carros[i].camino || carros[j].camino) && seTocan(contornos[i], contornos[j])) return true;
      }
    }
    return false;
  };
  // El primer toque: a pasos de 1/250 de la película y después afinado a la mitad, doce veces.
  let tauGolpe = null;
  let antes = 0;
  for (let k = 0; k <= 250; k++) {
    const tau = k / 250;
    if (hayToque(tau)) {
      let a = antes;
      let b = tau;
      for (let n = 0; n < 12; n++) {
        const m = (a + b) / 2;
        if (hayToque(m)) b = m;
        else a = m;
      }
      tauGolpe = k === 0 ? 0 : b;
      break;
    }
    antes = tau;
  }
  const toque = tauGolpe !== null;
  if (!toque) {
    // Sin toque, la película para cuando la trompa (o la cola, en reversa) del primero llega al final
    // de su flecha, que en el modo guiado es el golpe.
    tauGolpe = Math.min(...carros.filter((c) => c.camino).map((c) => Math.max(0, c.camino.largo - c.largo / 2) / c.camino.largo));
  }
  return { plano, carros, tauGolpe, toque };
}

// Dónde está cada carro en el momento `t` de la película (0 a 1). `golpe`: si ya pasó.
export function fotograma(rec, t) {
  const avance = Math.min(1, Math.max(0, t) / GOLPE_EN);
  const tau = rec.tauGolpe * avance;
  return {
    carros: rec.carros.map((c) => ({ letra: c.letra, largo: c.largo, ancho: c.ancho, ...poseEn(c, c.camino ? tau * c.camino.largo : 0) })),
    golpe: t >= GOLPE_EN,
  };
}

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
// Cerca del golpe la cámara vuelve a ponerse detrás de la cola: a un metro, la línea al golpe gira
// de un tirón (en un golpe de costado queda de lado), y la cámara daba un latigazo.
//
// No hay cámara «desde los ojos del conductor», y es a propósito. Se construyó y se quitó el 14-nov:
// la maqueta abierta no tiene árboles, barrancos ni carros parqueados, así que mostraba una vía
// despejada y daba a entender que el conductor veía al otro. Sobre qué se alcanzaba a ver solo
// hablan las fotos de la escena.
export function camaraQueSigue(rec, letra, t) {
  const carro = rec.carros.find((c) => c.letra === letra);
  if (!carro) return null;
  const pose = fotograma(rec, t).carros.find((c) => c.letra === letra);
  const u = vector(pose.avance);
  const atras = carro.largo / 2 + 12;
  // Del carro al golpe, y cuánto de eso le queda al frente.
  const g = { x: -pose.x, y: -pose.y };
  const lejos = Math.hypot(g.x, g.y);
  // Si el golpe quedó al lado o detrás del carro (un golpe de costado, o un croquis a mano con la
  // flecha pasada), no cuenta: la cámara se queda detrás de la cola y mira al carro. De 0 a 2 m al
  // frente va entrando, para que no salte.
  const alFrente = Math.min(1, Math.max(0, (g.x * u.x + g.y * u.y) / 2));
  const peso = lejos > 1e-6 ? Math.min(1, lejos / 6) * alFrente : 0;
  // Entre «detrás de la cola» y «en la línea del golpe». Las dos apuntan al frente, así que la
  // mezcla nunca se anula.
  const d = { x: u.x * (1 - peso) + (g.x / (lejos || 1)) * peso, y: u.y * (1 - peso) + (g.y / (lejos || 1)) * peso };
  const largo = Math.hypot(d.x, d.y) || 1;
  return {
    desde: { x: pose.x - (d.x / largo) * atras, y: pose.y - (d.y / largo) * atras, alto: 4.5 },
    hacia: { x: pose.x + g.x * alFrente, y: pose.y + g.y * alFrente, alto: 0 },
  };
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
