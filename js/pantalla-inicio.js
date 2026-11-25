// La portada: el choque en un botón enorme, el 123 a un toque y, debajo, lo demás. La eligió Joan
// (la A) el 25-nov-2026: casi siempre se va a abrir con calma, para aprender o preparar, y el día del
// choque hay que encontrar el botón sin leer.
//
// Solo muestra lo que ya existe. Las baldosas de «Practicar», «¿Muevo los carros?», «Normas y
// señales» y «Mi carro» entran cuando sus pantallas estén hechas: una baldosa que no abre nada es una
// promesa.
import { abiertaDesdeInicio, esIOS } from './instalacion.js';
import { iniciarRenglonDelInicio } from './pantalla-reportes.js';

// El tiempo para que el teléfono alcance a abrir su ventana de llamar antes de cambiar de pantalla.
const ESPERA_DEL_123 = 600;

export function iniciarPantallaInicio(raiz, { reporte, abrir, sinSenal, ventana = globalThis }) {
  const $ = (selector) => raiz.querySelector(selector);
  const renglon = iniciarRenglonDelInicio(raiz, { reporte, abrir });

  // «Hay heridos: llamar al 123» abre la llamada de una vez y deja detrás la pantalla de los heridos,
  // para que al volver la persona encuentre qué hacer mientras llegan.
  $('#inicio-123').addEventListener('click', () => {
    setTimeout(() => {
      ventana.location.hash = 'heridos';
    }, ESPERA_DEL_123);
  });

  $('#inicio-actualizar').addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Actualizando…';
    sinSenal.actualizar();
  });

  function pintar() {
    const desdeInicio = abiertaDesdeInicio(ventana);
    $('#inicio-antes').hidden = desdeInicio;
    $('#inicio-agregar-detalle').textContent = esIOS(ventana.navigator) ? 'Abre sin señal, y Safari no borra lo tuyo' : 'Abre sin señal, en un toque';
    $('#inicio-nueva').hidden = !sinSenal.hayNueva();
  }
  sinSenal.alCambiar(pintar);

  return {
    entrar() {
      pintar();
      sinSenal.alVolverAlInicio();
      return renglon.entrar();
    },
    salir: () => renglon.salir(),
  };
}
