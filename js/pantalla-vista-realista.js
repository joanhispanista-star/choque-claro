// El botón «Vista realista» de la zona en 3D (zona-3d.html). Lo que se ve y qué tiene de verdad está en
// vista-realista.js; aquí está lo de la pantalla: el botón, el sello encima del mapa y los textos.
//
// En el ejemplo se enciende sola, cuando la cámara ya entró al 3D (antes, el mapa se congelaba a mitad
// del vuelo y, con las fotos del piso por bajar, se demoraba en entrar). En un reporte arranca apagada:
// la persona la enciende sabiendo que las fachadas son una ilustración.
import { montarVistaRealista } from './vista-realista.js';

const $ = (selector) => document.querySelector(selector);
const TEXTO_DEL_BOTON = { apagada: 'Encender la vista realista', ocupada: 'Vistiendo la zona…', encendida: 'Apagar la vista realista' };

// Con «ahorro de datos» en el navegador no se bajan solos los 2 a 4 MB de imágenes del ejemplo.
const ahorraDatos = () => !!globalThis.navigator?.connection?.saveData;

// Hasta que la cámara se quede quieta, con un tope por si nunca para (la vuelta).
const cuandoPare = (mapa) =>
  new Promise((listo) => {
    if (!mapa.isMoving()) return listo();
    mapa.once('moveend', listo);
    setTimeout(listo, 4000);
  });

// `donde()`: lo que tiene que verse, [{ lat, lon }]. `sola`: si se enciende sin tocar nada. Devuelve la
// vista, o null si a la página le falta una parte (entonces queda la maqueta de siempre).
export function montarBotonDeLaVista({ mapa, centro, ejemplo = false, sol = null, donde, sola = false }) {
  const boton = $('#vista-realista');
  const sello = $('#sello-realista');
  const aviso = $('#vista-realista-aviso');
  const nota = $('#zona-nota');
  if (![boton, sello, aviso, nota].every(Boolean)) return null;
  const notaDeLaMaqueta = nota.textContent;
  const vista = montarVistaRealista({ mapa, centro, ejemplo, sol, donde });
  let ocupada = false;

  const pintar = (estado, problema = '') => {
    boton.textContent = ocupada ? TEXTO_DEL_BOTON.ocupada : estado.encendida ? TEXTO_DEL_BOTON.encendida : TEXTO_DEL_BOTON.apagada;
    boton.disabled = ocupada;
    boton.setAttribute('aria-pressed', String(!!estado.encendida));
    sello.hidden = !estado.encendida;
    sello.textContent = estado.textos?.sello ?? '';
    aviso.textContent = problema || (estado.textos?.corto ?? '');
    aviso.hidden = !aviso.textContent;
    aviso.classList.toggle('error', !!problema);
    nota.textContent = estado.textos?.nota ?? notaDeLaMaqueta;
  };
  const poner = async (si) => {
    if (ocupada) return;
    ocupada = true;
    boton.textContent = TEXTO_DEL_BOTON.ocupada;
    boton.disabled = true;
    let estado = { encendida: false };
    let problema = '';
    try {
      estado = await vista.poner(si);
    } catch (error) {
      console.warn('Vista realista:', error?.message ?? error);
      problema = 'La vista realista no se pudo armar en este momento. Queda la maqueta de siempre; inténtalo otra vez con mejor señal.';
    }
    ocupada = false;
    pintar(estado, problema);
  };

  boton.hidden = false;
  pintar({ encendida: false });
  boton.addEventListener('click', () => poner(!vista.encendida));
  if (sola && !ahorraDatos()) {
    // Lo pesado se va bajando mientras la cámara entra; si falla, lo cuenta `poner`.
    vista.preparar().catch(() => {});
    mapa.once('idle', async () => {
      await cuandoPare(mapa);
      if (!vista.encendida) await poner(true);
    });
  }
  return vista;
}
