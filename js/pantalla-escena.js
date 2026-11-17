// La pantalla "La escena": la vuelta de 8 fotos con la brújula, antes de mover
// los carros.
//
// Tres vistas: el inicio (qué se va a hacer, y el botón que pide los permisos),
// la cámara (el visor, el anillo y el botón de la foto) y la lista (las 8 fotos
// y la revisión de la cadena de huellas).
//
// Lo que decide qué toma va dónde, qué dice la guía y si una foto sirve está en
// módulos puros con pruebas (escena.js, calidad.js, orientacion.js,
// evidencia.js). La cámara con sus sensores y la vuelta en pantalla son las
// mismas de los carros (sesion-de-camara.js y vuelta-en-pantalla.js); aquí
// queda lo propio de la escena: el inicio, la lista y el aviso de que la
// persona está lejos del punto que marcó.
import { pedirPermisoBrujula } from './brujula.js';
import { NOMBRES_DE_PROBLEMAS } from './calidad.js';
import { TEXTOS, esDeLaEscena, etiquetaDeLaFoto, textoDeLaCuenta, textoDeLaDistancia } from './escena.js';
import { textoDeLaCadena } from './evidencia.js';
import { detalle } from './reporte-en-curso.js';
import { crearVueltaEnPantalla } from './vuelta-en-pantalla.js';

// `empezarOtro`: app.js, que antes de cambiar de reporte termina de guardar lo pendiente y le hace
// olvidar a cada paso lo del anterior (el lugar del paso 3, sobre todo).
export function iniciarPantallaEscena(raiz, { reporte, puntoDelChoque = () => null, empezarOtro = () => reporte.nuevoReporte() }) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = { activa: false, turnoCadena: 0 };

  const vuelta = crearVueltaEnPantalla({
    raiz,
    prefijo: 'escena',
    reporte,
    filtro: () => esDeLaEscena,
    datos: () => ({ paso: 'escena' }),
    textos: TEXTOS,
    // Lo que la persona tiene que saber y no cabe en la guía: que está lejos del punto.
    avisos(orientacion, v, gps) {
      const distancia = textoDeLaDistancia(gps, puntoDelChoque());
      return distancia ? [{ texto: distancia.texto, lejos: distancia.lejos }] : [];
    },
    alCompletar: () => mostrarLista(),
    alApagarseSola: () => mostrarInicio(),
  });

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
    const v = vuelta.vuelta();
    const boton = $('#escena-empezar');
    boton.disabled = false;
    boton.textContent = v.cuantas > 0 ? `Seguir la vuelta (${textoDeLaCuenta(v)})` : 'Empezar la vuelta';
    mostrarVista('inicio');
  }

  async function encenderCamara(permiso) {
    const boton = $('#escena-empezar');
    if (boton.disabled && boton.textContent === 'Abriendo la cámara…') return;
    const textoAntes = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Abriendo la cámara…';
    avisarError('');
    const resultado = await vuelta.encender(permiso);
    boton.disabled = false;
    boton.textContent = textoAntes;
    if (resultado.error) avisarError(resultado.error);
    else if (resultado.ok && estado.activa) mostrarVista('camara');
  }

  // --- La lista: la vuelta completa ----------------------------------------

  function tarjetaDeFoto(registro) {
    const figura = document.createElement('figure');
    figura.className = 'foto-escena';
    const img = document.createElement('img');
    img.src = reporte.fotoDe(registro).url;
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
      vuelta.repetir(registro.sector);
      encenderCamara(permiso);
    });
    figura.append(img, pie, repetir);
    return figura;
  }

  async function mostrarLista() {
    mostrarVista('lista');
    $('#escena-resumen').replaceChildren(...vuelta.vuelta().vigentes.filter(Boolean).map(tarjetaDeFoto));
    const cadena = $('#escena-cadena');
    cadena.textContent = 'Revisando la cadena de huellas…';
    delete cadena.dataset.estado;
    const turno = ++estado.turnoCadena;
    let texto;
    let tono;
    try {
      const resultado = await reporte.revisarCadena();
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
  $('#escena-nuevo').addEventListener('click', async () => {
    try {
      await empezarOtro();
    } catch (error) {
      avisarError(`No se pudo empezar otro reporte (${detalle(error)}).`);
      return;
    }
    vuelta.olvidar();
    mostrarInicio();
  });

  // --- Entrar y salir -------------------------------------------------------

  async function entrar() {
    estado.activa = true;
    if (vuelta.sesion.encendida() || vuelta.sesion.abriendo()) return;
    avisarError('');
    mostrarVista('inicio');
    $('#escena-empezar').disabled = true;
    try {
      await reporte.cargar();
    } catch (error) {
      avisarError(`No se pudo abrir el lugar donde se guardan las fotos en este teléfono (${detalle(error)}). Sin eso, este paso no se puede hacer: sáltalo.`);
      return;
    }
    if (!estado.activa) return;
    if (vuelta.vuelta().completa) mostrarLista();
    else mostrarInicio();
  }

  function salir() {
    estado.activa = false;
    vuelta.apagar();
  }

  // Al cambiar de reporte: la foto que se iba a repetir era del otro.
  const olvidar = () => vuelta.olvidar();

  return { entrar, salir, olvidar, vuelta: () => vuelta };
}
