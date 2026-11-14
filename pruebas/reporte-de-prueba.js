// Un reporte completo para las pruebas del paso 8 (sello, expediente y envío), armado con las
// mismas funciones de la app: la curva real del ejemplo, A Picanto y B Captiva de frente, la
// escena con la foto 4 repetida, B sin las tomas 6 y 7 y con la placa sin revisar, y daños con y
// sin foto de cerca. Las fotos son JPEG mínimos (jpeg-de-prueba.js), cada uno con su huella.
import fs from 'node:fs';
import { INICIO_DE_LA_CADENA, registroDeFoto, sellarRegistro, sha256Hex } from '../js/evidencia.js';
import { analizarVia } from '../js/via.js';
import { armarCaso, croquisParaGuardar, viaDesdeElAnalisis } from '../js/croquis.js';
import { lugarParaElReporte } from '../js/sello.js';
import { jpegDePrueba } from './jpeg-de-prueba.js';

export const HORA_DEL_CHOQUE = '2026-11-13T22:15:00Z';
export const CLIMA = { desde: '17:00', hasta: '18:00', lluvia: 0, nubes: 78, visibilidad: 24000, codigo: 3, texto: 'Nublado' };

export function analisisDelEjemplo() {
  const { punto, respuesta } = JSON.parse(fs.readFileSync(new URL('./datos/curva-verjones-patios.json', import.meta.url), 'utf8'));
  return { punto, analisis: analizarVia(respuesta, punto) };
}

export const CARROS = [
  { letra: 'A', quien: 'tuyo', placa: { texto: 'JRK245', fuente: 'leida', lectura: { texto: 'JRK245', sector: 0, foto: 'x', confianza: 0.93 }, intentos: [] }, linea: { marca: 'Kia', linea: 'Picanto', carroceria: 'hatchback', medidas: { largo: 3595, ancho: 1595, alto: 1485, entreEjes: 2400 } } },
  { letra: 'B', quien: 'otro', placa: { texto: '', fuente: null, lectura: { texto: 'HTX918', sector: 4, foto: 'y', confianza: 0.81 }, intentos: [] }, linea: { marca: 'Chevrolet', linea: 'Captiva', carroceria: 'suv', medidas: { largo: 4673, ancho: 1849, alto: 1756, entreEjes: 2707 } } },
];

export const DANOS = [
  { carro: 'A', pieza: 'bomper-del', tipo: 'abolladura', cuando: '2026-11-13T22:35:00Z' },
  { carro: 'A', pieza: 'capo', tipo: 'abolladura', cuando: '2026-11-13T22:36:00Z' },
  { carro: 'A', pieza: 'guardafango-del-der', tipo: 'rayon', cuando: '2026-11-13T22:36:30Z' },
  { carro: 'B', pieza: 'guardafango-del-izq', tipo: 'roto', cuando: '2026-11-13T22:38:00Z' },
];

export async function reporteDePrueba({ conLugar = true } = {}) {
  const { punto, analisis } = analisisDelEjemplo();
  const via = viaDesdeElAnalisis(analisis, punto);
  const croquis = { ...croquisParaGuardar(armarCaso('frente', via, CARROS), via, { punto, ejemplo: true, hora: HORA_DEL_CHOQUE }), hecho: '2026-11-13T22:41:00Z' };
  const lugar = conLugar ? lugarParaElReporte({ punto, origen: 'ejemplo', fecha: HORA_DEL_CHOQUE, via: analisis, clima: CLIMA }) : null;

  const registros = [];
  const fotos = new Map();
  let t = Date.parse('2026-11-13T22:24:10Z');
  async function tomar(datos, problemas = []) {
    const n = registros.length;
    const vertical = datos.paso !== 'danos';
    const bytes = jpegDePrueba(vertical ? 960 : 1280, vertical ? 1280 : 960, { relleno: 9, semilla: 11 + n });
    t += 12000;
    const registro = registroDeFoto({
      reporte: 'r-prueba',
      indice: n,
      hora: new Date(t),
      gps: { lat: 4.64838 + n * 0.000001, lon: -74.01052, precision: 8, edadS: 1 },
      orientacion: { rumbo: ((datos.sector ?? 0) * 45 + 20) % 360, fuente: 'iphone', precisionRumbo: 12, elevacion: 2, giro: 1 },
      calidad: { nitidez: 30, laplaciano: 210, brillo: 120, problemas },
      foto: { tipo: 'image/jpeg', ancho: vertical ? 960 : 1280, alto: vertical ? 1280 : 960, bytes: bytes.length, sha256: await sha256Hex(bytes) },
      ...datos,
    });
    const sellado = await sellarRegistro(registro, n ? registros[n - 1].huella : INICIO_DE_LA_CADENA);
    registros.push(sellado);
    fotos.set(sellado.huella, bytes);
    return sellado;
  }
  for (let s = 0; s < 8; s++) {
    if (s === 3) {
      const mala = await tomar({ paso: 'escena', sector: 3 }, ['borrosa']);
      await tomar({ paso: 'escena', sector: 3, reemplaza: mala.huella });
    } else await tomar({ paso: 'escena', sector: s });
  }
  for (let s = 0; s < 8; s++) await tomar({ paso: 'carro', carro: 'A', sector: s });
  for (const s of [0, 1, 2, 3, 4, 7]) await tomar({ paso: 'carro', carro: 'B', sector: s }, s === 7 ? ['oscura'] : []);
  await tomar({ paso: 'danos', carro: 'A', pieza: 'bomper-del', dano: 'abolladura' });
  await tomar({ paso: 'danos', carro: 'A', pieza: 'capo', dano: 'rayon' });
  await tomar({ paso: 'danos', carro: 'B', pieza: 'guardafango-del-izq', dano: 'roto' });

  const reporte = { id: 'r-prueba', orden: 1, creado: '2026-11-13T22:20:00Z', actualizado: '2026-11-13T22:41:00Z', carros: CARROS, danos: DANOS, croquis, lugar };
  return { reporte, registros, fotos, punto, analisis };
}
