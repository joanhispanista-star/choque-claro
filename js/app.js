// El recorrido del reporte: una pantalla por paso, con el paso en el #hash
// de la dirección para que el botón "atrás" del celular funcione.
//
// Las pantallas que toman fotos (escena, carros y daños), el croquis y el envío
// comparten UN reporte en curso (reporte-en-curso.js): una sola cadena de
// huellas, una sola copia.
import { iniciarPantallaDonde } from './pantalla-donde.js';
import { iniciarPantallaEscena } from './pantalla-escena.js';
import { iniciarPantallaCarros } from './pantalla-carros.js';
import { iniciarPantallaDanos } from './pantalla-danos.js';
import { iniciarPantallaCroquis } from './pantalla-croquis.js';
import { iniciarPantallaEnviar } from './pantalla-enviar.js';
import { crearReporteEnCurso } from './reporte-en-curso.js';

const PASOS = { inicio: 1, heridos: 1, 'a-salvo': 2, donde: 3, escena: 4, carros: 5, danos: 6, croquis: 7, enviar: 8 };
const TOTAL_PASOS = 8;
const reporte = crearReporteEnCurso();
let donde = null;
let actual = null;
// Las pantallas con cámara y el croquis: se crean la primera vez que se entra y
// se apagan al salir.
const perezosas = {};
const INICIAR = {
  escena: () => iniciarPantallaEscena(document.querySelector('#p-escena'), { reporte, puntoDelChoque }),
  carros: () => iniciarPantallaCarros(document.querySelector('#p-carros'), { reporte }),
  danos: () => iniciarPantallaDanos(document.querySelector('#p-danos'), { reporte }),
  croquis: () => iniciarPantallaCroquis(document.querySelector('#p-croquis'), { reporte, lugar: lugarDelChoque }),
  enviar: () => iniciarPantallaEnviar(document.querySelector('#p-enviar'), { reporte, lugar: lugarDelChoque }),
};

// El punto que se marcó en el mapa, para decirle a la persona si está lejos de
// él al hacer la vuelta. El ejemplo no cuenta: es una curva de otra parte.
function puntoDelChoque() {
  const e = donde ? donde.estado() : null;
  return e && e.punto && e.origen !== 'ejemplo' ? e.punto : null;
}

// Lo del paso 3 que el croquis y el envío necesitan: el punto, de dónde salió,
// el análisis de la vía, el clima y la hora. Vive en la memoria de la página
// (el paso 3 no lo guarda en el reporte): si la página se recargó, el croquis
// usa la vía que guardó, y el envío, lo que se guardó al pasar por el paso 8.
function lugarDelChoque() {
  const e = donde ? donde.estado() : null;
  if (!e || !e.punto) return null;
  return { punto: e.punto, origen: e.origen, via: e.via, precision: e.precision ?? null, fecha: donde.fecha(), clima: e.clima ?? null, climaCargando: !!e.climaCargando };
}

function mostrar(nombre) {
  if (!(nombre in PASOS)) nombre = 'inicio';
  // Salir de una pantalla con cámara la apaga: nunca queda prendida detrás de otra.
  if (actual !== nombre && perezosas[actual]) perezosas[actual].salir();
  for (const pantalla of document.querySelectorAll('.pantalla')) pantalla.hidden = pantalla.id !== 'p-' + nombre;
  document.querySelector('#paso').textContent = `Paso ${PASOS[nombre]} de ${TOTAL_PASOS}`;
  if (nombre === 'donde') {
    if (!donde) donde = iniciarPantallaDonde(document.querySelector('#p-donde'));
    // Leaflet mide el contenedor al crearse; si estaba oculto, mide cero.
    requestAnimationFrame(() => donde.ajustar());
  }
  if (INICIAR[nombre]) {
    if (!perezosas[nombre]) perezosas[nombre] = INICIAR[nombre]();
    perezosas[nombre].entrar();
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
mostrar(location.hash.slice(1));

// Para las pruebas en el navegador.
globalThis.__choqueClaro = {
  reporte,
  pantallaDonde: () => donde,
  pantallaEscena: () => perezosas.escena,
  pantallaCarros: () => perezosas.carros,
  pantallaDanos: () => perezosas.danos,
  pantallaCroquis: () => perezosas.croquis,
  pantallaEnviar: () => perezosas.enviar,
};
