// La escena en 360°: la opción C del plan, que Joan eligió el 13-nov-2026. Es
// lo único de la zona que es DEL DÍA del choque: las 8 fotos de la vuelta del
// paso 4, puestas en círculo según la brújula, para girar con el dedo como si
// uno estuviera parado en el punto del golpe.
//
// No están cosidas. Coser fotos de verdad (buscar los mismos puntos en dos fotos
// y deformarlas) pesa mucho para un celular y, con 8 fotos tomadas a mano, deja
// costuras raras. Aquí cada foto va en su rumbo, como un panel de una sala
// redonda: entre una y otra puede haber un salto o un pedazo repetido, y la
// pantalla lo dice. Sin brújula (Android sin `deviceorientationabsolute`, o un
// permiso negado en iPhone) van en el orden en que se tomaron, una cada octavo
// de vuelta, y también se dice.
//
// Este módulo es puro (sin DOM): calcula dónde va cada panel y qué foto queda
// de frente. La parte del navegador está en pantalla-escena-360.js.
import { diferenciaAngular, puntoCardinal } from './geo.js';

// Lo que ve en horizontal la cámara de atrás de un celular en vertical: unos
// 50°. Con 8 fotos cada 45°, se pisan un poco: mejor que dejar huecos.
export const CAMPO_DE_LA_FOTO = 50;
// Lo que se ve en el visor a lo ancho: un poco más que una foto, para ver que
// la de al lado sigue.
export const CAMPO_DEL_VISOR = 70;

const normal = (g) => ((g % 360) + 360) % 360;

// Las fotos de la escena, cada una con su ángulo en el círculo. Si TODAS tienen
// rumbo, va el rumbo; si falta en alguna, van todas en orden, una cada 45°:
// mezclar las dos cosas pondría fotos encima de otras sin que se note.
export function panelesDelCirculo(fotos = []) {
  const escena = fotos.filter((f) => f && f.registro && f.registro.paso === 'escena').sort((a, b) => a.registro.indice - b.registro.indice);
  if (!escena.length) return { paneles: [], conBrujula: false };
  const conBrujula = escena.every((f) => Number.isFinite(f.registro.rumbo));
  const paneles = escena.map((f, i) => ({
    id: f.id,
    indice: f.registro.indice,
    angulo: conBrujula ? normal(f.registro.rumbo) : normal(i * 45),
    registro: f.registro,
  }));
  return { paneles, conBrujula };
}

// Las medidas del cilindro para un visor de `ancho` píxeles: la perspectiva de
// CSS (dónde está el ojo), el radio (a qué distancia quedan las fotos) y el
// tamaño de cada panel. Con radio = perspectiva, la foto de frente se ve a su
// tamaño real en la pantalla. `proporcion` es alto/ancho de la foto.
export function geometriaDelVisor(ancho, { proporcion = 4 / 3 } = {}) {
  const perspectiva = ancho / 2 / Math.tan(((CAMPO_DEL_VISOR / 2) * Math.PI) / 180);
  const radio = perspectiva;
  const anchoPanel = 2 * radio * Math.tan(((CAMPO_DE_LA_FOTO / 2) * Math.PI) / 180);
  return { perspectiva, radio, anchoPanel, altoPanel: anchoPanel * proporcion };
}

// La transformación de CSS de cada panel y la del mundo. En CSS, rotateY(+a)
// lleva lo que está al frente hacia la IZQUIERDA; el rumbo crece hacia la
// derecha (90° = este), por eso los paneles van con -ángulo.
export function transformacionDelPanel(angulo, radio) {
  return `rotateY(${-normal(angulo)}deg) translateZ(${-radio}px)`;
}

export function transformacionDelMundo(mirandoA, perspectiva) {
  return `translateZ(${perspectiva}px) rotateY(${mirandoA}deg)`;
}

// La foto que queda de frente cuando se mira hacia `rumbo`.
export function panelDeFrente(paneles, rumbo) {
  let mejor = null;
  for (const p of paneles) {
    const d = diferenciaAngular(p.angulo, rumbo);
    if (!mejor || d < mejor.d) mejor = { panel: p, d };
  }
  return mejor ? mejor.panel : null;
}

// Arrastrar el dedo: cuántos grados gira la vista por cada píxel. Un ancho de
// visor de arrastre = el campo del visor: lo que estaba en el borde queda en
// el centro, como al mover una foto con el dedo.
export function gradosPorPixel(ancho) {
  return CAMPO_DEL_VISOR / Math.max(1, ancho);
}

const dos = (n) => String(n).padStart(2, '0');

// "5:16 p. m." en la hora de Colombia (UTC-5, sin horario de verano).
function horaColombia(iso) {
  const f = new Date(Date.parse(iso) - 5 * 3600000);
  if (Number.isNaN(f.getTime())) return '';
  const h = f.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${dos(f.getUTCMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

// Lo que se dice de la foto de frente. La huella va corta (los primeros 8
// caracteres): la completa está en el expediente.
export function textoDeLaFoto(registro, { conBrujula = true } = {}) {
  const partes = [`Foto ${registro.indice + 1}`, horaColombia(registro.hora)];
  if (conBrujula && Number.isFinite(registro.rumbo)) partes.push(`hacia el ${puntoCardinal(registro.rumbo)} (${Math.round(normal(registro.rumbo))}°)`);
  partes.push(registro.gps ? `GPS ±${Math.round(registro.gps.precision)} m` : 'sin GPS');
  if (registro.huella) partes.push(`huella ${String(registro.huella).slice(0, 8)}…`);
  if (registro.calidad?.aceptadaConProblemas) partes.push('aceptada sin pasar la revisión');
  return partes.filter(Boolean).join(' · ');
}

// Las marcas de la brújula que van debajo del círculo (N, NE, E...), con su ángulo.
export const MARCAS = [
  ['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315],
];
