// La pantalla "Los carros" (paso 5): una vuelta de 8 fotos alrededor de cada
// carro, la placa leída sola y, si se sabe, la marca y la línea.
//
// Tres vistas: la lista de los carros, un carro (sus fotos, su placa y su
// línea) y la cámara. La cámara con la vuelta es la misma de la escena
// (vuelta-en-pantalla.js), con la silueta del carro encima (siluetas-3d.js).
//
// La placa se lee de la foto del frente (o de la de atrás, si en el frente no
// salió) DESPUÉS de guardarla y sin detener la vuelta: la primera vez el
// teléfono baja el lector (17 MB, placa-ocr.js). Lo leído queda como propuesta
// hasta que la persona lo ve; en el taller, una X a 30° salió K.
//
// Lo que decide todo eso es puro y tiene pruebas (carros.js, escena.js).
import { pedirPermisoBrujula } from './brujula.js';
import { NOMBRES_DE_PROBLEMAS } from './calidad.js';
import { estadoDeLaVuelta, etiquetaDeLaFoto, textoDeLaCuenta } from './escena.js';
import {
  LETRAS,
  SECTOR_DEL_FRENTE,
  TEXTOS_DEL_CARRO,
  agregarCarro,
  cambiarCarro,
  cambiarPlaca,
  carroDe,
  carrosDelReporte,
  conLecturaDePlaca,
  conPlacaEscrita,
  confirmarPlacaLeida,
  debeLeerLaPlaca,
  esDelCarro,
  estadoDeLaPlaca,
  faltantesDeLaVuelta,
  nombreDeLaToma,
  nombreDelCarro,
  placaParaMostrar,
  quitarCarro,
  resumenDelCarro,
  sinPlaca,
  textoDeLaLinea,
  textoDeLasFaltantes,
} from './carros.js';
import { normalizarCarroceria, CARROCERIAS } from './carrocerias.js';
import { detalle } from './reporte-en-curso.js';
import { crearVueltaEnPantalla } from './vuelta-en-pantalla.js';

const SUGERENCIAS = 6;
const ESPERA_AL_ESCRIBIR_MS = 150;

export function iniciarPantallaCarros(raiz, { reporte }) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = {
    activa: false,
    vista: 'lista',
    letra: null,
    leyendo: new Set(),
    corrigiendo: false,
    // { clave, urls } de las siluetas del carro en la cámara.
    siluetas: null,
    cola: Promise.resolve(),
    turnoBusqueda: 0,
  };

  const carros = () => carrosDelReporte(reporte.reporte());
  const carroActual = () => carroDe(carros(), estado.letra);
  const vueltaDe = (letra) => estadoDeLaVuelta(reporte.registros(), { filtro: esDelCarro(letra) });

  // Los cambios a los carros van en fila: la placa se lee por detrás y puede
  // terminar mientras la persona escribe la línea. Cada cambio sale de lo
  // último guardado, no de una copia vieja.
  function cambiarCarros(cambio) {
    const hecho = estado.cola.then(async () => {
      const nuevos = cambio(carros());
      await reporte.guardarDatos({ carros: nuevos });
    });
    estado.cola = hecho.catch(() => {});
    return hecho;
  }
  const cambiarEste = (letra, cambio) => cambiarCarros((lista) => cambiarCarro(lista, letra, cambio));

  const vuelta = crearVueltaEnPantalla({
    raiz,
    prefijo: 'carro',
    reporte,
    filtro: () => esDelCarro(estado.letra),
    datos: () => ({ paso: 'carro', carro: estado.letra }),
    textos: TEXTOS_DEL_CARRO,
    nombreDeLaToma,
    silueta: (sector) => (estado.siluetas && estado.siluetas.urls ? estado.siluetas.urls[sector] : null),
    async alGuardar(foto, toma) {
      const carro = carroActual();
      if (carro && debeLeerLaPlaca(carro, foto.registro.sector)) leerPlaca(carro.letra, toma.blob, foto.registro);
    },
    alCompletar: () => mostrarCarro(),
    alApagarseSola: () => mostrarCarro(),
  });

  // --- Las vistas -----------------------------------------------------------

  function mostrarVista(nombre) {
    estado.vista = nombre;
    for (const vista of ['lista', 'carro', 'camara']) $('#carros-' + vista).hidden = vista !== nombre;
    raiz.classList.toggle('con-camara', nombre === 'camara');
    window.scrollTo(0, 0);
  }

  function avisarError(texto) {
    const p = $('#carros-error');
    p.textContent = texto;
    p.hidden = !texto;
  }

  // --- La lista ---------------------------------------------------------------

  function mostrarLista() {
    estado.letra = null;
    pintarLista();
    mostrarVista('lista');
  }

  function pintarLista() {
    const lista = carros();
    $('#carros-tarjetas').replaceChildren(
      ...lista.map((carro) => {
        const v = vueltaDe(carro.letra);
        const resumen = resumenDelCarro(carro, v);
        const tarjeta = document.createElement('article');
        tarjeta.className = 'tarjeta-carro' + (resumen.completa ? ' completa' : '');
        const frente = v.vigentes[SECTOR_DEL_FRENTE];
        const cara = document.createElement('div');
        cara.className = 'tarjeta-carro-foto';
        if (frente) {
          const img = document.createElement('img');
          img.src = reporte.fotoDe(frente).url;
          img.alt = '';
          cara.append(img);
        } else {
          cara.textContent = carro.letra;
        }
        const texto = document.createElement('div');
        const titulo = document.createElement('h2');
        titulo.textContent = resumen.titulo;
        texto.append(titulo, ...resumen.lineas.map((l) => Object.assign(document.createElement('p'), { textContent: l })));
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'boton boton-chico' + (resumen.boton === 'Ver' ? ' boton-suave' : '');
        boton.textContent = resumen.boton;
        boton.setAttribute('aria-label', `${resumen.boton}: ${resumen.titulo}`);
        boton.addEventListener('click', () => abrirCarro(carro.letra));
        tarjeta.append(cara, texto, boton);
        return tarjeta;
      }),
    );
    $('#carros-agregar').hidden = lista.length >= LETRAS.length;
  }

  // --- Un carro ------------------------------------------------------------------

  function abrirCarro(letra) {
    if (estado.letra !== letra) vuelta.olvidar();
    estado.letra = letra;
    estado.corrigiendo = false;
    $('#carro-placa-texto').value = '';
    avisoDePlaca('');
    $('#carro-linea-buscar').value = '';
    $('#carro-linea-sugerencias').replaceChildren();
    mostrarCarro();
  }

  function mostrarCarro() {
    const carro = carroActual();
    if (!carro) return mostrarLista();
    $('#carros-titulo').textContent = nombreDelCarro(carro);
    const v = vueltaDe(carro.letra);
    $('#carros-instrucciones').hidden = v.cuantas > 0;
    const boton = $('#carros-empezar');
    boton.hidden = v.completa;
    boton.disabled = false;
    boton.textContent = v.cuantas > 0 ? `Seguir la vuelta (${textoDeLaCuenta(v)})` : 'Empezar la vuelta';
    $('#carros-fotos').replaceChildren(...v.vigentes.filter(Boolean).map(tarjetaDeFoto));
    const faltantes = faltantesDeLaVuelta(v);
    const faltan = $('#carros-faltan');
    faltan.hidden = v.cuantas === 0 || v.completa;
    faltan.textContent = `Faltan: ${textoDeLasFaltantes(faltantes)}. Si no es seguro tomarlas (un lado que da a la vía), déjalas así: el reporte dirá cuáles faltan.`;
    $('#carros-quitar').hidden = carro.letra === 'A' || carro.letra === 'B' || v.cuantas > 0 || reporte.registros().some(esDelCarro(carro.letra));
    pintarPlaca();
    pintarLinea();
    mostrarVista('carro');
  }

  function tarjetaDeFoto(registro) {
    const figura = document.createElement('figure');
    figura.className = 'foto-escena';
    const img = document.createElement('img');
    img.src = reporte.fotoDe(registro).url;
    img.alt = etiquetaDeLaFoto(registro, nombreDeLaToma);
    const pie = document.createElement('figcaption');
    pie.textContent = etiquetaDeLaFoto(registro, nombreDeLaToma);
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

  // --- La cámara ------------------------------------------------------------------

  // Las siluetas se dibujan mientras la cámara abre; hasta que estén, el visor
  // dice qué lado va sin dibujo. Sin WebGL no hay silueta y la vuelta sigue.
  function prepararSiluetas(carro) {
    const linea = carro.linea;
    const datos = { carroceria: normalizarCarroceria(linea?.carroceria), medidas: linea?.medidas || null };
    const clave = JSON.stringify(datos);
    if (estado.siluetas && estado.siluetas.clave === clave) return;
    estado.siluetas = { clave, urls: null };
    import('./siluetas-3d.js')
      .then(({ siluetasDelCarro }) => siluetasDelCarro(datos))
      .then((urls) => {
        if (estado.siluetas && estado.siluetas.clave === clave) estado.siluetas.urls = urls;
      })
      .catch((error) => console.warn('Sin siluetas:', error));
  }

  async function encenderCamara(permiso) {
    const carro = carroActual();
    if (!carro) return;
    const boton = $('#carros-empezar');
    const textoAntes = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Abriendo la cámara…';
    avisarError('');
    prepararSiluetas(carro);
    $('#carro-quien').textContent = nombreDelCarro(carro);
    const resultado = await vuelta.encender(permiso);
    boton.disabled = false;
    boton.textContent = textoAntes;
    if (resultado.error) avisarError(resultado.error);
    else if (resultado.ok && estado.activa) mostrarVista('camara');
  }

  // --- La placa ---------------------------------------------------------------------

  async function leerPlaca(letra, blob, registro) {
    estado.leyendo.add(letra);
    pintarPlacaSiSeVe(letra);
    let resultado = null;
    let error = null;
    try {
      const { leerPlacaDelVideo } = await import('./lector-de-placa.js');
      resultado = await leerPlacaDelVideo(blob);
    } catch (e) {
      error = detalle(e);
      console.warn('No se pudo leer la placa:', e);
    }
    estado.leyendo.delete(letra);
    try {
      await cambiarEste(letra, (carro) => conLecturaDePlaca(carro, { registro, resultado, error, cuando: new Date() }));
    } catch (e) {
      console.warn('No se pudo guardar la lectura de la placa:', e);
    }
    pintarPlacaSiSeVe(letra);
  }

  function pintarPlacaSiSeVe(letra) {
    if (estado.vista === 'carro' && estado.letra === letra) pintarPlaca();
    if (estado.vista === 'lista') pintarLista();
  }

  function pintarPlaca() {
    const carro = carroActual();
    if (!carro) return;
    const e = estadoDeLaPlaca(carro, { leyendo: estado.leyendo.has(carro.letra) });
    $('#carro-placa-estado').textContent = e.detalle;
    $('#carro-placa-propuesta').hidden = e.tipo !== 'propuesta' || estado.corrigiendo;
    $('#carro-placa-leida').textContent = placaParaMostrar(e.texto);
    $('#carro-placa-lista').hidden = e.tipo !== 'lista';
    $('#carro-placa-lista-texto').textContent = placaParaMostrar(e.texto);
    $('#carro-placa-cambiar').hidden = !(e.tipo === 'lista' || e.tipo === 'sin-placa') || estado.corrigiendo;
    const formulario = $('#carro-placa-formulario');
    formulario.hidden = !(estado.corrigiendo || e.tipo === 'pendiente' || e.tipo === 'no-leida' || e.tipo === 'leyendo');
    const campo = $('#carro-placa-texto');
    if (e.sugerida && !campo.value) campo.value = e.sugerida;
    const ultimo = carro.placa.intentos[carro.placa.intentos.length - 1];
    $('#carro-placa-otra-vez').hidden = !(e.tipo === 'no-leida' && ultimo && ultimo.resultado === 'fallo');
  }

  function avisoDePlaca(texto) {
    const p = $('#carro-placa-aviso');
    p.textContent = texto || '';
    p.hidden = !texto;
  }

  // --- La línea -----------------------------------------------------------------------

  function pintarLinea() {
    const carro = carroActual();
    const elegida = $('#carro-linea-elegida');
    const linea = carro && carro.linea;
    elegida.hidden = !linea;
    $('#carro-linea-quitar').hidden = !linea;
    if (linea) elegida.textContent = `${textoDeLaLinea(linea)} · ${CARROCERIAS[normalizarCarroceria(linea.carroceria)].nombre}`;
    $('#carro-linea-campo').hidden = !!linea;
  }

  async function buscarLinea(texto) {
    const turno = ++estado.turnoBusqueda;
    const caja = $('#carro-linea-sugerencias');
    if (texto.trim().length < 2) {
      caja.replaceChildren();
      return;
    }
    let catalogo;
    try {
      catalogo = await import('./catalogo.js');
    } catch (error) {
      caja.replaceChildren(Object.assign(document.createElement('p'), { className: 'nota', textContent: `No se pudo abrir el catálogo (${detalle(error)}).` }));
      return;
    }
    if (turno !== estado.turnoBusqueda) return;
    const encontradas = catalogo.buscarLinea(texto, SUGERENCIAS);
    if (!encontradas.length) {
      caja.replaceChildren(Object.assign(document.createElement('p'), { className: 'nota', textContent: 'No está en el catálogo. Sigue sin ella: es opcional.' }));
      return;
    }
    caja.replaceChildren(
      ...encontradas.map((entrada) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'sugerencia';
        const nombre = document.createElement('strong');
        nombre.textContent = catalogo.nombreDeLinea(entrada);
        const datos = document.createElement('span');
        datos.textContent = [CARROCERIAS[normalizarCarroceria(entrada.carroceria)].nombre, entrada.anos].filter(Boolean).join(' · ');
        boton.append(nombre, datos);
        boton.addEventListener('click', async () => {
          const letra = estado.letra;
          try {
            await cambiarEste(letra, { linea: catalogo.datosDeEntrada(entrada) });
          } catch (error) {
            avisarError(`No se pudo guardar la línea (${detalle(error)}).`);
            return;
          }
          $('#carro-linea-buscar').value = '';
          caja.replaceChildren();
          if (estado.letra === letra) pintarLinea();
        });
        return boton;
      }),
    );
  }

  // --- Los botones ------------------------------------------------------------------

  $('#carros-agregar').addEventListener('click', async () => {
    try {
      await cambiarCarros(agregarCarro);
    } catch (error) {
      avisarError(`No se pudo agregar el carro (${detalle(error)}).`);
      return;
    }
    pintarLista();
  });
  $('#carros-empezar').addEventListener('click', () => {
    // Lo primero, sin nada antes: el permiso de la brújula del iPhone (brujula.js).
    const permiso = pedirPermisoBrujula();
    encenderCamara(permiso);
  });
  $('#carros-volver').addEventListener('click', () => mostrarLista());
  $('#carros-quitar').addEventListener('click', async () => {
    const letra = estado.letra;
    try {
      await cambiarCarros((lista) => quitarCarro(lista, letra));
    } catch (error) {
      avisarError(`No se pudo quitar el carro (${detalle(error)}).`);
      return;
    }
    mostrarLista();
  });
  $('#carro-terminar').addEventListener('click', () => {
    vuelta.apagar();
    mostrarCarro();
  });

  $('#carro-placa-si').addEventListener('click', async () => {
    await cambiarEste(estado.letra, confirmarPlacaLeida).catch((error) => avisarError(`No se pudo guardar la placa (${detalle(error)}).`));
    avisoDePlaca('');
    pintarPlaca();
  });
  $('#carro-placa-corregir').addEventListener('click', () => {
    estado.corrigiendo = true;
    const carro = carroActual();
    $('#carro-placa-texto').value = carro.placa.lectura ? carro.placa.lectura.texto : '';
    pintarPlaca();
    $('#carro-placa-texto').focus();
  });
  $('#carro-placa-cambiar').addEventListener('click', async () => {
    estado.corrigiendo = true;
    const carro = carroActual();
    $('#carro-placa-texto').value = carro.placa.texto;
    await cambiarEste(estado.letra, cambiarPlaca).catch(() => {});
    pintarPlaca();
    $('#carro-placa-texto').focus();
  });
  $('#carro-placa-formulario').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const letra = estado.letra;
    const { carro, aviso } = conPlacaEscrita(carroActual(), $('#carro-placa-texto').value);
    if (carro.placa.fuente !== 'escrita') {
      avisoDePlaca(aviso);
      return;
    }
    try {
      await cambiarEste(letra, () => carro);
    } catch (error) {
      avisarError(`No se pudo guardar la placa (${detalle(error)}).`);
      return;
    }
    estado.corrigiendo = false;
    avisoDePlaca(aviso);
    pintarPlaca();
  });
  $('#carro-sin-placa').addEventListener('click', async () => {
    await cambiarEste(estado.letra, sinPlaca).catch((error) => avisarError(`No se pudo guardar (${detalle(error)}).`));
    estado.corrigiendo = false;
    avisoDePlaca('');
    pintarPlaca();
  });
  $('#carro-placa-otra-vez').addEventListener('click', async () => {
    // Con la foto ya guardada (1280 px): la grande ya no está en memoria.
    const letra = estado.letra;
    const v = vueltaDe(letra);
    const registro = v.vigentes[SECTOR_DEL_FRENTE] || v.vigentes.find((r) => r && r.sector === 4);
    if (!registro) return;
    const blob = await reporte.blobDe(registro);
    if (blob) leerPlaca(letra, blob, registro);
  });

  let esperaBusqueda = 0;
  $('#carro-linea-buscar').addEventListener('input', (evento) => {
    clearTimeout(esperaBusqueda);
    esperaBusqueda = setTimeout(() => buscarLinea(evento.target.value), ESPERA_AL_ESCRIBIR_MS);
  });
  $('#carro-linea-quitar').addEventListener('click', async () => {
    await cambiarEste(estado.letra, { linea: null }).catch((error) => avisarError(`No se pudo quitar la línea (${detalle(error)}).`));
    pintarLinea();
  });

  // --- Entrar y salir -------------------------------------------------------

  async function entrar() {
    estado.activa = true;
    if (vuelta.sesion.encendida() || vuelta.sesion.abriendo()) return;
    avisarError('');
    try {
      await reporte.cargar();
    } catch (error) {
      avisarError(`No se pudo abrir el lugar donde se guardan las fotos en este teléfono (${detalle(error)}).`);
      return;
    }
    if (!estado.activa) return;
    if (estado.vista === 'carro' && carroActual()) mostrarCarro();
    else mostrarLista();
  }

  function salir() {
    estado.activa = false;
    vuelta.apagar();
    if (estado.vista === 'camara') estado.vista = 'carro';
  }

  return { entrar, salir, vuelta: () => vuelta, estado: () => estado };
}
