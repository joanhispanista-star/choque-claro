// La brújula y la inclinación del celular, del navegador a orientacion.js.
//
// iPhone (iOS 13 en adelante): Safari no manda ni un evento de orientación
// hasta que la persona da permiso, y el permiso solo se puede pedir DENTRO de
// un toque y antes de cualquier await: después lo niega sin preguntar. Por eso
// `pedirPermisoBrujula` es lo primero que corre el botón de empezar.
//
// Android (Chrome): `deviceorientationabsolute` da el giro contra el norte.
// Llega también `deviceorientation`, pero relativo: solo sirve para la
// inclinación. Se escuchan los dos y orientacion.js decide qué vale.
//
// Un computador o un celular sin magnetómetro no manda nada (o manda todo en
// null): si en unos segundos no llega un rumbo, la pantalla dice "Sin brújula".
import { lecturaDeOrientacion, suavizarRumbo } from './orientacion.js';

// Tiempo que se le da a la brújula para su primera lectura. En iPhone puede
// tardar en calibrarse.
export const ESPERA_DE_LA_BRUJULA_MS = 3000;
// Una lectura más vieja que esto ya no dice hacia dónde apunta el celular.
const VIGENCIA_MS = 1500;

export function pedirPermisoBrujula(Evento = globalThis.DeviceOrientationEvent) {
  if (!Evento || typeof Evento.requestPermission !== 'function') return Promise.resolve('no-hace-falta');
  try {
    return Evento.requestPermission().catch(() => 'denied');
  } catch {
    return Promise.resolve('denied');
  }
}

// El ángulo de la pantalla: 0 en vertical, 90 o 270 de lado. screen.orientation
// llegó a Safari en iOS 16.4; antes estaba window.orientation.
export function anguloDeLaPantalla() {
  const angulo = globalThis.screen?.orientation?.angle ?? globalThis.orientation ?? 0;
  return ((Number(angulo) % 360) + 360) % 360;
}

export function escucharBrujula({ ventana = globalThis.window, angulo = anguloDeLaPantalla, reloj = () => performance.now() } = {}) {
  const inicio = reloj();
  const estado = { rumbo: null, fuente: null, precisionRumbo: null, brujulaDudosa: false, elevacion: null, giro: null, cuandoRumbo: -Infinity, cuandoInclinacion: -Infinity, cuandoDudosa: -Infinity };

  const alEvento = (evento) => {
    const l = lecturaDeOrientacion(evento, angulo());
    const ahora = reloj();
    if (l.rumbo !== null) {
      // Tras un silencio, la lectura nueva entra entera: suavizar contra una
      // vieja daría un rumbo que nunca existió.
      estado.rumbo = suavizarRumbo(ahora - estado.cuandoRumbo < VIGENCIA_MS ? estado.rumbo : null, l.rumbo);
      estado.fuente = l.fuente;
      estado.precisionRumbo = l.precisionRumbo;
      estado.cuandoRumbo = ahora;
    } else if (l.brujulaDudosa) {
      estado.cuandoDudosa = ahora;
    }
    if (l.elevacion !== null) {
      estado.elevacion = l.elevacion;
      estado.giro = l.giro;
      estado.cuandoInclinacion = ahora;
    }
  };
  ventana.addEventListener('deviceorientationabsolute', alEvento);
  ventana.addEventListener('deviceorientation', alEvento);

  return {
    // Lo de este instante; lo que esté viejo sale en null.
    leer() {
      const ahora = reloj();
      const conRumbo = ahora - estado.cuandoRumbo < VIGENCIA_MS;
      const conInclinacion = ahora - estado.cuandoInclinacion < VIGENCIA_MS;
      return {
        rumbo: conRumbo ? estado.rumbo : null,
        fuente: conRumbo ? estado.fuente : null,
        precisionRumbo: conRumbo ? estado.precisionRumbo : null,
        brujulaDudosa: !conRumbo && ahora - estado.cuandoDudosa < VIGENCIA_MS,
        elevacion: conInclinacion ? estado.elevacion : null,
        giro: conInclinacion ? estado.giro : null,
        // Todavía en los primeros segundos y sin ninguna lectura de rumbo.
        esperando: estado.cuandoRumbo === -Infinity && ahora - inicio < ESPERA_DE_LA_BRUJULA_MS,
      };
    },
    detener() {
      ventana.removeEventListener('deviceorientationabsolute', alEvento);
      ventana.removeEventListener('deviceorientation', alEvento);
    },
  };
}
