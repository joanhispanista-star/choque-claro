// La ciudad de la vista realista, en números: con la huella y la altura de cada casa (OpenStreetMap)
// arma las paredes, los techos y las sombras de contacto. Puro: se prueba en Node. Quien la dibuja es
// maqueta-ciudad.js.
//
// Qué es de verdad y qué no, porque de esto depende lo que la pantalla puede decir:
//  - DE VERDAD: dónde está cada casa, la forma de su planta y (si alguien la anotó en el mapa) su
//    altura; y el techo y el piso, que son la foto aérea de 2017 del Catastro de Bogotá y la FAC.
//  - NO: las fachadas. Salen de cuatro hojas de textura hechas con IA (ladrillo, estuco, edificio de
//    apartamentos y culata), escogidas con un azar fijo por casa. Ninguna ventana ni puerta es la del
//    lugar. Las culatas (la pared pegada a otra casa) van sin ventanas, como en la calle.
//  - Donde no hay foto aérea abierta (fuera de Bogotá), el techo tampoco: es una teja genérica.
//
// Las coordenadas son del plano local del golpe (geo.js), en metros: x al este, y al norte. La escena
// es la de three: x al este, y hacia arriba, z al sur.
import { ShapeUtils, Vector2 } from 'three';

export const PISO_M = 2.9; // lo que mide un piso: cuántos caben en la altura del mapa
export const TRAMO_M = 3.3; // una ventana o una puerta cada tantos metros de fachada
export const PRETIL_M = 0.32; // el borde que sobresale del techo: sin él, la casa se ve como una caja
const BAJO_TIERRA_M = 2.5; // la pared baja esto más, para que en una cuesta no quede aire debajo
const ALTO_MINIMO_M = 2.6;
const TEJA_M = 3.2; // lo que cubre una hoja de teja
const SANGRIA = 0.004; // para que una celda de la hoja de textura no sangre en la vecina
// De aquí para allá la casa es de fondo: una celda cada dos pisos y cada dos tramos.
const LEJOS_M = 210;
const CUADRO_M = 24; // el lado de los cuadros en que se buscan los vecinos

// El azar fijo: la misma casa sale igual cada vez que se abre la página.
export const azar = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function areaConSigno(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const [x0, y0] = a[i];
    const [x1, y1] = a[(i + 1) % a.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

export function estaAdentro(x, y, a) {
  let c = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i];
    const [xj, yj] = a[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Un montón de caras en una sola malla. `edificio` dice de qué casa es cada vértice: con eso la
// tarjeta gráfica la sube a su pedazo de relieve y la baja cuando tapa los carros.
function nuevaMalla() {
  const posicion = [];
  const normal = [];
  const uv = [];
  const color = [];
  const edificio = [];
  const indice = [];
  return {
    posicion,
    normal,
    uv,
    color,
    edificio,
    indice,
    cuadro(v, n, t, c, quien) {
      const k = edificio.length;
      for (let i = 0; i < 4; i++) {
        posicion.push(...v[i]);
        normal.push(...n);
        uv.push(...t[i]);
        color.push(...c[i]);
        edificio.push(quien);
      }
      indice.push(k, k + 1, k + 2, k, k + 2, k + 3);
    },
    tapa(v, t, c, quien, caras) {
      const k = edificio.length;
      v.forEach((p, i) => {
        posicion.push(...p);
        normal.push(0, 1, 0);
        uv.push(...t[i]);
        color.push(...c);
        edificio.push(quien);
      });
      for (const cara of caras) indice.push(...cara.map((i) => i + k));
    },
  };
}

// El estuco, con el color que le toque: blanco, crema, ocre claro, gris azulado, rosado viejo, verde.
const TINTES_DEL_ESTUCO = [
  [1, 1, 1.04],
  [1.02, 0.98, 0.91],
  [1.02, 0.93, 0.8],
  [0.92, 0.96, 1.03],
  [1.03, 0.9, 0.84],
  [0.92, 0.98, 0.9],
];
// Las culatas: cemento, ladrillo a la vista o pintada.
const TINTES_DE_LA_CULATA = [
  [0.98, 0.97, 0.95],
  [1.16, 1.12, 1.05],
  [1.06, 0.86, 0.76],
  [1.24, 1.22, 1.18],
];

// `edificios`: [{ h, a: [[x, y], …] }]. `medios`: el medio lado, en metros, de cada foto del piso (de
// la más cercana y nítida a la más amplia): el techo toma la primera donde cabe entero. Sin fotos, el
// techo lleva una de las `tejas` (cuántas hojas de teja hay).
export function armarCiudad(edificios, { medios = [], tejas = 0 } = {}) {
  const lista = [];
  for (const e of edificios ?? []) {
    const a = (e.a ?? []).map(([x, y]) => [x, y]);
    const [p, q] = [a[0], a[a.length - 1]];
    if (a.length > 1 && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05) a.pop();
    if (a.length < 3 || Math.abs(areaConSigno(a)) < 2) continue;
    if (areaConSigno(a) < 0) a.reverse(); // al revés del reloj: la normal de afuera es (dy, -dx)
    const xs = a.map((v) => v[0]);
    const ys = a.map((v) => v[1]);
    lista.push({
      alto: Math.max(ALTO_MINIMO_M, Number(e.h) || 0),
      a,
      caja: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      centro: [xs.reduce((s, v) => s + v, 0) / a.length, ys.reduce((s, v) => s + v, 0) / a.length],
    });
  }
  // Para no buscar el vecino de cada pared entre todas las casas (en un barrio apretado son más de mil),
  // se guarda qué casas tocan cada cuadro del plano.
  const cuadros = new Map();
  const llave = (i, j) => i * 4096 + j;
  const cuadro = (v) => Math.floor(v / CUADRO_M) + 2048;
  for (const e of lista) {
    for (let i = cuadro(e.caja[0]); i <= cuadro(e.caja[2]); i++) {
      for (let j = cuadro(e.caja[1]); j <= cuadro(e.caja[3]); j++) {
        const g = cuadros.get(llave(i, j));
        if (g) g.push(e);
        else cuadros.set(llave(i, j), [e]);
      }
    }
  }
  const vecinoEn = (x, y, yo) => cuadros.get(llave(cuadro(x), cuadro(y)))?.find((o) => o !== yo && x >= o.caja[0] && x <= o.caja[2] && y >= o.caja[1] && y <= o.caja[3] && estaAdentro(x, y, o.a)) ?? null;

  const mallas = { ladrillo: nuevaMalla(), estuco: nuevaMalla(), apto: nuevaMalla(), culata: nuevaMalla(), contacto: nuevaMalla(), techos: medios.map(() => nuevaMalla()), tejas: Array.from({ length: tejas }, () => nuevaMalla()) };
  const BLANCO = [1, 1, 1];
  lista.forEach((e, k) => {
    const { alto } = e;
    const borde = alto + PRETIL_M;
    const lejos = Math.hypot(...e.centro) > LEJOS_M;
    const r = azar(k + 1);
    const tipo = alto >= 14 ? 'apto' : r < 0.46 ? 'ladrillo' : r < 0.92 ? 'estuco' : 'apto';
    const brillo = 0.9 + 0.2 * azar(k + 77);
    const tinte = tipo === 'estuco' ? TINTES_DEL_ESTUCO[Math.floor(azar(k + 5) * TINTES_DEL_ESTUCO.length)] : BLANCO;
    const deLaCulata = TINTES_DE_LA_CULATA[Math.floor(azar(k + 23) * TINTES_DE_LA_CULATA.length)];
    const pintado = (t, f) => t.map((v) => v * brillo * f);
    for (let i = 0; i < e.a.length; i++) {
      const p0 = e.a[i];
      const p1 = e.a[(i + 1) % e.a.length];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const largo = Math.hypot(dx, dy);
      if (largo < 0.3) continue;
      const nx = dy / largo;
      const ny = -dx / largo;
      const normal = [nx, 0, -ny];
      const punto = (s, h) => [p0[0] + dx * s, h, -(p0[1] + dy * s)];
      // Lo de adentro del pretil: se ve desde arriba, al otro lado del techo.
      mallas.culata.cuadro([punto(1, alto), punto(0, alto), punto(0, borde), punto(1, borde)], [-nx, 0, ny], [[0, 0], [largo / 6, 0], [largo / 6, 0.05], [0, 0.05]], Array(4).fill(pintado(deLaCulata, 0.9)), k);
      // Tres puntos a lo largo de la pared: una casa vecina puede tapar solo un pedazo, y con uno solo (el
      // del medio) la otra punta quedaba sin pared.
      const vecinos = [0.15, 0.5, 0.85].map((s) => vecinoEn(p0[0] + dx * s + nx * 0.7, p0[1] + dy * s + ny * 0.7, e));
      if (vecinos.filter(Boolean).length >= 2 || largo < 1.6) {
        // Pegada a otra casa (o un pedacito): solo se ve lo que sobresale, y ahí no hay ventanas.
        const desde = Math.min(borde, ...vecinos.map((v) => (v ? v.alto : -BAJO_TIERRA_M)));
        if (borde - desde > 0.25) {
          const c = pintado(deLaCulata, 0.82);
          const d = pintado(deLaCulata, 0.96);
          mallas.culata.cuadro([punto(0, desde), punto(1, desde), punto(1, borde), punto(0, borde)], normal, [[0, desde / 6], [largo / 6, desde / 6], [largo / 6, borde / 6], [0, borde / 6]], [c, c, d, d], k);
        }
        continue;
      }
      const cada = lejos ? 2 : 1;
      const pisos = Math.max(1, Math.round(borde / (PISO_M * cada)));
      const altoPiso = borde / pisos;
      const tramos = Math.max(1, Math.round(largo / (TRAMO_M * cada)));
      for (let f = 0; f < pisos; f++) {
        for (let b = 0; b < tramos; b++) {
          // La hoja de textura tiene 3 × 3 celdas: abajo, los primeros pisos (puertas y locales);
          // arriba, los pisos con ventanas.
          const celda = k * 31 + i * 7 + b;
          const col = f === 0 ? Math.floor(azar(celda + 3) * 3) : tipo === 'apto' ? b % 3 : Math.floor(azar(celda + 9 + f) * 3);
          const fila = f === 0 ? 0 : 1 + (f % 2);
          const [u0, u1] = [col / 3 + SANGRIA, (col + 1) / 3 - SANGRIA];
          const [v0, v1] = [fila / 3 + SANGRIA, (fila + 1) / 3 - SANGRIA];
          const [s0, s1] = [b / tramos, (b + 1) / tramos];
          const [h0, h1] = [f * altoPiso, (f + 1) * altoPiso];
          // Más oscuro abajo: es la luz que no llega al rincón de la calle.
          const abajo = pintado(tinte, f === 0 ? 0.72 : 0.97);
          const arriba = pintado(tinte, f === pisos - 1 ? 0.92 : 1);
          mallas[tipo].cuadro([punto(s0, h0), punto(s1, h0), punto(s1, h1), punto(s0, h1)], normal, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [abajo, abajo, arriba, arriba], k);
          if (f === 0) {
            const oscuro = pintado(tinte, 0.5);
            mallas.culata.cuadro([punto(s0, -BAJO_TIERRA_M), punto(s1, -BAJO_TIERRA_M), punto(s1, 0), punto(s0, 0)], normal, [[s0, 0], [s1, 0], [s1, 0.4], [s0, 0.4]], Array(4).fill(oscuro), k);
          }
        }
      }
      // La sombra de contacto en el andén: donde la casa toca el piso nunca llega toda la luz. No es la
      // sombra del sol (esa no se dibuja: la maqueta no sabe si ese día hubo sol).
      const afuera = (s, d) => [p0[0] + dx * s + nx * d, 0.07, -(p0[1] + dy * s + ny * d)];
      mallas.contacto.cuadro([afuera(0, 0), afuera(1, 0), afuera(1, 1.5), afuera(0, 1.5)], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [BLANCO, BLANCO, BLANCO, BLANCO], k);
    }
    const caras = ShapeUtils.triangulateShape(e.a.map(([x, y]) => new Vector2(x, y)), []);
    const arriba = e.a.map(([x, y]) => [x, alto, -y]);
    // El techo, con la foto aérea: la primera en la que cabe entero.
    const mayor = Math.max(...e.caja.map(Math.abs));
    const foto = medios.findIndex((m) => mayor < m * 0.985);
    if (foto >= 0) {
      const m = medios[foto];
      mallas.techos[foto].tapa(arriba, e.a.map(([x, y]) => [(x + m) / (2 * m), (y + m) / (2 * m)]), BLANCO, k, caras);
    } else if (tejas) {
      // Sin foto del lugar, una teja genérica, derecha con la pared más larga.
      const cual = Math.floor(azar(k + 51) * tejas);
      const t = e.a.map((p, i) => [p, e.a[(i + 1) % e.a.length]]).sort((u, v) => Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) - Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]))[0];
      const g = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
      const [c, n] = [Math.cos(g), Math.sin(g)];
      mallas.tejas[cual].tapa(arriba, e.a.map(([x, y]) => [(x * c + y * n) / TEJA_M, (y * c - x * n) / TEJA_M]), pintado(BLANCO, 1), k, caras);
    } else {
      // Ni foto ni tejas: cemento. (Fuera de la foto salía el color de su orilla, que puede ser negro.)
      mallas.culata.tapa(arriba, e.a.map(([x, y]) => [x / 6, y / 6]), pintado(deLaCulata, 0.85), k, caras);
    }
  });
  return { lista, mallas };
}

// Qué casas quedan entre el ojo y lo que hay que ver: por cada punto, la recta del ojo al punto se
// corta con cada planta; si en el cruce la recta va por debajo del techo, esa casa tapa. `ojo` y
// `puntos`: { x, y, z } en metros (z, la altura). `sueloDe(k)`: la altura del suelo de la casa k.
export function queTapan(lista, ojo, puntos, sueloDe = () => 0) {
  const tapan = new Set();
  lista.forEach((e, k) => {
    const techo = sueloDe(k) + e.alto + PRETIL_M;
    for (const p of puntos) {
      if (Math.min(ojo.x, p.x) > e.caja[2] || Math.max(ojo.x, p.x) < e.caja[0] || Math.min(ojo.y, p.y) > e.caja[3] || Math.max(ojo.y, p.y) < e.caja[1]) continue;
      const [dx, dy, dz] = [p.x - ojo.x, p.y - ojo.y, p.z - ojo.z];
      for (let i = 0; i < e.a.length; i++) {
        const [ax, ay] = e.a[i];
        const [bx, by] = e.a[(i + 1) % e.a.length];
        const [ex, ey] = [bx - ax, by - ay];
        const det = dx * ey - dy * ex;
        if (Math.abs(det) < 1e-9) continue;
        const t = ((ax - ojo.x) * ey - (ay - ojo.y) * ex) / det;
        const u = ((ax - ojo.x) * dy - (ay - ojo.y) * dx) / det;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        if (ojo.z + dz * t < techo) {
          tapan.add(k);
          return;
        }
      }
      // El ojo metido en la casa (la cámara muy cerca): también estorba.
      if (ojo.z < techo && estaAdentro(ojo.x, ojo.y, e.a)) {
        tapan.add(k);
        return;
      }
    }
  });
  return tapan;
}
