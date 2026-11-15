// Si llovía, había niebla o estaba nublado a la hora del choque.
//
// Fuente: Open-Meteo. Son MODELOS del clima, no una estación al lado de la
// vía, y la pantalla lo dice. Es gratis y sin clave solo para uso NO
// comercial: para venderle el producto a una aseguradora hay que pagar su
// plan comercial o cambiar de fuente (PLAN.md).
//
// Dos trampas de Open-Meteo que este módulo resuelve:
//  - La lluvia de cada hora es la suma de la hora ANTERIOR: el valor de las
//    6:00 p. m. es lo que llovió entre las 5 y las 6. Por eso la hora del
//    choque se redondea hacia arriba.
//  - Con `timezone=auto` las horas vienen en la hora del LUGAR, sin zona; se
//    cruzan con el choque usando `utc_offset_seconds`, no la zona del
//    celular (que puede estar en otra).
import { numero } from './geo.js';

const DIA = 86400000;
// Lo más atrás que llega la API de pronóstico con `past_days`.
export const DIAS_ATRAS_MAXIMO = 92;

export function urlDelClima(punto, fecha, ahora = new Date()) {
  const diasAtras = Math.ceil((ahora.getTime() - fecha.getTime()) / DIA) + 1;
  if (diasAtras > DIAS_ATRAS_MAXIMO) return null;
  const parametros = new URLSearchParams({
    latitude: punto.lat.toFixed(3),
    longitude: punto.lon.toFixed(3),
    hourly: 'precipitation,cloud_cover,visibility,weather_code',
    timezone: 'auto',
    past_days: String(Math.max(1, diasAtras)),
    forecast_days: '1',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + parametros.toString();
}

const CODIGOS = [
  [[0], 'Despejado'],
  [[1], 'Casi despejado'],
  [[2], 'Parcialmente nublado'],
  [[3], 'Nublado'],
  [[45, 48], 'Niebla'],
  [[51, 53, 55], 'Llovizna'],
  [[56, 57], 'Llovizna helada'],
  [[61], 'Lluvia ligera'],
  [[63], 'Lluvia'],
  [[65], 'Lluvia fuerte'],
  [[66, 67], 'Lluvia helada'],
  [[71, 73, 75, 77], 'Nieve'],
  [[80], 'Chubascos ligeros'],
  [[81], 'Chubascos'],
  [[82], 'Chubascos violentos'],
  [[85, 86], 'Chubascos de nieve'],
  [[95], 'Tormenta'],
  [[96, 99], 'Tormenta con granizo'],
];

export function textoDelCodigo(codigo) {
  for (const [codigos, texto] of CODIGOS) if (codigos.includes(codigo)) return texto;
  return null;
}

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

// La hora del lugar como texto "AAAA-MM-DDTHH" para un instante.
function horaDelLugar(instante, desfaseSegundos) {
  const f = new Date(instante + desfaseSegundos * 1000);
  return `${f.getUTCFullYear()}-${dosDigitos(f.getUTCMonth() + 1)}-${dosDigitos(f.getUTCDate())}T${dosDigitos(f.getUTCHours())}`;
}

// De la respuesta de Open-Meteo, el clima en la hora del choque:
// { desde: 'HH:00', hasta: 'HH:00', lluvia (mm), nubes (%), visibilidad (m),
//   codigo, texto } o null si esa hora no viene en la respuesta.
export function climaALaHora(respuesta, fecha) {
  const horas = respuesta?.hourly?.time;
  if (!Array.isArray(horas)) return null;
  const desfase = Number(respuesta.utc_offset_seconds) || 0;
  const hora = 3600000;
  // Redondear hacia arriba: un choque a las 5:15 cae en el bloque de 5 a 6,
  // que Open-Meteo guarda en las 6:00. Un choque a las 5:00 en punto, en el
  // de 4 a 5.
  const fin = Math.ceil(fecha.getTime() / hora) * hora;
  const clave = horaDelLugar(fin, desfase) + ':00';
  const i = horas.indexOf(clave);
  if (i < 0) return null;
  const valor = (nombre) => {
    const v = respuesta.hourly[nombre]?.[i];
    return v == null ? null : Number(v);
  };
  const codigo = valor('weather_code');
  const hasta = clave.slice(11, 16);
  const desde = horaDelLugar(fin - hora, desfase).slice(11) + ':00';
  return { desde, hasta, lluvia: valor('precipitation'), nubes: valor('cloud_cover'), visibilidad: valor('visibility'), codigo, texto: codigo == null ? null : textoDelCodigo(codigo) };
}

// "17:00" → "5:00 p. m."
export function horaDeReloj(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${dosDigitos(m)} ${sufijo}`;
}

export function filasDelClima(clima) {
  if (!clima) return [];
  if (clima.error) return [{ clave: 'clima', etiqueta: 'Clima', valor: 'No se pudo consultar', nota: clima.error, aviso: 'sin-dato' }];
  const franja = `entre las ${horaDeReloj(clima.desde)} y las ${horaDeReloj(clima.hasta)}`;
  const filas = [];
  if (clima.lluvia != null) {
    filas.push(
      clima.lluvia > 0
        ? { clave: 'lluvia', etiqueta: 'Lluvia', valor: `${numero(clima.lluvia, 1)}\u00a0mm ${franja}`, nota: 'según el modelo del clima, no una estación', aviso: 'atencion' }
        : { clave: 'lluvia', etiqueta: 'Lluvia', valor: `Sin lluvia ${franja}`, nota: 'según el modelo del clima, no una estación', aviso: null },
    );
  }
  if (clima.texto || clima.nubes != null) {
    const nubes = clima.nubes != null ? `nubes: ${Math.round(clima.nubes)}\u00a0%` : '';
    filas.push({ clave: 'cielo', etiqueta: 'Cielo', valor: clima.texto || 'Sin dato', nota: nubes, aviso: /Niebla|Lluvia|Llovizna|Chubasco|Tormenta/.test(clima.texto || '') ? 'atencion' : null });
  }
  if (clima.visibilidad != null) {
    const v = clima.visibilidad;
    const valor = v >= 1000 ? `${numero(v / 1000, v >= 10000 ? 0 : 1)}\u00a0km` : `${Math.round(v)}\u00a0m`;
    filas.push({ clave: 'visibilidad', etiqueta: 'Visibilidad', valor, nota: v < 1000 ? 'muy poca: niebla o lluvia densa' : 'según el modelo del clima', aviso: v < 1000 ? 'atencion' : null });
  }
  return filas;
}
