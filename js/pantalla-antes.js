// La pantalla «Antes de mover los carros» (paso 2): las dos preguntas, lo que dice la ley con cada
// respuesta y el botón para seguir. Qué se pregunta y qué se dice está en antes.js.
//
// Lo que dice la ley sale aunque la base del teléfono falle: la persona está en la calle decidiendo
// si mueve el carro. Guardar la respuesta es lo segundo.
import { PREGUNTAS, avisoDeAntes, conRespuesta, respuestasDeAntes } from './antes.js';
import { detalle } from './reporte-en-curso.js';

function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

// `preparar({ choqueNuevo })`: app.js. Deja en curso el reporte de este choque y lo devuelve; si el
// que estaba no sirve para un choque nuevo (sellado, de otro día, el ejemplo), empieza otro.
export function iniciarPantallaAntes(raiz, { reporte, preparar, reloj = () => new Date() }) {
  const $ = (selector) => raiz.querySelector(selector);
  let respuestas = null;
  let turno = 0;
  // Mientras se abre la base no hay dónde guardar: lo que la persona alcance a tocar espera aquí.
  let preparando = false;
  let temprana = null;
  // El guardado en curso: app.js lo espera antes de cambiar de reporte. NO incluye la preparación,
  // que puede cambiar de reporte ella misma y se quedaría esperándose.
  let guardando = Promise.resolve();

  const botones = new Map();
  const avisos = new Map();
  for (const p of PREGUNTAS) {
    const caja = elemento('div', 'pregunta');
    const grupo = elemento('div', 'alternativas');
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', p.texto);
    for (const o of p.opciones) {
      const boton = elemento('button', `alternativa${o.atencion ? ' alternativa-atencion' : ''}`, o.texto);
      boton.type = 'button';
      boton.addEventListener('click', () => responder(p.clave, o.valor));
      botones.set(`${p.clave}:${o.valor}`, boton);
      grupo.append(boton);
    }
    caja.append(elemento('p', null, p.texto), grupo);
    const aviso = elemento('div', 'aviso-ley');
    // Se lee solo al aparecer: quien usa un lector de pantalla no lo vería llegar.
    aviso.setAttribute('role', 'status');
    aviso.hidden = true;
    avisos.set(p.clave, aviso);
    $('#antes-preguntas').append(caja, aviso);
  }

  function avisarError(texto) {
    $('#antes-error').textContent = texto;
    $('#antes-error').hidden = !texto;
  }

  function pintar() {
    for (const [llave, boton] of botones) {
      const [clave, valor] = llave.split(':');
      boton.setAttribute('aria-pressed', String(respuestas?.[clave] === valor));
    }
    const a = avisoDeAntes(respuestas);
    for (const [clave, caja] of avisos) {
      const va = a?.tras === clave;
      caja.hidden = !va;
      if (!va) {
        caja.replaceChildren();
        continue;
      }
      caja.dataset.tono = a.tono;
      const partes = [elemento('strong', null, a.titulo), elemento('p', null, a.texto)];
      if (a.llamar) {
        const llamar = elemento('a', 'boton boton-chico boton-peligro', 'Llamar al 123');
        llamar.href = 'tel:123';
        partes.push(llamar);
      }
      partes.push(elemento('span', 'articulo', a.articulos));
      caja.replaceChildren(...partes);
    }
  }

  function guardar(estas) {
    const id = reporte.reporte()?.id;
    guardando = guardando
      // Si mientras tanto se cambió de reporte, esto era del otro.
      .then(() => (reporte.reporte()?.id === id ? reporte.guardarDatos({ antes: estas }) : null))
      .then(() => avisarError(''))
      .catch((error) => avisarError(`No se pudo guardar tu respuesta en el teléfono (${detalle(error)}). Puedes seguir.`));
  }

  function responder(clave, valor) {
    respuestas = conRespuesta(respuestas, clave, valor, reloj());
    pintar();
    if (preparando) temprana = respuestas;
    else if (reporte.reporte()) guardar(respuestas);
  }

  async function entrar({ desde = null } = {}) {
    const mio = ++turno;
    avisarError('');
    const aEnviar = desde === 'enviar';
    $('#antes-seguir').textContent = aEnviar ? 'Volver al reporte' : 'Seguir: dónde fue';
    $('#antes-seguir').dataset.ir = aEnviar ? 'enviar' : 'donde';
    $('#antes-volver').dataset.ir = aEnviar ? 'enviar' : 'a-salvo';
    preparando = true;
    temprana = null;
    pintar();
    let rep = null;
    try {
      rep = await preparar({ choqueNuevo: desde === 'a-salvo' });
    } catch (error) {
      if (mio === turno) avisarError(`No se pudo abrir el reporte en este teléfono (${detalle(error)}). Lo de abajo sirve igual; recarga la página para que quede guardado.`);
      return;
    } finally {
      preparando = false;
    }
    if (reporte.reporte()?.id !== rep.id) return;
    const guardadas = respuestasDeAntes(rep.antes);
    if (temprana) {
      // Lo que tocó mientras se abría vale sobre lo guardado, aunque ya haya seguido a otra pantalla.
      respuestas = { ...(guardadas ?? {}), ...temprana };
      temprana = null;
      guardar(respuestas);
    } else {
      respuestas = guardadas;
    }
    if (mio === turno) pintar();
  }

  function salir() {
    turno++;
  }

  // Al cambiar de reporte: lo respondido era del otro. Mientras se prepara no se borra lo que la
  // persona acaba de tocar: es de este choque.
  function olvidar() {
    if (!preparando) respuestas = null;
  }

  return { entrar, salir, olvidar, pendiente: () => guardando, estado: () => ({ respuestas, preparando }) };
}
