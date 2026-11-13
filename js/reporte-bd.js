// La base del reporte en el teléfono (IndexedDB): el reporte en curso y sus
// fotos, con la cadena de huellas. El demo no tiene nube y la pantalla lo dice.
//
// Una foto se guarda como { id, reporte, registro, archivo, miniatura }:
// `registro` es lo que se selló (evidencia.js), intacto; `archivo` y
// `miniatura` van como bytes y no como Blob (conexion-bd.js cuenta por qué).
//
// iOS cierra la base sin avisar cuando la página pasa a segundo plano o le
// falta memoria: cada operación va por conexionViva, que reabre y repite.
import { aBlob, aBytes, conTope, conexionViva } from './conexion-bd.js';
import { INICIO_DE_LA_CADENA } from './evidencia.js';

export const NOMBRE_BD = 'choque-claro';
const VERSION = 1;

// Un choque se documenta en una sentada. Si el último reporte se tocó hace más
// de esto, abrir la app es empezar otro: así el demo, mostrado dos días
// seguidos, no amanece con la vuelta de ayer.
export const HORAS_DE_UN_REPORTE = 6;

export const CADENA_CAMBIO = 'La cadena de fotos cambió mientras se guardaba esta. Vuelve a tomarla.';

export function reporteVigente(reporte, ahora = new Date(), horas = HORAS_DE_UN_REPORTE) {
  if (!reporte || !reporte.actualizado) return false;
  const edad = ahora.getTime() - new Date(reporte.actualizado).getTime();
  return edad >= 0 && edad < horas * 3600 * 1000;
}

function idNuevo() {
  // randomUUID existe en https; la otra rama es para lo demás (y para Node viejo).
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function pedir(peticion) {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error || new Error('Falló la base de las fotos'));
  });
}

export function abrirBaseDelReporte({ indexedDB: fabrica = globalThis.indexedDB, nombre = NOMBRE_BD, reloj = () => new Date(), nuevoId = idNuevo } = {}) {
  if (!fabrica) return Promise.reject(new Error('Este navegador no tiene dónde guardar las fotos (IndexedDB)'));
  const abrir = () =>
    new Promise((resolver, rechazar) => {
      let peticion;
      try {
        peticion = fabrica.open(nombre, VERSION);
      } catch (e) {
        rechazar(e);
        return;
      }
      peticion.onupgradeneeded = () => {
        const bd = peticion.result;
        if (!bd.objectStoreNames.contains('reportes')) bd.createObjectStore('reportes', { keyPath: 'id' });
        if (!bd.objectStoreNames.contains('fotos')) {
          // Dentro de un mismo reporte, el índice ordena por id, que crece:
          // el último que se agregó es el último de la cadena.
          bd.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true }).createIndex('reporte', 'reporte');
        }
      };
      peticion.onerror = () => rechazar(peticion.error || new Error('No se pudo abrir la base de las fotos'));
      peticion.onblocked = () => rechazar(new Error('La base de las fotos está abierta en otra pestaña con una versión vieja: ciérrala'));
      peticion.onsuccess = () => resolver(peticion.result);
    });

  return conTope(abrir(), 10000).then((bd) => {
    const conexion = conexionViva(bd, abrir, { tope: 30000 });
    const almacen = (nombreAlmacen, modo = 'readonly') => conexion.actual.transaction(nombreAlmacen, modo).objectStore(nombreAlmacen);

    // `orden` desempata dos reportes tocados en el mismo instante (el que se
    // acaba de crear con "Empezar un reporte nuevo" y el anterior): gana el
    // último creado. Los id son al azar y no sirven para eso.
    async function crearReporte() {
      const todos = await pedir(almacen('reportes').getAll());
      const ahora = reloj().toISOString();
      const reporte = { id: nuevoId(), orden: todos.reduce((mayor, r) => Math.max(mayor, r.orden ?? 0), 0) + 1, creado: ahora, actualizado: ahora };
      await pedir(almacen('reportes', 'readwrite').add(reporte));
      return reporte;
    }

    const masReciente = (a, b) => (a.actualizado === b.actualizado ? (b.orden ?? 0) - (a.orden ?? 0) : a.actualizado < b.actualizado ? 1 : -1);

    return {
      // El reporte en curso: el último que se tocó, si sigue vigente; si no, uno nuevo.
      reporteEnCurso: conexion.protegida(async () => {
        const todos = await pedir(almacen('reportes').getAll());
        const ultimo = todos.sort(masReciente)[0];
        return reporteVigente(ultimo, reloj()) ? ultimo : crearReporte();
      }),

      // Empezar otro aunque el de ahora siga vigente. El anterior queda guardado.
      nuevoReporte: conexion.protegida(crearReporte),

      // Las fotos de un reporte en el orden de la cadena: { id, registro,
      // miniatura (Blob) }, sin la foto grande, que se pide aparte.
      fotos: conexion.protegida(async (reporte) => {
        const filas = await pedir(almacen('fotos').index('reporte').getAll(reporte));
        return filas
          .sort((a, b) => a.registro.indice - b.registro.indice)
          .map((f) => ({ id: f.id, registro: f.registro, miniatura: aBlob(f.miniatura) }));
      }),

      foto: conexion.protegida(async (id) => {
        const fila = await pedir(almacen('fotos').get(id));
        return fila ? aBlob(fila.archivo) : null;
      }),

      // Agrega una foto ya sellada. Dentro de la misma transacción revisa que
      // siga la cadena: que `anterior` sea la huella de la última foto del
      // reporte. Si no (otra foto se guardó en el medio), no guarda nada.
      // Repetirla es seguro: si esta misma ya había quedado guardada, devuelve
      // su id y no la duplica.
      agregarFoto: conexion.protegida(async (registro, { foto, miniatura }) => {
        const archivo = await aBytes(foto);
        const chica = !miniatura || miniatura === foto ? archivo : await aBytes(miniatura);
        return new Promise((resolver, rechazar) => {
          const tx = conexion.actual.transaction(['fotos', 'reportes'], 'readwrite');
          const fotos = tx.objectStore('fotos');
          let resultado = null;
          let error = null;
          // Una clave sola sirve de rango: el cursor hacia atrás da primero la última.
          const ultima = fotos.index('reporte').openCursor(registro.reporte, 'prev');
          ultima.onsuccess = () => {
            const cursor = ultima.result;
            const previa = cursor ? cursor.value.registro : null;
            if (previa && previa.huella === registro.huella) {
              resultado = cursor.value.id;
              return;
            }
            const esperada = previa ? previa.huella : INICIO_DE_LA_CADENA;
            const indice = previa ? previa.indice + 1 : 0;
            if (registro.anterior !== esperada || registro.indice !== indice) {
              error = new Error(CADENA_CAMBIO);
              tx.abort();
              return;
            }
            fotos.add({ reporte: registro.reporte, registro, archivo, miniatura: chica }).onsuccess = (e) => {
              resultado = e.target.result;
            };
            const reportes = tx.objectStore('reportes');
            reportes.get(registro.reporte).onsuccess = (e) => {
              const reporte = e.target.result;
              if (reporte) reportes.put({ ...reporte, actualizado: reloj().toISOString() });
            };
          };
          tx.oncomplete = () => resolver(resultado);
          tx.onabort = () => rechazar(error || tx.error || new Error('No se pudo guardar la foto'));
          tx.onerror = () => {
            if (!error) error = tx.error;
          };
        });
      }),

      // Pedirle al navegador que no borre las fotos cuando le falte espacio.
      // Si dice que no, todo sigue igual; solo que el teléfono podría borrarlas.
      async pedirQueNoSeBorren() {
        try {
          return globalThis.navigator?.storage?.persist ? await navigator.storage.persist() : false;
        } catch {
          return false;
        }
      },

      cerrar: () => conexion.cerrar(),
    };
  });
}
