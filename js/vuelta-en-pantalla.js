// La vuelta de 8 fotos en la pantalla: el anillo que gira con la brújula, la
// guía, la tira de las tomas y, en los carros, la silueta guía. La usan la
// escena (paso 4) y cada carro (paso 5); la cámara, los sensores y el guardado
// son de sesion-de-camara.js, y lo que decide qué toma va dónde está en
// escena.js (puro, con pruebas).
//
// Elementos, con el prefijo de la pantalla: `anillo` (un <svg>), `guia`,
// `cuenta`, `tira`, y si hay silueta, `silueta` (un <img>) y `vista`.
import { crearSesionDeCamara, poner } from './sesion-de-camara.js';
import {
  TEXTOS,
  TOMAS,
  caminoDelSector,
  dibujoDelAnillo,
  estadoDeLaVuelta,
  etiquetaDeLaFoto,
  guiaDeLaVuelta,
  sectorParaLaFoto,
  textoDeLaCuenta,
} from './escena.js';

// Arriba y no junto a las funciones que las usan: una constante declarada
// después de la función que la usa dejó una pantalla muda en el taller.
const SVG = 'http://www.w3.org/2000/svg';
const PENDIENTE = 'Esa foto no pasó la revisión: mira arriba';

export function crearVueltaEnPantalla({
  raiz,
  prefijo,
  reporte,
  // () => (registro) => boolean: qué fotos son de esta vuelta. Es una función
  // porque en los carros cambia según el carro que se está fotografiando.
  filtro,
  // (sector) => lo que va al registro además del sector: { paso, carro }.
  datos,
  textos = TEXTOS,
  // (sector) => 'Lado derecho'. Sin él, las fotos se nombran por su rumbo.
  nombreDeLaToma = null,
  // (sector) => la URL de la silueta de esa toma, o null mientras no esté.
  silueta = null,
  // (orientacion, vuelta, gps) => [{ texto, lejos }]
  avisos = () => [],
  alCompletar = () => {},
  alGuardar = async () => {},
  alApagarseSola = () => {},
}) {
  const $ = (sufijo) => raiz.querySelector(`#${prefijo}-${sufijo}`);
  const estado = { porRepetir: null };

  const vuelta = () => estadoDeLaVuelta(reporte.registros(), { porRepetir: estado.porRepetir, filtro: filtro() });

  // El anillo: 8 sectores, la flecha de "lo que tienes al frente", el norte y la cuenta.
  const anillo = $('anillo');
  const elementoSvg = (etiqueta, atributos) => {
    const e = document.createElementNS(SVG, etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) e.setAttribute(clave, valor);
    anillo.append(e);
    return e;
  };
  const sectores = Array.from({ length: TOMAS }, () => elementoSvg('path', { class: 'sector sector-vacia' }));
  elementoSvg('path', { d: 'M0 -48 L-6 -58 L6 -58 Z', class: 'anillo-flecha' });
  const norte = elementoSvg('text', { class: 'anillo-norte' });
  norte.textContent = 'N';
  const cuentaDelCentro = elementoSvg('text', { class: 'anillo-cuenta', x: 0, y: 1 });

  const sesion = crearSesionDeCamara({
    raiz,
    prefijo,
    reporte,
    destino(orientacion) {
      const v = vuelta();
      const d = sectorParaLaFoto(v, orientacion.rumbo, textos);
      if (d.error) return d;
      const reemplazada = v.vigentes[d.sector];
      return { clave: d.sector, datos: { ...datos(d.sector), sector: d.sector, reemplaza: reemplazada ? reemplazada.huella : null } };
    },
    alCuadro(orientacion) {
      const v = vuelta();
      const guia = guiaDeLaVuelta(v, orientacion.rumbo, textos);
      pintarAnillo(v, guia, orientacion.rumbo);
      // Con una foto en revisión, el botón de tomar no está: la guía no puede decir "toma la foto".
      poner($('guia'), sesion.hayPendiente() ? PENDIENTE : guia.texto);
      if (silueta) pintarSilueta(guia);
    },
    avisos(orientacion) {
      const v = vuelta();
      const lista = [...avisos(orientacion, v, sesion.estado().gps)];
      const sinBrujula = v.conBrujula === false || (v.conBrujula === null && orientacion.rumbo === null && !orientacion.esperando);
      if (sinBrujula) lista.push({ texto: (sesion.permisoBrujula() === 'denied' ? 'No diste permiso para la brújula. ' : '') + textos.sinBrujula });
      return lista;
    },
    async alGuardar(foto, toma) {
      if (estado.porRepetir === toma.clave) estado.porRepetir = null;
      pintarTira();
      await alGuardar(foto, toma);
      if (vuelta().completa) {
        sesion.apagar();
        alCompletar();
      }
    },
    alApagarseSola,
    alRecargar: () => pintarTira(),
  });

  function pintarAnillo(v, guia, rumbo) {
    const dibujo = dibujoDelAnillo(v, guia, rumbo);
    dibujo.tomas.forEach((toma, i) => {
      sectores[i].setAttribute('d', caminoDelSector(toma.angulo));
      sectores[i].setAttribute('class', 'sector sector-' + toma.estado);
    });
    // La N se esconde bajo la flecha cuando el norte queda justo al frente.
    if (dibujo.norte === null || Math.abs(dibujo.norte) < 14) {
      norte.style.display = 'none';
    } else {
      const a = (dibujo.norte * Math.PI) / 180;
      norte.style.display = '';
      norte.setAttribute('x', (54 * Math.sin(a)).toFixed(1));
      norte.setAttribute('y', (-54 * Math.cos(a)).toFixed(1));
    }
    poner(cuentaDelCentro, `${v.cuantas}/${TOMAS}`);
    poner($('cuenta'), textoDeLaCuenta(v));
    const etiqueta = `Anillo de las ${TOMAS} tomas: ${textoDeLaCuenta(v)}`;
    if (anillo.getAttribute('aria-label') !== etiqueta) anillo.setAttribute('aria-label', etiqueta);
  }

  // La silueta de la toma donde está parada la persona, si está vacía. Cuando
  // la guía la manda a otro lado, no se muestra la del destino: desde donde
  // está no podría calzarla, y lo intentaría.
  function pintarSilueta(guia) {
    const img = $('silueta');
    const sector = guia.accion === 'tomar' || guia.accion === 'seguir' ? guia.sector : null;
    const url = sector === null || sesion.hayPendiente() ? null : silueta(sector);
    if (!url) {
      img.hidden = true;
      poner($('vista'), sector === null ? '' : `Foto ${sector + 1} de ${TOMAS} · ${nombreDeLaToma(sector)}`);
      return;
    }
    if (img.dataset.url !== url) {
      img.dataset.url = url;
      img.src = url;
    }
    img.hidden = false;
    poner($('vista'), `Foto ${sector + 1} de ${TOMAS} · ${nombreDeLaToma(sector)}`);
  }

  // --- La tira de las 8 tomas ----------------------------------------------

  function pintarTira() {
    const v = vuelta();
    $('tira').replaceChildren(
      ...v.vigentes.map((registro, sector) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'toma' + (sector === v.porRepetir ? ' toma-repetir' : '');
        if (!registro) {
          boton.textContent = String(sector + 1);
          boton.disabled = true;
          boton.setAttribute('aria-label', `Foto ${sector + 1}: falta`);
          return boton;
        }
        const img = document.createElement('img');
        img.src = reporte.fotoDe(registro).url;
        img.alt = '';
        boton.append(img);
        boton.setAttribute('aria-label', `${etiquetaDeLaFoto(registro, nombreDeLaToma)}. ${sector === v.porRepetir ? 'Toca para dejarla como está' : 'Toca para repetirla'}`);
        boton.addEventListener('click', () => {
          estado.porRepetir = estado.porRepetir === sector ? null : sector;
          sesion.reiniciarIntentos(sector);
          pintarTira();
        });
        return boton;
      }),
    );
  }

  return {
    // { ok } / { error } / { cancelada }, como la sesión.
    async encender(permiso) {
      const resultado = await sesion.encender(permiso);
      if (resultado.ok) pintarTira();
      return resultado;
    },
    apagar: () => sesion.apagar(),
    vuelta,
    // Repetir una toma desde la lista: cuenta como vacía hasta que llegue la nueva.
    repetir(sector) {
      estado.porRepetir = sector;
      sesion.reiniciarIntentos(sector);
    },
    olvidar() {
      estado.porRepetir = null;
    },
    sesion,
  };
}
