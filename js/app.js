// El recorrido del reporte: una pantalla por paso, con el paso en el #hash
// de la dirección para que el botón "atrás" del celular funcione.
//
// Los pasos 5 a 8 (carros, daños, croquis y enviar) aún no existen: la
// pantalla de los carros lo dice con su fecha, no finge (PLAN.md).
import { iniciarPantallaDonde } from './pantalla-donde.js';
import { iniciarPantallaEscena } from './pantalla-escena.js';

const PASOS = { inicio: 1, heridos: 1, 'a-salvo': 2, donde: 3, escena: 4, carros: 5 };
const TOTAL_PASOS = 8;
let donde = null;
let escena = null;
let actual = null;

// El punto que se marcó en el mapa, para decirle a la persona si está lejos de
// él al hacer la vuelta. El ejemplo no cuenta: es una curva de otra parte.
function puntoDelChoque() {
  const e = donde ? donde.estado() : null;
  return e && e.punto && e.origen !== 'ejemplo' ? e.punto : null;
}

function mostrar(nombre) {
  if (!(nombre in PASOS)) nombre = 'inicio';
  // Salir de la escena apaga la cámara: nunca queda prendida detrás de otra pantalla.
  if (actual === 'escena' && nombre !== 'escena') escena.salir();
  for (const pantalla of document.querySelectorAll('.pantalla')) pantalla.hidden = pantalla.id !== 'p-' + nombre;
  document.querySelector('#paso').textContent = `Paso ${PASOS[nombre]} de ${TOTAL_PASOS}`;
  if (nombre === 'donde') {
    if (!donde) donde = iniciarPantallaDonde(document.querySelector('#p-donde'));
    // Leaflet mide el contenedor al crearse; si estaba oculto, mide cero.
    requestAnimationFrame(() => donde.ajustar());
  }
  if (nombre === 'escena') {
    if (!escena) escena = iniciarPantallaEscena(document.querySelector('#p-escena'), { puntoDelChoque });
    escena.entrar();
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
globalThis.__choqueClaro = { pantallaDonde: () => donde, pantallaEscena: () => escena };
