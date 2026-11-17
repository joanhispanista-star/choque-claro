// Qué tan distintos se VEN dos colores: la diferencia CIEDE2000 (ΔE00), la que usan las imprentas y los
// talleres de pintura. Un número, no un parecido a ojo: alrededor de 2 apenas se nota lado a lado, y de
// 10 para arriba se ve de lejos.
//
// Existe por la recreación (maqueta-carros.js): la pieza marcada lleva el color de su daño, y cuando
// ese color se parece al del carro (la abolladura azul sobre el azul de C, el «suelto» morado sobre el
// morado de D), la pieza no se distinguía de la lata (revisión del 16-nov). Medir en RGB no servía: dos
// azules a 45 niveles de distancia en el canal azul se ven casi iguales, porque el ojo apenas distingue
// ahí; un rojo y un naranja a 38 en el verde sí se distinguen.
//
// Fórmula de Sharma, Wu y Dalal (2005), «The CIEDE2000 color-difference formula», con sus casos de
// prueba en pruebas/maqueta-carros.test.js. Luz de día D65, como sRGB.

const GRADO = Math.PI / 180;

// De '#rrggbb' (sRGB, el de la pantalla) a CIELAB.
export function aLab(hex) {
  const lineal = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lineal;
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// El tono en grados, de 0 a 360 (0 si no hay color: un gris no tiene tono).
const tono = (b, a) => {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / GRADO;
  return h < 0 ? h + 360 : h;
};

// ΔE00 entre dos colores en CIELAB ([L, a, b]).
export function diferenciaEnLab([L1, a1, b1], [L2, a2, b2]) {
  const C7 = ((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp1 = tono(b1, ap1);
  const hp2 = tono(b2, ap2);

  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * GRADO);

  const Lm = (L1 + L2) / 2;
  const Cm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) <= 180) hm /= 2;
    else hm = hm < 360 ? (hm + 360) / 2 : (hm - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hm - 30) * GRADO) + 0.24 * Math.cos(2 * hm * GRADO) + 0.32 * Math.cos((3 * hm + 6) * GRADO) - 0.2 * Math.cos((4 * hm - 63) * GRADO);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Cm7 = Cm ** 7;
  const RC = 2 * Math.sqrt(Cm7 / (Cm7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cm;
  const SH = 1 + 0.015 * Cm * T;
  const RT = -Math.sin(2 * dTheta * GRADO) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

// ΔE00 entre dos colores '#rrggbb'.
export const diferenciaPercibida = (a, b) => diferenciaEnLab(aLab(a), aLab(b));
