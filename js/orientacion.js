// Hacia dónde mira la cámara y qué tan derecho está el celular, sacado de los
// eventos de orientación del navegador. Todo puro: se prueba en Node.
//
// Los ángulos del navegador (alpha, beta, gamma) son los de la norma W3C
// (DeviceOrientation Event): R = Rz(alpha) · Rx(beta) · Ry(gamma). El marco de
// la Tierra es x = este, y = norte, z = arriba; el del celular, x = a la
// derecha de la pantalla, y = hacia arriba de la pantalla, z = saliendo de la
// pantalla hacia la cara. La cámara de atrás mira hacia −z.
//
// Por qué no sirve alpha tal cual: alpha es el giro del celular ACOSTADO. Con
// el celular parado, como se toma una foto, el rumbo de la cámara sale de
// proyectar −z sobre el piso. Es la fórmula del ejemplo de la norma.
//
// En iPhone Safari no da alpha absoluto: da `webkitCompassHeading`, que con el
// celular parado es el rumbo hacia el que mira la cámara de atrás, como la app
// Brújula. Los dos son rumbos MAGNÉTICOS: en Colombia el norte magnético queda
// unos 7 a 8° al oeste del verdadero, y al lado de un carro (hierro) la brújula
// del celular se desvía. Por eso cada foto guarda de dónde salió su rumbo.
const GRADO = Math.PI / 180;

export const normalizar = (grados) => ((grados % 360) + 360) % 360;

// De −180 (excluido) a 180: el giro más corto.
export function conSigno(grados) {
  const n = normalizar(grados);
  return n > 180 ? n - 360 : n;
}

// Por debajo de esto la cámara mira casi recto al piso o al cielo, y "hacia
// dónde apunta" deja de tener sentido: el rumbo saltaría con cualquier temblor.
const VERTICAL = Math.sin(15 * GRADO);

// El rumbo (0 = norte, 90 = este) hacia el que mira la cámara de atrás, o null.
export function rumboDeLaCamara(alpha, beta, gamma) {
  if (![alpha, beta, gamma].every(Number.isFinite)) return null;
  const a = alpha * GRADO;
  const b = beta * GRADO;
  const g = gamma * GRADO;
  const este = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const norte = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  if (Math.hypot(este, norte) < VERTICAL) return null;
  return normalizar(Math.atan2(este, norte) / GRADO);
}

// Qué tan derecha queda la foto:
// - `elevacion`: cuántos grados mira la cámara por encima (+) o por debajo
//   (−) del horizonte.
// - `giro`: cuánto está torcido el horizonte en la pantalla (0 = derecho). Se
//   descuenta `anguloPantalla` (el de screen.orientation: 0, 90, 180 o 270),
//   para que una foto tomada con el celular de lado no salga "torcida 90°".
// No depende de alpha, así que vale igual en iPhone y en Android.
export function inclinacionDeLaCamara(beta, gamma, anguloPantalla = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const b = beta * GRADO;
  const g = gamma * GRADO;
  // El "arriba" del mundo visto desde el celular: la tercera fila de R. Es
  // único aunque los tres ángulos no lo sean (con el celular parado, el
  // navegador puede repartir el mismo giro entre beta y gamma de varias formas).
  const x = -Math.cos(b) * Math.sin(g);
  const y = Math.sin(b);
  const z = Math.cos(b) * Math.cos(g);
  const elevacion = Math.asin(Math.max(-1, Math.min(1, -z))) / GRADO;
  const giro = conSigno(Math.atan2(x, y) / GRADO - (Number(anguloPantalla) || 0));
  return { elevacion, giro };
}

// Lo que sirve de un evento de orientación, venga de un iPhone o de un Android.
// `evento` puede ser un objeto cualquiera con los mismos campos (las pruebas).
export function lecturaDeOrientacion(evento, anguloPantalla = 0) {
  const inclinacion = inclinacionDeLaCamara(evento.beta, evento.gamma, anguloPantalla);
  const lectura = {
    rumbo: null,
    fuente: null,
    precisionRumbo: null,
    brujulaDudosa: false,
    elevacion: inclinacion ? inclinacion.elevacion : null,
    giro: inclinacion ? inclinacion.giro : null,
  };
  const deIphone = evento.webkitCompassHeading;
  if (typeof deIphone === 'number' && Number.isFinite(deIphone)) {
    const precision = evento.webkitCompassAccuracy;
    // Apple: una precisión negativa es un rumbo inválido (brújula sin
    // calibrar o un campo magnético fuerte cerca). Se dice, no se usa.
    if (typeof precision === 'number' && precision < 0) {
      lectura.brujulaDudosa = true;
    } else {
      lectura.rumbo = normalizar(deIphone);
      lectura.fuente = 'iphone';
      lectura.precisionRumbo = Number.isFinite(precision) ? precision : null;
    }
    return lectura;
  }
  // En Android llegan dos eventos: `deviceorientation` (relativo a como
  // estaba el celular al abrir la página: no sirve de brújula) y
  // `deviceorientationabsolute` (contra el norte). Solo el segundo da rumbo.
  if (evento.type === 'deviceorientationabsolute' || evento.absolute === true) {
    const rumbo = rumboDeLaCamara(evento.alpha, evento.beta, evento.gamma);
    if (rumbo !== null) {
      lectura.rumbo = rumbo;
      lectura.fuente = 'android';
    }
  }
  return lectura;
}

// La brújula de un celular tiembla unos grados de lectura en lectura. Esto la
// suaviza sin el error de promediar 359° y 1° como si fuera 180°.
export function suavizarRumbo(anterior, nuevo, peso = 0.3) {
  if (anterior === null || anterior === undefined || !Number.isFinite(anterior)) return normalizar(nuevo);
  return normalizar(anterior + peso * conSigno(nuevo - anterior));
}
