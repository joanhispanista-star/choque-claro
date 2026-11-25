// «Tenerla en tu teléfono»: cómo agregarla a la pantalla de inicio en cada teléfono, si ya quedó
// lista para abrir sin señal, y qué funciona y qué no sin internet. Qué se le ofrece a quién lo
// decide instalacion.js.
import { abiertaDesdeInicio, esIOS, formaDeAgregar } from './instalacion.js';

const ESTADOS = {
  lista: { texto: 'Ya abre sin señal.', tono: 'bien' },
  guardando: { texto: 'Guardando la app en el teléfono para que abra sin señal… (unos 2 MB)', tono: 'neutro' },
  fallo: { texto: 'No se pudo guardar para abrir sin señal. Se intenta otra vez la próxima vez que la abras con internet.', tono: 'mal' },
  'sin-soporte': { texto: 'Este navegador no deja guardarla para abrir sin señal. Prueba en Safari o en Chrome.', tono: 'mal' },
  apagado: { texto: 'En este computador no se guarda: es el servidor de pruebas.', tono: 'neutro' },
};

// Android ofrece instalar con un evento que llega una sola vez y muy temprano: se oye desde que la
// página carga, no desde que se abre esta pantalla.
export function escucharInstalacion(ventana = globalThis) {
  let evento = null;
  const oyentes = new Set();
  const avisar = () => {
    for (const oyente of oyentes) oyente();
  };
  ventana.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e;
    avisar();
  });
  ventana.addEventListener('appinstalled', () => {
    evento = null;
    avisar();
  });
  return {
    hay: () => !!evento,
    alCambiar: (oyente) => oyentes.add(oyente),
    // Devuelve si la persona aceptó. El evento sirve una vez.
    async pedir() {
      const este = evento;
      if (!este) return false;
      evento = null;
      await este.prompt();
      const { outcome } = await este.userChoice;
      avisar();
      return outcome === 'accepted';
    },
  };
}

export function iniciarPantallaAgregar(raiz, { sinSenal, instalacion, ventana = globalThis }) {
  const $ = (selector) => raiz.querySelector(selector);

  function pintar() {
    const ios = esIOS(ventana.navigator);
    const desdeInicio = abiertaDesdeInicio(ventana);
    const forma = formaDeAgregar({ ios, desdeInicio, conBoton: instalacion.hay() });
    for (const f of ['ya', 'iphone', 'boton', 'menu']) $('#agregar-' + f).hidden = f !== forma;
    const e = ESTADOS[sinSenal.estado()];
    $('#agregar-estado').textContent = e.texto;
    $('#agregar-estado').dataset.estado = e.tono;
  }

  $('#agregar-instalar').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    try {
      if (await instalacion.pedir()) $('#agregar-hecho').hidden = false;
    } catch {
      // El navegador no la dejó: quedan las instrucciones del menú.
    } finally {
      boton.disabled = false;
      pintar();
    }
  });

  instalacion.alCambiar(pintar);
  sinSenal.alCambiar(pintar);

  return { entrar: pintar, salir() {} };
}
