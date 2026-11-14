// La pantalla del paso 8: revisar lo que va en el reporte, sellarlo y sacarlo del teléfono (el PDF
// por la hoja de compartir del teléfono, el número y la huella por WhatsApp). La lógica está en
// enviar.js, sello.js y expediente.js; aquí van los botones.
//
// El PDF se arma ANTES de que la persona toque «Compartir»: Safari solo abre la hoja de compartir
// dentro del toque mismo, y armar el PDF (leer y revisar todas las fotos de la base) puede tardar
// más que eso. En cuanto el sello está vigente se prepara, y el botón se prende cuando está listo.
//
// Lo que viene del reporte (placas, nombres de vías del mapa) se pinta con textContent, nunca con
// innerHTML.
import { enlaceDeWhatsApp, impideSellar, nombreDelArchivo, revisionDelReporte, textoParaWhatsApp } from './enviar.js';
import { estadoDelSello, lugarParaElReporte, sellarReporte, textoDelCambio } from './sello.js';
import { adjuntoDeLaCadena, adjuntoDelContenido, armarExpediente } from './expediente.js';
import { pdfDelExpediente } from './expediente-pdf.js';
import { sha256Hex, textoCanonico, verificarCadena } from './evidencia.js';
import { fechaYHora } from './fechas.js';
import { numero } from './geo.js';
import { detalle } from './reporte-en-curso.js';

// `lugar()`: lo del paso 3 que sigue en la memoria (app.js, lugarDelChoque) o null.
export function iniciarPantallaEnviar(raiz, { reporte, lugar = () => null }) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = { sello: 'sin-sellar', pdf: null, turno: 0, turnoPdf: 0, sellando: false };
  let url = null;

  function avisarError(texto) {
    $('#enviar-error').textContent = texto;
    $('#enviar-error').hidden = !texto;
  }

  async function entrar() {
    avisarError('');
    const mio = ++estado.turno;
    let rep;
    try {
      rep = await reporte.cargar();
    } catch (error) {
      avisarError(`No se pudo abrir el reporte en este teléfono (${detalle(error)}). Recarga la página.`);
      return;
    }
    // Lo del paso 3 que sigue en la memoria se guarda en el reporte: es lo que el expediente dice
    // de la vía, la luz y el clima. Solo si cambió, para no mover la hora del reporte por nada.
    const l = lugar();
    if (l) {
      const nuevo = lugarParaElReporte(l);
      if (nuevo && textoCanonico(nuevo) !== textoCanonico(rep.lugar ?? null)) {
        try {
          rep = await reporte.guardarDatos({ lugar: nuevo });
        } catch {
          // Sin guardarlo, el expediente usa lo que ya tenía el reporte.
        }
      }
    }
    if (mio === estado.turno) await pintar();
  }

  function salir() {
    estado.turno++;
  }

  // --- Lo que va en el reporte ------------------------------------------------------------------

  function pintarLista(items) {
    const lista = $('#enviar-lista');
    lista.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement('li');
        li.className = 'revision-item';
        li.dataset.completo = String(item.completo);
        const marca = document.createElement('span');
        marca.className = 'revision-marca';
        marca.setAttribute('aria-hidden', 'true');
        marca.textContent = item.completo ? '✓' : '!';
        const texto = document.createElement('div');
        const titulo = document.createElement('strong');
        titulo.textContent = item.titulo;
        const det = document.createElement('span');
        det.textContent = item.detalle;
        texto.append(titulo, det);
        li.append(marca, texto);
        if (!item.completo) {
          const boton = document.createElement('button');
          boton.type = 'button';
          boton.className = 'boton boton-suave boton-chico';
          boton.dataset.ir = item.ir;
          boton.textContent = item.boton;
          li.append(boton);
        }
        return li;
      }),
    );
    const faltan = items.filter((i) => !i.completo).length;
    $('#enviar-resumen').textContent = faltan
      ? `${faltan === 1 ? 'Falta 1 cosa' : `Faltan ${faltan} cosas`}. Puedes sellarlo así y el expediente dirá qué faltó, o completarlo antes.`
      : 'Está todo. Revisa que sea lo que pasó y séllalo.';
  }

  // --- El sello ---------------------------------------------------------------------------------

  async function pintar() {
    const rep = reporte.reporte();
    const registros = reporte.registros();
    pintarLista(revisionDelReporte({ reporte: rep, registros }));
    $('#enviar-ejemplo').hidden = !(rep.lugar?.origen === 'ejemplo' || rep.croquis?.ejemplo);
    let e;
    try {
      e = await estadoDelSello({ reporte: rep, registros });
    } catch (error) {
      // Sin https no hay cómo calcular huellas (evidencia.js, SIN_CRIPTO).
      avisarError(error.message);
      return;
    }
    estado.sello = e.estado;
    $('#enviar-sin-sellar').hidden = e.estado !== 'sin-sellar';
    $('#enviar-cambio').hidden = e.estado !== 'cambio';
    $('#enviar-sellado').hidden = e.estado !== 'vigente';
    const impide = impideSellar({ registros });
    $('#enviar-impide').textContent = impide || '';
    $('#enviar-impide').hidden = !impide;
    $('#enviar-sellar').disabled = !!impide || estado.sellando;
    if (e.estado === 'cambio') {
      $('#enviar-cambio-texto').textContent = textoDelCambio(e.cambios);
      $('#enviar-numero-viejo').textContent = rep.sello.numero;
    }
    if (e.estado === 'vigente') {
      pintarSello(rep, registros.length);
      prepararPdf(e.texto);
    }
  }

  function pintarSello(rep, total) {
    const sello = rep.sello;
    $('#enviar-numero').textContent = sello.numero;
    $('#enviar-hora').textContent = `Sellado el ${fechaYHora(sello.hora)}`;
    // La huella en cuatro grupos de 16: se lee y se compara mejor que 64 letras seguidas.
    $('#enviar-huella').textContent = sello.huella.match(/.{1,16}/g).join(' ');
    $('#enviar-whatsapp').href = enlaceDeWhatsApp(textoParaWhatsApp({ reporte: rep, sello, totalDeFotos: total }));
  }

  async function sellar(boton) {
    if (estado.sellando) return;
    estado.sellando = true;
    avisarError('');
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Revisando las fotos…';
    try {
      // Antes de sellar, la cadena entera con los bytes de cada foto: no se sella una cadena rota.
      const revision = await reporte.revisarCadena();
      const impide = impideSellar({ registros: reporte.registros() }, revision);
      if (impide) {
        avisarError(impide);
        return;
      }
      boton.textContent = 'Sellando…';
      const { sello } = await sellarReporte({ reporte: reporte.reporte(), registros: reporte.registros() });
      await reporte.guardarDatos({ sello });
    } catch (error) {
      avisarError(`No se pudo sellar el reporte (${detalle(error)}). Vuelve a intentarlo.`);
    } finally {
      estado.sellando = false;
      boton.disabled = false;
      boton.textContent = texto;
    }
    await pintar();
    $('#enviar-sellado').scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  // --- El PDF -----------------------------------------------------------------------------------

  function pdfListo() {
    const { archivo } = estado.pdf;
    $('#enviar-compartir').disabled = false;
    $('#enviar-ver').href = url;
    $('#enviar-ver').hidden = false;
    $('#enviar-pdf-estado').textContent = `Listo: ${archivo.name}, ${numero(archivo.size / 1e6, 1)} MB.`;
  }

  async function prepararPdf(textoSellado) {
    const rep = reporte.reporte();
    const sello = rep.sello;
    if (estado.pdf?.huella === sello.huella) return pdfListo();
    const mio = ++estado.turnoPdf;
    $('#enviar-compartir').disabled = true;
    $('#enviar-ver').hidden = true;
    const registros = reporte.registros();
    try {
      // Las fotos, leídas una vez: con esos mismos bytes se revisa la cadena y se arma el PDF.
      const fotos = new Map();
      for (let i = 0; i < registros.length; i++) {
        $('#enviar-pdf-estado').textContent = `Preparando el expediente… foto ${i + 1} de ${registros.length}`;
        const blob = await reporte.blobDe(registros[i]);
        if (blob) fotos.set(registros[i].huella, new Uint8Array(await blob.arrayBuffer()));
      }
      const revision = await verificarCadena(registros, { huellaDeLaFoto: async (r) => (fotos.has(r.huella) ? sha256Hex(fotos.get(r.huella)) : 'sin foto') });
      if (mio !== estado.turnoPdf) return;
      const modelo = armarExpediente({ reporte: rep, registros, sello, revision });
      const bytes = pdfDelExpediente(modelo, {
        fotos,
        adjuntos: [
          { nombre: adjuntoDelContenido(sello.numero), bytes: textoSellado, tipo: 'application/json', descripcion: 'El texto exacto que se selló: su SHA-256 es la huella del reporte.' },
          { nombre: adjuntoDeLaCadena(sello.numero), bytes: JSON.stringify(registros, null, 2), tipo: 'application/json', descripcion: 'El registro sellado de cada foto, en el orden de la cadena.' },
        ],
      });
      const archivo = new File([bytes], nombreDelArchivo(sello), { type: 'application/pdf' });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(archivo);
      estado.pdf = { huella: sello.huella, archivo, revision };
      pdfListo();
    } catch (error) {
      if (mio === estado.turnoPdf) $('#enviar-pdf-estado').textContent = `No se pudo armar el PDF (${detalle(error)}). Sal de esta pantalla y vuelve a entrar.`;
    }
  }

  // La hoja de compartir del teléfono (WhatsApp, correo, Archivos…). Donde no la hay (un
  // computador), se descarga.
  async function compartir() {
    const pdf = estado.pdf;
    if (!pdf) return;
    const sello = reporte.reporte().sello;
    const datos = { files: [pdf.archivo], title: `Expediente del choque ${sello.numero}`, text: `Expediente del choque ${sello.numero}. Huella SHA-256: ${sello.huella}` };
    if (globalThis.navigator?.canShare?.(datos)) {
      try {
        await navigator.share(datos);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // la persona cerró la hoja
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = pdf.archivo.name;
    document.body.append(a);
    a.click();
    a.remove();
    $('#enviar-pdf-estado').textContent = `Se descargó ${pdf.archivo.name}. Adjúntalo donde lo vayas a enviar.`;
  }

  $('#enviar-sellar').addEventListener('click', (e) => sellar(e.currentTarget));
  $('#enviar-resellar').addEventListener('click', (e) => sellar(e.currentTarget));
  $('#enviar-compartir').addEventListener('click', compartir);

  return { entrar, salir, estado: () => estado, pdf: () => estado.pdf };
}
