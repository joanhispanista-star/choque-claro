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

export const detalle = (error) => `${error?.name || 'Error'}: ${String(error?.message || '').slice(0, 120)}`;

export function crearReporteEnCurso({ abrirBase = abrirBaseDelReporte, reducir = reducirFoto, urls = globalThis.URL } = {}) {
  let base = null;
  let reporte = null;
  // { id, registro, miniatura (Blob), url }, en el orden de la cadena.
  let fotos = [];

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
    async agregarFoto({ blob, hora, gps, orientacion, medida, revision }, { paso, sector = null, carro = null, pieza = null, dano = null, reemplaza = null }) {
      const reducida = await reducir(blob, { ladoMiniatura: MINIATURA });
      const bytes = await reducida.foto.arrayBuffer();
      const anterior = fotos[fotos.length - 1];
      const registro = registroDeFoto({
        reporte: reporte.id,
        paso,
        indice: fotos.length,
        sector,
        carro,
        pieza,
        dano,
        hora,
        gps,
        orientacion,
        calidad: { ...medida, problemas: revision.problemas },
        foto: { tipo: reducida.foto.type || 'image/jpeg', ancho: reducida.ancho, alto: reducida.alto, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) },
        reemplaza,
      });
      const sellado = await sellarRegistro(registro, anterior ? anterior.registro.huella : INICIO_DE_LA_CADENA);
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
      reporte = await base.guardarDatos(reporte.id, cambios);
      return reporte;
    },

    async nuevoReporte() {
      reporte = await base.nuevoReporte();
      ponerFotos([]);
      return reporte;
    },

    // Sin await: si el navegador dice que no, todo sigue igual.
    pedirQueNoSeBorren() {
      if (base) base.pedirQueNoSeBorren();
    },
  };
}
