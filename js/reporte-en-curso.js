// El reporte que se está llenando, compartido por las pantallas que toman
// fotos (la escena, los carros y los daños): la base del teléfono, el reporte
// en curso, sus fotos en el orden de la cadena y lo que la persona declara.
//
// Una sola cadena por reporte (evidencia.js). Si cada pantalla guardara su
// propia copia de las fotos, la que guardara segunda sellaría contra una
// huella vieja y la base la rechazaría. Aquí hay una sola copia, y cada
// pantalla la recarga al entrar (cargar).
import { reducirFoto } from './fotos.js';
import { INICIO_DE_LA_CADENA, registroDeFoto, sellarRegistro, sha256Hex, verificarCadena } from './evidencia.js';
import { CADENA_CAMBIO, abrirBaseDelReporte } from './reporte-bd.js';

// Miniatura de 480 y no los 200 del taller: en las listas van dos fotos por
// fila, unos 165 px de ancho que en un iPhone son 500 puntos de pantalla, y a
// 200 se veían borrosas.
const MINIATURA = 480;

// Una foto que se estaba guardando cuando la persona cambió de reporte («Tus reportes»): era del
// otro, y la cámara ya se apagó al salir. No se guarda en ninguno.
export const OTRO_REPORTE = 'Cambiaste de reporte mientras se guardaba la foto: no se guardó.';

export const detalle = (error) => `${error?.name || 'Error'}: ${String(error?.message || '').slice(0, 120)}`;

export function crearReporteEnCurso({ abrirBase = abrirBaseDelReporte, reducir = reducirFoto, urls = globalThis.URL } = {}) {
  let base = null;
  let reporte = null;
  // { id, registro, miniatura (Blob), url }, en el orden de la cadena.
  let fotos = [];
  // Los registros de otros reportes que «Tus reportes» ya leyó (registrosDe).
  const leidos = new Map();

  function ponerFotos(nuevas) {
    for (const f of fotos) urls.revokeObjectURL(f.url);
    fotos = nuevas.map((f) => ({ ...f, url: urls.createObjectURL(f.miniatura) }));
  }

  const fotoDe = (registro) => fotos.find((f) => f.registro === registro) || null;

  return {
    // Abre la base (la primera vez), toma el reporte en curso y sus fotos.
    async cargar() {
      if (!base) base = await abrirBase();
      reporte = await base.reporteEnCurso();
      ponerFotos(await base.fotos(reporte.id));
      return reporte;
    },

    reporte: () => reporte,
    registros: () => fotos.map((f) => f.registro),
    fotoDe,

    async blobDe(registro) {
      const foto = fotoDe(registro);
      return foto ? base.foto(foto.id) : null;
    },

    // Reduce, sella y guarda una foto tomada ahora. Si algo falla, la foto no
    // entra y la cadena queda como estaba: la persona la vuelve a tomar.
    // `datos`: paso, sector, carro, pieza, dano y reemplaza (evidencia.js).
    // `completa`: se guarda con la medida de la cámara, sin reducir a 1.280 px (las fotos de cerca de
    // una huella, E1: a 1.280 las rayas se pierden). Pesa de cuatro a diez veces más.
    async agregarFoto({ blob, hora, gps, orientacion, medida, revision }, { paso, sector = null, carro = null, pieza = null, dano = null, prueba = null, completa = false, reemplaza = null }) {
      const deEste = reporte.id;
      const reducida = await reducir(blob, completa ? { ladoMayor: Infinity, ladoMiniatura: MINIATURA, calidad: 0.92 } : { ladoMiniatura: MINIATURA });
      const bytes = await reducida.foto.arrayBuffer();
      const huella = await sha256Hex(bytes);
      if (reporte.id !== deEste) throw new Error(OTRO_REPORTE);
      const anterior = fotos[fotos.length - 1];
      const registro = registroDeFoto({
        reporte: reporte.id,
        paso,
        indice: fotos.length,
        sector,
        carro,
        pieza,
        dano,
        prueba,
        hora,
        gps,
        orientacion,
        calidad: { ...medida, problemas: revision.problemas },
        foto: { tipo: reducida.foto.type || 'image/jpeg', ancho: reducida.ancho, alto: reducida.alto, bytes: bytes.byteLength, sha256: huella },
        reemplaza,
      });
      const sellado = await sellarRegistro(registro, anterior ? anterior.registro.huella : INICIO_DE_LA_CADENA);
      if (reporte.id !== deEste) throw new Error(OTRO_REPORTE);
      let id;
      try {
        id = await base.agregarFoto(sellado, { foto: reducida.foto, miniatura: reducida.miniatura });
      } catch (error) {
        if (error.message === CADENA_CAMBIO) {
          ponerFotos(await base.fotos(reporte.id));
          throw error;
        }
        throw new Error(`No se pudo guardar la foto en el teléfono (${detalle(error)}). Vuelve a tomarla.`);
      }
      // Si se cambió de reporte mientras la base la guardaba, ya quedó en el suyo (su registro lo
      // dice): no entra a la lista del de ahora.
      if (reporte.id !== deEste) return { id, registro: sellado, miniatura: reducida.miniatura, url: null };
      const foto = { id, registro: sellado, miniatura: reducida.miniatura, url: urls.createObjectURL(reducida.miniatura) };
      fotos.push(foto);
      return foto;
    },

    // La cadena entera del reporte, con los bytes de cada foto.
    revisarCadena() {
      return verificarCadena(
        fotos.map((f) => f.registro),
        {
          huellaDeLaFoto: async (registro) => {
            const blob = await base.foto(fotoDe(registro).id);
            return blob ? sha256Hex(await blob.arrayBuffer()) : 'sin foto';
          },
        },
      );
    },

    // Lo que no es foto: los carros y los daños (reporte-bd.js, guardarDatos).
    async guardarDatos(cambios) {
      const id = reporte.id;
      const guardado = await base.guardarDatos(id, cambios);
      // Igual que con las fotos: si mientras tanto se cambió de reporte, el de ahora no se pisa.
      if (reporte.id === id) reporte = guardado;
      return guardado;
    },

    async nuevoReporte() {
      if (!base) base = await abrirBase();
      reporte = await base.nuevoReporte();
      ponerFotos([]);
      return reporte;
    },

    // Volver a un reporte guardado («Tus reportes»): queda en curso, con sus fotos. Las fotos se
    // leen ANTES de cambiarlo en la base: si la lectura falla, todo sigue en el de antes, en la
    // base y aquí, y el error que ve la persona dice la verdad.
    async abrir(reporteId) {
      if (!base) base = await abrirBase();
      const suyas = await base.fotos(reporteId);
      reporte = await base.abrirReporte(reporteId);
      ponerFotos(suyas);
      return reporte;
    },

    // «Tus reportes»: todos los del teléfono con su cuenta de fotos (reporte-bd.js, reportes) y,
    // aparte, los registros de las fotos de uno, sin las fotos.
    async reportes() {
      if (!base) base = await abrirBase();
      return base.reportes();
    },
    // Leerlos recorre las fotos grandes (van en el mismo registro de la base), así que se guardan
    // mientras la página siga abierta: a un reporte solo se le agregan fotos, nunca se le quitan, y
    // si la cuenta es la misma, los registros también. Los del reporte en curso ya están aquí.
    async registrosDe(reporteId, cuantas = null) {
      if (reporte?.id === reporteId && (cuantas === null || fotos.length === cuantas)) return fotos.map((f) => f.registro);
      const ya = leidos.get(reporteId);
      if (ya && ya.length === cuantas) return ya;
      if (!base) base = await abrirBase();
      const suyos = await base.registros(reporteId);
      leidos.set(reporteId, suyos);
      return suyos;
    },

    // Sin await: si el navegador dice que no, todo sigue igual.
    pedirQueNoSeBorren() {
      if (base) base.pedirQueNoSeBorren();
    },
  };
}
