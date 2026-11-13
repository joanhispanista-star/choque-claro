// La pantalla "¿Dónde fue el choque?": el punto (GPS, un toque en el mapa o
// el ejemplo), la hora, y el análisis de la vía, la luz y el clima ahí.
//
// Cada consulta lleva un TURNO (lección del taller, 22-oct-2026): si mientras
// tanto se movió el pin o cambió la hora, la respuesta vieja no pinta nada.
// Sin eso, el análisis de un punto podía quedar pintado encima de otro.
//
// Lo que viene del mapa (nombres de calles) se pinta con textContent, nunca
// con innerHTML: cualquiera puede escribir un nombre en OpenStreetMap.
import { analizarVia, consultaDeLaVia, filasDeLaVia, resumenDeLaVia } from './via.js';
import { filasDelSol, posicionDelSol } from './sol.js';
import { climaALaHora, filasDelClima, urlDelClima } from './clima.js';
import { consultarJson, consultarOverpass } from './servicios.js';
import { buscarUbicacion } from './ubicacion.js';
import { crearMapa } from './mapa.js';
import { enlacesDeGoogle, fechaCorta } from './enlaces-google.js';

// El ejemplo: una curva REAL (la más cerrada de la medición del 12-nov-2026)
// con un choque inventado ayer a las 5:15 p. m. La pantalla lo dice.
export const EJEMPLO = { lat: 4.6484, lon: -74.0105 };

// Arriba y no junto a fijarPunto: una constante declarada después de la
// función que la usa dejó una pantalla muda en el taller (15-oct-2026).
const TEXTOS_DEL_ORIGEN = {
  mapa: 'Punto marcado en el mapa. Si no es exacto, arrastra el pin.',
  'gps-ajustado': 'Punto corregido a mano. El círculo muestra dónde lo puso el GPS.',
  ejemplo: 'Ejemplo: una curva real de la vía Los Verjones–Patios, con un choque inventado ayer a las 5:15 p. m.',
};

const dos =(n) => String(n).padStart(2, '0');

// Para <input type="datetime-local">: la hora del celular, sin zona.
export function valorDeFecha(fecha) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function fechaDeValor(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function iniciarPantallaDonde(raiz) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = { punto: null, origen: null, via: null, clima: null, climaCargando: false, buscandoGps: false };
  const cacheVia = new Map();
  const cacheClima = new Map();
  // Puntos cuya respuesta del mapa viene de un archivo guardado, con su fecha.
  const fechasGuardadas = new Map();
  const claveDe = (p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  let turnoVia = 0;
  let turnoClima = 0;

  const ahora = new Date();
  $('#hora-choque').value = valorDeFecha(ahora);
  $('#hora-choque').max = valorDeFecha(ahora);

  let mapa;
  try {
    mapa = crearMapa($('#mapa'), {
      alTocar: (p) => fijarPunto(p, { origen: 'mapa', acercar: false }),
      alSoltarPin: (p) => fijarPunto(p, { origen: estado.origen === 'gps' || estado.origen === 'gps-ajustado' ? 'gps-ajustado' : estado.origen === 'ejemplo' ? 'ejemplo' : 'mapa', moverPin: false }),
    });
  } catch (error) {
    mapa = { ponerPin() {}, dibujarVia() {}, ajustar() {} };
    avisarUbicacion(error.message, true);
  }

  function avisarUbicacion(texto, esError = false) {
    const p = $('#estado-ubicacion');
    p.textContent = texto;
    p.classList.toggle('error', esError);
  }

  function avisarAnalisis(texto, { reintentar = false } = {}) {
    $('#analisis-estado').textContent = texto;
    $('#reintentar').hidden = !reintentar;
  }

  function pintarFilas(selector, filas) {
    $(selector).replaceChildren(
      ...filas.map((f) => {
        const fila = document.createElement('div');
        fila.className = 'fila' + (f.aviso ? ' ' + f.aviso : '');
        const dt = document.createElement('dt');
        dt.textContent = f.etiqueta;
        const dd = document.createElement('dd');
        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = f.valor;
        dd.append(valor);
        if (f.nota) {
          const nota = document.createElement('span');
          nota.className = 'nota';
          nota.textContent = f.nota;
          dd.append(nota);
        }
        fila.append(dt, dd);
        return fila;
      }),
    );
  }

  const fechaDelChoque = () => fechaDeValor($('#hora-choque').value) ?? new Date();

  function pintarLuz() {
    if (!estado.punto) return;
    const sol = posicionDelSol(fechaDelChoque(), estado.punto.lat, estado.punto.lon);
    const rumboVia = estado.via?.estado === 'ok' ? estado.via.rumbo : undefined;
    const clima = estado.climaCargando ? [{ clave: 'clima', etiqueta: 'Clima', valor: 'Consultando…', nota: '', aviso: 'sin-dato' }] : filasDelClima(estado.clima);
    pintarFilas('#filas-luz', [...filasDelSol(sol, rumboVia, { nubes: estado.clima?.nubes ?? null }), ...clima]);
  }

  async function analizar() {
    const mio = ++turnoVia;
    const p = estado.punto;
    const clave = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    avisarAnalisis('Analizando la vía en el mapa… puede tardar unos segundos.');
    pintarFilas('#filas-via', []);
    mapa.dibujarVia(null);
    let resultado;
    try {
      let respuesta = cacheVia.get(clave);
      if (!respuesta) {
        respuesta = await consultarOverpass(consultaDeLaVia(p));
        cacheVia.set(clave, respuesta);
      }
      resultado = analizarVia(respuesta, p);
    } catch (error) {
      resultado = { estado: 'error', error: error.message, detalle: error.detalle };
    }
    if (mio !== turnoVia) return;
    estado.via = resultado;
    mapa.dibujarVia(resultado);
    if (resultado.estado === 'error') avisarAnalisis(resultado.error, { reintentar: true });
    else avisarAnalisis(resumenDeLaVia(resultado) + (fechasGuardadas.has(clave) ? ` Datos del mapa guardados el ${fechasGuardadas.get(clave)}.` : ''));
    pintarFilas('#filas-via', filasDeLaVia(resultado));
    pintarLuz(); // el sol de frente depende del rumbo de la vía
    actualizarEnlaces(); // Street View mirando a lo largo de la vía
  }

  function actualizarEnlaces() {
    if (!estado.punto) return;
    const rumbo = estado.via?.estado === 'ok' ? estado.via.rumbo : null;
    const { mapa: aMapa, calle } = enlacesDeGoogle(estado.punto, { rumbo });
    $('#ver-google-maps').href = aMapa;
    $('#ver-street-view').href = calle;
    $('#enlaces-google').hidden = false;
    $('#nota-google').hidden = false;
  }

  // El ejemplo no depende de los servidores públicos del mapa, que se llenan y
  // se caen (el 12-nov-2026 overpass-api.de dio 502 y 504, y dos más no
  // respondieron): usa la respuesta REAL guardada ese día, y la pantalla dice
  // de qué fecha es. Delante de un cliente, el ejemplo no puede fallar.
  async function precargarEjemplo() {
    const clave = claveDe(EJEMPLO);
    if (cacheVia.has(clave)) return;
    try {
      const guardado = await consultarJson('datos/ejemplo-verjones-patios.json', { limiteMs: 8000 });
      cacheVia.set(clave, guardado.respuesta);
      fechasGuardadas.set(clave, fechaCorta(guardado.fecha));
    } catch {
      // Si el archivo no carga, el ejemplo se consulta en vivo como cualquier punto.
    }
  }

  async function actualizarClima() {
    const mio = ++turnoClima;
    const p = estado.punto;
    const fecha = fechaDelChoque();
    const url = urlDelClima(p, fecha);
    if (!url) {
      estado.climaCargando = false;
      estado.clima = { error: 'El clima de hace más de tres meses no se puede consultar aquí.' };
      pintarLuz();
      return;
    }
    estado.climaCargando = true;
    pintarLuz();
    let clima;
    try {
      let respuesta = cacheClima.get(url);
      if (!respuesta) {
        respuesta = await consultarJson(url);
        cacheClima.set(url, respuesta);
      }
      clima = climaALaHora(respuesta, fecha) ?? { error: 'Esa hora no vino en la respuesta del servicio del clima.' };
    } catch (error) {
      clima = { error: error.message };
    }
    if (mio !== turnoClima) return;
    estado.climaCargando = false;
    estado.clima = clima;
    pintarLuz();
  }

  function fijarPunto(punto, { origen, precision = null, acercar = true, moverPin = true }) {
    estado.punto = punto;
    estado.origen = origen;
    if (moverPin) mapa.ponerPin(punto, { precision, acercar });
    avisarUbicacion(origen === 'gps' ? `Tu ubicación por GPS (±${Math.round(precision)} m). Si no es el punto exacto, arrastra el pin.` : TEXTOS_DEL_ORIGEN[origen]);
    estado.via = null;
    actualizarEnlaces();
    $('#analisis').hidden = false;
    analizar();
    actualizarClima();
  }

  $('#usar-ubicacion').addEventListener('click', async () => {
    if (estado.buscandoGps) return;
    estado.buscandoGps = true;
    const boton = $('#usar-ubicacion');
    boton.textContent = 'Buscando…';
    avisarUbicacion('Buscando tu ubicación…');
    try {
      const lectura = await buscarUbicacion({
        alMejorar: (l) => {
          mapa.ponerPin(l, { precision: l.precision });
          avisarUbicacion(`Buscando tu ubicación… ±${Math.round(l.precision)} m`);
        },
      });
      fijarPunto(lectura, { origen: 'gps', precision: lectura.precision });
    } catch (error) {
      avisarUbicacion(error.message, true);
    } finally {
      estado.buscandoGps = false;
      boton.textContent = 'Usar mi ubicación';
    }
  });

  $('#ver-ejemplo').addEventListener('click', async () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(17, 15, 0, 0);
    $('#hora-choque').value = valorDeFecha(ayer);
    await precargarEjemplo();
    fijarPunto(EJEMPLO, { origen: 'ejemplo' });
  });

  $('#reintentar').addEventListener('click', () => {
    if (!estado.punto) return;
    cacheVia.delete(claveDe(estado.punto));
    fechasGuardadas.delete(claveDe(estado.punto));
    analizar();
    // Si se cayó el internet, también se cayó el clima: se reintenta junto.
    if (estado.clima?.error) actualizarClima();
  });

  $('#hora-choque').addEventListener('change', () => {
    if (estado.punto) actualizarClima();
  });

  return {
    ajustar: () => mapa.ajustar(),
    estado: () => estado,
  };
}
