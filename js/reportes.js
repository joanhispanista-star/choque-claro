// «Tus reportes»: lo que se dice de cada reporte guardado en el teléfono y cuál va en el renglón del
// inicio. Sin DOM (pantalla-reportes.js pinta) para poder probarlo en Node.
//
// Hasta el 17-nov-2026 un reporte se perdía a las seis horas: la base lo guardaba, pero abrir la app
// empezaba otro y no había cómo volver. Ahora cada uno se puede seguir (el que falta) o abrir (el
// sellado), y el inicio ofrece seguir el último si quedó a medias.
import { estadoDelSello } from './sello.js';
import { revisionDelReporte } from './enviar.js';
import { croquisUtilizable } from './croquis.js';
import { diaRelativo, horaDeColombia } from './fechas.js';

const mayuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const minuscula = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);
const sinPunto = (t) => String(t ?? '').replace(/\.$/, '');

// Un reporte que se creó solo por abrir la app (reporte-bd.js crea uno al pasar las seis horas) y en
// el que nadie declaró nada: no se lista. `reporte.fotos` es la cuenta que da la base.
export function reporteVacio(reporte) {
  if (!reporte) return true;
  if (reporte.fotos || reporte.lugar || reporte.croquis || reporte.sello || reporte.danos?.length) return false;
  return !(reporte.carros ?? []).some((c) => c.linea || c.placa?.texto || c.placa?.fuente || c.placa?.lectura);
}

const esEjemplo = (reporte) => reporte.lugar?.origen === 'ejemplo' || !!reporte.croquis?.ejemplo;

// Dónde fue, como lo dice el reporte: la vía del paso 3 o, si no se guardó, la del croquis.
export function dondeFue(reporte) {
  const croquis = croquisUtilizable(reporte.croquis) ? reporte.croquis : null;
  const via = reporte.lugar?.via?.nombre || croquis?.via?.nombre || null;
  if (via) return via;
  // Sin nombre: puede ser que el análisis de la vía no alcanzó a llegar, no que la calle no lo tenga.
  if (reporte.lugar?.punto || croquis) return 'Punto marcado en el mapa';
  return 'Sin lugar marcado';
}

// Lo primero que falta, en una línea: «Falta: la escena (3 de 8 fotos)». Del detalle de la revisión
// del paso 8 va lo primero (hasta el primer « · » o el primer punto): la fila es corta.
function queFalta(item) {
  const detalle = minuscula(sinPunto(String(item.detalle ?? '').split(' · ')[0].split('. ')[0]));
  return `Falta: ${minuscula(item.titulo)}${detalle ? ` (${detalle})` : ''}`;
}

// Una fila de «Tus reportes». `reporte` viene de la base con su cuenta de fotos (reportes()) y
// `registros`, los de sus fotos: sin ellos no se sabe si el sello sigue valiendo.
// { id, dia, hora, donde, ejemplo, sello: 'sin-sellar'|'cambio'|'vigente', numero, linea, ir, boton }
export async function filaDelReporte({ reporte, registros = [] }, { ahora = new Date(), sutil } = {}) {
  const { estado } = await estadoDelSello({ reporte, registros }, sutil);
  const vigente = estado === 'vigente';
  const falta = vigente ? null : revisionDelReporte({ reporte, registros }).find((i) => !i.completo) ?? null;
  let linea;
  if (vigente) linea = null;
  else if (falta) linea = queFalta(falta);
  else if (estado === 'cambio') linea = 'Cambió después de sellar: falta sellarlo otra vez';
  else linea = 'Está todo: falta sellarlo';
  return {
    id: reporte.id,
    dia: diaRelativo(reporte.creado, ahora),
    hora: horaDeColombia(reporte.creado),
    donde: dondeFue(reporte),
    ejemplo: esEjemplo(reporte),
    sello: estado,
    // El número viejo de un reporte que cambió ya no vale: no se muestra como si valiera.
    numero: vigente ? reporte.sello.numero : null,
    linea,
    // «Seguir» lleva a lo que falta; si no falta nada, a sellarlo. «Abrir», al número y al PDF.
    ir: falta?.ir ?? 'enviar',
    boton: vigente ? 'Abrir' : 'Seguir',
  };
}

// «Hoy, 3:40 p. m.» en la lista; «Reporte de hoy, 3:40 p. m.» o «Reporte del sáb 14 nov, …» en el
// renglón del inicio.
export const cuandoDeLaFila = (fila) => `${mayuscula(fila.dia)}, ${fila.hora}`;
export const tituloDelRenglon = (fila) => `Reporte ${fila.dia === 'hoy' || fila.dia === 'ayer' ? 'de' : 'del'} ${fila.dia}, ${fila.hora}`;

// Los reportes que se listan (sin los vacíos), en el orden de la base: del más nuevo al más viejo.
export const reportesConAlgo = (reportes) => reportes.filter((r) => !reporteVacio(r));

// Los que pueden ir en el renglón del inicio, en orden: el que está en curso (puede ser uno viejo que
// se volvió a abrir) y el último que se empezó. Va el primero que quedó a medias (filaDelReporte
// dice si el sello vale). Si los dos están sellados, la persona terminó: el inicio no le insiste
// con uno más viejo (para eso está «Ver tus reportes»).
export function candidatosParaSeguir(conAlgo) {
  const enCurso = conAlgo.find((r) => r.enCurso) ?? null;
  return [enCurso, conAlgo[0] ?? null].filter((r, i, todos) => r && todos.indexOf(r) === i);
}

// «Ver tus 4 reportes», o «Ver tu reporte guardado» si hay uno solo.
export const textoDelEnlace = (cuantos) => (cuantos === 1 ? 'Ver tu reporte guardado' : `Ver tus ${cuantos} reportes`);
