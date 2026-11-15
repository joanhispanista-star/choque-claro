// El paso 8, lo que no es pantalla: qué tiene y qué le falta al reporte antes de sellarlo, el
// mensaje con el número para WhatsApp y el nombre del archivo. Puro: se prueba en Node.
//
// La revisión NO bloquea: un reporte sin la foto 5 de la escena se puede sellar y enviar, porque
// en la vía no siempre se puede hacer todo (llegó la grúa, empezó a llover). Lo que falta se dice
// aquí con un botón para ir a hacerlo, y el expediente lo dice también. Solo dos cosas impiden
// sellar: que no haya ni una foto (no hay nada que sellar) y que la cadena esté rota.
import { carrosDelReporte, esDelCarro, estadoDeLaPlaca, nombreDelCarro, placaParaMostrar, textoDeLaLinea } from './carros.js';
import { filasDeDanos } from './danos.js';
import { estadoDeLaVuelta, esDeLaEscena, TOMAS } from './escena.js';
import { croquisUtilizable, tituloDelCaso } from './croquis.js';
import { fechaYHora } from './fechas.js';
import { distancia, planoLocal } from './geo.js';

const fotos = (n) => (n === 1 ? '1 foto' : `${n} fotos`);
// La misma distancia con la que el croquis avisa que el punto del paso 3 se movió (pantalla-croquis.js).
export const LEJOS_DEL_CROQUIS = 30;

// La lista de lo que va en el reporte: [{ clave, titulo, detalle, completo, ir, boton }], con `ir`
// el paso al que lleva el botón cuando algo falta.
export function revisionDelReporte({ reporte, registros = [] }) {
  const items = [];
  const lugar = reporte.lugar ?? null;
  const croquis = croquisUtilizable(reporte.croquis) ? reporte.croquis : null;

  // Dónde y cuándo: del paso 3 si se guardó al llegar aquí; si no (la página se recargó y el paso 3
  // se perdió), lo poco que guarda el croquis. Si el punto del paso 3 y el del croquis no son el
  // mismo lugar, el expediente diría una vía y dibujaría otra: se avisa.
  const delCroquis = croquis?.punto ?? croquis?.centro ?? null;
  const separacion = lugar && delCroquis ? Math.round(distancia({ x: 0, y: 0 }, planoLocal(lugar.punto).aMetros(delCroquis))) : 0;
  if (lugar && separacion > LEJOS_DEL_CROQUIS) {
    items.push({ clave: 'lugar', titulo: 'Dónde y cuándo', detalle: `El punto de «¿Dónde fue?» está a ${separacion}\u00a0m del croquis. Revisa cuál es el del choque.`, completo: false, ir: 'croquis', boton: 'Ver el croquis' });
  } else if (lugar) {
    items.push({ clave: 'lugar', titulo: 'Dónde y cuándo', detalle: [lugar.via?.nombre, fechaYHora(lugar.hora)].filter(Boolean).join(' · '), completo: true, ir: 'donde', boton: 'Cambiar' });
  } else if (delCroquis) {
    items.push({ clave: 'lugar', titulo: 'Dónde y cuándo', detalle: 'Solo el punto del croquis: el análisis de la vía y el clima se perdieron al recargar la página. Abre «¿Dónde fue?» otra vez para traerlos.', completo: false, ir: 'donde', boton: 'Abrir' });
  } else {
    items.push({ clave: 'lugar', titulo: 'Dónde y cuándo', detalle: 'Sin marcar.', completo: false, ir: 'donde', boton: 'Marcar' });
  }

  const escena = estadoDeLaVuelta(registros, { filtro: esDeLaEscena });
  items.push({
    clave: 'escena',
    titulo: 'La escena',
    detalle: escena.cuantas === 0 ? 'Sin fotos.' : `${escena.cuantas} de ${TOMAS} fotos.`,
    completo: escena.completa,
    ir: 'escena',
    boton: escena.cuantas === 0 ? 'Tomarlas' : 'Completar',
  });

  for (const carro of carrosDelReporte(reporte)) {
    const vuelta = estadoDeLaVuelta(registros, { filtro: esDelCarro(carro.letra) });
    const placa = estadoDeLaPlaca(carro);
    const partes = [vuelta.cuantas === 0 ? 'sin fotos' : `${vuelta.cuantas} de ${TOMAS} fotos`];
    if (placa.tipo === 'lista') partes.push(`placa ${placaParaMostrar(placa.texto)}`);
    else if (placa.tipo === 'sin-placa') partes.push('sin placa');
    else if (placa.tipo === 'propuesta') partes.push(`placa ${placaParaMostrar(placa.texto)} sin revisar`);
    else partes.push('placa sin leer');
    const linea = textoDeLaLinea(carro.linea);
    if (linea) partes.push(linea);
    const detalle = partes.join(' · ');
    items.push({
      clave: `carro-${carro.letra}`,
      titulo: nombreDelCarro(carro),
      detalle: detalle[0].toUpperCase() + detalle.slice(1) + '.',
      completo: vuelta.completa && (placa.tipo === 'lista' || placa.tipo === 'sin-placa'),
      ir: 'carros',
      boton: 'Revisar',
    });
  }

  const filas = carrosDelReporte(reporte).flatMap((c) => filasDeDanos(reporte.danos ?? [], registros, c.letra, c.linea?.carroceria ?? null).map((f) => ({ ...f, letra: c.letra })));
  const sinFoto = filas.filter((f) => !f.foto).length;
  items.push({
    clave: 'danos',
    titulo: 'Los daños',
    detalle: !filas.length ? 'Ninguno marcado.' : `${filas.length === 1 ? '1 pieza marcada' : `${filas.length} piezas marcadas`}${sinFoto ? `; ${sinFoto === 1 ? 'falta 1 foto' : `faltan ${sinFoto} fotos`} de cerca` : filas.length === 1 ? ', con su foto de cerca' : ', todas con su foto de cerca'}.`,
    // Ninguno marcado puede ser cierto (un toque sin daños): no se da por incompleto.
    completo: sinFoto === 0,
    ir: 'danos',
    boton: 'Revisar',
  });

  items.push({
    clave: 'croquis',
    titulo: 'El croquis',
    detalle: croquis ? `${tituloDelCaso(croquis.caso)}${croquis.hecho ? '.' : ', sin terminar.'}` : 'No se hizo.',
    completo: !!croquis?.hecho,
    ir: 'croquis',
    boton: croquis ? 'Terminar' : 'Hacerlo',
  });
  return items;
}

// Lo que impide sellar, o null.
export function impideSellar({ registros = [] }, revision = null) {
  if (!registros.length) return 'Todavía no hay fotos que sellar: toma al menos las de la escena.';
  if (revision && !revision.integra) return `La cadena de fotos se rompe en el registro ${revision.rota.indice + 1}: este reporte no se puede sellar. Empieza uno nuevo.`;
  return null;
}

export const nombreDelArchivo = (sello) => `Choque-Claro-${sello.numero}.pdf`;

// El mensaje con el número y la huella. Quien lo recibe se queda con la huella en su chat, con la
// fecha de WhatsApp: si el reporte cambia después, ya no cuadra. Eso es lo que vuelve el sello
// algo más que una promesa del teléfono.
export function textoParaWhatsApp({ reporte, sello, totalDeFotos = 0 }) {
  const lugar = reporte.lugar ?? null;
  const croquis = croquisUtilizable(reporte.croquis) ? reporte.croquis : null;
  const ejemplo = lugar?.origen === 'ejemplo' || !!croquis?.ejemplo;
  const via = lugar?.via?.nombre || croquis?.via?.nombre || null;
  const hora = lugar?.hora ?? croquis?.hora ?? null;
  const carros = carrosDelReporte(reporte).map((c) => {
    const placa = estadoDeLaPlaca(c);
    const texto = placa.tipo === 'lista' ? placaParaMostrar(placa.texto) : placa.tipo === 'sin-placa' ? 'sin placa' : 'placa sin revisar';
    const linea = textoDeLaLinea(c.linea);
    return `${c.letra} ${texto}${linea ? ` (${linea})` : ''}`;
  });
  // «5:44 p. m.» ya termina en punto: no se le pone otro.
  const frase = (t) => (t.endsWith('.') ? t : t + '.');
  return [
    `${ejemplo ? 'EJEMPLO (choque inventado). ' : ''}Reporte de choque ${sello.numero}, hecho con Choque Claro.`,
    frase(`Sellado el ${fechaYHora(sello.hora)}`),
    `Huella SHA-256: ${sello.huella}`,
    hora || via ? frase(`El choque: ${[hora ? fechaYHora(hora) : null, via ? `en ${via}` : null].filter(Boolean).join(', ')}`) : null,
    `Carros: ${carros.join('; ')}.`,
    totalDeFotos > 1 ? `El expediente completo, con las ${fotos(totalDeFotos)}, va en PDF.` : 'El expediente completo va en PDF.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const enlaceDeWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
