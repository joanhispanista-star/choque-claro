// La silueta guía de la vuelta al carro (paso 5): el contorno del carro visto
// desde la toma que sigue, encima del visor, para que la persona sepa dónde
// pararse y cuánto carro meter en la foto.
//
// Sale del mismo carro 3D de los daños (carro.js), dibujado desde las 8 tomas
// (siluetas-3d.js), y no de 8 dibujos a mano: así un hatchback o una pick-up
// tienen SU silueta, la de la línea que se eligió. Aquí va la parte pura, que
// se prueba en Node: dónde se para la cámara en cada toma y cómo se saca el
// contorno de la mancha que dibuja el 3D.

// Distancia y altura de la cámara: un celular a la altura del pecho, a unos
// pasos del carro. Solo cambia la perspectiva de la silueta, no su tamaño: la
// imagen se recorta a la mancha y el visor la estira a su ancho.
export const DISTANCIA_DE_LA_TOMA = 6;
export const ALTURA_DE_LA_TOMA = 1.4;
export const MIRA = [0, 0.7, 0];

// En carro.js el carro mira hacia -Z y su lado izquierdo (el del conductor)
// queda en -X. La toma 0 es el frente; caminando hacia la izquierda de quien
// toma las fotos, la siguiente muestra el lado DERECHO del carro (+X): la
// cámara recorre el círculo de -Z hacia +X (carros.js lo explica).
export function posicionDeLaCamara(sector, { distancia = DISTANCIA_DE_LA_TOMA, altura = ALTURA_DE_LA_TOMA } = {}) {
  const angulo = (sector * 45 * Math.PI) / 180;
  // El + 0 vuelve el -0 (de -cos 90°) un 0 de verdad.
  const redondear = (v) => Math.round(v * 1e6) / 1e6 + 0;
  return [redondear(Math.sin(angulo) * distancia), altura, redondear(-Math.cos(angulo) * distancia)];
}

// La caja de los píxeles con alfa (de una imagen RGBA), o null si no hay
// ninguno.
export function cajaDeLaMascara(rgba, ancho, alto, umbral = 127) {
  let x1 = ancho;
  let y1 = alto;
  let x2 = -1;
  let y2 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (rgba[(y * ancho + x) * 4 + 3] <= umbral) continue;
      if (x < x1) x1 = x;
      if (x > x2) x2 = x;
      if (y < y1) y1 = y;
      if (y > y2) y2 = y;
    }
  }
  return x2 < 0 ? null : { x1, y1, x2, y2 };
}

// Erosión con un cuadrado de (2·radio + 1), por filas y luego por columnas:
// un píxel queda adentro solo si todo su alrededor lo está.
function erosionar(dentro, ancho, alto, radio) {
  const pasada = (origen, horizontal) => {
    const salida = new Uint8Array(ancho * alto);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        let todo = 1;
        for (let d = -radio; d <= radio && todo; d++) {
          const xx = horizontal ? x + d : x;
          const yy = horizontal ? y : y + d;
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto || !origen[yy * ancho + xx]) todo = 0;
        }
        salida[y * ancho + x] = todo;
      }
    }
    return salida;
  };
  return pasada(pasada(dentro, true), false);
}

// De la mancha blanca que dibuja el 3D a la silueta del visor: un borde
// blanco de `grosor` píxeles por dentro de la mancha y un relleno casi
// transparente. El relleno lleno tapaba el carro de verdad, que es lo que la
// persona tiene que ver; el borde solo, sobre una calle clara, se perdía (por
// eso el visor le pone además una sombra oscura).
export function contornoDeMascara(rgba, ancho, alto, { grosor = 3, relleno = 36, umbral = 127 } = {}) {
  const dentro = new Uint8Array(ancho * alto);
  for (let i = 0; i < ancho * alto; i++) dentro[i] = rgba[i * 4 + 3] > umbral ? 1 : 0;
  const nucleo = erosionar(dentro, ancho, alto, grosor);
  const salida = new Uint8ClampedArray(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    if (!dentro[i]) continue;
    salida[i * 4] = 255;
    salida[i * 4 + 1] = 255;
    salida[i * 4 + 2] = 255;
    salida[i * 4 + 3] = nucleo[i] ? relleno : 255;
  }
  return salida;
}
