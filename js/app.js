// El recorrido del reporte: una pantalla por paso, con el paso en el #hash
// de la dirección para que el botón "atrás" del celular funcione.
//
// Los pasos 4 a 8 (escena, carros, daños, croquis y enviar) aún no existen:
// la pantalla de la escena lo dice con su fecha, no finge (PLAN.md).
import { iniciarPantallaDonde } from './pantalla-donde.js';

const PASOS = { inicio: 1, heridos: 1, 'a-salvo': 2, donde: 3, escena: 4 };
const TOTAL_PASOS = 8;
let donde = null;

function mostrar(nombre) {
  if (!(nombre in PASOS)) nombre = 'inicio';
  for (const pantalla of document.querySelectorAll('.pantalla')) pantalla.hidden = pantalla.id !== 'p-' + nombre;
  document.querySelector('#paso').textContent = `Paso ${PASOS[nombre]} de ${TOTAL_PASOS}`;
  if (nombre === 'donde') {
    if (!donde) donde = iniciarPantallaDonde(document.querySelector('#p-donde'));
    // Leaflet mide el contenedor al crearse; si estaba oculto, mide cero.
    requestAnimationFrame(() => donde.ajustar());
  }
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
globalThis.__choqueClaro = { pantallaDonde: () => donde };
