// El piso de la vista realista: la foto aérea, cortada en teselas en este mismo navegador.
//
// No se pone como «image source» de MapLibre: sobre el relieve, MapLibre 4.7 solo dibuja la imagen en
// la tesela donde cae su centro, y lo que se pasa de esa tesela se pierde (medido el 24-nov-2026: la
// foto de 100 m se cortaba 22 m al sur del golpe). Con un protocolo propio el mapa pide teselas como
// las de cualquier fuente, y cada una se arma con las fotos que la tocan, de la más amplia a la más
// nítida.
const LADO = 256;

// El rectángulo (en píxeles de la tesela) que ocupa una foto cuadrada centrada en `centro`, que mide
// `medio` metros a cada lado. Las fotos están en Mercator, como las teselas: es una regla de tres.
export function rectanguloEnLaTesela({ z, x, y }, centro, medioMercator, lado = LADO) {
  const n = 2 ** z;
  const px = (v, t) => (v * n - t) * lado;
  const x0 = px(centro.x - medioMercator, x);
  const x1 = px(centro.x + medioMercator, x);
  const y0 = px(centro.y - medioMercator, y);
  const y1 = px(centro.y + medioMercator, y);
  return { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0, toca: x1 > 0 && y1 > 0 && x0 < lado && y0 < lado };
}

// La orilla difuminada: los puntos de un degradado de `desde` a `desde + ancho` que sube en la primera
// `pluma` (parte del lado) y baja en la última, sin escalón.
export function degradadoDeLaOrilla(pluma) {
  const suave = [0, 0.25, 0.5, 0.75, 1].map((t) => [t * pluma, t * t * (3 - 2 * t)]);
  return [...suave, ...suave.map(([t, a]) => [1 - t, a]).reverse()];
}

export const teselaDeLaDireccion = (url) => {
  const p = /(\d+)\/(\d+)\/(\d+)$/.exec(url);
  return p ? { z: +p[1], x: +p[2], y: +p[3] } : null;
};

// Cuánto grano se le pone al piso en cada zoom, de 0 a 1: la piedrita del asfalto solo se ve de cerca.
export const granoDelZoom = (z) => (z >= 22 ? 0.34 : z === 21 ? 0.22 : z === 20 ? 0.1 : 0);

// Un cuadro de ruido gris para el grano (siempre el mismo: no cambia al mover el mapa).
function cuadroDeGrano(lienzo) {
  const pincel = lienzo.getContext('2d');
  const d = pincel.createImageData(LADO, LADO);
  let s = 7;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 128 + ((s / 2147483647) ** 3 - 0.25) * 190 * (s & 1 ? 1 : -1);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  pincel.putImageData(d, 0, 0);
  return lienzo;
}

// La foto con la orilla borrada, en un lienzo aparte del tamaño de la tesela.
function conLaOrillaBorrada(lienzo, f, r) {
  const pincel = lienzo.getContext('2d');
  pincel.imageSmoothingQuality = 'high';
  pincel.drawImage(f.imagen, r.x, r.y, r.ancho, r.alto);
  pincel.globalCompositeOperation = 'destination-in';
  for (const [x0, y0, x1, y1] of [[r.x, 0, r.x + r.ancho, 0], [0, r.y, 0, r.y + r.alto]]) {
    const g = pincel.createLinearGradient(x0, y0, x1, y1);
    for (const [t, a] of degradadoDeLaOrilla(f.pluma)) g.addColorStop(t, `rgba(0,0,0,${a})`);
    pincel.fillStyle = g;
    pincel.fillRect(0, 0, LADO, LADO);
  }
  return lienzo;
}

// `fotos`: [{ imagen, medioMercator, pluma }] de la más amplia a la más nítida (`pluma`: qué parte del lado
// se difumina; sin ella, la foto ya trae su orilla). `base(tesela)`: lo que va debajo, o null (foto-aerea.js).
// `grano`: de cerca, la piedrita del asfalto. Es un adorno: solo va en el ejemplo, donde el piso ya está
// aclarado con IA.
export function registrarPiso(maplibregl, nombre, centro, fotos, { grano = false, base = null } = {}) {
  const nuevoLienzo = () => {
    if (globalThis.OffscreenCanvas) return new OffscreenCanvas(LADO, LADO);
    const c = document.createElement('canvas');
    c.width = c.height = LADO;
    return c;
  };
  const elGrano = grano ? cuadroDeGrano(nuevoLienzo()) : null;
  // Las teselas del piso se arman aquí y son instantáneas, pero MapLibre las pone en la misma fila de las
  // imágenes que vienen de internet (16 a la vez, 8 si el mapa se mueve) y se quedaban detrás del relieve:
  // en un computador el piso llegaba 4 a 6 s tarde (medido el 24-nov-2026). Se abre la fila; cuántas van a
  // la red al tiempo lo sigue decidiendo el navegador.
  Object.assign(maplibregl.config ?? {}, { MAX_PARALLEL_IMAGE_REQUESTS: 128, MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 128 });
  maplibregl.addProtocol(nombre, async ({ url }) => {
    const t = teselaDeLaDireccion(url);
    const lienzo = nuevoLienzo();
    const pincel = lienzo.getContext('2d');
    pincel.imageSmoothingQuality = 'high';
    const b = t ? await base?.(t) : null;
    if (b) pincel.drawImage(b.imagen, b.x, b.y, b.lado, b.lado, 0, 0, LADO, LADO);
    for (const f of t ? fotos : []) {
      const r = rectanguloEnLaTesela(t, centro, f.medioMercator);
      if (!r.toca) continue;
      if (f.pluma) pincel.drawImage(conLaOrillaBorrada(nuevoLienzo(), f, r), 0, 0);
      else pincel.drawImage(f.imagen, r.x, r.y, r.ancho, r.alto);
    }
    const fuerza = elGrano && t ? granoDelZoom(t.z) : 0;
    if (fuerza) {
      pincel.globalCompositeOperation = 'overlay';
      pincel.globalAlpha = fuerza;
      pincel.drawImage(elGrano, 0, 0);
    }
    return { data: await createImageBitmap(lienzo) };
  });
}
