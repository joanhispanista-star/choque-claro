// Los carros del choque (paso 5): quiénes son, la vuelta de 8 fotos alrededor
// de cada uno, su placa y su línea. Todo puro: la pantalla (pantalla-carros.js)
// solo pinta lo que esto decide, y aquí se prueba en Node.
//
// La vuelta es la misma cuenta de la escena (escena.js): quien camina
// alrededor de un carro apuntándole con el celular también le da la vuelta
// entera al rumbo de la cámara. Parado frente al carro, el rumbo es el del
// frente; caminando hacia la IZQUIERDA de quien toma las fotos, el rumbo
// crece, y el primer lado que aparece es el DERECHO del carro (el del
// pasajero: el carro te mira de frente). Por eso las tomas van frente, frente
// y lado derecho, lado derecho… y la guía dice "camina hacia tu izquierda".
//
// Lo que la persona declara (la placa, la línea) no es una foto: se guarda en
// el reporte (reporte-bd.js, guardarDatos) y se sella al enviar (paso 8). Las
// fotos sí van a la cadena desde que se toman, con la letra del carro.
import { TOMAS } from './escena.js';

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Las tomas de la vuelta. `largo` va en las frases ("toma la foto 2: el frente
// y el lado derecho"); `corto`, sobre el visor y en la lista.
export const VISTAS_DEL_CARRO = [
  { corto: 'Frente', largo: 'el frente, con la placa' },
  { corto: 'Frente y lado derecho', largo: 'el frente y el lado derecho' },
  { corto: 'Lado derecho', largo: 'el lado derecho' },
  { corto: 'Atrás y lado derecho', largo: 'atrás y el lado derecho' },
  { corto: 'Atrás', largo: 'atrás, con la placa' },
  { corto: 'Atrás y lado izquierdo', largo: 'atrás y el lado izquierdo' },
  { corto: 'Lado izquierdo', largo: 'el lado izquierdo' },
  { corto: 'Frente y lado izquierdo', largo: 'el frente y el lado izquierdo' },
];

// Las tomas donde se ve una placa: de ahí se lee sola.
export const SECTOR_DEL_FRENTE = 0;
export const SECTOR_DE_ATRAS = 4;
export const SECTORES_CON_PLACA = [SECTOR_DEL_FRENTE, SECTOR_DE_ATRAS];

// `derecha`: el rumbo crece, que alrededor del carro es caminar hacia la
// izquierda (ver arriba). escena.js explica las claves.
export const TEXTOS_DEL_CARRO = {
  primera: 'Párate frente al carro y toma la primera foto: el frente, con la placa',
  tomar: 'Quieto… y toma la foto',
  seguir: 'Sigue caminando a tu izquierda, apuntándole al carro',
  derecha: 'Camina hacia tu izquierda alrededor del carro',
  izquierda: 'Camina hacia tu derecha: falta una de ese lado',
  completa: 'Listo: la vuelta al carro está completa',
  yaTiene: 'Ese lado del carro ya tiene su foto.',
  repetirSinBrujula: (sector) => `Repite la foto ${sector + 1}: ${VISTAS_DEL_CARRO[sector].largo}`,
  siguienteSinBrujula: (sector) => `Camina hacia tu izquierda y toma la foto ${sector + 1}: ${VISTAS_DEL_CARRO[sector].largo}`,
  sinBrujula: 'Sin brújula, la app no sabe desde qué lado tomas cada foto. Sigue igual: la guía y la silueta te dicen cuál va.',
};

export const nombreDeLaToma = (sector) => VISTAS_DEL_CARRO[sector].corto;

// Qué fotos son de la vuelta de un carro.
export const esDelCarro = (letra) => (registro) => registro.paso === 'carro' && registro.carro === letra;

export function carroNuevo(letra, quien = 'otro') {
  return { letra, quien, placa: { texto: '', fuente: null, lectura: null, intentos: [] }, linea: null };
}

// Los carros del reporte. Si todavía no hay ninguno guardado, el tuyo y el
// otro: un choque simple es de dos.
export function carrosDelReporte(reporte) {
  const guardados = reporte && Array.isArray(reporte.carros) ? reporte.carros : [];
  return guardados.length ? guardados : [carroNuevo('A', 'tuyo'), carroNuevo('B', 'otro')];
}

export function agregarCarro(carros) {
  const libre = LETRAS.find((letra) => !carros.some((c) => c.letra === letra));
  return libre ? [...carros, carroNuevo(libre, 'otro')] : carros;
}

// Solo uno agregado de más (C en adelante): el tuyo y el otro siempre están,
// aunque el otro no tenga fotos (un choque contra un poste). La pantalla solo
// lo ofrece si el carro no tiene fotos: las fotos no se borran de la cadena.
export function quitarCarro(carros, letra) {
  if (letra === 'A' || letra === 'B') return carros;
  return carros.filter((c) => c.letra !== letra);
}

// `cambio`: un objeto que se mezcla, o una función (carro) => carro.
export function cambiarCarro(carros, letra, cambio) {
  return carros.map((c) => (c.letra !== letra ? c : typeof cambio === 'function' ? cambio(c) : { ...c, ...cambio }));
}

export function carroDe(carros, letra) {
  return carros.find((c) => c.letra === letra) || null;
}

export function nombreDelCarro(carro) {
  if (carro.quien === 'tuyo') return `Carro ${carro.letra} · el tuyo`;
  if (carro.letra === 'B') return `Carro ${carro.letra} · el otro`;
  return `Carro ${carro.letra}`;
}

// --- La placa --------------------------------------------------------------

export function normalizarPlaca(texto) {
  return String(texto || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

// Carro particular o público: tres letras y tres números (ABC123). Moto: tres
// letras, dos números y una letra (ABC12D). Lo demás (remolques, diplomáticas,
// placas de otro país) se acepta igual, con un aviso.
export function formatoDePlaca(texto) {
  const placa = normalizarPlaca(texto);
  if (!placa) return 'vacia';
  if (/^[A-Z]{3}[0-9]{3}$/.test(placa)) return 'carro';
  if (/^[A-Z]{3}[0-9]{2}[A-Z]$/.test(placa)) return 'moto';
  return 'otra';
}

// "ABC123" se lee "ABC 123", como en la placa de verdad.
export function placaParaMostrar(texto) {
  const placa = normalizarPlaca(texto);
  return /^[A-Z]{3}[0-9]/.test(placa) ? placa.slice(0, 3) + ' ' + placa.slice(3) : placa;
}

const DE_LA_FOTO = { [SECTOR_DEL_FRENTE]: 'de la foto del frente', [SECTOR_DE_ATRAS]: 'de la foto de atrás' };

// Se lee sola la primera vez que llega la foto del frente o la de atrás, si
// la persona todavía no decidió nada y no hay ya una lectura esperando que la
// revise. Una lectura que no encontró la placa en el frente deja probar atrás.
export function debeLeerLaPlaca(carro, sector) {
  if (!SECTORES_CON_PLACA.includes(sector)) return false;
  const placa = carro.placa;
  if (placa.fuente !== null || placa.lectura) return false;
  return !placa.intentos.some((i) => i.sector === sector);
}

// Lo que dio leerPlacaDeFoto (placa-ocr.js) para la foto `registro`:
// null si no había placa amarilla, { placa: '' } si había y no se pudo leer,
// o { placa, crudo, confianza, milisegundos }. `error`: si el lector falló
// (sin internet la primera vez, por ejemplo).
export function conLecturaDePlaca(carro, { registro, resultado = null, error = null, cuando }) {
  const intento = {
    sector: registro.sector,
    foto: registro.huella,
    cuando: new Date(cuando).toISOString(),
    resultado: error ? 'fallo' : !resultado ? 'sin-placa-en-la-foto' : resultado.placa ? 'leida' : 'ilegible',
    ...(error ? { error: String(error).slice(0, 160) } : {}),
    ...(resultado ? { crudo: resultado.crudo, confianza: Math.round(resultado.confianza * 1000) / 1000, milisegundos: resultado.milisegundos } : {}),
  };
  const placa = { ...carro.placa, intentos: [...carro.placa.intentos, intento] };
  // La lectura queda como propuesta: la placa no se da por buena hasta que la
  // persona la ve (en el taller, la X de una placa a 30° salió K).
  if (intento.resultado === 'leida' && placa.fuente === null && !placa.lectura) {
    placa.lectura = { texto: resultado.placa, sector: registro.sector, foto: registro.huella, confianza: intento.confianza };
  }
  return { ...carro, placa };
}

export function confirmarPlacaLeida(carro) {
  if (!carro.placa.lectura) return carro;
  return { ...carro, placa: { ...carro.placa, texto: carro.placa.lectura.texto, fuente: 'leida' } };
}

// La placa escrita a mano. Devuelve { carro, aviso }: lo que no parece una
// placa colombiana se guarda igual, porque la persona la tiene enfrente.
export function conPlacaEscrita(carro, texto) {
  const placa = normalizarPlaca(texto);
  const formato = formatoDePlaca(placa);
  if (formato === 'vacia') return { carro, aviso: 'Escribe la placa, o toca «No tiene placa».' };
  const aviso = formato === 'otra' ? 'No parece una placa colombiana (ABC123 de carro, ABC12D de moto). Si es la que tiene, déjala así.' : null;
  return { carro: { ...carro, placa: { ...carro.placa, texto: placa, fuente: 'escrita' } }, aviso };
}

export function sinPlaca(carro) {
  return { ...carro, placa: { ...carro.placa, texto: '', fuente: 'sin-placa' } };
}

// Volver a decidir: lo leído y los intentos se quedan, para el expediente.
export function cambiarPlaca(carro) {
  return { ...carro, placa: { ...carro.placa, texto: '', fuente: null } };
}

// Lo que dice la pantalla de la placa. `tipo`: 'lista', 'sin-placa',
// 'leyendo', 'propuesta', 'no-leida' o 'pendiente'.
export function estadoDeLaPlaca(carro, { leyendo = false } = {}) {
  const placa = carro.placa;
  const lectura = placa.lectura;
  if (placa.fuente === 'leida') return { tipo: 'lista', texto: placa.texto, detalle: `Leída ${DE_LA_FOTO[lectura?.sector] ?? 'de una foto'} y revisada por ti.` };
  if (placa.fuente === 'escrita') {
    const antes = lectura && lectura.texto !== placa.texto ? ` La app había leído ${placaParaMostrar(lectura.texto)}.` : '';
    return { tipo: 'lista', texto: placa.texto, detalle: `Escrita por ti.${antes}` };
  }
  if (placa.fuente === 'sin-placa') return { tipo: 'sin-placa', texto: '', detalle: 'Dijiste que no tiene placa o que no se ve.' };
  if (leyendo) return { tipo: 'leyendo', texto: '', detalle: 'Leyendo la placa en la foto… La primera vez el teléfono baja el lector (unos 17\u00a0MB).' };
  if (lectura) {
    return {
      tipo: 'propuesta',
      texto: lectura.texto,
      detalle: `Leída ${DE_LA_FOTO[lectura.sector] ?? 'de una foto'}. Revísala: el lector puede confundir una letra (la K con la X, la 6 con la 8, la M con la W).`,
    };
  }
  const ultimo = placa.intentos[placa.intentos.length - 1];
  if (ultimo) {
    // Lo que se alcanzó a leer ("JRK24") va en el campo, para completarlo.
    const crudo = normalizarPlaca(ultimo.crudo);
    const motivo = {
      'sin-placa-en-la-foto': `No se encontró una placa amarilla ${DE_LA_FOTO[ultimo.sector] ?? 'en la foto'}.`,
      ilegible: `Se encontró la placa ${DE_LA_FOTO[ultimo.sector] ?? 'en la foto'}, pero no se pudo leer entera${crudo ? ` (se leyó «${crudo}»)` : ''}.`,
      fallo: 'El lector de placas no abrió (la primera vez necesita internet).',
    }[ultimo.resultado];
    const otra = ultimo.sector === SECTOR_DEL_FRENTE && !placa.intentos.some((i) => i.sector === SECTOR_DE_ATRAS) ? ' Se va a probar con la foto de atrás.' : '';
    return { tipo: 'no-leida', texto: '', sugerida: ultimo.resultado === 'ilegible' ? crudo : '', detalle: `${motivo ?? 'No se pudo leer.'}${otra} También la puedes escribir.` };
  }
  return { tipo: 'pendiente', texto: '', detalle: 'Se lee sola de la foto del frente. También la puedes escribir.' };
}

// --- La línea (opcional) ------------------------------------------------------

// Lo que se guarda de una entrada del catálogo (datosDeEntrada de catalogo.js).
export function textoDeLaLinea(linea) {
  if (!linea) return '';
  return [linea.marca, linea.linea].filter(Boolean).join(' ');
}

// --- El resumen de cada carro ---------------------------------------------------

export function faltantesDeLaVuelta(vuelta) {
  return vuelta.tomadas.map((tomada, sector) => (tomada ? null : sector)).filter((s) => s !== null);
}

// Las tomas que faltan, en palabras y con su número: "la 4 (atrás y lado
// derecho) y la 5 (atrás)". Sin el número, los nombres que ya llevan "y" se
// leían como una sola lista ("atrás y lado derecho, atrás y atrás y…").
export function textoDeLasFaltantes(sectores) {
  const nombres = sectores.map((s) => `la ${s + 1} (${VISTAS_DEL_CARRO[s].corto.toLowerCase()})`);
  if (nombres.length <= 1) return nombres.join('');
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

// La tarjeta de un carro en la lista. `vuelta`: estadoDeLaVuelta de sus fotos.
export function resumenDelCarro(carro, vuelta) {
  const placa = estadoDeLaPlaca(carro);
  const lineas = [vuelta.cuantas === 0 ? 'Sin fotos todavía' : `${vuelta.cuantas} de ${TOMAS} fotos`];
  if (placa.tipo === 'lista') lineas.push(`Placa ${placaParaMostrar(placa.texto)}`);
  else if (placa.tipo === 'sin-placa') lineas.push('Sin placa');
  else if (placa.tipo === 'propuesta') lineas.push(`Placa ${placaParaMostrar(placa.texto)}, sin revisar`);
  else lineas.push('Placa sin leer');
  const linea = textoDeLaLinea(carro.linea);
  if (linea) lineas.push(linea);
  const boton = vuelta.cuantas === 0 ? 'Fotografiar' : vuelta.completa ? 'Ver' : 'Seguir';
  return { titulo: nombreDelCarro(carro), lineas, boton, completa: vuelta.completa };
}
