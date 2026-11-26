// La pantalla «Antes de mover: lo que se borra primero» (paso 4, E1, 26-nov-2026): la lista, la
// cámara con la guía de cada foto (en voz alta), la medida de la huella, quien lo vio y el final
// («Ya puedes mover los carros»). Qué se pide, en qué orden y qué se dice está en pruebas.js (puro,
// con pruebas); la cámara con sus sensores es la de siempre (sesion-de-camara.js); la voz, voz.js.
//
// La vuelta de 8 fotos es un renglón de la lista, pero se hace en su pantalla de siempre (#escena),
// que vuelve aquí.
//
// Lo que se anota (las respuestas, la medida, quien lo vio) se pinta primero y se guarda después, en
// fila: la persona está en la vía y no puede esperar a la base. Si guardar falla, se dice y se sigue.
import { crearSesionDeCamara, poner, revisarConInclinacion } from './sesion-de-camara.js';
import { revisarFotoDeCerca } from './danos.js';
import { pedirPermisoBrujula } from './brujula.js';
import {
  avisosParaMover,
  conMedida,
  conMovidos,
  conRespuesta,
  conSalto,
  conSinEscala,
  conTestigo,
  conTipo,
  estadoDeLasPruebas,
  guiaDeLaFoto,
  sinSalto,
  sinTestigo,
  textoDelFinal,
  TIPOS,
} from './pruebas.js';
import { crearVoz } from './voz.js';
import { detalle } from './reporte-en-curso.js';

// Mirando más abajo de esto, la foto es «desde arriba» (la pastilla se pone verde).
const DESDE_ARRIBA = -55;
const VISTAS = ['lista', 'camara', 'medida', 'testigos', 'final'];

function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

export function iniciarPantallaPruebas(raiz, { reporte, lugar = () => null, reloj = () => new Date(), voz = crearVoz() }) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = {
    activa: false,
    turno: 0,
    vista: 'lista',
    // Lo anotado, ya con el último cambio (lo que se pinta). Se guarda en fila (`cola`).
    local: null,
    cola: Promise.resolve(),
    // El renglón y la foto que se están tomando.
    renglon: null,
    foto: 0,
    // La guía de la foto que se está tomando, tal como se pintó. La cámara la lee en cada cuadro:
    // recalcular la lista sesenta veces por segundo no tiene sentido.
    guia: null,
    medidaComo: 'cinta',
  };

  const actual = () => estadoDeLasPruebas({ pruebas: estado.local, registros: reporte.registros(), lugar: lugar(), ahora: reloj() });
  const renglonActual = () => actual().renglones.find((r) => r.clave === estado.renglon) ?? null;
  const fotoActual = () => {
    const r = renglonActual();
    return r ? guiaDeLaFoto(r, estado.foto) : null;
  };

  function avisarError(texto) {
    $('#pruebas-error').textContent = texto;
    $('#pruebas-error').hidden = !texto;
  }

  // Pinta ya y guarda en fila. Cada guardado lleva todo lo anotado: el último que llega gana.
  function anotar(cambio) {
    try {
      estado.local = cambio(estado.local);
    } catch (error) {
      avisarError(error.message);
      return;
    }
    const id = reporte.reporte()?.id;
    const estas = estado.local;
    estado.cola = estado.cola
      .then(() => (id && reporte.reporte()?.id === id ? reporte.guardarDatos({ pruebas: estas }) : null))
      .then(() => avisarError(''))
      .catch((error) => avisarError(`No se pudo guardar en el teléfono (${detalle(error)}). Puedes seguir: lo de la pantalla vale.`));
  }

  // --- La cámara -----------------------------------------------------------------------------

  const sesion = crearSesionDeCamara({
    raiz,
    prefijo: 'prueba',
    reporte,
    camaraGrande: true,
    // Las de «desde arriba» miran al piso a propósito: no se rechazan por eso.
    revisar: (medida, orientacion) => (estado.guia?.desdeArriba ? revisarFotoDeCerca(medida) : revisarConInclinacion(medida, orientacion)),
    destino() {
      const r = renglonActual();
      const f = fotoActual();
      if (!r || !f) return { error: 'Elige primero qué foto vas a tomar.' };
      if (r.estado === 'declarado') return { error: 'Marcaste que no hay. Si sí hay, toca otra respuesta.' };
      const anterior = r.vigentes[estado.foto];
      return {
        clave: `${r.clave}:${estado.foto}`,
        datos: { paso: 'prueba', prueba: r.clave, sector: estado.foto, completa: !!f.completa, reemplaza: anterior ? anterior.huella : null },
      };
    },
    alCuadro(orientacion) {
      const f = estado.guia;
      const arriba = $('#prueba-pastilla-arriba');
      arriba.hidden = !f?.desdeArriba;
      if (f?.desdeArriba) {
        const bien = orientacion.elevacion !== null && orientacion.elevacion < DESDE_ARRIBA;
        poner(arriba, orientacion.elevacion === null ? 'Desde arriba' : bien ? 'Desde arriba' : 'Apunta al piso');
        arriba.dataset.estado = orientacion.elevacion === null ? 'neutro' : bien ? 'bien' : 'mal';
      }
    },
    async alGuardar() {
      const r = renglonActual();
      // Tomó una foto de un renglón que había saltado: ya no fue «no era seguro».
      if (r?.saltada) anotar((p) => sinSalto(p, r.clave, reloj()));
      siguienteFoto();
    },
    alApagarseSola: () => mostrarLista(),
  });

  // Después de cada foto: la siguiente que falte; si no falta ninguna, la medida (la huella) o la
  // lista.
  function siguienteFoto() {
    const r = renglonActual();
    if (!r) return mostrarLista();
    if (r.siguienteFoto !== null) {
      estado.foto = r.siguienteFoto;
      pintarCamara({ decir: true });
      return;
    }
    sesion.apagar();
    if (r.medible && !r.medida) mostrarMedida();
    else mostrarLista();
  }

  // --- Las vistas ----------------------------------------------------------------------------

  function mostrarVista(nombre) {
    estado.vista = nombre;
    for (const v of VISTAS) $('#pruebas-' + v).hidden = v !== nombre;
    raiz.classList.toggle('con-camara', nombre === 'camara');
    if (nombre !== 'camara') voz.callar();
    window.scrollTo(0, 0);
  }

  const SVG = 'http://www.w3.org/2000/svg';
  // La marca de la izquierda: el chulo de lo listo, el «!» de lo saltado, vacía para lo que falta.
  function marcaDe(r) {
    const marca = elemento('span', 'prueba-marca');
    marca.setAttribute('aria-hidden', 'true');
    if (r.listo) {
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      const trazo = document.createElementNS(SVG, 'path');
      trazo.setAttribute('d', 'M3.5 8.5l3 3 6-7');
      svg.append(trazo);
      marca.append(svg);
    } else if (r.estado === 'saltado') {
      marca.textContent = '!';
    }
    return marca;
  }
  const cuantasDe = (r) => {
    if (!r.total || r.estado === 'declarado' || r.estado === 'saltado') return '';
    if (r.estado === 'a-medias') return `${r.tomadas} de ${r.total}`;
    return r.total === 1 ? '1 foto' : `${r.total} fotos`;
  };

  function filaDe(r, { conBoton = false, ahora = false } = {}) {
    const li = elemento('li', `prueba-renglon estado-${r.estado}${ahora ? ' ahora' : ''}`);
    const boton = elemento('button', 'prueba-renglon-boton');
    boton.type = 'button';
    const texto = elemento('span', 'prueba-renglon-texto');
    texto.append(elemento('strong', null, r.titulo), elemento('small', null, r.estado === 'falta' ? r.porque : r.resumen));
    boton.append(marcaDe(r), texto, elemento('span', 'prueba-der', cuantasDe(r)));
    boton.addEventListener('click', () => abrir(r.clave));
    li.append(boton);
    if (conBoton && !r.listo) {
      const tomarla = elemento('button', 'boton boton-chico boton-suave', 'Tomarla');
      tomarla.type = 'button';
      tomarla.addEventListener('click', () => abrir(r.clave));
      li.append(tomarla);
    }
    return li;
  }

  function pintarLista() {
    const e = actual();
    poner($('#pruebas-cuenta'), `${e.hechos} de ${e.total}`);
    $('#pruebas-barra').style.width = `${Math.round((100 * e.hechos) / Math.max(1, e.total))}%`;
    const tipos = $('#pruebas-tipos');
    if (!tipos.children.length) {
      for (const t of TIPOS) {
        const b = elemento('button', 'alternativa', t.texto);
        b.type = 'button';
        b.dataset.valor = t.valor;
        b.addEventListener('click', () => {
          anotar((p) => conTipo(p, t.valor, reloj()));
          pintarLista();
        });
        tipos.append(b);
      }
    }
    for (const b of tipos.children) b.setAttribute('aria-pressed', String(e.tipo === b.dataset.valor));
    $('#pruebas-renglones').replaceChildren(...e.renglones.map((r) => filaDe(r, { ahora: r === e.siguiente })));
    const seguir = $('#pruebas-seguir');
    if (e.siguiente) {
      seguir.textContent = `${e.fotos || e.hechos ? 'Seguir' : 'Empezar'}: ${e.siguiente.corto}`;
      $('#pruebas-saltar').hidden = false;
    } else {
      seguir.textContent = 'Listo: ya puedes moverlos';
      $('#pruebas-saltar').hidden = true;
    }
  }

  function mostrarLista() {
    sesion.apagar();
    estado.renglon = null;
    pintarLista();
    mostrarVista('lista');
  }

  // Abrir un renglón: la cámara, la vuelta (su pantalla) o quien lo vio. Se llama dentro del toque:
  // el permiso de la brújula del iPhone y la primera frase de la voz lo necesitan.
  function abrir(clave) {
    const r = actual().renglones.find((x) => x.clave === clave);
    if (!r) return;
    if (r.pantalla === 'escena') {
      location.hash = 'escena';
      return;
    }
    estado.renglon = clave;
    if (r.pantalla === 'testigos') return mostrarTestigos();
    estado.foto = r.siguienteFoto ?? 0;
    const permiso = pedirPermisoBrujula();
    voz.olvidarLaUltima();
    mostrarVista('camara');
    pintarCamara({ decir: true });
    encender(permiso);
  }

  async function encender(permiso) {
    const boton = $('#prueba-disparar');
    boton.disabled = true;
    const resultado = await sesion.encender(permiso);
    boton.disabled = false;
    if (resultado.error) {
      avisarError(resultado.error);
      mostrarLista();
    }
  }

  function pintarCamara({ decir = false } = {}) {
    const r = renglonActual();
    const f = fotoActual();
    estado.guia = f;
    if (!r) return;
    poner($('#prueba-titulo'), r.titulo);
    poner($('#prueba-cuenta'), f ? f.cuenta : '');
    const despues = r.fotos[estado.foto + 1];
    poner($('#prueba-sigue'), despues ? `Sigue: ${despues.corto.toLowerCase()}` : '');
    const declarado = r.estado === 'declarado';
    poner($('#prueba-guia'), declarado ? 'Marcaste que no hay. Si sí hay, toca otra respuesta.' : f?.guia ?? '');
    $('#prueba-pastilla-completa').hidden = !f?.completa;
    $('#prueba-sin-escala').hidden = !f?.escala;
    $('#prueba-sin-escala').textContent = r.sinEscala ? 'Ya tengo con qué medir' : 'No tengo con qué medir';
    $('#prueba-velocidad').hidden = !r.medible;
    $('#prueba-disparar').hidden = declarado;
    pintarPregunta(r);
    pintarTira(r);
    pintarVoz();
    if (decir && f && !declarado) voz.decir(f.guia);
  }

  function pintarPregunta(r) {
    const caja = $('#prueba-pregunta');
    caja.hidden = !r.pregunta;
    if (!r.pregunta) return;
    poner($('#prueba-pregunta-texto'), r.pregunta.texto);
    const opciones = $('#prueba-opciones');
    if (opciones.dataset.renglon !== r.clave) {
      opciones.dataset.renglon = r.clave;
      opciones.replaceChildren(
        ...r.pregunta.opciones.map((o) => {
          const b = elemento('button', 'alternativa', o.texto);
          b.type = 'button';
          b.dataset.valor = o.valor;
          b.addEventListener('click', () => responder(r.clave, o));
          return b;
        }),
      );
    }
    for (const b of opciones.children) b.setAttribute('aria-pressed', String(r.respuesta === b.dataset.valor));
  }

  function responder(clave, opcion) {
    anotar((p) => conRespuesta(p, clave, opcion.valor, reloj()));
    // «No hay» cierra el renglón: no hay qué fotografiar.
    if (opcion.sinFotos) return mostrarLista();
    // La respuesta cambia la guía (con frenos ABS, la huella son rayitas): se dice otra vez.
    voz.olvidarLaUltima();
    pintarCamara({ decir: true });
  }

  function pintarTira(r) {
    $('#prueba-tira').replaceChildren(
      ...r.vigentes.map((registro, i) => {
        const b = elemento('button', 'toma' + (i === estado.foto ? ' toma-repetir' : ''));
        b.type = 'button';
        if (registro) {
          const img = document.createElement('img');
          img.src = reporte.fotoDe(registro).url;
          img.alt = '';
          b.append(img);
        } else {
          b.textContent = String(i + 1);
        }
        b.setAttribute('aria-label', `${r.fotos[i]?.corto ?? `Foto ${i + 1}`}: ${registro ? 'tomada, toca para repetirla' : 'falta'}`);
        b.addEventListener('click', () => {
          estado.foto = i;
          sesion.reiniciarIntentos(`${r.clave}:${i}`);
          voz.olvidarLaUltima();
          pintarCamara({ decir: true });
        });
        return b;
      }),
    );
  }

  function pintarVoz() {
    const b = $('#prueba-voz');
    b.hidden = !voz.disponible;
    b.setAttribute('aria-pressed', String(voz.encendida()));
    b.classList.toggle('callada', !voz.encendida());
    poner($('#prueba-voz-texto'), voz.encendida() ? 'Guía en voz alta: prendida' : 'Guía en voz alta: apagada');
  }

  // --- La medida de la huella ----------------------------------------------------------------

  function mostrarMedida() {
    const m = actual().renglones.find((r) => r.clave === 'huella')?.medida ?? null;
    estado.medidaComo = m?.como ?? 'cinta';
    $('#medida-valor').value = m ? String(m.valor).replace('.', ',') : '';
    $('#medida-desde').value = m?.desde ?? '';
    $('#medida-error').hidden = true;
    pintarMedida();
    mostrarVista('medida');
  }

  function pintarMedida() {
    $('#medida-cinta').setAttribute('aria-pressed', String(estado.medidaComo === 'cinta'));
    $('#medida-pasos').setAttribute('aria-pressed', String(estado.medidaComo === 'pasos'));
    poner($('#medida-unidad'), estado.medidaComo === 'cinta' ? 'Largo de la raya, en metros' : 'Largo de la raya, en pasos');
  }

  // --- Quien lo vio --------------------------------------------------------------------------

  function mostrarTestigos() {
    $('#testigo-error').hidden = true;
    pintarTestigos();
    mostrarVista('testigos');
  }

  function pintarTestigos() {
    const e = actual();
    $('#testigos-lista').replaceChildren(
      ...e.testigos.map((t, i) => {
        const li = elemento('li', 'testigo');
        li.append(elemento('span', null, `${t.nombre} · ${t.celular}`));
        const quitar = elemento('button', 'boton boton-chico boton-claro', 'Quitar');
        quitar.type = 'button';
        quitar.addEventListener('click', () => {
          anotar((p) => sinTestigo(p, i, reloj()));
          pintarTestigos();
        });
        li.append(quitar);
        return li;
      }),
    );
    $('#testigo-nadie').hidden = e.testigos.length > 0;
  }

  // --- El final ------------------------------------------------------------------------------

  function mostrarFinal() {
    sesion.apagar();
    const e = actual();
    const fraccion = e.hechos / Math.max(1, e.total);
    const largo = 2 * Math.PI * 42;
    const lleno = $('#final-lleno');
    lleno.setAttribute('stroke-dasharray', `${(largo * fraccion).toFixed(1)} ${largo.toFixed(1)}`);
    poner($('#final-numero'), String(e.hechos));
    poner($('#final-de'), `de ${e.total}`);
    $('#final-anillo').setAttribute('aria-label', `${e.hechos} de ${e.total} listos`);
    poner($('#final-texto'), textoDelFinal(e));
    $('#final-renglones').replaceChildren(...e.renglones.map((r) => filaDe(r, { conBoton: true })));
    $('#final-avisos').replaceChildren(
      ...avisosParaMover(reporte.reporte()?.antes).map((a) => {
        const caja = elemento('div', 'aviso-ley');
        caja.dataset.tono = a.tono;
        caja.append(elemento('p', null, a.texto), elemento('span', 'articulo', a.articulo));
        return caja;
      }),
    );
    mostrarVista('final');
  }

  // --- Los botones ---------------------------------------------------------------------------

  $('#pruebas-seguir').addEventListener('click', () => {
    const e = actual();
    if (e.siguiente) abrir(e.siguiente.clave);
    else mostrarFinal();
  });
  $('#pruebas-saltar').addEventListener('click', () => {
    const e = actual();
    if (!e.siguiente) return;
    anotar((p) => conSalto(p, e.siguiente.clave, reloj()));
    pintarLista();
  });
  $('#pruebas-ya').addEventListener('click', mostrarFinal);

  $('#prueba-volver').addEventListener('click', mostrarLista);
  $('#prueba-saltar').addEventListener('click', () => {
    const r = renglonActual();
    if (r) anotar((p) => conSalto(p, r.clave, reloj()));
    mostrarLista();
  });
  $('#prueba-sin-escala').addEventListener('click', () => {
    const r = renglonActual();
    if (!r) return;
    anotar((p) => conSinEscala(p, !r.sinEscala, reloj()));
    pintarCamara();
  });
  $('#prueba-voz').addEventListener('click', () => {
    const prendida = voz.alternar();
    pintarVoz();
    // Al prenderla, que diga ya lo que hay que hacer (este toque es el que iOS pide).
    if (prendida && fotoActual()) voz.decir(fotoActual().guia, { aunqueSeaLaMisma: true });
  });

  $('#medida-cinta').addEventListener('click', () => {
    estado.medidaComo = 'cinta';
    pintarMedida();
  });
  $('#medida-pasos').addEventListener('click', () => {
    estado.medidaComo = 'pasos';
    pintarMedida();
  });
  $('#medida-guardar').addEventListener('click', () => {
    const valor = Number($('#medida-valor').value.trim().replace(',', '.'));
    const medida = { valor, como: estado.medidaComo, desde: $('#medida-desde').value };
    try {
      // Que no sea un número que no se entiende se revisa antes de anotar: no hay nada que pintar.
      conMedida(null, medida);
    } catch {
      $('#medida-error').textContent = estado.medidaComo === 'cinta' ? 'Escribe el largo en metros, con números: por ejemplo 11,4.' : 'Escribe cuántos pasos, con números: por ejemplo 15.';
      $('#medida-error').hidden = false;
      return;
    }
    anotar((p) => conMedida(p, medida, reloj()));
    mostrarLista();
  });
  $('#medida-no').addEventListener('click', mostrarLista);

  $('#testigo-agregar').addEventListener('click', () => {
    const error = $('#testigo-error');
    const nombre = $('#testigo-nombre').value;
    const celular = $('#testigo-celular').value;
    if (!$('#testigo-acepta').checked) {
      error.textContent = 'Primero pregúntale si acepta quedar en el reporte, y marca la casilla.';
      error.hidden = false;
      return;
    }
    try {
      conTestigo(estado.local, { nombre, celular });
    } catch (e) {
      error.textContent = e.message === 'Falta el nombre o el celular' ? 'Falta el nombre o el celular.' : e.message + '.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    anotar((p) => conTestigo(p, { nombre, celular }, reloj()));
    $('#testigo-nombre').value = '';
    $('#testigo-celular').value = '';
    $('#testigo-acepta').checked = false;
    pintarTestigos();
  });
  $('#testigo-nadie').addEventListener('click', () => {
    anotar((p) => conRespuesta(p, 'testigos', 'nadie', reloj()));
    mostrarLista();
  });
  $('#testigo-volver').addEventListener('click', mostrarLista);

  $('#final-volver').addEventListener('click', mostrarLista);
  $('#final-movidos').addEventListener('click', () => {
    anotar((p) => conMovidos(p, reloj()));
    location.hash = 'carros';
  });

  // --- Entrar y salir ------------------------------------------------------------------------

  async function entrar() {
    const mio = ++estado.turno;
    estado.activa = true;
    avisarError('');
    mostrarLista();
    try {
      await reporte.cargar();
      // Lo que esté en fila primero: si no, se leería lo de antes del último cambio.
      await estado.cola;
    } catch (error) {
      if (mio === estado.turno) avisarError(`No se pudo abrir el reporte en este teléfono (${detalle(error)}). Sin eso, las fotos no se pueden guardar.`);
      return;
    }
    if (mio !== estado.turno || !estado.activa) return;
    estado.local = reporte.reporte()?.pruebas ?? null;
    pintarLista();
  }

  function salir() {
    estado.activa = false;
    estado.turno++;
    sesion.apagar();
    voz.callar();
  }

  // Al cambiar de reporte: lo anotado era del otro.
  function olvidar() {
    estado.local = null;
    estado.renglon = null;
  }

  return { entrar, salir, olvidar, pendiente: () => estado.cola, estado: () => ({ vista: estado.vista, renglon: estado.renglon, foto: estado.foto, local: estado.local }), actual, sesion };
}
