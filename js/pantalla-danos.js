// La pantalla "Los daños" (paso 6): en el carro 3D se toca la pieza dañada,
// se elige qué le pasó (rayón, abolladura, roto o suelto) y se toma una foto
// de cerca. Una pieza marcada se pinta del color de su tipo de daño.
//
// Dos vistas: el carro (el 3D, la hoja de la pieza y la lista de lo marcado)
// y la cámara de la foto de cerca, que es la misma sesión de la escena y los
// carros (sesion-de-camara.js) sin anillo ni guía de vuelta, y con una
// revisión que no castiga mirar hacia abajo (danos.js).
//
// El 3D (visor-danos.js, con Three.js) se baja al entrar a este paso. Si el
// navegador no puede mostrarlo, las piezas se eligen de una lista, que además
// está siempre a mano para quien no puede tocar un 3D.
import { pedirPermisoBrujula } from './brujula.js';
import { carroDe, carrosDelReporte, nombreDelCarro } from './carros.js';
import { nombreDePiezaEn, normalizarCarroceria } from './carrocerias.js';
import {
  PIEZAS_CON_DANO,
  TIPOS_DE_DANO,
  TIPO_POR_ID,
  coloresDelCarro,
  danoDe,
  filasDeDanos,
  fotosDeLosDanos,
  marcarDano,
  quitarDano,
  resumenDeDanos,
  revisarFotoDeCerca,
} from './danos.js';
import { detalle } from './reporte-en-curso.js';
import { crearSesionDeCamara } from './sesion-de-camara.js';

export function iniciarPantallaDanos(raiz, { reporte }) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = {
    activa: false,
    vista: 'carro',
    letra: 'A',
    // La pieza abierta en la hoja, y si la hoja muestra los tipos.
    elegida: null,
    eligiendoTipo: false,
    visor: null,
    abriendoVisor: null,
    // { letra, pieza, tipo } de la foto de cerca que se está tomando.
    tomando: null,
    cola: Promise.resolve(),
  };

  const carros = () => carrosDelReporte(reporte.reporte());
  const carroActual = () => carroDe(carros(), estado.letra) || carros()[0];
  const danos = () => (reporte.reporte() && reporte.reporte().danos) || [];
  const carroceria = () => normalizarCarroceria(carroActual().linea?.carroceria);
  const nombreDePieza = (pieza) => nombreDePiezaEn(carroceria(), pieza);

  // Los cambios van en fila y cada uno sale de lo último guardado.
  function cambiarDanos(cambio) {
    const hecho = estado.cola.then(() => reporte.guardarDatos({ danos: cambio(danos()) }));
    estado.cola = hecho.catch(() => {});
    return hecho;
  }

  const sesion = crearSesionDeCamara({
    raiz,
    prefijo: 'dano',
    reporte,
    revisar: (medida) => revisarFotoDeCerca(medida),
    destino() {
      const t = estado.tomando;
      if (!t) return { error: 'Elige primero la pieza.' };
      const anterior = fotosDeLosDanos(reporte.registros(), t.letra).get(t.pieza);
      return { clave: t.pieza, datos: { paso: 'danos', carro: t.letra, pieza: t.pieza, dano: t.tipo, reemplaza: anterior ? anterior.huella : null } };
    },
    async alGuardar() {
      sesion.apagar();
      volverAlCarro();
    },
    alApagarseSola: () => volverAlCarro(),
  });

  // --- Las vistas -----------------------------------------------------------

  function mostrarVista(nombre) {
    estado.vista = nombre;
    $('#danos-carro').hidden = nombre !== 'carro';
    $('#danos-camara').hidden = nombre !== 'camara';
    raiz.classList.toggle('con-camara', nombre === 'camara');
    window.scrollTo(0, 0);
  }

  function avisarError(texto) {
    const p = $('#danos-error');
    p.textContent = texto;
    p.hidden = !texto;
  }

  // --- El carro en 3D ---------------------------------------------------------

  async function abrirVisor() {
    if (estado.visor) return estado.visor;
    if (!estado.abriendoVisor) {
      estado.abriendoVisor = import('./visor-danos.js')
        .then(({ crearVisorDeDanos }) => crearVisorDeDanos($('#danos-lienzo'), { alTocar: elegirPieza }))
        .then((visor) => {
          estado.visor = visor;
          $('#danos-cargando').hidden = true;
          return visor;
        })
        .catch((error) => {
          // Sin 3D, las piezas se eligen de la lista: la pantalla lo dice.
          $('#danos-visor').hidden = true;
          $('#danos-vistas').hidden = true;
          $('#danos-ayuda').textContent = `No se pudo mostrar el carro en 3D (${detalle(error)}). Elige la pieza dañada de la lista.`;
          $('#danos-piezas-caja').open = true;
          return null;
        });
    }
    return estado.abriendoVisor;
  }

  function pintarCarro3d() {
    const visor = estado.visor;
    if (!visor) return;
    const carro = carroActual();
    visor.mostrarCarro({ carroceria: carroceria(), medidas: carro.linea?.medidas || null, placa: carro.placa.texto || '' });
    visor.pintar(coloresDelCarro(danos(), carro.letra), estado.elegida && !danoDe(danos(), carro.letra, estado.elegida) ? estado.elegida : null);
  }

  // --- Lo que se pinta ----------------------------------------------------------

  function pintarSelector() {
    const lista = carros();
    $('#danos-selector').replaceChildren(
      ...lista.map((carro) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.setAttribute('role', 'tab');
        boton.setAttribute('aria-selected', String(carro.letra === estado.letra));
        const marcadas = danos().filter((d) => d.carro === carro.letra).length;
        boton.textContent = nombreDelCarro(carro) + (marcadas ? ` (${marcadas})` : '');
        boton.addEventListener('click', () => {
          if (carro.letra === estado.letra) return;
          estado.letra = carro.letra;
          cerrarHoja();
          pintarTodo();
        });
        return boton;
      }),
    );
  }

  function pintarLeyenda() {
    $('#danos-leyenda').replaceChildren(
      ...TIPOS_DE_DANO.map((tipo) => {
        const li = document.createElement('li');
        const muestra = document.createElement('span');
        muestra.className = 'muestra';
        muestra.style.background = tipo.color;
        li.append(muestra, tipo.nombre);
        return li;
      }),
    );
  }

  function pintarPiezas() {
    $('#danos-piezas').replaceChildren(
      ...PIEZAS_CON_DANO.map((pieza) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        const marca = danoDe(danos(), estado.letra, pieza);
        boton.textContent = nombreDePieza(pieza) + (marca ? ` · ${TIPO_POR_ID.get(marca.tipo).nombre}` : '');
        if (marca) boton.style.borderColor = TIPO_POR_ID.get(marca.tipo).color;
        boton.addEventListener('click', () => elegirPieza(pieza));
        return boton;
      }),
    );
  }

  function pintarLista() {
    const filas = filasDeDanos(danos(), reporte.registros(), estado.letra, carroceria());
    $('#danos-resumen').textContent = resumenDeDanos(filas);
    $('#danos-lista').replaceChildren(
      ...filas.map((fila) => {
        const li = document.createElement('li');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'fila-dano';
        const muestra = document.createElement('span');
        muestra.className = 'muestra';
        muestra.style.background = fila.color;
        const texto = document.createElement('span');
        texto.className = 'fila-dano-texto';
        const nombre = document.createElement('strong');
        nombre.textContent = fila.nombre;
        const tipo = document.createElement('span');
        tipo.textContent = fila.nombreDelTipo + (fila.foto ? ' · con foto de cerca' : ' · falta la foto de cerca');
        texto.append(nombre, tipo);
        if (fila.fotoComoOtroTipo) {
          const otro = document.createElement('span');
          otro.className = 'problemas';
          otro.textContent = `La foto se tomó cuando decía «${fila.fotoComoOtroTipo}».`;
          texto.append(otro);
        }
        boton.append(muestra, texto);
        if (fila.foto) {
          const img = document.createElement('img');
          img.src = reporte.fotoDe(fila.foto).url;
          img.alt = '';
          boton.append(img);
        } else {
          boton.classList.add('sin-foto');
        }
        boton.addEventListener('click', () => elegirPieza(fila.pieza));
        li.append(boton);
        return li;
      }),
    );
  }

  function pintarTodo() {
    pintarSelector();
    pintarLista();
    pintarPiezas();
    pintarHoja();
    pintarCarro3d();
  }

  // --- La hoja de la pieza -------------------------------------------------------

  function elegirPieza(pieza) {
    if (!PIEZAS_CON_DANO.includes(pieza)) return;
    estado.elegida = pieza;
    estado.eligiendoTipo = !danoDe(danos(), estado.letra, pieza);
    pintarHoja();
    pintarCarro3d();
    $('#danos-hoja').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function cerrarHoja() {
    estado.elegida = null;
    estado.eligiendoTipo = false;
    pintarHoja();
    pintarCarro3d();
  }

  function pintarHoja() {
    const hoja = $('#danos-hoja');
    const pieza = estado.elegida;
    hoja.hidden = !pieza;
    if (!pieza) return;
    const marca = danoDe(danos(), estado.letra, pieza);
    const foto = fotosDeLosDanos(reporte.registros(), estado.letra).get(pieza);
    $('#danos-hoja-pieza').textContent = nombreDePieza(pieza);
    $('#danos-hoja-tipos').hidden = !estado.eligiendoTipo;
    $('#danos-hoja-foto').hidden = estado.eligiendoTipo || !marca;
    $('#danos-quitar').hidden = !marca;
    $('#danos-tipos').replaceChildren(
      ...TIPOS_DE_DANO.map((tipo) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'tipo-dano';
        boton.setAttribute('aria-pressed', String(marca?.tipo === tipo.id));
        const muestra = document.createElement('span');
        muestra.className = 'muestra';
        muestra.style.background = tipo.color;
        const texto = document.createElement('span');
        const nombre = document.createElement('strong');
        nombre.textContent = tipo.nombre;
        const ayuda = document.createElement('small');
        ayuda.textContent = tipo.ayuda;
        texto.append(nombre, ayuda);
        boton.append(muestra, texto);
        boton.addEventListener('click', () => marcar(pieza, tipo.id));
        return boton;
      }),
    );
    if (marca) {
      const tipo = TIPO_POR_ID.get(marca.tipo).nombre;
      $('#danos-hoja-foto-texto').textContent = foto ? `${tipo}, con su foto de cerca.` : `${tipo}. Ahora una foto de cerca del daño.`;
      $('#danos-tomar').textContent = foto ? 'Repetir la foto de cerca' : 'Tomar la foto de cerca';
      $('#danos-tomar').classList.toggle('boton-suave', !!foto);
    }
  }

  async function marcar(pieza, tipo) {
    const letra = estado.letra;
    try {
      await cambiarDanos((lista) => marcarDano(lista, { carro: letra, pieza, tipo, cuando: new Date() }));
    } catch (error) {
      avisarError(`No se pudo guardar la marca (${detalle(error)}).`);
      return;
    }
    estado.eligiendoTipo = false;
    pintarTodo();
  }

  // --- La foto de cerca ----------------------------------------------------------

  async function tomarFoto(permiso) {
    const marca = danoDe(danos(), estado.letra, estado.elegida);
    if (!marca) return;
    estado.tomando = { letra: estado.letra, pieza: marca.pieza, tipo: marca.tipo };
    $('#dano-que').textContent = `${nombreDelCarro(carroActual())} · ${nombreDePieza(marca.pieza)} · ${TIPO_POR_ID.get(marca.tipo).nombre}`;
    const boton = $('#danos-tomar');
    const textoAntes = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Abriendo la cámara…';
    avisarError('');
    const resultado = await sesion.encender(permiso);
    boton.disabled = false;
    boton.textContent = textoAntes;
    if (resultado.error) {
      avisarError(resultado.error);
      return;
    }
    if (!resultado.ok || !estado.activa) return;
    if (estado.visor) estado.visor.pausar();
    mostrarVista('camara');
  }

  function volverAlCarro() {
    estado.tomando = null;
    if (!estado.activa) return;
    mostrarVista('carro');
    if (estado.visor) estado.visor.reanudar();
    pintarTodo();
  }

  // --- Los botones ------------------------------------------------------------

  $('#danos-tomar').addEventListener('click', () => {
    // Lo primero, sin nada antes: el permiso de la brújula del iPhone (brujula.js).
    const permiso = pedirPermisoBrujula();
    tomarFoto(permiso);
  });
  $('#danos-cambiar-tipo').addEventListener('click', () => {
    estado.eligiendoTipo = true;
    pintarHoja();
  });
  $('#danos-quitar').addEventListener('click', async () => {
    const letra = estado.letra;
    const pieza = estado.elegida;
    const teniaFoto = fotosDeLosDanos(reporte.registros(), letra).has(pieza);
    try {
      await cambiarDanos((lista) => quitarDano(lista, letra, pieza));
    } catch (error) {
      avisarError(`No se pudo quitar la marca (${detalle(error)}).`);
      return;
    }
    cerrarHoja();
    pintarTodo();
    // La foto no se borra: la cadena no deja quitar una del medio sin romperse.
    if (teniaFoto) avisarError('Se quitó la marca. La foto de cerca que tenía se queda guardada con su huella: las fotos no se borran del reporte.');
  });
  $('#danos-cerrar').addEventListener('click', cerrarHoja);
  $('#dano-cancelar').addEventListener('click', () => {
    sesion.apagar();
    volverAlCarro();
  });
  $('#danos-vistas').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-vista]');
    if (boton && estado.visor) estado.visor.vista(boton.dataset.vista);
  });

  // --- Entrar y salir -------------------------------------------------------

  async function entrar() {
    estado.activa = true;
    if (sesion.encendida() || sesion.abriendo()) return;
    avisarError('');
    try {
      await reporte.cargar();
    } catch (error) {
      avisarError(`No se pudo abrir el lugar donde se guarda el reporte en este teléfono (${detalle(error)}).`);
      return;
    }
    if (!estado.activa) return;
    if (!carroDe(carros(), estado.letra)) estado.letra = carros()[0].letra;
    mostrarVista('carro');
    pintarLeyenda();
    pintarTodo();
    await abrirVisor();
    if (!estado.activa) return;
    if (estado.visor) estado.visor.reanudar();
    pintarCarro3d();
  }

  function salir() {
    estado.activa = false;
    sesion.apagar();
    if (estado.visor) estado.visor.pausar();
    estado.vista = 'carro';
  }

  // Al cambiar de reporte: la pieza abierta era del otro.
  function olvidar() {
    estado.letra = 'A';
    estado.elegida = null;
    estado.eligiendoTipo = false;
    estado.tomando = null;
  }

  // Lo que está en fila para guardarse: app.js lo espera antes de cambiar de reporte.
  const pendiente = () => estado.cola;

  return { entrar, salir, olvidar, pendiente, estado: () => estado, sesion: () => sesion };
}
