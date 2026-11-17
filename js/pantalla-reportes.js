// «Tus reportes» en pantalla: el renglón del inicio (el último reporte, si quedó a medias, con
// «Seguir») y la pantalla con todos. Qué se dice de cada uno está en reportes.js; volver a uno
// (guardar lo pendiente del de ahora y cambiar) lo hace app.js con `abrir(id, ir)`.
//
// El inicio pregunta primero si hay heridos: el renglón va debajo, nunca encima, y si la base del
// teléfono falla el inicio no muestra un error por esto (los pasos siguientes ya lo dicen).
//
// Lo que viene del reporte (nombres de vías del mapa) se pinta con textContent, nunca con innerHTML.
import { candidatosParaSeguir, cuandoDeLaFila, filaDelReporte, reportesConAlgo, textoDelEnlace, tituloDelRenglon } from './reportes.js';
import { detalle } from './reporte-en-curso.js';

const MARCAS = {
  vigente: ['Sellado', 'marca-sellado'],
  'sin-sellar': ['Sin sellar', 'marca-falta'],
  cambio: ['Cambió después de sellar', 'marca-falta'],
};

function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

function marca(texto, clase) {
  return elemento('span', `marca ${clase}`, texto);
}

// El botón de una fila: en un lector de pantalla dice de cuál reporte es.
function botonDe(fila, alTocar) {
  const boton = elemento('button', `boton boton-chico${fila.boton === 'Abrir' ? ' boton-claro' : ''}`, fila.boton);
  boton.type = 'button';
  boton.setAttribute('aria-label', `${fila.boton} el reporte de ${fila.dia}, ${fila.hora}`);
  boton.addEventListener('click', () => alTocar(fila, boton));
  return boton;
}

// Al tocar «Seguir» o «Abrir»: los botones se apagan mientras se cambia de reporte, y si falla se
// dice ahí mismo.
function alTocarCon(abrir, raiz, avisar) {
  return async (fila, boton) => {
    const botones = [...raiz.querySelectorAll('button')];
    for (const b of botones) b.disabled = true;
    const texto = boton.textContent;
    boton.textContent = 'Abriendo…';
    avisar('');
    try {
      await abrir(fila.id, fila.ir);
    } catch (error) {
      avisar(`No se pudo abrir ese reporte (${detalle(error)}).`);
    } finally {
      boton.textContent = texto;
      for (const b of botones) b.disabled = false;
    }
  };
}

// --- El renglón del inicio -------------------------------------------------------------------

export function iniciarRenglonDelInicio(raiz, { reporte, abrir, reloj = () => new Date() }) {
  const $ = (selector) => raiz.querySelector(selector);
  let turno = 0;
  const avisar = (texto) => {
    $('#inicio-reportes-error').textContent = texto;
    $('#inicio-reportes-error').hidden = !texto;
  };
  const alTocar = alTocarCon(abrir, raiz, avisar);

  async function entrar() {
    const mio = ++turno;
    let conAlgo;
    let fila = null;
    try {
      conAlgo = reportesConAlgo(await reporte.reportes());
      for (const r of candidatosParaSeguir(conAlgo)) {
        const f = await filaDelReporte({ reporte: r, registros: r.fotos ? await reporte.registrosDe(r.id, r.fotos) : [] }, { ahora: reloj() });
        if (f.sello !== 'vigente') {
          fila = f;
          break;
        }
      }
    } catch {
      if (mio === turno) raiz.hidden = true;
      return;
    }
    if (mio !== turno) return;
    avisar('');
    const renglon = $('#inicio-seguir');
    renglon.hidden = !fila;
    if (fila) {
      const titulo = elemento('strong', null, tituloDelRenglon(fila));
      if (fila.ejemplo) titulo.append(marca('Ejemplo', 'marca-ejemplo'));
      renglon.replaceChildren(titulo, elemento('span', 'que', fila.linea), botonDe(fila, alTocar));
    }
    $('#inicio-todos').textContent = textoDelEnlace(conAlgo.length);
    $('#inicio-todos').hidden = conAlgo.length === 0;
    raiz.hidden = conAlgo.length === 0;
  }

  function salir() {
    turno++;
  }

  return { entrar, salir };
}

// --- La pantalla con todos -------------------------------------------------------------------

export function iniciarPantallaReportes(raiz, { reporte, abrir, reloj = () => new Date() }) {
  const $ = (selector) => raiz.querySelector(selector);
  let turno = 0;
  const avisar = (texto) => {
    $('#reportes-error').textContent = texto;
    $('#reportes-error').hidden = !texto;
  };
  const alTocar = alTocarCon(abrir, raiz, avisar);

  function filaEnPantalla(fila) {
    const li = elemento('li', 'reporte-fila');
    const titulo = elemento('strong', null, cuandoDeLaFila(fila));
    if (fila.ejemplo) titulo.append(marca('Ejemplo', 'marca-ejemplo'));
    titulo.append(marca(...MARCAS[fila.sello]));
    li.append(titulo, elemento('span', 'que', fila.donde));
    li.append(fila.numero ? elemento('span', 'numero', fila.numero) : elemento('span', 'que', fila.linea));
    li.append(botonDe(fila, alTocar));
    return li;
  }

  async function entrar() {
    const mio = ++turno;
    avisar('');
    const lista = $('#reportes-lista');
    $('#reportes-estado').textContent = 'Buscando tus reportes en este teléfono…';
    $('#reportes-estado').hidden = false;
    lista.replaceChildren();
    // Cada fila sale apenas se sabe qué decir de ella: la primera vez, leer los registros recorre
    // las fotos grandes de cada reporte (reporte-en-curso.js, registrosDe), y con muchos reportes la
    // pantalla no puede quedarse en «Buscando…» hasta el último.
    let cuantas = 0;
    try {
      for (const r of reportesConAlgo(await reporte.reportes())) {
        const fila = await filaDelReporte({ reporte: r, registros: r.fotos ? await reporte.registrosDe(r.id, r.fotos) : [] }, { ahora: reloj() });
        if (mio !== turno) return;
        lista.append(filaEnPantalla(fila));
        cuantas++;
      }
    } catch (error) {
      if (mio !== turno) return;
      $('#reportes-estado').hidden = true;
      avisar(`No se pudieron leer ${cuantas ? 'todos ' : ''}los reportes de este teléfono (${detalle(error)}). Recarga la página.`);
      return;
    }
    if (mio !== turno) return;
    $('#reportes-estado').textContent = cuantas ? '' : 'Todavía no hay reportes guardados en este teléfono.';
    $('#reportes-estado').hidden = cuantas > 0;
  }

  function salir() {
    turno++;
  }

  return { entrar, salir };
}
