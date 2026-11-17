// Las fechas y horas que se leen en el paso 8 y en el expediente, en la hora de Colombia (UTC-5,
// sin horario de verano), escritas a mano en vez de con Intl: Node, Safari y Chrome no escriben
// igual «p. m.» ni los meses, y el expediente tiene que decir lo mismo en el teléfono que en las
// pruebas. Una foto tomada a las 11 de la noche en Bogotá es de ese día, no del siguiente en Londres.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n) => String(n).padStart(2, '0');

function enColombia(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t - 5 * 3600000);
}

// «13 de noviembre de 2026».
export function fechaLarga(iso) {
  const f = enColombia(iso);
  return f ? `${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}` : '';
}

// «5:15 p. m.», o «5:15:03 p. m.» con los segundos (las fotos).
export function horaDeColombia(iso, { segundos = false } = {}) {
  const f = enColombia(iso);
  if (!f) return '';
  const h = f.getUTCHours();
  const reloj = `${h % 12 || 12}:${dos(f.getUTCMinutes())}${segundos ? ':' + dos(f.getUTCSeconds()) : ''}`;
  return `${reloj} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

// «13 de noviembre de 2026, 5:15 p. m.».
export function fechaYHora(iso, opciones) {
  const fecha = fechaLarga(iso);
  return fecha ? `${fecha}, ${horaDeColombia(iso, opciones)}` : '';
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// El día de un reporte en «Tus reportes», contado en Colombia: «hoy», «ayer», «sáb 14 nov», y con el
// año si no es el de `ahora` («mar 9 dic 2025»). En minúscula: quien lo usa decide la mayúscula.
export function diaRelativo(iso, ahora = new Date()) {
  const f = enColombia(iso);
  const hoy = enColombia(ahora.toISOString());
  if (!f || !hoy) return '';
  const dia = (d) => Math.floor(d.getTime() / 86400000);
  const atras = dia(hoy) - dia(f);
  if (atras === 0) return 'hoy';
  if (atras === 1) return 'ayer';
  const corto = `${DIAS_CORTOS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES_CORTOS[f.getUTCMonth()]}`;
  return f.getUTCFullYear() === hoy.getUTCFullYear() ? corto : `${corto} ${f.getUTCFullYear()}`;
}

// «251113» (año, mes y día de Colombia), para el número del reporte.
export function fechaCompacta(iso) {
  const f = enColombia(iso);
  return f ? `${dos(f.getUTCFullYear() % 100)}${dos(f.getUTCMonth() + 1)}${dos(f.getUTCDate())}` : '';
}
