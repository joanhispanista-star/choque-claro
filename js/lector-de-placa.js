// La placa de una foto que sale del VIDEO de la cámara, no de un JPEG de la
// galería. Usa el lector del taller tal cual (placa-ocr.js) y le agrega una
// segunda pasada con más margen alrededor de la placa.
//
// Por qué (medido el 13-nov-2026 en un Edge con la foto de la Captiva de Joan
// como cámara): el video llega en YUV 4:2:0, como en un celular, con el color
// a media resolución, y la mancha amarilla de la placa sale un poco más chica
// que en la foto original. Con las esquinas justas el lector cortó el último
// carácter y leyó "JRK24" (5 de 6). Ampliando las esquinas leyó:
//   1,04 × 1,04 → JRK241 (confianza 0,43)    1,16 × 1,08 → JRK246 (0,78)
//   1,12 × 1,06 → JRK240 (0,64)              1,20 × 1,10 → JRK248 (0,95)
//                                            1,25 × 1,12 → JRK248 (0,99)
// En el taller, de la foto original, leyó JRK248 sin margen. La placa es
// JRX248: la X a 30° sale K, y por eso lo leído siempre lo revisa la persona.
//
// Regla: si la primera lectura es una placa y el lector está seguro, se queda
// esa (es la que midió el taller con 60 placas). Si no, se prueban los márgenes
// y gana la placa válida de más confianza. Es UNA foto medida, no sesenta: los
// márgenes se revisan con las primeras placas de verdad.
import { leerPlacaDeFoto, ubicarPlaca } from './placa-ocr.js';

export const MARGENES = [
  [1.12, 1.06],
  [1.2, 1.1],
  [1.25, 1.12],
];
export const CONFIANZA_SUFICIENTE = 0.8;

// Las cuatro esquinas (fracciones) alejadas de su centro `fx` veces a lo
// ancho y `fy` a lo alto, sin salirse de la foto.
export function ampliarEsquinas(esquinas, fx, fy) {
  const cx = esquinas.reduce((s, p) => s + p.x, 0) / esquinas.length;
  const cy = esquinas.reduce((s, p) => s + p.y, 0) / esquinas.length;
  const dentro = (v) => Math.min(1, Math.max(0, v));
  return esquinas.map((p) => ({ x: dentro(cx + (p.x - cx) * fx), y: dentro(cy + (p.y - cy) * fy) }));
}

// La mejor de varias lecturas: la placa válida de más confianza. Si ninguna
// es placa, la que más caracteres leyó, para que la persona la complete.
export function mejorLectura(lecturas) {
  const validas = lecturas.filter((l) => l && l.placa);
  if (validas.length) return validas.reduce((a, b) => (b.confianza > a.confianza ? b : a));
  const crudas = lecturas.filter(Boolean);
  if (!crudas.length) return null;
  return crudas.reduce((a, b) => ((b.crudo || '').length > (a.crudo || '').length ? b : a));
}

// Lo mismo que leerPlacaDeFoto: null si no hay placa amarilla en la foto,
// { placa: '' , crudo } si la hay y no se pudo leer, o { placa, crudo,
// confianza, milisegundos }.
export async function leerPlacaDelVideo(foto, alAvanzar = () => {}) {
  const inicio = performance.now();
  const donde = await ubicarPlaca(foto);
  if (!donde || !donde.esquinas) return null;
  const lecturas = [await leerPlacaDeFoto(foto, donde, alAvanzar)];
  const primera = lecturas[0];
  if (!(primera && primera.placa && primera.confianza >= CONFIANZA_SUFICIENTE)) {
    for (const [fx, fy] of MARGENES) lecturas.push(await leerPlacaDeFoto(foto, { ...donde, esquinas: ampliarEsquinas(donde.esquinas, fx, fy) }));
  }
  const mejor = mejorLectura(lecturas);
  return mejor && { ...mejor, milisegundos: Math.round(performance.now() - inicio) };
}
