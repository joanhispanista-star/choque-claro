// La cámara en vivo con sus sensores, la revisión de cada foto y el guardado:
// lo que comparten la vuelta de la escena (paso 4), la vuelta a cada carro
// (paso 5) y las fotos de cerca de los daños (paso 6). Lo que cambia entre
// ellas lo pone quien la crea: a qué toma va la foto (`destino`), qué se pinta
// encima en cada cuadro (`alCuadro`) y qué se revisa (`revisar`).
//
// Los elementos se buscan por id con el prefijo de la pantalla
// (`escena-video`, `carro-video`, `dano-video`…). Los que una pantalla no
// tiene (la raya del horizonte en los daños, la pastilla de la brújula) se
// saltan.
//
// La cámara se apaga cuando la pantalla lo pide (al salir, al terminar) y
// cuando la app pasa a segundo plano: encendida sin necesidad gasta batería y
// asusta (el punto verde del iPhone). Al volver, un toque la enciende otra vez.
import { abrirCamara, cuadroDeVideo, grisDe, lienzoABlob, mensajeDeLaCamara, soltarLienzo } from './camara.js';
import { escucharBrujula } from './brujula.js';
import { vigilarUbicacion } from './ubicacion.js';
import { LADO_DE_REVISION, UMBRALES, medirFoto, nitidezEnVivo, revisarFoto, textoDeLaRevision } from './calidad.js';
import { textoDeLaBrujula, textoDelGps } from './escena.js';
import { CADENA_CAMBIO } from './reporte-bd.js';

// Después de dos fotos rechazadas en la misma toma se ofrece usarla igual. De
// noche o con lluvia puede que ninguna pase, y la persona no puede quedarse
// atascada en la vía. La foto queda marcada y el expediente lo dice.
const INTENTOS_ANTES_DE_USARLA_ASI = 2;
// La revisión en vivo (la pastilla "Nítida"): cuatro veces por segundo basta.
const CADA_CUANTO_REVISAR_MS = 250;
const DURACION_DE_LA_ALERTA_MS = 4500;
// ?medir en la dirección pone los números de la revisión en la pastilla: para
// calibrar los umbrales con el primer celular de verdad (calidad.js).
const MEDIR = /[?&]medir\b/.test(globalThis.location?.search ?? '');
const SIN_GPS = {
  1: 'Sin permiso de ubicación: las fotos irán sin GPS.',
  2: 'El celular no encuentra señal de GPS: las fotos irán sin GPS hasta que la encuentre.',
  sinHttps: 'La ubicación solo funciona con https: las fotos irán sin GPS.',
  sinGeo: 'Este navegador no da la ubicación: las fotos irán sin GPS.',
};

// La revisión de la escena y de los carros: borrosa, oscura, torcida, piso o cielo.
export const revisarConInclinacion = (medida, orientacion) => revisarFoto({ ...medida, elevacion: orientacion.elevacion, giro: orientacion.giro });

// Solo si cambió: un aria-live que se reescribe sesenta veces por segundo no
// deja hablar al lector de pantalla.
export function poner(elemento, texto) {
  if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
}

export function crearSesionDeCamara({
  raiz,
  prefijo,
  reporte,
  // (orientacion) => { clave, datos } o { error }. `clave`: la toma (para
  // contar los intentos); `datos`: lo que va al registro (reporte-en-curso.js).
  destino,
  revisar = revisarConInclinacion,
  // (orientacion, v) en cada cuadro, para el anillo, la guía o la silueta.
  alCuadro = () => {},
  // (orientacion) => [{ texto, lejos }], cuatro veces por segundo.
  avisos = () => [],
  // (foto, toma) después de guardar; la toma trae el Blob grande (la placa se lee de ahí).
  alGuardar = async () => {},
  // Cuando la cámara se apaga sola (la app pasó a segundo plano).
  alApagarseSola = () => {},
  // Después de que la cadena cambió por debajo y se recargó.
  alRecargar = () => {},
  // La cámara a 3840×2160 (camara.js): «Antes de mover», que guarda algunas fotos sin reducir.
  camaraGrande = false,
}) {
  const $ = (sufijo) => raiz.querySelector(`#${prefijo}-${sufijo}`);
  const video = $('video');
  const estado = {
    querida: false,
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
    intentos: new Map(),
  };

  function leerOrientacion() {
    return estado.brujula ? estado.brujula.leer() : { rumbo: null, elevacion: null, giro: null, esperando: false };
  }

  // { ok: true }, { error: texto } o { cancelada: true } si mientras se abría
  // la persona se fue de la pantalla o de la app.
  async function encender(permiso) {
    if (estado.abriendo || estado.camara) return { ok: !!estado.camara };
    estado.abriendo = true;
    estado.querida = true;
    let camara;
    try {
      camara = await abrirCamara(video, { grande: camaraGrande });
    } catch (error) {
      return { error: mensajeDeLaCamara(error) };
    } finally {
      estado.abriendo = false;
    }
    // Una cámara prendida sin nadie mirando es lo que no puede pasar.
    if (!estado.querida || document.hidden) {
      camara.detener();
      return { cancelada: true };
    }
    estado.camara = camara;
    estado.permisoBrujula = await permiso;
    if (!estado.querida) {
      apagar();
      return { cancelada: true };
    }
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
    estado.animacion = requestAnimationFrame(ciclo);
    reporte.pedirQueNoSeBorren();
    return { ok: true };
  }

  function apagar() {
    estado.querida = false;
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
    alertar('');
  }

  // Lo que se pinta en cada cuadro: lo de quien la creó y la raya del
  // horizonte siguen al celular sin retraso; lo demás, cuatro veces por segundo.
  function ciclo(ahora) {
    estado.animacion = requestAnimationFrame(ciclo);
    const orientacion = leerOrientacion();
    alCuadro(orientacion);
    pintarHorizonte(orientacion);
    if (ahora - estado.ultimaRevision >= CADA_CUANTO_REVISAR_MS) {
      estado.ultimaRevision = ahora;
      revisarEnVivo();
      pintarPastillas(orientacion);
      pintarAvisos(orientacion);
      if (estado.alertaHasta && performance.now() > estado.alertaHasta) alertar('');
    }
  }

  function pintarHorizonte(orientacion) {
    const raya = $('horizonte');
    if (!raya) return;
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

  function pintarPastilla(sufijo, { texto, estado: tono }) {
    const pastilla = $(sufijo);
    if (!pastilla) return;
    poner(pastilla, texto);
    pastilla.dataset.estado = tono;
  }

  function pintarPastillas(orientacion) {
    const nitidez = nitidezEnVivo(estado.vivo);
    if (MEDIR && estado.vivo) nitidez.texto += ` ${Math.round(estado.vivo.nitidez)}·${Math.round(estado.vivo.brillo)}`;
    pintarPastilla('pastilla-nitidez', nitidez);
    pintarPastilla('pastilla-gps', textoDelGps(estado.gps, estado.errorGps));
    pintarPastilla('pastilla-brujula', textoDeLaBrujula(orientacion, { esperando: orientacion.esperando, permiso: estado.permisoBrujula }));
  }

  // Lo que la persona tiene que saber y no cabe en la guía.
  function pintarAvisos(orientacion) {
    const caja = $('avisos');
    if (!caja) return;
    const lista = [...avisos(orientacion)];
    if (estado.errorGps !== null && SIN_GPS[estado.errorGps] && !estado.gps) lista.push({ texto: SIN_GPS[estado.errorGps] });
    const clave = JSON.stringify(lista);
    if (caja.dataset.clave === clave) return;
    caja.dataset.clave = clave;
    caja.replaceChildren(
      ...lista.map((aviso) => {
        const p = document.createElement('p');
        p.textContent = aviso.texto;
        if (aviso.lejos) p.className = 'lejos';
        return p;
      }),
    );
  }

  function alertar(texto) {
    const p = $('alerta');
    if (!p) return;
    p.textContent = texto;
    p.hidden = !texto;
    estado.alertaHasta = texto ? performance.now() + DURACION_DE_LA_ALERTA_MS : 0;
  }

  // --- Tomar la foto ----------------------------------------------------------

  function lecturaDelGps(hora) {
    if (!estado.gps) return null;
    return { ...estado.gps, edadS: Math.max(0, (hora.getTime() - estado.gps.hora.getTime()) / 1000) };
  }

  function destellar() {
    const visor = $('visor');
    visor.classList.remove('destello');
    void visor.offsetWidth; // para que la animación vuelva a empezar
    visor.classList.add('destello');
  }

  async function disparar() {
    if (estado.ocupado || estado.pendiente || !estado.camara) return;
    // Todo del mismo instante: la orientación y el cuadro, sin un await en el medio.
    const orientacion = leerOrientacion();
    const adonde = destino(orientacion);
    if (adonde.error) {
      alertar(adonde.error);
      return;
    }
    estado.ocupado = true;
    const boton = $('disparar');
    boton.disabled = true;
    let cuadro = null;
    try {
      cuadro = cuadroDeVideo(video);
      const hora = new Date();
      const gps = lecturaDelGps(hora);
      const { gris, ancho, alto } = grisDe(cuadro, cuadro.width, cuadro.height, LADO_DE_REVISION);
      const medida = medirFoto(gris, ancho, alto);
      const revision = revisar(medida, orientacion);
      destellar();
      const blob = await lienzoABlob(cuadro);
      soltarLienzo(cuadro);
      cuadro = null;
      const toma = { blob, hora, gps, orientacion, medida, revision, clave: adonde.clave, datos: adonde.datos };
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
    const intentos = (estado.intentos.get(toma.clave) || 0) + 1;
    estado.intentos.set(toma.clave, intentos);
    $('revision-foto').src = estado.pendiente.url;
    $('revision-texto').textContent = textoDeLaRevision(toma.revision);
    $('usar-asi').hidden = intentos < INTENTOS_ANTES_DE_USARLA_ASI;
    $('revision').hidden = false;
    $('disparar').hidden = true;
  }

  function descartarPendiente() {
    if (estado.pendiente) URL.revokeObjectURL(estado.pendiente.url);
    estado.pendiente = null;
    $('revision').hidden = true;
    $('revision-foto').removeAttribute('src');
    $('disparar').hidden = false;
  }

  async function aceptar(toma) {
    let foto;
    try {
      foto = await reporte.agregarFoto(toma, toma.datos);
    } catch (error) {
      if (error.message === CADENA_CAMBIO) alRecargar();
      throw error;
    }
    estado.intentos.delete(toma.clave);
    await alGuardar(foto, toma);
  }

  // --- Los botones ----------------------------------------------------------

  $('disparar').addEventListener('click', disparar);
  $('repetir').addEventListener('click', descartarPendiente);
  $('usar-asi').addEventListener('click', async () => {
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && estado.camara) {
      apagar();
      alApagarseSola();
    }
  });

  return {
    encender,
    apagar,
    alertar,
    leerOrientacion,
    encendida: () => !!estado.camara,
    abriendo: () => estado.abriendo,
    hayPendiente: () => !!estado.pendiente,
    permisoBrujula: () => estado.permisoBrujula,
    reiniciarIntentos: (clave) => estado.intentos.delete(clave),
    estado: () => estado,
  };
}
