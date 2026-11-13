// La vuelta de la escena: 8 fotos alrededor, una cada 45°, guiadas con la
// brújula. Todo puro: la pantalla (pantalla-escena.js) solo pinta lo que esto
// decide, y aquí se prueba en Node.
//
// Los sectores se cuentan desde la PRIMERA foto, no desde el norte. La primera
// es la que apunta a los carros, la más importante, y así queda en el centro
// de su sector. Con sectores fijos al norte, una primera foto a 22° quedaría en
// la raya entre dos, y la siguiente podría caer 1° más allá y "llenar" otro
// sector sin mostrar nada nuevo.
//
// Sin brújula (un computador, un celular sin magnetómetro o el permiso negado)
// la vuelta se hace igual: las tomas se llenan en orden y la guía dice cuánto
// girar. Esas fotos quedan con rumbo null, y el expediente lo dice.
//
// La misma cuenta sirve para la vuelta a cada carro (paso 5, carros.js): quien
// camina alrededor de un carro apuntándole, también le da la vuelta entera al
// rumbo de la cámara. Por eso las funciones reciben qué fotos cuentan
// (`filtro`) y qué decir (`textos`); sin ellos, son las de la escena.
import { conSigno, normalizar } from './orientacion.js';
import { distancia, numero, planoLocal, puntoCardinal } from './geo.js';

export const TOMAS = 8;
export const GRADOS_POR_TOMA = 360 / TOMAS;

// Cuántos grados antes del centro de una toma vacía se puede disparar sin que
// la guía pida seguir girando. Girando a la derecha, cada foto cae unos 15°
// antes de su centro y la siguiente queda a unos 45°: con los ~50° de ancho que
// ve la cámara de un celular parado, dos fotos seguidas se solapan un poco.
export const MARGEN_DEL_CENTRO = 15;

// A partir de esta distancia del punto marcado en el mapa, se avisa que la
// vuelta se hace donde fue el golpe. El GPS en la ciudad se equivoca de 5 a 30 m.
export const LEJOS_DEL_PUNTO = 30;

// `derecha` e `izquierda` son el sentido en que cambia el rumbo (a la derecha,
// crece), no hacia dónde camina la persona: alrededor de un carro, el rumbo
// crece caminando hacia la izquierda (carros.js).
export const TEXTOS = {
  primera: 'Apunta hacia los carros y toma la primera foto',
  tomar: 'Quieto… y toma la foto',
  seguir: 'Sigue girando despacio a tu derecha',
  derecha: 'Gira despacio a tu derecha',
  izquierda: 'Gira despacio a tu izquierda: falta una de ese lado',
  completa: 'Listo: la vuelta está completa',
  yaTiene: 'Esa dirección ya tiene su foto.',
  // Sin brújula, en orden.
  repetirSinBrujula: (sector) => `Apunta hacia donde tomaste la foto ${sector + 1} y repítela`,
  siguienteSinBrujula: (sector) => `Gira un octavo de vuelta a tu derecha y toma la foto ${sector + 1}`,
  sinBrujula: 'Sin brújula, la app no sabe hacia dónde apunta cada foto. Sigue igual: gira un octavo de vuelta entre una y otra (lo que va de las 12 a la 1 y media en un reloj).',
};

export const esDeLaEscena = (registro) => registro.paso === 'escena';

export function centroDelSector(sector, origen) {
  return normalizar(origen + sector * GRADOS_POR_TOMA);
}

export function sectorDelRumbo(rumbo, origen) {
  return Math.round(normalizar(rumbo - origen) / GRADOS_POR_TOMA) % TOMAS;
}

// La vuelta según las fotos ya guardadas, en el orden de la cadena. Si una toma
// se repitió, vale la última. `porRepetir`: la toma que la persona pidió
// repetir; cuenta como vacía hasta que llegue la nueva. `filtro`: qué fotos son
// de esta vuelta (la cadena del reporte trae también las de los carros y los
// daños).
export function estadoDeLaVuelta(registros, { porRepetir = null, filtro = esDeLaEscena } = {}) {
  const deLaEscena = registros.filter((r) => filtro(r) && Number.isInteger(r.sector) && r.sector >= 0 && r.sector < TOMAS);
  const primera = deLaEscena[0] ?? null;
  // El modo lo decide la primera foto y no cambia en toda la vuelta: si la
  // brújula aparece o se cae a mitad de camino, el anillo no se reacomoda.
  const conBrujula = primera ? primera.rumbo !== null : null;
  const vigentes = new Array(TOMAS).fill(null);
  for (const r of deLaEscena) vigentes[r.sector] = r;
  const tomadas = vigentes.map((r, i) => r !== null && i !== porRepetir);
  const cuantas = tomadas.filter(Boolean).length;
  return {
    conBrujula,
    origen: conBrujula ? primera.rumbo : null,
    vigentes,
    tomadas,
    cuantas,
    completa: cuantas === TOMAS,
    porRepetir: porRepetir !== null && vigentes[porRepetir] ? porRepetir : null,
  };
}

// La toma vacía más cercana a `desde`. Hacia la derecha cuesta un paso menos:
// seguir la vuelta es más natural que devolverse.
function vaciaMasCercana(tomadas, desde) {
  let mejor = null;
  for (let k = 1; k < TOMAS; k++) {
    const derecha = (desde + k) % TOMAS;
    if (!tomadas[derecha] && (!mejor || k < mejor.costo)) mejor = { sector: derecha, costo: k, sentido: 'derecha' };
    const izquierda = (desde - k + TOMAS) % TOMAS;
    if (!tomadas[izquierda] && (!mejor || k + 1 < mejor.costo)) mejor = { sector: izquierda, costo: k + 1, sentido: 'izquierda' };
  }
  return mejor;
}

const usaBrujula = (vuelta, rumbo) => rumbo !== null && (vuelta.conBrujula ?? true);

// Sin brújula, o con la brújula caída a mitad de la vuelta: la toma que sigue
// es la que se pidió repetir o la primera vacía.
const siguienteEnOrden = (vuelta) => vuelta.porRepetir ?? vuelta.tomadas.indexOf(false);

// Qué decirle a la persona ahora mismo, con el rumbo de la cámara (null si no
// hay brújula). `accion`: 'tomar', 'seguir', 'girar' o 'completa'; `sector`, la
// toma de la que se habla.
export function guiaDeLaVuelta(vuelta, rumbo = null, textos = TEXTOS) {
  if (vuelta.completa) return { accion: 'completa', sector: null, texto: textos.completa };
  if (!usaBrujula(vuelta, rumbo)) {
    const sector = siguienteEnOrden(vuelta);
    let texto;
    if (vuelta.cuantas === 0 && sector === 0) texto = textos.primera;
    else if (sector === vuelta.porRepetir) texto = textos.repetirSinBrujula(sector);
    else texto = textos.siguienteSinBrujula(sector);
    return { accion: 'tomar', sector, texto, sinBrujula: true };
  }
  const origen = vuelta.origen ?? rumbo;
  const aqui = sectorDelRumbo(rumbo, origen);
  if (!vuelta.tomadas[aqui]) {
    const desvio = conSigno(rumbo - centroDelSector(aqui, origen));
    if (vuelta.cuantas > 0 && desvio < -MARGEN_DEL_CENTRO) return { accion: 'seguir', sector: aqui, desvio, texto: textos.seguir };
    return { accion: 'tomar', sector: aqui, desvio, texto: vuelta.cuantas === 0 ? textos.primera : textos.tomar };
  }
  let destino;
  if (vuelta.porRepetir !== null) {
    const derecha = normalizar(centroDelSector(vuelta.porRepetir, origen) - rumbo);
    destino = { sector: vuelta.porRepetir, sentido: derecha <= 360 - derecha + GRADOS_POR_TOMA ? 'derecha' : 'izquierda' };
  } else {
    destino = vaciaMasCercana(vuelta.tomadas, aqui);
  }
  return { accion: 'girar', sector: destino.sector, sentido: destino.sentido, texto: textos[destino.sentido] };
}

// A qué toma va una foto tomada ahora: { sector } o { error } si esa
// dirección ya tiene foto.
export function sectorParaLaFoto(vuelta, rumbo = null, textos = TEXTOS) {
  if (vuelta.completa) return { error: 'La vuelta ya está completa.' };
  if (!usaBrujula(vuelta, rumbo)) return { sector: siguienteEnOrden(vuelta) };
  const sector = sectorDelRumbo(rumbo, vuelta.origen ?? rumbo);
  if (vuelta.tomadas[sector]) return { error: `${textos.yaTiene} ${guiaDeLaVuelta(vuelta, rumbo, textos).texto}.` };
  return { sector };
}

// Lo que dibuja el anillo: el ángulo de cada toma en la pantalla (0 = arriba,
// creciendo en el sentido del reloj) y su estado. Con brújula, el anillo gira
// con el celular: lo que la cámara tiene al frente queda siempre arriba, bajo
// la flecha, y la toma que falta se ve llegar por la derecha.
export function dibujoDelAnillo(vuelta, guia, rumbo = null) {
  const conBrujula = usaBrujula(vuelta, rumbo);
  const origen = vuelta.origen ?? rumbo ?? 0;
  return {
    conBrujula,
    norte: conBrujula ? conSigno(-rumbo) : null,
    tomas: Array.from({ length: TOMAS }, (_, sector) => ({
      sector,
      angulo: conBrujula ? conSigno(centroDelSector(sector, origen) - rumbo) : sector * GRADOS_POR_TOMA,
      estado: vuelta.tomadas[sector] ? 'tomada' : sector === vuelta.porRepetir ? 'repetir' : sector === guia.sector ? 'siguiente' : 'vacia',
    })),
  };
}

// El trazo SVG de un sector del anillo (una porción de dona) centrado en
// `angulo`, con el centro del anillo en 0,0.
export function caminoDelSector(angulo, { exterior = 46, interior = 30, separacion = 3 } = {}) {
  const rad = Math.PI / 180;
  const a0 = (angulo - GRADOS_POR_TOMA / 2 + separacion / 2) * rad;
  const a1 = (angulo + GRADOS_POR_TOMA / 2 - separacion / 2) * rad;
  const p = (r, a) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
  return `M${p(exterior, a0)} A${exterior} ${exterior} 0 0 1 ${p(exterior, a1)} L${p(interior, a1)} A${interior} ${interior} 0 0 0 ${p(interior, a0)} Z`;
}

export function textoDeLaCuenta(vuelta) {
  return `${vuelta.cuantas} de ${TOMAS} tomas`;
}

// "Foto 3 · noreste, 47°" (el rumbo es magnético: lo da la brújula). Con
// `nombreDeLaToma` (la vuelta a un carro), "Foto 3 · el lado derecho": ahí lo
// que dice algo es qué lado del carro se ve, no hacia dónde apuntaba.
export function etiquetaDeLaFoto(registro, nombreDeLaToma = null) {
  if (nombreDeLaToma) return `Foto ${registro.sector + 1} · ${nombreDeLaToma(registro.sector)}`;
  const rumbo = registro.rumbo === null ? 'sin rumbo' : `${puntoCardinal(registro.rumbo)}, ${numero(registro.rumbo)}°`;
  return `Foto ${registro.sector + 1} · ${rumbo}`;
}

// La pastilla del GPS. `codigoError`: el de la API (1 = sin permiso) o
// 'sinHttps' / 'sinGeo'.
export function textoDelGps(lectura, codigoError = null, ahora = Date.now()) {
  if (lectura && ahora - new Date(lectura.hora).getTime() < 30000) {
    return { texto: `GPS ±${Math.round(lectura.precision)} m`, estado: lectura.precision <= 20 ? 'bien' : 'mal' };
  }
  if (codigoError === 1 || codigoError === 'sinHttps' || codigoError === 'sinGeo') return { texto: 'Sin GPS', estado: 'mal' };
  return { texto: 'Buscando GPS…', estado: 'neutro' };
}

// La pastilla de la brújula. `esperando`: aún no pasan los segundos que se le
// dan para la primera lectura. `permiso`: lo que respondió el iPhone.
export function textoDeLaBrujula(lectura, { esperando = false, permiso = null } = {}) {
  if (lectura && lectura.rumbo !== null) {
    const p = lectura.precisionRumbo;
    return { texto: p !== null ? `Brújula ±${Math.round(p)}°` : 'Brújula', estado: p !== null && p > 30 ? 'mal' : 'bien' };
  }
  if (permiso === 'denied') return { texto: 'Brújula sin permiso', estado: 'mal' };
  if (lectura && lectura.brujulaDudosa) return { texto: 'Brújula: muévela en 8', estado: 'mal' };
  if (esperando) return { texto: 'Buscando brújula…', estado: 'neutro' };
  return { texto: 'Sin brújula', estado: 'mal' };
}

// Qué tan lejos está la persona del punto que marcó en el mapa. Null si falta
// alguno de los dos.
export function textoDeLaDistancia(lectura, punto) {
  if (!lectura || !punto) return null;
  const plano = planoLocal(punto);
  const metros = distancia(plano.aMetros(lectura), { x: 0, y: 0 });
  const cuanto = metros < 1000 ? `${Math.round(metros)} m` : `${numero(metros / 1000, 1)} km`;
  if (metros > LEJOS_DEL_PUNTO) return { texto: `Estás a ${cuanto} del punto que marcaste en el mapa. La vuelta se hace donde fue el golpe.`, lejos: true };
  return { texto: `A ${cuanto} del punto que marcaste en el mapa.`, lejos: false };
}
