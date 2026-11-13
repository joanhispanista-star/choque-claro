// Lo que guarda cada foto como prueba, y la cadena de huellas que la amarra a
// las demás. Sirve a la escena y servirá igual a los carros y a los daños: un
// solo reporte, una sola cadena.
//
// Cada foto lleva la hora, el GPS con su precisión, el rumbo y la inclinación
// del celular, lo que dio la revisión de calidad y la huella SHA-256 de sus
// bytes. El registro entero se sella con otra huella que incluye la del
// registro anterior: si alguien cambia una foto o un dato, la cambia de orden o
// quita una del medio, las huellas dejan de cuadrar desde ahí y la revisión
// dice en cuál.
//
// Lo que esto NO prueba, dicho de frente: mientras la cadena viva solo en el
// teléfono, alguien con el teléfono y conocimientos podría rehacerla entera
// con fotos cambiadas. Para que valga también contra eso, la última huella
// tiene que salir del teléfono en el momento (fase 2: un servidor; o el paso 8,
// al enviar). Y la hora es la del reloj del celular.
//
// El texto que se sella es JSON con las claves en orden alfabético y sin
// espacios: cualquiera puede rehacer la huella con otra herramienta.
export const INICIO_DE_LA_CADENA = '0'.repeat(64);
export const VERSION_DEL_REGISTRO = 1;
export const SIN_CRIPTO = 'Este navegador no puede calcular la huella de las fotos: la app tiene que abrirse con https.';

function redondear(valor, decimales) {
  if (!Number.isFinite(valor)) return null;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

// 359,96° redondeado a un decimal es 360,0: se escribe 0.
function rumboRedondeado(rumbo) {
  const r = redondear(rumbo, 1);
  return r !== null && r >= 360 ? r - 360 : r;
}

export function textoCanonico(valor) {
  if (valor === null || typeof valor !== 'object') {
    // JSON convierte NaN e Infinity en null sin avisar: aquí se avisa, porque
    // un dato que cambia al sellarse es una huella que no se puede repetir.
    if (typeof valor === 'number' && !Number.isFinite(valor)) throw new Error('Un número no válido no se puede sellar');
    if (valor === undefined || typeof valor === 'function') throw new Error('Un valor indefinido no se puede sellar');
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) return '[' + valor.map(textoCanonico).join(',') + ']';
  const claves = Object.keys(valor)
    .filter((clave) => valor[clave] !== undefined)
    .sort();
  return '{' + claves.map((clave) => JSON.stringify(clave) + ':' + textoCanonico(valor[clave])).join(',') + '}';
}

export async function sha256Hex(datos, sutil = globalThis.crypto?.subtle) {
  // crypto.subtle solo existe en https (o en 127.0.0.1): por la IP del Wi-Fi no.
  if (!sutil) throw new Error(SIN_CRIPTO);
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : datos;
  const resumen = await sutil.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('');
}

// El registro de una foto, con los números ya redondeados: lo que se guarda es
// exactamente lo que se sella, sin decimales sueltos que cambien al leerlos.
export function registroDeFoto({ reporte, paso, indice, sector = null, hora, gps = null, orientacion = null, calidad, foto, reemplaza = null }) {
  const conRumbo = orientacion && Number.isFinite(orientacion.rumbo);
  const conInclinacion = orientacion && Number.isFinite(orientacion.elevacion) && Number.isFinite(orientacion.giro);
  return {
    version: VERSION_DEL_REGISTRO,
    reporte,
    paso,
    indice,
    sector,
    hora: new Date(hora).toISOString(),
    gps:
      gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon)
        ? { lat: redondear(gps.lat, 7), lon: redondear(gps.lon, 7), precision: redondear(gps.precision, 1), edadS: redondear(gps.edadS ?? 0, 1) }
        : null,
    // Magnético (ver orientacion.js). `rumboFuente`: 'iphone' o 'android'.
    rumbo: conRumbo ? rumboRedondeado(orientacion.rumbo) : null,
    rumboFuente: conRumbo ? orientacion.fuente ?? null : null,
    rumboPrecision: conRumbo && Number.isFinite(orientacion.precisionRumbo) ? redondear(orientacion.precisionRumbo, 1) : null,
    inclinacion: conInclinacion ? { elevacion: redondear(orientacion.elevacion, 1), giro: redondear(orientacion.giro, 1) } : null,
    // Los números de la revisión (calidad.js), para calibrar los umbrales.
    calidad: {
      nitidez: redondear(calidad.nitidez, 1),
      laplaciano: redondear(calidad.laplaciano, 1),
      brillo: redondear(calidad.brillo, 1),
      problemas: [...calidad.problemas],
      // La persona la aceptó aunque no pasó la revisión (de noche, por ejemplo).
      aceptadaConProblemas: calidad.problemas.length > 0,
    },
    foto: { tipo: foto.tipo, ancho: foto.ancho, alto: foto.alto, bytes: foto.bytes, sha256: foto.sha256 },
    reemplaza,
  };
}

// La huella de un registro: todo menos la huella misma.
export async function huellaDelRegistro(registro, sutil) {
  const { huella, ...resto } = registro;
  return sha256Hex(textoCanonico(resto), sutil);
}

export async function sellarRegistro(registro, anterior = INICIO_DE_LA_CADENA, sutil) {
  const conAnterior = { ...registro, anterior };
  return { ...conAnterior, huella: await huellaDelRegistro(conAnterior, sutil) };
}

// Revisa la cadena de punta a punta. `huellaDeLaFoto(registro)` devuelve la
// huella de los bytes guardados; sin ella, solo se revisan los datos.
// { integra, total, rota: null | { indice, motivo } }, con motivo 'orden'
// (falta un registro, sobra o se cambió de lugar), 'datos' o 'foto'.
export async function verificarCadena(registros, { huellaDeLaFoto = null } = {}, sutil) {
  let anterior = INICIO_DE_LA_CADENA;
  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    const rota = (motivo) => ({ integra: false, total: registros.length, rota: { indice: i, motivo } });
    if (r.indice !== i || r.anterior !== anterior) return rota('orden');
    if ((await huellaDelRegistro(r, sutil)) !== r.huella) return rota('datos');
    if (huellaDeLaFoto && (await huellaDeLaFoto(r)) !== r.foto.sha256) return rota('foto');
    anterior = r.huella;
  }
  return { integra: true, total: registros.length, rota: null };
}

const MOTIVOS = {
  orden: 'falta una foto, sobra una o cambiaron de orden',
  datos: 'cambiaron los datos de la foto (hora, GPS, rumbo…)',
  foto: 'la imagen ya no es la que se tomó',
};

export function textoDeLaCadena(resultado) {
  if (resultado.integra) {
    const n = resultado.total;
    return `Revisada en este teléfono la cadena de ${n} ${n === 1 ? 'huella' : 'huellas'}: ninguna foto ni dato ha cambiado desde que se tomó.`;
  }
  return `La cadena se rompe en el registro ${resultado.rota.indice + 1}: ${MOTIVOS[resultado.rota.motivo]}.`;
}
