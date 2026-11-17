// El ejemplo de «Ver un ejemplo»: un lugar REAL con un choque INVENTADO. Todas las pantallas sacan
// de aquí el punto, el archivo y lo que dicen de él, para que ninguna se quede hablando del lugar
// viejo (pasó: el ejemplo vivió en una curva de la vía Los Verjones–Patios del 12 al 17-nov-2026).
//
// Por qué esta esquina. El mar 17-nov-2026 Joan aprobó mover el ejemplo a una esquina de barrio de
// Bogotá, con un choque como el de las fotos de muestra de la vuelta (dos carros, uno contra el
// costado del otro). En la curva, el 3D de Google salía borroso; en la ciudad sale nítido. De 352
// esquinas buscadas en el mapa (Teusaquillo, Palermo, Chapinero y Quinta Camacho), esta tiene:
//   - dos calles residenciales en ángulo recto, sin semáforo;
//   - la Carrera 20 de un solo sentido hacia el norte, que es el sentido en que va el carro A;
//   - la Calle 44 de doble sentido, por donde llega el carro B desde la izquierda de A;
//   - un Pare en cada entrada de la Calle 44, en el mapa: el ejemplo enseña a ver las señales.
// El ejemplo NO dice quién tuvo la culpa: eso no lo decide Choque Claro.
//
// El punto queda 1,65 m antes del cruce por la Carrera 20 (no en el nodo del cruce): así el análisis
// elige la calle de A y el golpe del caso «En un cruce» cae en el carril de B.

import { planoLocal, distancia } from './geo.js';

export const EJEMPLO = { lat: 4.6326328, lon: -74.0728039 };

// La respuesta REAL de Overpass guardada (herramientas/guardar-ejemplo-via.mjs): delante de un
// cliente el ejemplo no puede depender de los servidores públicos del mapa.
export const ARCHIVO_DEL_EJEMPLO = 'datos/ejemplo-teusaquillo.json';

// El caso del paso 7 con que se arma el croquis inventado.
export const CASO_DEL_EJEMPLO = 'cruce';

export const LUGAR_DEL_EJEMPLO = 'una esquina real de Teusaquillo (Bogotá), la Carrera 20 con Calle 44';

// Hasta dónde un punto «es» el del ejemplo. Un enlace viejo con ejemplo=1 (de la curva) o un pin
// arrastrado lejos no puede analizarse con los datos guardados de esta esquina: el carro saldría en
// una calle que no es. Lejos de aquí, el ejemplo se consulta en vivo como cualquier punto.
export const CERCA_DEL_EJEMPLO = 30;

export function esElLugarDelEjemplo(punto, metros = CERCA_DEL_EJEMPLO) {
  if (!punto || !Number.isFinite(punto.lat) || !Number.isFinite(punto.lon)) return false;
  const plano = planoLocal(EJEMPLO);
  return distancia(plano.aMetros(EJEMPLO), plano.aMetros(punto)) <= metros;
}
