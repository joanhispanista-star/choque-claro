// Dónde estaba el sol a la hora del choque: altura sobre el horizonte y
// rumbo. Sin internet: son las fórmulas de baja precisión del Almanaque
// Astronómico (centésimas de grado entre 1950 y 2050), de sobra para saber si
// era de noche o si el sol encandilaba. No se suma la refracción del aire
// (medio grado en el horizonte): no cambia ninguna conclusión de aquí.
//
// Por qué importa: con el sol a menos de ~25° sobre el horizonte y de frente,
// el conductor ve blanco. En Bogotá, en noviembre, el sol se pone hacia el
// oeste-suroeste (rumbo ~252°) un poco antes de las 5:45 p. m.
import { diferenciaAngular, puntoCardinal } from './geo.js';

const GRADO = Math.PI / 180;

// `fecha`: un Date (un instante). Devuelve { altura, azimut } en grados; el
// azimut es el rumbo (0 = norte, 90 = este).
export function posicionDelSol(fecha, lat, lon) {
  const d = fecha.getTime() / 86400000 + 2440587.5 - 2451545.0; // días desde J2000
  const g = (357.529 + 0.98560028 * d) * GRADO; // anomalía media
  const q = 280.459 + 0.98564736 * d; // longitud media
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * GRADO; // longitud eclíptica
  const e = (23.439 - 0.00000036 * d) * GRADO; // oblicuidad
  const ascension = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const declinacion = Math.asin(Math.sin(e) * Math.sin(l));
  const horasSiderales = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  const horario = (horasSiderales * 15 + lon) * GRADO - ascension;
  const fi = lat * GRADO;
  const altura = Math.asin(Math.sin(fi) * Math.sin(declinacion) + Math.cos(fi) * Math.cos(declinacion) * Math.cos(horario));
  const azimut = Math.atan2(-Math.sin(horario), Math.tan(declinacion) * Math.cos(fi) - Math.sin(fi) * Math.cos(horario));
  return { altura: altura / GRADO, azimut: (azimut / GRADO + 360) % 360 };
}

// 'dia' | 'sol-bajo' | 'crepusculo' | 'noche'. El crepúsculo civil termina
// con el sol 6° bajo el horizonte: de ahí en adelante, sin luces no se ve.
export function momentoDelDia({ altura }) {
  if (altura > 6) return 'dia';
  if (altura > 0) return 'sol-bajo';
  if (altura > -6) return 'crepusculo';
  return 'noche';
}

// Si el sol pudo encandilar a alguien que iba por la vía: estaba arriba del
// horizonte pero a menos de 25°, y a menos de 30° de uno de los dos sentidos
// de la vía. Devuelve { haciaRumbo, diferencia } o null. `rumboVia` es el
// rumbo de la vía en el punto (cualquiera de sus dos sentidos).
export const ALTURA_QUE_ENCANDILA = 25;
export const ANGULO_QUE_ENCANDILA = 30;

export function encandilamiento(sol, rumboVia) {
  if (!Number.isFinite(rumboVia)) return null;
  if (!(sol.altura > 0 && sol.altura < ALTURA_QUE_ENCANDILA)) return null;
  const ida = ((rumboVia % 360) + 360) % 360;
  const vuelta = (ida + 180) % 360;
  const dIda = diferenciaAngular(sol.azimut, ida);
  const dVuelta = diferenciaAngular(sol.azimut, vuelta);
  const diferencia = Math.min(dIda, dVuelta);
  if (diferencia > ANGULO_QUE_ENCANDILA) return null;
  return { haciaRumbo: dIda <= dVuelta ? ida : vuelta, diferencia };
}

// Con el cielo así de cubierto, el sol no se ve como un disco: se dice, en
// vez de afirmar un encandilamiento que probablemente no hubo.
export const NUBES_QUE_TAPAN = 85;

// `nubes`: el % de nubes a esa hora, si se sabe (clima.js).
export function filasDelSol(sol, rumboVia, { nubes = null } = {}) {
  const alto = Math.round(sol.altura);
  const hacia = puntoCardinal(sol.azimut);
  const tarde = sol.azimut > 180;
  const luz = {
    dia: { valor: 'De día', nota: `el sol estaba a ${alto}° sobre el horizonte, hacia el ${hacia}` },
    'sol-bajo': { valor: tarde ? 'Atardeciendo, sol muy bajo' : 'Amaneciendo, sol muy bajo', nota: `a ${alto}° sobre el horizonte, hacia el ${hacia}` },
    crepusculo: { valor: tarde ? 'Anochecer' : 'Amanecer', nota: tarde ? 'el sol ya se había puesto; quedaba algo de luz' : 'el sol aún no salía; ya había algo de luz' },
    noche: { valor: 'De noche', nota: 'sin luz del sol' },
  }[momentoDelDia(sol)];
  const filas = [{ clave: 'luz', etiqueta: 'Luz', ...luz, aviso: momentoDelDia(sol) === 'dia' ? null : 'atencion' }];
  const g = encandilamiento(sol, rumboVia);
  if (g) {
    const cubierto = nubes != null && nubes >= NUBES_QUE_TAPAN;
    filas.push({
      clave: 'encandilamiento',
      etiqueta: 'Sol de frente',
      valor: `Para quien iba hacia el ${puntoCardinal(g.haciaRumbo)}`,
      nota: cubierto
        ? `el sol estaba bajo (${alto}°) y casi en la línea de la vía, pero el cielo estaba cubierto (${Math.round(nubes)} % de nubes): es menos probable que encandilara`
        : `el sol estaba bajo (${alto}°) y casi en la línea de la vía: pudo encandilar`,
      aviso: cubierto ? null : 'atencion',
    });
  }
  return filas;
}
