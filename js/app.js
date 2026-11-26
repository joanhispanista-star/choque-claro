// El recorrido del reporte: una pantalla por paso, con el paso en el #hash
// de la dirección para que el botón "atrás" del celular funcione.
//
// Las pantallas que toman fotos (escena, carros y daños), el croquis y el envío
// comparten UN reporte en curso (reporte-en-curso.js): una sola cadena de
// huellas, una sola copia. «Tus reportes» (desde el 17-nov-2026) deja volver a
// uno guardado; cambiar de reporte pasa siempre por aquí (cambiarDeReporte).
import { iniciarPantallaInicio } from './pantalla-inicio.js';
import { iniciarPantallaAgregar, escucharInstalacion } from './pantalla-agregar.js';
import { iniciarPantallaAntes } from './pantalla-antes.js';
import { iniciarPantallaDonde } from './pantalla-donde.js';
import { iniciarPantallaPruebas } from './pantalla-pruebas.js';
import { iniciarPantallaEscena } from './pantalla-escena.js';
import { iniciarPantallaCarros } from './pantalla-carros.js';
import { iniciarPantallaDanos } from './pantalla-danos.js';
import { iniciarPantallaCroquis } from './pantalla-croquis.js';
import { iniciarPantallaEnviar } from './pantalla-enviar.js';
import { iniciarPantallaReportes } from './pantalla-reportes.js';
import { crearReporteEnCurso } from './reporte-en-curso.js';
import { sirveParaUnChoqueNuevo } from './reporte-bd.js';
import { completaElLugar, leFaltaAlgo, lugarParaElReporte } from './sello.js';
import { textoCanonico } from './evidencia.js';
import { crearSinSenal } from './sin-senal.js';

// Lo que no es un paso lleva null: la barra dice el nombre de la pantalla (la portada, nada).
// «Antes de mover» (E1) es el paso 4, y la vuelta de la escena es uno de sus renglones: también 4.
const PASOS = { inicio: null, choque: 1, heridos: 1, 'a-salvo': 2, antes: 2, donde: 3, pruebas: 4, escena: 4, carros: 5, danos: 6, croquis: 7, enviar: 8, reportes: null, agregar: null };
const TITULOS = { inicio: '', reportes: 'Tus reportes', agregar: 'En tu teléfono' };
const TOTAL_PASOS = 8;
const sinSenal = crearSinSenal();
const instalacion = escucharInstalacion();
const reporte = crearReporteEnCurso();
let donde = null;
let actual = null;
// Todas menos el paso 3 y las que son solo texto: se crean la primera vez que
// se entra y se apagan al salir.
const perezosas = {};
const INICIAR = {
  inicio: () => iniciarPantallaInicio(document.querySelector('#p-inicio'), { reporte, abrir: abrirReporte, sinSenal }),
  agregar: () => iniciarPantallaAgregar(document.querySelector('#p-agregar'), { sinSenal, instalacion }),
  reportes: () => iniciarPantallaReportes(document.querySelector('#p-reportes'), { reporte, abrir: abrirReporte }),
  antes: () => iniciarPantallaAntes(document.querySelector('#p-antes'), { reporte, preparar: prepararElChoque }),
  pruebas: () => iniciarPantallaPruebas(document.querySelector('#p-pruebas'), { reporte, lugar: lugarGuardable }),
  escena: () => iniciarPantallaEscena(document.querySelector('#p-escena'), { reporte, puntoDelChoque, empezarOtro }),
  carros: () => iniciarPantallaCarros(document.querySelector('#p-carros'), { reporte }),
  danos: () => iniciarPantallaDanos(document.querySelector('#p-danos'), { reporte }),
  croquis: () => iniciarPantallaCroquis(document.querySelector('#p-croquis'), { reporte, lugar: lugarDelChoque }),
  enviar: () => iniciarPantallaEnviar(document.querySelector('#p-enviar'), { reporte, guardarLugar: guardarYCompletarElLugar, antesDeSellar: () => lugar.guardando, empezarOtro }),
};

// --- El lugar del paso 3 -----------------------------------------------------------------------
//
// El paso 3 vive en la memoria de la página (pantalla-donde.js) y se guarda en el reporte al salir
// de él, al llegar al paso 8 y cuando llegan la vía o el clima. Con varios reportes, esa memoria es
// de UNO: `de` dice de cuál. Antes del 17-nov, «Empezar un reporte nuevo» dejaba el lugar del
// anterior en la memoria y el paso 8 se lo guardaba al nuevo.
//
// `guardada`: la versión del paso 3 (pantalla-donde.js, version) que el reporte ya tiene, porque se
// guardó o porque al paso 3 se le puso lo que el reporte tenía. Mientras siga igual, la persona no
// cambió nada: lo que llega solo (la vía, el clima) completa lo que le falte al reporte, pero no
// reemplaza lo guardado (el mapa y el clima de hoy pueden decir otra cosa que los de ese día) ni
// toca un reporte sellado (le cambiaría el número sin que nadie hiciera nada).
//
// `guardando`: los guardados van en fila, y el paso 8 espera el que va en camino antes de sellar.
const lugar = { de: null, guardada: null, guardando: Promise.resolve() };

function lugarEnMemoria() {
  const e = donde ? donde.estado() : null;
  const rep = reporte.reporte();
  if (!e || !e.punto || !rep || rep.id !== lugar.de) return null;
  return { punto: e.punto, origen: e.origen, via: e.via, precision: e.precision ?? null, fecha: donde.fecha(), clima: e.clima ?? null, climaCargando: !!e.climaCargando };
}

// El lugar del choque para el croquis y la vuelta de la escena: el del paso 3 si es de este
// reporte; si no (se siguió el reporte desde «Tus reportes», o iOS recargó la página), el que el
// reporte guardó, que no trae la forma de la vía: solo su nombre y su rumbo (`viaGuardada`).
// Sin esto, el croquis le decía «márcalo primero en el mapa» a un reporte que ya tenía el lugar.
function lugarDelChoque() {
  const enMemoria = lugarEnMemoria();
  if (enMemoria) return enMemoria;
  const g = reporte.reporte()?.lugar;
  if (!g?.punto) return null;
  const fecha = new Date(g.hora);
  return { punto: g.punto, origen: g.origen, via: null, viaGuardada: g.via ?? null, precision: g.precision ?? null, fecha: Number.isNaN(fecha.getTime()) ? null : fecha, clima: null, climaCargando: false };
}

// El lugar en la forma en que se guarda en el reporte (sello.js), para «Antes de mover»: de él salen
// la luz, la lluvia y la velocidad de la vía con que se arma la lista. Lo del paso 3 si es de este
// reporte (con la vía y el clima que ya llegaron); si no, lo que el reporte guardó.
function lugarGuardable() {
  const l = lugarEnMemoria();
  return (l && lugarParaElReporte(l)) || reporte.reporte()?.lugar || null;
}

// El punto que se marcó en el mapa, para decirle a la persona si está lejos de
// él al hacer la vuelta. El ejemplo no cuenta: es un lugar de otra parte (js/ejemplo.js).
function puntoDelChoque() {
  const l = lugarDelChoque();
  return l && l.origen !== 'ejemplo' ? l.punto : null;
}

// Guarda en el reporte lo del paso 3, si hay algo que guardar. Devuelve si escribió.
function guardarElLugar() {
  const hecho = lugar.guardando.then(guardarElLugarYa);
  lugar.guardando = hecho.catch(() => false);
  return hecho;
}

async function guardarElLugarYa() {
  const l = lugarEnMemoria();
  const rep = reporte.reporte();
  if (!l || !rep) return false;
  const version = donde.version();
  const sinCambios = version === lugar.guardada;
  // Mientras se sella, tampoco: el sello se calcula con lo que había al empezar.
  if (sinCambios && (rep.sello || perezosas.enviar?.estado().sellando)) return false;
  const nuevo = lugarParaElReporte(l);
  if (!nuevo || (sinCambios && !completaElLugar(nuevo, rep.lugar))) return false;
  let escribio = false;
  if (textoCanonico(nuevo) !== textoCanonico(rep.lugar ?? null)) {
    await reporte.guardarDatos({ lugar: nuevo });
    escribio = true;
  }
  // Si mientras tanto se cambió de reporte, la memoria ya no es de este (cambiarDeReporte la limpió).
  if (lugar.de === rep.id) lugar.guardada = version;
  return escribio;
}

// Llegaron la vía o el clima del paso 3. Si la persona ya salió de él, van al reporte de una vez (sin
// eso, quien sigue antes del análisis dejaría el reporte sin el nombre de la calle), y la pantalla en
// la que está se entera. En el paso 3 no: se guarda al salir.
function alActualizar() {
  if (actual === 'donde') return;
  guardarElLugar()
    .then((escribio) => {
      if (escribio && actual === 'enviar') perezosas.enviar?.refrescar();
    })
    .catch(() => {});
  if (actual === 'croquis') perezosas.croquis?.alLlegarElLugar();
}

function crearDonde() {
  if (!donde) donde = iniciarPantallaDonde(document.querySelector('#p-donde'), { alActualizar });
  return donde;
}

// Lo que se marcó sin señal quedó sin la vía o sin el clima, y la app promete completarlo solo: se
// pide otra vez al llegar al paso 8 y cuando vuelve la señal. Lo que llegue se guarda por
// alActualizar, y en un reporte sellado, nunca (guardarElLugarYa). Sin esperar: son consultas de
// varios segundos.
function completarElLugar() {
  if (globalThis.navigator?.onLine === false) return;
  const rep = reporte.reporte();
  // El paso 3 ya tiene el lugar de este reporte (o la base falló y el paso 3 va por su cuenta).
  if (donde && (!rep || lugar.de === rep.id)) {
    donde.completar();
    return;
  }
  if (!rep || rep.sello || !leFaltaAlgo(rep.lugar)) return;
  crearDonde();
  alinearElLugar();
}

async function guardarYCompletarElLugar() {
  const escribio = await guardarElLugar();
  completarElLugar();
  return escribio;
}

// Que el paso 3 tenga el lugar del reporte en curso. Si la memoria no es de nadie (la página recién
// abierta, o se acaba de cambiar de reporte), toma el lugar que el reporte ya tiene; si es de otro
// (pasaron las seis horas y la base empezó uno nuevo), se limpia primero.
//
// `choqueNuevo`: se llega al paso 3 por el camino del inicio (los heridos, «Ya estoy a salvo»). Si
// el reporte en curso no es para un choque de ahora (sellado, de otro día, el ejemplo), se empieza
// otro: el choque nuevo no puede caer en él (reporte-bd.js, sirveParaUnChoqueNuevo).
async function alinearElLugar({ choqueNuevo = false } = {}) {
  let rep;
  try {
    // «Antes de mover» pudo quedar preparando el reporte de este choque: primero eso.
    await preparando;
    rep = await reporte.cargar();
    if (choqueNuevo && !sirveParaUnChoqueNuevo(rep)) rep = await empezarOtro();
  } catch {
    return; // Sin la base, el paso 3 funciona igual; los pasos siguientes dicen qué pasa.
  }
  if (!donde || rep.id === lugar.de) return;
  if (lugar.de !== null) {
    donde.reiniciar();
    lugar.de = null;
  }
  lugar.guardada = null;
  // La persona alcanzó a tocar el mapa mientras se abría la base: ese punto es de este reporte.
  if (donde.estado().punto || !rep.lugar?.punto) {
    lugar.de = rep.id;
    return;
  }
  lugar.de = rep.id;
  lugar.guardada = donde.version();
  await donde.restaurar(rep.lugar);
}

// «Antes de mover» (pantalla-antes.js): deja en curso el reporte de este choque y lo devuelve.
// `choqueNuevo`, como en alinearElLugar: se viene de «Ya estoy a salvo». La promesa queda a mano
// para que el paso 3, si la persona sigue antes de que termine, la espere: si no, las dos podrían
// empezar un reporte cada una.
let preparando = Promise.resolve();
function prepararElChoque({ choqueNuevo = false } = {}) {
  const hecho = preparando.then(async () => {
    let rep = await reporte.cargar();
    if (choqueNuevo && !sirveParaUnChoqueNuevo(rep)) rep = await empezarOtro();
    return rep;
  });
  preparando = hecho.catch(() => {});
  return hecho;
}

// --- Cambiar de reporte --------------------------------------------------------------------------

// «Tus reportes», «Empezar un reporte nuevo» (pasos 4 y 8) y el choque nuevo que no cabe en el
// reporte en curso. Primero se termina de guardar, en el reporte de ahora, lo que está en fila (el
// croquis, los carros, los daños, el sello) y el lugar del paso 3; después se cambia, y cada paso
// olvida lo que tenía del anterior. Si guardar el lugar falla, no se cambia: se perdería sin aviso.
async function cambiarDeReporte(cambio) {
  await Promise.allSettled(Object.values(perezosas).map((p) => p.pendiente?.()));
  await guardarElLugar();
  const rep = await cambio();
  for (const p of Object.values(perezosas)) p.olvidar?.();
  lugar.de = null;
  lugar.guardada = null;
  if (donde) donde.reiniciar();
  return rep;
}

function empezarOtro() {
  return cambiarDeReporte(() => reporte.nuevoReporte());
}

// Seguir o abrir uno de «Tus reportes»: queda en curso y se va al paso que dice la fila. Si
// mientras se abría la persona se fue a otra pantalla (tocó «Sí, hay heridos», o volvió al inicio),
// se queda donde está: no se la saca de «Llama al 123».
async function abrirReporte(id, ir) {
  const desde = actual;
  await cambiarDeReporte(() => reporte.abrir(id));
  if (actual !== desde) return;
  if (location.hash.slice(1) === ir) mostrar(ir);
  else location.hash = ir;
}

// --- Las pantallas -------------------------------------------------------------------------------

function mostrar(nombre) {
  if (!(nombre in PASOS)) nombre = 'inicio';
  // Salir de una pantalla con cámara la apaga: nunca queda prendida detrás de otra.
  if (actual !== nombre && perezosas[actual]) perezosas[actual].salir();
  // Lo marcado en el paso 3 se guarda en el reporte al salir de él: si después se cambia de
  // reporte, o la página se recarga, el lugar no se pierde. Si falla, lo intenta el paso 8.
  if (actual === 'donde' && nombre !== 'donde') guardarElLugar().catch(() => {});
  for (const pantalla of document.querySelectorAll('.pantalla')) pantalla.hidden = pantalla.id !== 'p-' + nombre;
  document.querySelector('#paso').textContent = PASOS[nombre] ? `Paso ${PASOS[nombre]} de ${TOTAL_PASOS}` : TITULOS[nombre];
  if (nombre === 'donde') {
    crearDonde();
    // Leaflet mide el contenedor al crearse; si estaba oculto, mide cero.
    requestAnimationFrame(() => donde.ajustar());
    // Desde «Antes de mover» no: esa pantalla ya dejó en curso el reporte de este choque.
    if (actual !== 'donde') alinearElLugar({ choqueNuevo: actual === 'heridos' || actual === 'a-salvo' });
  }
  // El croquis arma la vía con el análisis del paso 3. Si el paso 3 no tiene el lugar de este
  // reporte (se siguió desde «Tus reportes», o la página se recargó), se le pone por detrás, sin
  // mostrarlo: el croquis arranca con el lugar guardado y toma la vía de verdad cuando llega
  // (pantalla-croquis.js, alLlegarElLugar). Al volver al paso 3, el mapa ya está listo.
  if (nombre === 'croquis') {
    crearDonde();
    alinearElLugar();
  }
  if (INICIAR[nombre]) {
    if (!perezosas[nombre]) perezosas[nombre] = INICIAR[nombre]();
    perezosas[nombre].entrar({ desde: actual });
  }
  actual = nombre;
  window.scrollTo(0, 0);
}

document.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-ir]');
  if (!boton) return;
  evento.preventDefault();
  location.hash = boton.dataset.ir;
});

window.addEventListener('hashchange', () => mostrar(location.hash.slice(1)));
window.addEventListener('online', completarElLugar);
mostrar(location.hash.slice(1));
sinSenal.arrancar();

// Para las pruebas en el navegador.
globalThis.__choqueClaro = {
  reporte,
  lugar: () => ({ de: lugar.de, guardada: lugar.guardada }),
  lugarDelChoque,
  pantallaDonde: () => donde,
  pantallaPruebas: () => perezosas.pruebas,
  pantallaEscena: () => perezosas.escena,
  pantallaCarros: () => perezosas.carros,
  pantallaDanos: () => perezosas.danos,
  pantallaCroquis: () => perezosas.croquis,
  pantallaEnviar: () => perezosas.enviar,
  pantallaReportes: () => perezosas.reportes,
  pantallaAntes: () => perezosas.antes,
  pantallaInicio: () => perezosas.inicio,
  sinSenal,
};
