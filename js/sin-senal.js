// La página y su service worker (sw.js): lo pone, dice si ya quedó lista para abrir sin señal y ofrece
// la versión nueva cuando la hay.
//
// Tres reglas:
//  - Se pone después de que la página cargó: quien acaba de chocar necesita la señal para lo suyo.
//  - La versión nueva no entra sola. Espera a que la persona toque «Actualizar» en el inicio, y ahí
//    la página se recarga entera: cambiarla a mitad de un reporte mezclaría módulos de dos versiones.
//  - En este PC (localhost) no se pone, salvo con «?sw=1» en la dirección: guardaría los archivos y
//    lo recién editado no se vería. Y si quedó uno de una prueba, se quita.
import { esLocal } from './instalacion.js';

const UNA_HORA = 3600 * 1000;

export function crearSinSenal({ ventana = globalThis, url = new URL('../sw.js', import.meta.url).href, reloj = () => Date.now() } = {}) {
  const nav = ventana.navigator;
  const oyentes = new Set();
  // 'sin-soporte' | 'apagado' (en este PC) | 'guardando' | 'lista' | 'fallo'
  let estado = 'guardando';
  let registro = null;
  let hayNueva = false;
  let pedida = false;
  let recargarAlVolver = false;
  let ultimaRevision = 0;

  const avisar = () => {
    for (const oyente of oyentes) oyente();
  };
  function poner(nuevo) {
    if (estado === nuevo) return;
    estado = nuevo;
    avisar();
  }

  function mirarNueva() {
    // `waiting` con una activa mandando: la nueva está bajada y completa, esperando.
    const nueva = !!(registro?.waiting && nav.serviceWorker.controller);
    if (nueva !== hayNueva) {
      hayNueva = nueva;
      avisar();
    }
  }

  function seguir(trabajador) {
    if (!trabajador) return;
    trabajador.addEventListener('statechange', () => {
      if (trabajador.state === 'activated') poner('lista');
      // 'redundant' sin que haya otra mandando: no se pudo guardar (sin señal, o la versión que
      // GitHub repartía estaba a medias). El navegador lo intenta en la próxima visita.
      if (trabajador.state === 'redundant' && !registro.active && !registro.waiting) poner('fallo');
      mirarNueva();
    });
  }

  async function iniciar() {
    if (!nav?.serviceWorker || !ventana.isSecureContext) {
      poner('sin-soporte');
      return;
    }
    const sw = nav.serviceWorker;
    const { hostname, search } = ventana.location;
    if (esLocal(hostname) && !new URLSearchParams(search).has('sw')) {
      poner('apagado');
      for (const r of await sw.getRegistrations()) await r.unregister();
      return;
    }
    sw.addEventListener('controllerchange', () => {
      // La primera vez que se instala no hay `hayNueva` ni nadie lo pidió: nada que recargar.
      if (pedida) ventana.location.reload();
      // La pidió otra pestaña: esta se recarga cuando la persona vuelva al inicio, no a mitad de nada.
      else if (hayNueva) recargarAlVolver = true;
    });
    try {
      registro = await sw.register(url, { updateViaCache: 'none' });
    } catch {
      poner('fallo');
      return;
    }
    if (registro.active) poner('lista');
    seguir(registro.installing);
    registro.addEventListener('updatefound', () => seguir(registro.installing));
    mirarNueva();
  }

  return {
    // Después de la carga, y no antes.
    arrancar() {
      const ya = () => iniciar().catch(() => poner('fallo'));
      if (ventana.document.readyState === 'complete') ya();
      else ventana.addEventListener('load', ya, { once: true });
      // Abierta desde el ícono puede pasar días sin cargarse de nuevo: al volver a ella se busca si
      // hay versión nueva, a lo sumo una vez por hora.
      ventana.document.addEventListener('visibilitychange', () => {
        if (ventana.document.visibilityState !== 'visible' || !registro || reloj() - ultimaRevision < UNA_HORA) return;
        ultimaRevision = reloj();
        registro.update().catch(() => {});
      });
    },
    estado: () => estado,
    hayNueva: () => hayNueva,
    alCambiar(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    actualizar() {
      if (!registro?.waiting) return;
      pedida = true;
      registro.waiting.postMessage('actualizar');
    },
    // app.js la llama al mostrar el inicio.
    alVolverAlInicio() {
      if (recargarAlVolver) ventana.location.reload();
    },
  };
}
