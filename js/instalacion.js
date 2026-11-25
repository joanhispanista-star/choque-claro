// Tener Choque Claro en el teléfono: en qué navegador está la persona, qué se le puede ofrecer y qué
// hay que decirle de lo guardado. Puro (recibe el navegador): se prueba en Node.
//
// Lo del iPhone, verificado el 25-nov-2026 (fuentes: webkit.org/tracking-prevention y WebKit 181849):
//  - Safari borra lo que una página guardó (los reportes, las fotos y la copia para abrir sin señal)
//    si pasan siete días de usarlo sin que la persona entre a esa página.
//  - Una página agregada a la pantalla de inicio no tiene ese límite, pero NO comparte lo guardado
//    con Safari: abre vacía. Y la primera vez necesita internet, para guardar su propia copia.
// En Android, la app instalada y Chrome comparten lo guardado, y no hay plazo.

export function esIOS(nav = globalThis.navigator) {
  if (!nav) return false;
  if (/iPad|iPhone|iPod/.test(nav.userAgent || '')) return true;
  // El iPad se presenta como un Mac desde iPadOS 13; un Mac de verdad no tiene pantalla táctil.
  return /Mac/.test(nav.platform || '') && (nav.maxTouchPoints || 0) > 1;
}

// El servidor de este PC (npm run dev). Ahí no se guarda nada para abrir sin señal (sin-senal.js).
export const esLocal = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host) || String(host).endsWith('.localhost');

export const esAndroid = (nav = globalThis.navigator) => /Android/.test(nav?.userAgent || '');

// Abierta desde el ícono de la pantalla de inicio, sin la barra del navegador.
export function abiertaDesdeInicio(ventana = globalThis) {
  if (ventana.navigator?.standalone === true) return true;
  return !!ventana.matchMedia?.('(display-mode: standalone)').matches;
}

// Qué se le ofrece: 'ya' (está en inicio), 'iphone' (se hace a mano), 'boton' (Android: el navegador
// deja ofrecerlo con un botón) o 'menu' (por el menú del navegador).
export function formaDeAgregar({ ios = false, desdeInicio = false, conBoton = false } = {}) {
  if (desdeInicio) return 'ya';
  if (ios) return 'iphone';
  return conBoton ? 'boton' : 'menu';
}

// Dónde puede perderse lo guardado solo, sin que la persona haga nada: en el iPhone, mientras se use
// en el navegador y no desde el ícono.
export const seBorraSolo = ({ ios = false, desdeInicio = false } = {}) => ios && !desdeInicio;

// El aviso del paso 8. Corto y con lo que hay que hacer: está al lado del botón de compartir.
export const AVISO_DEL_PASO_8 = 'Compártelo hoy. En el iPhone, Safari borra el reporte y sus fotos si pasan siete días de usarlo sin que abras esta página.';

// La nota de «Tus reportes», según el teléfono.
export function notaDeLoGuardado({ ios = false, desdeInicio = false } = {}) {
  const base = 'Están guardados solo en este teléfono. Si borras los datos del navegador, se borran con ellos.';
  const copia = 'Para tener una copia que no dependa del teléfono, comparte el expediente en PDF.';
  if (ios && desdeInicio) return `Están guardados solo en este teléfono, en esta app de la pantalla de inicio. Si la borras, se borran con ella. Los que hiciste en Safari no se ven aquí: ábrelos en Safari. ${copia}`;
  if (ios) return `${base} Y Safari los borra solo si pasan siete días de usarlo sin que abras esta página. ${copia}`;
  return `${base} ${copia}`;
}
