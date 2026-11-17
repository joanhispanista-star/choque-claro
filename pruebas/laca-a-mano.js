// La cuenta de la laca del Taller (LUZ_Y_LACA, en js/generico/pintura.js), hecha a mano en JavaScript,
// con los cambios que le pone la maqueta (CAMBIOS_EN_LA_LACA, en js/maqueta-carros.js). Sirve para
// probar en Node lo que solo se ve en la GPU: de qué color sale en pantalla una pieza, marcada o no,
// vista desde las cámaras de la recreación.
//
// Es una copia, y una copia se queda vieja: por eso maqueta-carros.test.js guarda la huella del texto
// del sombreador, y si el Taller (o la maqueta) lo cambia, esa prueba falla y pide rehacer esto.
// La escribió la revisión del 16-nov (dos revisores la cotejaron línea por línea con el sombreador).
//
// Lo que no copia: aR sale de fwidth() en la GPU; aquí es su piso, 0,006 (un panel plano).

const ss = (e0, e1, x) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};
const mix = (a, b, k) => a + (b - a) * k;
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unitario = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};

// El tono de cine de three (tonemapping_pars_fragment, ACESFilmicToneMapping) con la exposición del
// Taller, y de lineal a lo que se ve en pantalla: lo que hace la GPU con la luz que sale de la laca.
const ENTRADA = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
];
const SALIDA = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];
const por = (M, v) => M.map((f) => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]);
const ajuste = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
const aSrgb = (x) => Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
export function enPantalla(lineal, exposicion = 1.05) {
  const v = por(SALIDA, por(ENTRADA, lineal.map((x) => (x * exposicion) / 0.6)).map(ajuste));
  return v.map((x) => aSrgb(Math.min(1, Math.max(0, x))));
}
export const aHex = (rgb) => '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');

// De dónde se mira, en las coordenadas del carro (mira hacia -z, y arriba). La recreación inclina la
// cámara a 58°: el centro de la pantalla se ve a unos 32° sobre el horizonte y el borde de abajo a
// 50°. «Seguir a A» va casi a ras (8°), y 90° es mirar desde arriba, como «Ver desde arriba».
export const VISTAS = [];
for (const e of [8, 14, 32, 50, 90]) {
  const E = (e * Math.PI) / 180;
  const deLado = unitario([0.7 * Math.cos(E), Math.sin(E), 0.7 * Math.cos(E)]);
  VISTAS.push({ nombre: `techo a ${e}°`, pieza: 'techo', nM: [0, 1, 0], pM: [0, 1.35, 0.2], vM: deLado });
  VISTAS.push({ nombre: `capó a ${e}°`, pieza: 'capo', nM: [0, 1, 0], pM: [0, 0.85, -1.4], vM: deLado });
  if (e < 90) {
    VISTAS.push({ nombre: `puerta de lado a ${e}°`, pieza: 'puerta-del-der', nM: [1, 0, 0], pM: [0.88, 0.7, -0.2], vM: unitario([Math.cos(E), Math.sin(E), 0]) });
    VISTAS.push({ nombre: `puerta a 45° y ${e}°`, pieza: 'puerta-del-der', nM: [1, 0, 0], pM: [0.88, 0.7, -0.2], vM: deLado });
  }
}

// El color en pantalla ([r, g, b] de 0 a 255) de una pieza de laca. `uniformes`: los del sombreador
// (onBeforeCompile); `color`: material.color en lineal. `marcada`: como la deja tenir() (la maqueta:
// color calibrado, cielo teñido, sin emissive). `comoElTaller`: la marcada como la hacía el Taller
// (22 % del color propio, cielo blanco y el emissive sumado encima), para comparar.
export function lacaEnPantalla({ uniformes: U, color, marcada = false, comoElTaller = null, vista: { nM, vM, pM } }) {
  const v = (x) => U[x].value;
  const nv = Math.min(1, Math.max(0, punto(nM, vM)));
  const rM = vM.map((x, i) => -x + 2 * nv * nM[i]);
  const aR = 0.006;
  const sobreH = ss(-aR, aR, rM[1]);
  const sinNariz = ss(v('uNariz') + 0.15, v('uNariz') + 0.75, pM[2]);
  let luz = mix(mix(1, v('uAlto'), ss(0.05, 0.85, nM[1])), v('uBajo'), ss(0, 0.6, -nM[1]));
  luz *= mix(v('uCanto'), 1, ss(0, 0.75, nv));
  luz *= mix(v('uSuelo'), 1, ss(0.1, 0.42, pM[1] / v('uAlturas').x));
  luz *= mix(v('uFlop').x, v('uFlop').y, ss(-0.45, 0.55, rM[1]));
  luz *= mix(mix(1, v('uHorizonte'), sinNariz), 1, Math.max(sobreH, ss(0.45, 0.8, -rM[1])));
  const q = 1 - nv;
  const fresnel = 0.04 + (v('uF90') - 0.04) * q ** 5;
  const arribaR = Math.max(rM[1], 0);
  const cielo = v('uCielo') * arribaR * Math.sqrt(arribaR);
  const piso = v('uPiso') * (1 + 4 * sinNariz * ss(-0.3, -0.02, rM[1]) * (1 - sobreH));
  const deLado = 1 - ss(0.5, 0.75, Math.abs(nM[1]));
  const F = v('uFranja');
  const C = v('uCaja');
  const C2 = v('uCaja2');
  const A = v('uAlturas');
  let franja = ss(F.x - aR, F.x + aR, rM[1]) * (1 - ss(F.x, F.y, rM[1]));
  franja *= deLado * ss(0.1, 0.3, nv) * mix(0.55, 1, ss(0.2, 0.7, Math.abs(nM[0]))) * (1 - ss(A.y, A.y + 0.06, pM[1])) * sinNariz;
  let caja = ss(C.x - aR, C.x + aR, rM[1]) * (1 - ss(C.x, C.y, rM[1]));
  caja += 0.7 * ss(C2.x - aR, C2.x + aR, rM[1]) * (1 - ss(C2.x, C2.y, rM[1]));
  caja *= (1 - deLado) * ss(0.22, 0.36, nv);
  caja *= 1 - (1 - ss(0.14, 0.22, vM[1])) * ss(A.y + 0.02, A.y + 0.08, pM[1]);
  caja *= Math.min(1, 0.1 / fresnel);
  caja *= ss(v('uNariz') + 0.3, v('uNariz') + 1, pM[2]);

  let base = color;
  let tinte = [v('uTinte').x, v('uTinte').y, v('uTinte').z];
  let encima = [0, 0, 0];
  if (marcada || comoElTaller) {
    luz = mix(0.88, 1, ss(-0.4, 0.8, nM[1])) * mix(0.85, 1, ss(0, 0.75, nv));
    if (comoElTaller) {
      // comoElTaller: { emissive }, en lineal y ya por su intensidad.
      const { emissive } = comoElTaller;
      const mayorE = Math.max(...emissive);
      const propio = v('uPropio');
      base = emissive.map((x, i) => mix((x / mayorE) * 0.8, [propio.x, propio.y, propio.z][i], 0.22));
      tinte = [1, 1, 1];
      encima = emissive;
    } else {
      const mayor = Math.max(0.001, ...color);
      tinte = color.map((x) => Math.max(0, x) / mayor);
    }
  }
  const fu = v('uFuerza');
  return enPantalla([0, 1, 2].map((i) => base[i] * luz * 0.76 * (1 - 0.6 * fresnel) + ((cielo + piso) * tinte[i] + franja * fu.x + caja * fu.y) * fresnel + encima[i]));
}
