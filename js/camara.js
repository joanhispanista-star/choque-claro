// La cámara en vivo, y sacar de ella el cuadro de la foto y uno chico, en
// grises, para revisar la calidad (calidad.js).
//
// Solo cámara en vivo, con getUserMedia: aquí no hay <input type="file">, a
// propósito. Una foto de la galería pudo tomarse otro día o retocarse; una
// tomada aquí lleva la hora, el GPS, el rumbo y la huella del momento.
//
// El navegador da la cámara solo en https (o en 127.0.0.1): por la IP del
// Wi-Fi (http://192.168…) falla siempre, y se dice.
import { aGris } from './calidad.js';

export const MENSAJES_CAMARA = {
  sinHttps: 'La cámara solo funciona si la app se abre con https.',
  sinCamara: 'Este navegador no da la cámara en vivo. Ábrela en Safari (iPhone) o en Chrome (Android).',
  NotAllowedError:
    'La app no tiene permiso para usar la cámara. En iPhone: toca «aA» en la barra de Safari › Configuración del sitio web › Cámara › Permitir. En Android: toca el candado junto a la dirección › Permisos › Cámara. Luego recarga la página.',
  NotFoundError: 'Este aparato no tiene cámara.',
  NotReadableError: 'Otra app está usando la cámara. Ciérrala y vuelve a intentarlo.',
  AbortError: 'La cámara no arrancó. Vuelve a intentarlo.',
  sinImagen: 'La cámara todavía no da imagen. Espera un segundo y vuelve a tocar.',
  sinMemoria: 'Este celular no tiene memoria de imagen libre para la foto. Cierra otras pestañas y vuelve a intentarlo.',
};

export function mensajeDeLaCamara(error) {
  if (error && MENSAJES_CAMARA[error.name]) return MENSAJES_CAMARA[error.name];
  // Lo que no se reconoce se muestra con su nombre: sin eso no hay cómo
  // arreglarlo desde lejos.
  return `No se pudo abrir la cámara (${error?.name || 'Error'}: ${String(error?.message || '').slice(0, 120)}).`;
}

function conNombre(nombre) {
  const error = new Error(MENSAJES_CAMARA[nombre]);
  error.name = nombre;
  return error;
}

// Pone la cámara de atrás en `video` y devuelve { detener }.
export async function abrirCamara(video, { medios = globalThis.navigator?.mediaDevices, seguro = globalThis.isSecureContext } = {}) {
  if (!seguro) throw conNombre('sinHttps');
  if (!medios || typeof medios.getUserMedia !== 'function') throw conNombre('sinCamara');
  let flujo;
  try {
    // `ideal` y no `exact`: si el celular no tiene esa medida, da la más
    // cercana en vez de fallar. 1920 de lado mayor alcanza para reducir a 1280.
    flujo = await medios.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
  } catch (error) {
    // Un celular que no tiene esa medida ni parecida: se pide cualquier cámara de atrás.
    if (error?.name !== 'OverconstrainedError') throw error;
    flujo = await medios.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
  }
  const detener = () => {
    for (const pista of flujo.getTracks()) pista.stop();
    video.srcObject = null;
  };
  // iPhone: sin muted y playsinline, Safari abre el video a pantalla completa.
  video.muted = true;
  video.playsInline = true;
  video.srcObject = flujo;
  try {
    await video.play();
  } catch (error) {
    detener();
    throw error;
  }
  return { detener };
}

function lienzo(ancho, alto, opciones) {
  const l = document.createElement('canvas');
  l.width = ancho;
  l.height = alto;
  const ctx = l.getContext('2d', opciones);
  // Safari en iPhone tiene un tope para la suma de los lienzos de la página
  // (fotos.js): llegado el tope, getContext da null.
  if (!ctx) throw conNombre('sinMemoria');
  return { lienzo: l, ctx };
}

// Soltar un lienzo ya, y no cuando pase el recolector: en iPhone cuentan los vivos.
export function soltarLienzo(l) {
  if (!l) return;
  l.width = 0;
  l.height = 0;
}

// El cuadro de ahora, entero, en un lienzo. Quien lo pide lo suelta.
export function cuadroDeVideo(video) {
  const ancho = video.videoWidth;
  const alto = video.videoHeight;
  if (!ancho || !alto) throw conNombre('sinImagen');
  const { lienzo: l, ctx } = lienzo(ancho, alto);
  ctx.drawImage(video, 0, 0, ancho, alto);
  return l;
}

// La imagen reducida a `ladoCorto` y en grises, para la revisión de calidad.
// `reusar`: un lienzo que se vuelve a usar en cada cuadro en vivo, para no
// crear uno nuevo cuatro veces por segundo.
export function grisDe(fuente, anchoFuente, altoFuente, ladoCorto, reusar = null) {
  const escala = Math.min(1, ladoCorto / Math.min(anchoFuente, altoFuente));
  const ancho = Math.max(3, Math.round(anchoFuente * escala));
  const alto = Math.max(3, Math.round(altoFuente * escala));
  let l = reusar;
  let ctx;
  if (l) {
    if (l.width !== ancho || l.height !== alto) {
      l.width = ancho;
      l.height = alto;
    }
    ctx = l.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw conNombre('sinMemoria');
  } else {
    ({ lienzo: l, ctx } = lienzo(ancho, alto, { willReadFrequently: true }));
  }
  ctx.drawImage(fuente, 0, 0, ancho, alto);
  const { data } = ctx.getImageData(0, 0, ancho, alto);
  if (!reusar) soltarLienzo(l);
  return { gris: aGris(data, ancho, alto), ancho, alto };
}

// JPEG de buena calidad: después fotos.js la reduce a 1280 px. Se pasa por un
// Blob (y no el lienzo directo) porque así entra a reducirFoto igual que la
// foto de una cámara, que es el camino ya probado en iPhone en el taller.
export function lienzoABlob(l, calidad = 0.92) {
  return new Promise((resolver, rechazar) => {
    l.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo comprimir la foto'))), 'image/jpeg', calidad);
  });
}
