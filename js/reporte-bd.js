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

// Lo último que pasó con el reporte: que se tocó o que se volvió a abrir desde «Tus reportes». Las
// dos son ISO del mismo reloj y se comparan como texto.
export const ultimaVez = (reporte) => [reporte?.actualizado, reporte?.abierto].filter(Boolean).sort().pop() ?? null;

export function reporteVigente(reporte, ahora = new Date(), horas = HORAS_DE_UN_REPORTE) {
  const ultima = ultimaVez(reporte);
  if (!ultima) return false;
  const edad = ahora.getTime() - new Date(ultima).getTime();
  return edad >= 0 && edad < horas * 3600 * 1000;
}

// El turno: crece cada vez que un reporte se crea o se vuelve a abrir. El reporte en curso es el
// del turno más alto, no el último que se tocó: abrir uno viejo tiene que ganarle al de hoy aunque
// una escritura que iba en camino (la lectura de una placa, un guardado en fila) toque el de hoy un
// minuto después. Los reportes de antes del 17-nov-2026 no tienen turno: al crear o abrir uno, su
// `orden` (el de creación) cuenta como turno, para que el nuevo quede encima.
export const turnoDe = (reporte) => reporte?.turno ?? reporte?.orden ?? 0;

// Cuál está en curso. Mientras ningún reporte tenga turno (un teléfono con reportes de antes del
// 17-nov-2026 que todavía no ha creado ni abierto uno), sigue la regla de antes: el último que se
// tocó, y entre dos tocados a la vez, el último que se creó. Si no, la persona que actualiza la app
// a mitad de un reporte aparecería en otro.
const masReciente = (a, b) => (a.actualizado === b.actualizado ? (b.orden ?? 0) - (a.orden ?? 0) : a.actualizado < b.actualizado ? 1 : -1);
export function enCurso(todos) {
  if (!todos.some((r) => r.turno != null)) return [...todos].sort(masReciente)[0] ?? null;
  return todos.reduce((mejor, r) => (!mejor || turnoDe(r) > turnoDe(mejor) ? r : mejor), null);
}

// El camino del inicio («¿Hay alguien herido?» y después el paso 3) es para un choque de ahora: sigue
// el reporte en curso solo si se empezó hace menos de seis horas, no está sellado y no es el
// ejemplo. Si no, se empieza otro. Un choque nuevo no puede caer en uno sellado (le cambiaría el
// número), ni en uno de otro día que se volvió a abrir desde «Tus reportes», ni en el ejemplo.
export function sirveParaUnChoqueNuevo(reporte, ahora = new Date(), horas = HORAS_DE_UN_REPORTE) {
  if (!reporte || reporte.sello || reporte.lugar?.origen === 'ejemplo' || reporte.croquis?.ejemplo) return false;
  const edad = ahora.getTime() - new Date(reporte.creado).getTime();
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

    // `orden` es el de creación («Tus reportes» desempata con él) y `turno`, el que decide cuál
    // está en curso (turnoDe). Los id son al azar y no sirven para eso.
    async function crearReporte() {
      const todos = await pedir(almacen('reportes').getAll());
      const ahora = reloj().toISOString();
      const reporte = {
        id: nuevoId(),
        orden: todos.reduce((mayor, r) => Math.max(mayor, r.orden ?? 0), 0) + 1,
        turno: todos.reduce((mayor, r) => Math.max(mayor, turnoDe(r)), 0) + 1,
        creado: ahora,
        actualizado: ahora,
      };
      await pedir(almacen('reportes', 'readwrite').add(reporte));
      return reporte;
    }

    return {
      // El reporte en curso (enCurso), si sigue vigente; si no, uno nuevo.
      reporteEnCurso: conexion.protegida(async () => {
        const ultimo = enCurso(await pedir(almacen('reportes').getAll()));
        return reporteVigente(ultimo, reloj()) ? ultimo : crearReporte();
      }),

      // Empezar otro aunque el de ahora siga vigente. El anterior queda guardado.
      nuevoReporte: conexion.protegida(crearReporte),

      // Todos los reportes del teléfono, del más nuevo al más viejo (por cuándo se empezaron),
      // con cuántas fotos tiene cada uno y si es el que está en curso. Sin las fotos.
      reportes: conexion.protegida(async () => {
        const todos = await pedir(almacen('reportes').getAll());
        const actual = enCurso(todos);
        const indice = almacen('fotos').index('reporte');
        const conFotos = [];
        for (const r of todos) conFotos.push({ ...r, fotos: await pedir(indice.count(r.id)), enCurso: r === actual && reporteVigente(r, reloj()) });
        return conFotos.sort((a, b) => (a.creado === b.creado ? (b.orden ?? 0) - (a.orden ?? 0) : a.creado < b.creado ? 1 : -1));
      }),

      // Volver a uno guardado: queda en curso (le gana al de hoy) y vale otras seis horas desde
      // ahora. `abierto` y `turno` no entran al sello (sello.js toma solo lo declarado): abrir un
      // reporte sellado no le cambia el número.
      abrirReporte: conexion.protegida(
        (reporteId) =>
          new Promise((resolver, rechazar) => {
            const tx = conexion.actual.transaction('reportes', 'readwrite');
            const reportes = tx.objectStore('reportes');
            let abierto = null;
            let error = null;
            reportes.getAll().onsuccess = (e) => {
              const todos = e.target.result;
              const reporte = todos.find((r) => r.id === reporteId);
              if (!reporte) {
                error = new Error('Ese reporte ya no está en este teléfono');
                tx.abort();
                return;
              }
              abierto = { ...reporte, turno: todos.reduce((mayor, r) => Math.max(mayor, turnoDe(r)), 0) + 1, abierto: reloj().toISOString() };
              reportes.put(abierto);
            };
            tx.oncomplete = () => resolver(abierto);
            tx.onabort = () => rechazar(error || tx.error || new Error('No se pudo abrir el reporte'));
          }),
      ),

      // Solo los registros de las fotos de un reporte, en el orden de la cadena: lo que «Tus
      // reportes» necesita para decir qué falta y si el sello sigue valiendo. Con un cursor y no
      // con getAll, que subiría a la memoria todas las fotos grandes de una vez (en un iPhone,
      // varios reportes de 30 fotos pueden hacer que Safari cierre la página).
      registros: conexion.protegida(
        (reporteId) =>
          new Promise((resolver, rechazar) => {
            const registros = [];
            const cursor = almacen('fotos').index('reporte').openCursor(reporteId);
            cursor.onsuccess = () => {
              const c = cursor.result;
              if (!c) {
                resolver(registros.sort((a, b) => a.indice - b.indice));
                return;
              }
              registros.push(c.value.registro);
              c.continue();
            };
            cursor.onerror = () => rechazar(cursor.error || new Error('No se pudieron leer las fotos del reporte'));
          }),
      ),

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

      // Lo que la persona declara y no es una foto (los carros con su placa y
      // su línea, los daños marcados) va en el mismo registro del reporte. Se
      // mezcla dentro de una transacción con lo que haya en la base, no con
      // una copia vieja: agregarFoto también toca este registro (la hora).
      // Esto NO entra a la cadena: se sella al enviar (paso 8).
      guardarDatos: conexion.protegida(
        (reporteId, cambios) =>
          new Promise((resolver, rechazar) => {
            const { id, orden, turno, creado, abierto, ...permitidos } = cambios || {};
            const tx = conexion.actual.transaction('reportes', 'readwrite');
            const reportes = tx.objectStore('reportes');
            let guardado = null;
            let error = null;
            reportes.get(reporteId).onsuccess = (e) => {
              const reporte = e.target.result;
              if (!reporte) {
                error = new Error('El reporte ya no está en este teléfono');
                tx.abort();
                return;
              }
              guardado = { ...reporte, ...permitidos, actualizado: reloj().toISOString() };
              reportes.put(guardado);
            };
            tx.oncomplete = () => resolver(guardado);
            tx.onabort = () => rechazar(error || tx.error || new Error('No se pudo guardar el reporte'));
          }),
      ),

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
