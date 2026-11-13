// La pantalla "La escena": la vuelta de 8 fotos con la brújula, antes de mover
// los carros.
//
// Tres vistas: el inicio (qué se va a hacer, y el botón que pide los permisos),
// la cámara (el visor, el anillo y el botón de la foto) y la lista (las 8 fotos
// y la revisión de la cadena de huellas).
//
// Lo que decide qué toma va dónde, qué dice la guía y si una foto sirve está en
// módulos puros con pruebas (escena.js, calidad.js, orientacion.js,
// evidencia.js). Aquí solo se conecta eso con la cámara, los sensores y la base.
//
// La cámara se apaga al salir de la pantalla, al terminar la vuelta y cuando la
// app pasa a segundo plano: encendida sin necesidad gasta batería y asusta (el
// punto verde del iPhone). Al volver, un toque la enciende otra vez.
import { reducirFoto } from './fotos.js';
import { abrirCamara, cuadroDeVideo, grisDe, lienzoABlob, mensajeDeLaCamara, soltarLienzo } from './camara.js';
import { escucharBrujula, pedirPermisoBrujula } from './brujula.js';
import { vigilarUbicacion } from './ubicacion.js';
import { LADO_DE_REVISION, NOMBRES_DE_PROBLEMAS, UMBRALES, medirFoto, nitidezEnVivo, revisarFoto, textoDeLaRevision } from './calidad.js';
import {
  TOMAS,
  caminoDelSector,
  dibujoDelAnillo,
  estadoDeLaVuelta,
  etiquetaDeLaFoto,
  guiaDeLaVuelta,
  sectorParaLaFoto,
  textoDeLaBrujula,
  textoDeLaCuenta,
  textoDeLaDistancia,
  textoDelGps,
} from './escena.js';
import { INICIO_DE_LA_CADENA, registroDeFoto, sellarRegistro, sha256Hex, textoDeLaCadena, verificarCadena } from './evidencia.js';
import { CADENA_CAMBIO, abrirBaseDelReporte } from './reporte-bd.js';

// Arriba y no junto a las funciones que las usan: una constante declarada
// después de la función que la usa dejó una pantalla muda en el taller.
const SVG = 'http://www.w3.org/2000/svg';
// Después de dos fotos rechazadas en la misma toma se ofrece usarla igual. De
// noche o con lluvia puede que ninguna pase, y la persona no puede quedarse
// atascada en la vía. La foto queda marcada y el expediente lo dice.
const INTENTOS_ANTES_DE_USARLA_ASI = 2;
// La revisión en vivo (la pastilla "Nítida"): cuatro veces por segundo basta.
const CADA_CUANTO_REVISAR_MS = 250;
const DURACION_DE_LA_ALERTA_MS = 4500;
const MINIATURA = 480;
// ?medir en la dirección pone los números de la revisión en la pastilla: para
// calibrar los umbrales con el primer celular de verdad (calidad.js).
const MEDIR = /[?&]medir\b/.test(globalThis.location?.search ?? '');
const SIN_BRUJULA = 'Sin brújula, la app no sabe hacia dónde apunta cada foto. Sigue igual: gira un octavo de vuelta entre una y otra (lo que va de las 12 a la 1 y media en un reloj).';
const SIN_GPS = {
  1: 'Sin permiso de ubicación: las fotos irán sin GPS.',
  2: 'El celular no encuentra señal de GPS: las fotos irán sin GPS hasta que la encuentre.',
  sinHttps: 'La ubicación solo funciona con https: las fotos irán sin GPS.',
  sinGeo: 'Este navegador no da la ubicación: las fotos irán sin GPS.',
};

const detalle = (error) => `${error?.name || 'Error'}: ${String(error?.message || '').slice(0, 120)}`;

export function iniciarPantallaEscena(raiz, { puntoDelChoque = () => null } = {}) {
  const $ = (selector) => raiz.querySelector(selector);
  const video = $('#escena-video');
  const estado = {
    activa: false,
    base: null,
    reporte: null,
    // { id, registro, miniatura, url }, en el orden de la cadena.
    fotos: [],
    porRepetir: null,
    intentos: new Array(TOMAS).fill(0),
    camara: null,
    abriendo: false,
    brujula: null,
    permisoBrujula: null,
    dejarGps: null,
    gps: null,
    errorGps: null,
    vivo: null,
    ultimaRevision: -Infinity,
    lienzoVivo: null,
    animacion: 0,
    // La foto que no pasó la revisión, esperando "Repetir" o "Usarla así".
    pendiente: null,
    ocupado: false,
    alertaHasta: 0,
    turnoCadena: 0,
  };

  // El anillo: 8 sectores, la flecha de "lo que tienes al frente", el norte y la cuenta.
  const anillo = $('#escena-anillo');
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

  // --- Lo que se lee de la base -------------------------------------------

  const registros = () => estado.fotos.map((f) => f.registro);
  const vuelta = () => estadoDeLaVuelta(registros(), { porRepetir: estado.porRepetir });
  const fotoDe = (registro) => estado.fotos.find((f) => f.registro === registro);

  function ponerFotos(fotos) {
    for (const f of estado.fotos) URL.revokeObjectURL(f.url);
    estado.fotos = fotos.map((f) => ({ ...f, url: URL.createObjectURL(f.miniatura) }));
  }

  async function cargar() {
    if (!estado.base) estado.base = await abrirBaseDelReporte();
    estado.reporte = await estado.base.reporteEnCurso();
    ponerFotos(await estado.base.fotos(estado.reporte.id));
  }

  // --- Las vistas -----------------------------------------------------------

  function mostrarVista(nombre) {
    for (const vista of ['inicio', 'camara', 'lista']) $('#escena-' + vista).hidden = vista !== nombre;
    // Con la cámara, el título se va: en un celular chico, cada línea es visor.
    raiz.classList.toggle('con-camara', nombre === 'camara');
    // Cada vista empieza arriba: la lista heredaba el desplazamiento de la
    // cámara y su primer renglón quedaba debajo de la barra.
    window.scrollTo(0, 0);
  }

  function avisarError(texto) {
    const p = $('#escena-error');
    p.textContent = texto;
    p.hidden = !texto;
  }

  function mostrarInicio() {
    const v = vuelta();
    const boton = $('#escena-empezar');
    boton.disabled = false;
    boton.textContent = v.cuantas > 0 ? `Seguir la vuelta (${textoDeLaCuenta(v)})` : 'Empezar la vuelta';
    mostrarVista('inicio');
  }

  // --- La cámara y los sensores --------------------------------------------

  async function encenderCamara(permiso) {
    if (estado.abriendo || estado.camara) return;
    estado.abriendo = true;
    const boton = $('#escena-empezar');
    const textoAntes = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Abriendo la cámara…';
    avisarError('');
    let camara;
    try {
      camara = await abrirCamara(video);
    } catch (error) {
      avisarError(mensajeDeLaCamara(error));
      return;
    } finally {
      estado.abriendo = false;
      boton.disabled = false;
      boton.textContent = textoAntes;
    }
    // Si mientras se abría la persona se fue de la pantalla o de la app, se
    // apaga: una cámara prendida sin nadie mirando es lo que no puede pasar.
    if (!estado.activa || document.hidden) {
      camara.detener();
      return;
    }
    estado.camara = camara;
    estado.permisoBrujula = await permiso;
    estado.brujula = escucharBrujula();
    estado.gps = null;
    estado.errorGps = null;
    estado.dejarGps = vigilarUbicacion({
      alLeer: (lectura) => {
        estado.gps = lectura;
        estado.errorGps = null;
      },
      alFallar: (codigo) => {
        estado.errorGps = codigo;
      },
    });
    estado.vivo = null;
    estado.ultimaRevision = -Infinity;
    mostrarVista('camara');
    pintarTira();
    estado.animacion = requestAnimationFrame(ciclo);
    // Sin await: si el navegador dice que no, todo sigue igual.
    estado.base.pedirQueNoSeBorren();
  }

  function apagarCamara() {
    cancelAnimationFrame(estado.animacion);
    estado.animacion = 0;
    if (estado.camara) estado.camara.detener();
    estado.camara = null;
    if (estado.brujula) estado.brujula.detener();
    estado.brujula = null;
    if (estado.dejarGps) estado.dejarGps();
    estado.dejarGps = null;
    soltarLienzo(estado.lienzoVivo);
    estado.lienzoVivo = null;
    descartarPendiente();
  }

  function leerOrientacion() {
    return estado.brujula ? estado.brujula.leer() : { rumbo: null, elevacion: null, giro: null, esperando: false };
  }

  // Lo que se pinta en cada cuadro: el anillo y la raya del horizonte siguen al
  // celular sin retraso; lo demás, cuatro veces por segundo.
  function ciclo(ahora) {
    estado.animacion = requestAnimationFrame(ciclo);
    const orientacion = leerOrientacion();
    const v = vuelta();
    const guia = guiaDeLaVuelta(v, orientacion.rumbo);
    pintarAnillo(v, guia, orientacion.rumbo);
    pintarHorizonte(orientacion);
    // Con una foto en revisión, el botón de tomar no está: la guía no puede decir "toma la foto".
    poner($('#escena-guia'), estado.pendiente ? 'Esa foto no pasó la revisión: mira arriba' : guia.texto);
    if (ahora - estado.ultimaRevision >= CADA_CUANTO_REVISAR_MS) {
      estado.ultimaRevision = ahora;
      revisarEnVivo();
      pintarPastillas(orientacion);
      pintarAvisos(orientacion, v);
      if (estado.alertaHasta && performance.now() > estado.alertaHasta) alertar('');
    }
  }

  // Solo si cambió: un aria-live que se reescribe sesenta veces por segundo
  // no deja hablar al lector de pantalla.
  function poner(elemento, texto) {
    if (elemento.textContent !== texto) elemento.textContent = texto;
  }

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
    poner($('#escena-cuenta'), textoDeLaCuenta(v));
    const etiqueta = `Anillo de las ${TOMAS} tomas: ${textoDeLaCuenta(v)}`;
    if (anillo.getAttribute('aria-label') !== etiqueta) anillo.setAttribute('aria-label', etiqueta);
  }

  function pintarHorizonte(orientacion) {
    const raya = $('#escena-horizonte');
    if (orientacion.giro === null) {
      raya.hidden = true;
      return;
    }
    raya.hidden = false;
    // El horizonte de verdad, visto en la pantalla de un celular girado θ a la
    // derecha, se ve girado θ a la izquierda: justo `giro` (orientacion.js).
    raya.style.transform = `rotate(${orientacion.giro.toFixed(1)}deg)`;
    raya.classList.toggle('torcida', Math.abs(orientacion.giro) > UMBRALES.giro);
  }

  function revisarEnVivo() {
    if (!video.videoWidth || estado.pendiente || estado.ocupado) return;
    try {
      if (!estado.lienzoVivo) estado.lienzoVivo = document.createElement('canvas');
      const { gris, ancho, alto } = grisDe(video, video.videoWidth, video.videoHeight, LADO_DE_REVISION, estado.lienzoVivo);
      estado.vivo = medirFoto(gris, ancho, alto);
    } catch {
      estado.vivo = null;
    }
  }

  function pintarPastilla(selector, { texto, estado: tono }) {
    const pastilla = $(selector);
    poner(pastilla, texto);
    pastilla.dataset.estado = tono;
  }

  function pintarPastillas(orientacion) {
    const nitidez = nitidezEnVivo(estado.vivo);
    if (MEDIR && estado.vivo) nitidez.texto += ` ${Math.round(estado.vivo.nitidez)}·${Math.round(estado.vivo.brillo)}`;
    pintarPastilla('#pastilla-nitidez', nitidez);
    pintarPastilla('#pastilla-gps', textoDelGps(estado.gps, estado.errorGps));
    pintarPastilla('#pastilla-brujula', textoDeLaBrujula(orientacion, { esperando: orientacion.esperando, permiso: estado.permisoBrujula }));
  }

  // Lo que la persona tiene que saber y no cabe en la guía: que está lejos del
  // punto, que no hay brújula o que las fotos van sin GPS.
  function pintarAvisos(orientacion, v) {
    const avisos = [];
    const distancia = textoDeLaDistancia(estado.gps, puntoDelChoque());
    if (distancia) avisos.push({ texto: distancia.texto, lejos: distancia.lejos });
    const sinBrujula = v.conBrujula === false || (v.conBrujula === null && orientacion.rumbo === null && !orientacion.esperando);
    if (sinBrujula) avisos.push({ texto: (estado.permisoBrujula === 'denied' ? 'No diste permiso para la brújula. ' : '') + SIN_BRUJULA });
    if (estado.errorGps !== null && SIN_GPS[estado.errorGps] && !estado.gps) avisos.push({ texto: SIN_GPS[estado.errorGps] });
    const caja = $('#escena-avisos');
    const clave = JSON.stringify(avisos);
    if (caja.dataset.clave === clave) return;
    caja.dataset.clave = clave;
    caja.replaceChildren(
      ...avisos.map((aviso) => {
        const p = document.createElement('p');
        p.textContent = aviso.texto;
        if (aviso.lejos) p.className = 'lejos';
        return p;
      }),
    );
  }

  function alertar(texto) {
    const p = $('#escena-alerta');
    p.textContent = texto;
    p.hidden = !texto;
    estado.alertaHasta = texto ? performance.now() + DURACION_DE_LA_ALERTA_MS : 0;
  }

  // --- La tira de las 8 tomas ----------------------------------------------

  function pintarTira() {
    const v = vuelta();
    $('#escena-tira').replaceChildren(
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
        img.src = fotoDe(registro).url;
        img.alt = '';
        boton.append(img);
        boton.setAttribute('aria-label', `${etiquetaDeLaFoto(registro)}. ${sector === v.porRepetir ? 'Toca para dejarla como está' : 'Toca para repetirla'}`);
        boton.addEventListener('click', () => {
          estado.porRepetir = estado.porRepetir === sector ? null : sector;
          estado.intentos[sector] = 0;
          pintarTira();
        });
        return boton;
      }),
    );
  }

  // --- Tomar la foto ----------------------------------------------------------

  function lecturaDelGps(hora) {
    if (!estado.gps) return null;
    return { ...estado.gps, edadS: Math.max(0, (hora.getTime() - estado.gps.hora.getTime()) / 1000) };
  }

  function destellar() {
    const visor = $('#escena-visor');
    visor.classList.remove('destello');
    void visor.offsetWidth; // para que la animación vuelva a empezar
    visor.classList.add('destello');
  }

  async function disparar() {
    if (estado.ocupado || estado.pendiente || !estado.camara) return;
    // Todo del mismo instante: la orientación y el cuadro, sin un await en el medio.
    const orientacion = leerOrientacion();
    const destino = sectorParaLaFoto(vuelta(), orientacion.rumbo);
    if (destino.error) {
      alertar(destino.error);
      return;
    }
    estado.ocupado = true;
    const boton = $('#escena-disparar');
    boton.disabled = true;
    let cuadro = null;
    try {
      cuadro = cuadroDeVideo(video);
      const hora = new Date();
      const gps = lecturaDelGps(hora);
      const { gris, ancho, alto } = grisDe(cuadro, cuadro.width, cuadro.height, LADO_DE_REVISION);
      const medida = medirFoto(gris, ancho, alto);
      const revision = revisarFoto({ ...medida, elevacion: orientacion.elevacion, giro: orientacion.giro });
      destellar();
      const blob = await lienzoABlob(cuadro);
      soltarLienzo(cuadro);
      cuadro = null;
      const toma = { blob, hora, gps, orientacion, sector: destino.sector, medida, revision };
      if (revision.ok) await aceptar(toma);
      else mostrarRevision(toma);
    } catch (error) {
      alertar(error.message || mensajeDeLaCamara(error));
    } finally {
      soltarLienzo(cuadro);
      estado.ocupado = false;
      boton.disabled = false;
    }
  }

  function mostrarRevision(toma) {
    estado.pendiente = { ...toma, url: URL.createObjectURL(toma.blob) };
    estado.intentos[toma.sector] += 1;
    $('#escena-revision-foto').src = estado.pendiente.url;
    $('#escena-revision-texto').textContent = textoDeLaRevision(toma.revision);
    $('#escena-usar-asi').hidden = estado.intentos[toma.sector] < INTENTOS_ANTES_DE_USARLA_ASI;
    $('#escena-revision').hidden = false;
    $('#escena-disparar').hidden = true;
  }

  function descartarPendiente() {
    if (estado.pendiente) URL.revokeObjectURL(estado.pendiente.url);
    estado.pendiente = null;
    $('#escena-revision').hidden = true;
    $('#escena-revision-foto').removeAttribute('src');
    $('#escena-disparar').hidden = false;
  }

  // Reducir, sellar y guardar. Si algo falla, la foto no entra y la cadena
  // queda como estaba: la persona la vuelve a tomar.
  async function aceptar(toma) {
    // Miniatura de 480 y no los 200 del taller: en la lista van dos fotos por
    // fila, unos 165 px de ancho que en un iPhone son 500 puntos de pantalla, y
    // a 200 se veían borrosas.
    const reducida = await reducirFoto(toma.blob, { ladoMiniatura: MINIATURA });
    const bytes = await reducida.foto.arrayBuffer();
    const v = vuelta();
    const anterior = estado.fotos[estado.fotos.length - 1];
    const reemplazada = v.vigentes[toma.sector];
    const registro = registroDeFoto({
      reporte: estado.reporte.id,
      paso: 'escena',
      indice: estado.fotos.length,
      sector: toma.sector,
      hora: toma.hora,
      gps: toma.gps,
      orientacion: toma.orientacion,
      calidad: { ...toma.medida, problemas: toma.revision.problemas },
      foto: { tipo: reducida.foto.type || 'image/jpeg', ancho: reducida.ancho, alto: reducida.alto, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) },
      reemplaza: reemplazada ? reemplazada.huella : null,
    });
    const sellado = await sellarRegistro(registro, anterior ? anterior.registro.huella : INICIO_DE_LA_CADENA);
    let id;
    try {
      id = await estado.base.agregarFoto(sellado, { foto: reducida.foto, miniatura: reducida.miniatura });
    } catch (error) {
      if (error.message === CADENA_CAMBIO) {
        ponerFotos(await estado.base.fotos(estado.reporte.id));
        pintarTira();
        throw error;
      }
      throw new Error(`No se pudo guardar la foto en el teléfono (${detalle(error)}). Vuelve a tomarla.`);
    }
    estado.fotos.push({ id, registro: sellado, miniatura: reducida.miniatura, url: URL.createObjectURL(reducida.miniatura) });
    if (estado.porRepetir === toma.sector) estado.porRepetir = null;
    estado.intentos[toma.sector] = 0;
    pintarTira();
    if (vuelta().completa) {
      apagarCamara();
      mostrarLista();
    }
  }

  // --- La lista: la vuelta completa ----------------------------------------

  function tarjetaDeFoto(registro) {
    const figura = document.createElement('figure');
    figura.className = 'foto-escena';
    const img = document.createElement('img');
    img.src = fotoDe(registro).url;
    img.alt = etiquetaDeLaFoto(registro);
    const pie = document.createElement('figcaption');
    pie.textContent = etiquetaDeLaFoto(registro);
    if (registro.calidad.aceptadaConProblemas) {
      const problemas = document.createElement('span');
      problemas.className = 'problemas';
      problemas.textContent = 'Aceptada así: ' + registro.calidad.problemas.map((p) => NOMBRES_DE_PROBLEMAS[p].toLowerCase()).join(', ');
      pie.append(problemas);
    }
    const repetir = document.createElement('button');
    repetir.type = 'button';
    repetir.className = 'boton boton-suave';
    repetir.textContent = 'Repetir';
    repetir.setAttribute('aria-label', `Repetir la foto ${registro.sector + 1}`);
    repetir.addEventListener('click', () => {
      // Primero, dentro del toque: el permiso de la brújula del iPhone.
      const permiso = pedirPermisoBrujula();
      estado.porRepetir = registro.sector;
      estado.intentos[registro.sector] = 0;
      encenderCamara(permiso);
    });
    figura.append(img, pie, repetir);
    return figura;
  }

  async function mostrarLista() {
    mostrarVista('lista');
    $('#escena-resumen').replaceChildren(...vuelta().vigentes.filter(Boolean).map(tarjetaDeFoto));
    const cadena = $('#escena-cadena');
    cadena.textContent = 'Revisando la cadena de huellas…';
    delete cadena.dataset.estado;
    const turno = ++estado.turnoCadena;
    let texto;
    let tono;
    try {
      const resultado = await verificarCadena(registros(), {
        huellaDeLaFoto: async (registro) => {
          const blob = await estado.base.foto(fotoDe(registro).id);
          return blob ? sha256Hex(await blob.arrayBuffer()) : 'sin foto';
        },
      });
      texto = textoDeLaCadena(resultado);
      tono = resultado.integra ? 'bien' : 'mal';
    } catch (error) {
      texto = `No se pudo revisar la cadena (${detalle(error)}).`;
      tono = 'mal';
    }
    if (turno !== estado.turnoCadena) return;
    cadena.textContent = texto;
    cadena.dataset.estado = tono;
  }

  // --- Los botones ----------------------------------------------------------

  $('#escena-empezar').addEventListener('click', () => {
    // Lo primero, sin nada antes: el permiso de la brújula del iPhone (brujula.js).
    const permiso = pedirPermisoBrujula();
    encenderCamara(permiso);
  });
  $('#escena-disparar').addEventListener('click', disparar);
  $('#escena-repetir').addEventListener('click', descartarPendiente);
  $('#escena-usar-asi').addEventListener('click', async () => {
    const toma = estado.pendiente;
    if (!toma || estado.ocupado) return;
    estado.ocupado = true;
    try {
      await aceptar(toma);
    } catch (error) {
      alertar(error.message);
    } finally {
      estado.ocupado = false;
      descartarPendiente();
    }
  });
  $('#escena-nuevo').addEventListener('click', async () => {
    try {
      estado.reporte = await estado.base.nuevoReporte();
    } catch (error) {
      avisarError(`No se pudo empezar otro reporte (${detalle(error)}).`);
      return;
    }
    ponerFotos([]);
    estado.porRepetir = null;
    estado.intentos.fill(0);
    mostrarInicio();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && estado.camara) {
      apagarCamara();
      mostrarInicio();
    }
  });

  // --- Entrar y salir -------------------------------------------------------

  async function entrar() {
    estado.activa = true;
    if (estado.camara || estado.abriendo) return;
    avisarError('');
    mostrarVista('inicio');
    $('#escena-empezar').disabled = true;
    try {
      await cargar();
    } catch (error) {
      avisarError(`No se pudo abrir el lugar donde se guardan las fotos en este teléfono (${detalle(error)}). Sin eso, este paso no se puede hacer: sáltalo.`);
      return;
    }
    if (!estado.activa) return;
    if (vuelta().completa) mostrarLista();
    else mostrarInicio();
  }

  function salir() {
    estado.activa = false;
    apagarCamara();
    alertar('');
  }

  return { entrar, salir, estado: () => estado };
}
