// El sello del reporte (paso 8): una sola huella para todo lo que el reporte dice.
//
// Las fotos se sellan una a una desde que se toman (evidencia.js: la cadena). Lo que la persona
// declara y no es foto —los carros con su placa y su línea, los daños marcados, el croquis, el
// lugar— se puede corregir hasta el final, a propósito: un error de dedo no debería quedar
// grabado. Sellar es decir «esto es lo que declaro»: la última huella de la cadena y todo lo
// declarado van juntos en un texto canónico (textoCanonico, evidencia.js) y su SHA-256 es la
// huella del reporte. Ese texto viaja DENTRO del PDF como archivo adjunto, tal cual: quien lo saque
// y le calcule el SHA-256 con cualquier herramienta obtiene la huella impresa en la portada.
//
// Se puede seguir corrigiendo después de sellar. Si algo cambia (otra foto, otra placa, el
// croquis), el sello deja de ser el de lo que hay y la pantalla pide sellar otra vez: un
// expediente nunca sale con un sello que no es el suyo.
//
// Lo que esto NO prueba, igual que la cadena: mientras el sello viva solo en el teléfono, quien
// tenga el teléfono y conocimientos podría rehacerlo. Vale desde que sale de él: el número y la
// huella que ya le llegaron a otro (por WhatsApp, en el PDF) no se pueden cambiar en silencio.
import { INICIO_DE_LA_CADENA, sha256Hex, textoCanonico } from './evidencia.js';
import { fechaCompacta } from './fechas.js';
import { filasDeLaVia, resumenDeLaVia } from './via.js';
import { filasDelSol, posicionDelSol } from './sol.js';
import { filasDelClima } from './clima.js';

export const VERSION_DEL_SELLO = 1;

// Las partes del reporte, en el orden en que la pantalla dice qué cambió después de sellar.
export const PARTES = ['fotos', 'lugar', 'carros', 'danos', 'croquis'];
const NOMBRES_DE_LAS_PARTES = { fotos: 'las fotos', lugar: 'los datos del lugar', carros: 'los carros', danos: 'los daños', croquis: 'el croquis' };

const redondear = (valor, decimales) => (Number.isFinite(valor) ? Math.round(valor * 10 ** decimales) / 10 ** decimales : null);

// Lo guardado pasa por JSON antes de sellarse: una fecha (Date) se volvería «{}» en el texto
// canónico sin avisar, y un undefined dentro de una lista no se puede sellar. Como se limpia
// igual al sellar y al revisar, la huella se repite; y el adjunto del PDF es el texto ya limpio.
const limpio = (valor) => (valor === undefined ? null : JSON.parse(JSON.stringify(valor)));

// --- El lugar --------------------------------------------------------------------------------

const fila = ({ clave, etiqueta, valor, nota, aviso }) => ({ clave, etiqueta, valor: String(valor ?? ''), nota: nota ? String(nota) : '', aviso: aviso ?? null });

// Lo del paso 3 que se guarda en el reporte al llegar al paso 8: el punto, la hora del choque y lo
// que la app dijo de la vía, la luz y el clima ahí, en las mismas filas que mostró. El paso 3 vive
// en la memoria de la página: sin esto, el expediente de una página recargada no tendría ni la vía
// ni el clima. Lo que todavía se estaba consultando no entra.
export function lugarParaElReporte({ punto, origen = null, precision = null, fecha, via = null, clima = null, climaCargando = false } = {}) {
  if (!punto || !Number.isFinite(punto.lat) || !Number.isFinite(punto.lon)) return null;
  const hora = new Date(fecha);
  if (Number.isNaN(hora.getTime())) return null;
  const conVia = via?.estado === 'ok';
  const deClima = climaCargando ? null : clima;
  const sol = posicionDelSol(hora, punto.lat, punto.lon);
  return {
    punto: { lat: redondear(punto.lat, 7), lon: redondear(punto.lon, 7) },
    origen,
    precision: Number.isFinite(precision) ? Math.round(precision) : null,
    hora: hora.toISOString(),
    via: conVia ? { nombre: via.via?.nombre || (via.via?.ruta ? `Ruta ${via.via.ruta}` : null), rumbo: redondear(via.rumbo, 1), resumen: resumenDeLaVia(via) } : null,
    filasDeLaVia: filasDeLaVia(via).map(fila),
    filasDeLaLuz: [...filasDelSol(sol, conVia ? via.rumbo : undefined, { nubes: deClima?.nubes ?? null }), ...filasDelClima(deClima)].map(fila),
  };
}

// --- El sello --------------------------------------------------------------------------------

// Lo que se sella: todo lo que el reporte declara, tal como está guardado, y la punta de la
// cadena de fotos (que amarra a todas las anteriores). `hora`: la del sello.
export function contenidoDelSello({ reporte, registros = [], hora }) {
  const ultima = registros.length ? registros[registros.length - 1].huella : INICIO_DE_LA_CADENA;
  return limpio({
    version: VERSION_DEL_SELLO,
    app: 'Choque Claro',
    reporte: reporte.id,
    creado: reporte.creado,
    sellado: new Date(hora).toISOString(),
    fotos: { total: registros.length, ultimaHuella: ultima },
    lugar: reporte.lugar ?? null,
    carros: reporte.carros ?? [],
    danos: reporte.danos ?? [],
    croquis: reporte.croquis ?? null,
  });
}

// El número que la persona le dicta a la aseguradora: CC, el día del sello en Colombia y las
// primeras 6 letras de la huella («CC-261114-3FA9C2»). Dos reportes del mismo día comparten
// número solo por un azar de 1 en 16 millones. NO es el número del siniestro: ese lo da la
// aseguradora cuando la persona le avisa.
export function numeroDelReporte(huella, hora) {
  return `CC-${fechaCompacta(new Date(hora).toISOString())}-${String(huella).slice(0, 6).toUpperCase()}`;
}

// La huella de cada parte: no entra al sello (que es la de todo junto), solo sirve para decirle a
// la persona QUÉ cambió después de sellar.
async function huellasDeLasPartes(contenido, sutil) {
  const partes = {};
  for (const parte of PARTES) partes[parte] = await sha256Hex(textoCanonico(contenido[parte]), sutil);
  return partes;
}

// Sella el reporte: { sello, contenido, texto }. `sello` es lo que se guarda en el reporte
// (guardarDatos); `texto`, el adjunto del PDF, cuyo SHA-256 es `sello.huella`.
export async function sellarReporte({ reporte, registros = [], hora = new Date() }, sutil) {
  const contenido = contenidoDelSello({ reporte, registros, hora });
  const texto = textoCanonico(contenido);
  const huella = await sha256Hex(texto, sutil);
  return {
    sello: { version: VERSION_DEL_SELLO, hora: contenido.sellado, huella, numero: numeroDelReporte(huella, contenido.sellado), partes: await huellasDeLasPartes(contenido, sutil) },
    contenido,
    texto,
  };
}

// Si el sello guardado sigue siendo el de lo que hay: { estado, cambios, contenido, texto }, con
// estado 'sin-sellar', 'vigente' o 'cambio' (y en `cambios`, las partes que cambiaron).
export async function estadoDelSello({ reporte, registros = [] }, sutil) {
  const sello = reporte?.sello;
  if (!sello || sello.version !== VERSION_DEL_SELLO || !sello.huella || !sello.hora) return { estado: 'sin-sellar', cambios: [] };
  const contenido = contenidoDelSello({ reporte, registros, hora: sello.hora });
  const texto = textoCanonico(contenido);
  if ((await sha256Hex(texto, sutil)) === sello.huella) return { estado: 'vigente', cambios: [], contenido, texto };
  const partes = await huellasDeLasPartes(contenido, sutil);
  return { estado: 'cambio', cambios: PARTES.filter((p) => !sello.partes || partes[p] !== sello.partes[p]) };
}

const enLista = (cosas) => (cosas.length <= 1 ? cosas.join('') : cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1]);

export function textoDelCambio(cambios) {
  const partes = cambios.filter((c) => NOMBRES_DE_LAS_PARTES[c]);
  // «cambió el croquis», pero «cambiaron los carros» y «cambiaron el croquis y los daños».
  const verbo = partes.length === 1 && partes[0] === 'croquis' ? 'cambió' : 'cambiaron';
  const que = partes.length ? `${verbo} ${enLista(partes.map((c) => NOMBRES_DE_LAS_PARTES[c]))}` : 'cambió el reporte';
  return `Después de sellar ${que}. Séllalo otra vez antes de enviarlo: el número va a cambiar.`;
}
