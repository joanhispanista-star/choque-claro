// La recreación en la página de la zona (zona-3d.html), sobre la maqueta abierta: los carros 3D
// (maqueta-carros.js) recorren el croquis (recreacion.js) con un botón de reproducir encima del
// mapa, una línea de tiempo para ir a cualquier momento, cámara lenta y tres cámaras: la que los
// muestra a todos y se va cerrando sobre el golpe, y la que sigue a cada carro.
//
// Solo en la maqueta abierta, no en el 3D de Google: las condiciones de Google no dejan guardar ni
// sacar su 3D, y la recreación es justo lo que más adelante tiene que salir en el expediente.
//
// Lo que se dice siempre, en el mapa mismo y no solo debajo: que no es una medición, y de quién es lo
// que se ve (lo declarado, un croquis sin terminar o el ejemplo inventado). Un pantallazo de la
// recreación no puede salir sin esa advertencia.
//
// Antes de reproducir, los carros están donde los puso el croquis, no al comienzo de su flecha: la
// zona muestra lo declarado, y el primer cuadro de la película (12 m más atrás) no lo es.
import { DURACION_MS, GOLPE_EN, avisosDeLaRecreacion, camaraQueSigue, encuadreDeLosCarros, fotograma, fotogramaDelCroquis, recreacionDelCroquis, selloDeLaRecreacion, textoDeLaFase } from './recreacion.js';
import { colorDeCarro } from './zona-3d.js';

const $ = (selector) => document.querySelector(selector);
const GRADO = Math.PI / 180;
// Cámara lenta: cuatro veces más despacio, para ver el golpe.
const LENTO = 4;
// Lo que tarda la cámara en llegar a su sitio al cambiar de cámara: sin esto saltaba de golpe y no
// se entendía desde dónde se estaba mirando.
const ENTRADA_MS = 900;
// Lo más que avanza la película entre dos cuadros. Al volver de otra app o de la pantalla bloqueada,
// Safari entrega en el primer cuadro todo el tiempo que estuvo fuera, y la película saltaba al final
// sin mostrar el golpe (revisión del 14-nov). Un cuarto de segundo: con un tope de 100 ms, en el Edge
// oculto del PC (de 5 a 10 cuadros por segundo) la película tardaba más de 11 s en vez de 9.
const SALTO_MAXIMO_MS = 250;
// La cámara que los muestra a todos: inclinada, y con el círculo del encuadre ocupando casi todo el
// ancho del mapa (los créditos y los botones se comen el resto).
const INCLINACION_DE_TODOS = 58;
const LLENO = 0.86;
// Lo más que deja inclinar MapLibre. La cámara que sigue a un carro cuesta arriba lo necesita.
const INCLINACION_MAXIMA = 85;
// De `a` hacia `b` por el lado corto, en grados.
const giro = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

// «Continuar» y no «Seguir»: en la misma pantalla, «Seguir a A» es la cámara que va detrás del carro.
const TEXTOS = { listo: 'Ver cómo fue', jugando: 'Pausar', pausa: 'Continuar', fin: 'Verlo otra vez' };
const PARA_LECTORES = { listo: 'Ver la recreación', jugando: 'Pausar la recreación', pausa: 'Continuar la recreación', fin: 'Ver la recreación otra vez' };

// El final de la frase de las piezas que se encienden. Si el color de un daño se parece al del carro,
// la maqueta lo pinta más claro (colorDeLaSenal, en maqueta-carros.js), y entonces la frase no puede
// decir a secas «con el color de su daño». Exportada para las pruebas.
export function aclaradoEn(letras = []) {
  if (!letras.length) return '.';
  const lista = letras.length === 1 ? letras[0] : `${letras.slice(0, -1).join(', ')} y ${letras.at(-1)}`;
  return letras.length === 1 ? `; en el carro ${lista} ese color va más claro, porque se parecía al del carro.` : `; en los carros ${lista} ese color va más claro, porque se parecía al de cada carro.`;
}

// Con «Reducir movimiento» encendido (Ajustes › Accesibilidad › Movimiento en el iPhone), la cámara
// no vuela ni se va cerrando sola: MapLibre lo respeta en sus animaciones, pero la película mueve la
// cámara con jumpTo en cada cuadro, y eso no pasa por su filtro.
const quiereMenosMovimiento = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// `camaraGeneral()`: la cámara de la zona en ese momento (la de la maqueta, con el análisis si llegó).
// Devuelve { soltar(), irA(), camara() } para que los botones de la zona le quiten la cámara a la
// película, o null si no hay nada que recrear, si falta algo de la página o si este teléfono no pudo
// dibujar los carros. En los tres casos no apagó nada: quedan las cajas de siempre.
// `alTomarLaCamara()`: se llama cada vez que la película se queda con la cámara, para que la zona
// deje de moverla por su cuenta (la vuelta, o el análisis de la vía que llega tarde).
// `croquis.hecho`: cuándo la persona dijo «Listo: así fue» en el paso 7, o null si no lo ha dicho.
export async function montarRecreacion({ mapa, croquis, sol, lineas = {}, danos = [], ejemplo = false, camaraGeneral, alTomarLaCamara = () => {} }) {
  const rec = recreacionDelCroquis(croquis);
  if (!rec) return null;
  // Lo de la página, antes de tocar el mapa. Si el 3D de Google se cayó ya dibujado, antes se llevaba
  // el sello y el botón de encima del mapa: la recreación reventaba a medias, con las cajas de los
  // carros ya apagadas y los carros 3D sin película (revisión del 14-nov).
  const seccion = $('#recreacion');
  const barra = $('#rec-barra');
  const boton = $('#rec-jugar');
  const enMapa = $('#rec-jugar-mapa');
  const textoEnMapa = $('#rec-jugar-mapa-texto');
  const sello = $('#sello-recreacion');
  const linea = $('#rec-tiempo');
  const lento = $('#rec-lento');
  const camaras = $('#rec-camaras');
  const fase = $('#rec-fase');
  const nota = $('#rec-nota');
  if (![seccion, barra, boton, enMapa, textoEnMapa, sello, linea, lento, camaras, fase, nota].every(Boolean)) {
    console.warn('Recreación: a la página le falta una parte; quedan las cajas de siempre.');
    return null;
  }

  let capa;
  try {
    const { capaDeLosCarros } = await import('./maqueta-carros.js');
    // Armar los dos carros nuevos y compilar sus sombreadores frena la página unos 300 ms en este PC
    // (con el carro del paso 6 eran 50). Con el mapa entrando al 3D, la entrada se congelaba y
    // saltaba: se espera a que la cámara se quede quieta, con un tope por si nunca para (la vuelta).
    if (mapa.isMoving()) await new Promise((listo) => { mapa.once('moveend', listo); setTimeout(listo, 2500); });
    capa = capaDeLosCarros({
      maplibregl: globalThis.maplibregl,
      origen: croquis.golpe,
      plano: rec.plano,
      carros: rec.carros.map((c) => ({ letra: c.letra, color: colorDeCarro(c.letra), carroceria: lineas[c.letra]?.carroceria || 'sedan', medidas: lineas[c.letra]?.medidas || { largo: c.largo, ancho: c.ancho } })),
      danos,
      sol,
    });
    // Encima de los puntos y debajo solo de la letra de cada carro: puesto antes, el punto del choque
    // y el golpe se pintaban encima del carro B (medido el 14-nov).
    mapa.addLayer(capa, mapa.getLayer('choque-carros-nombre') ? 'choque-carros-nombre' : undefined);
  } catch (error) {
    // Sin WebGL 2 (Three.js lo necesita) quedan las cajas de siempre, que ya estaban dibujadas.
    // MapLibre anota la capa ANTES de llamar a su onAdd: si onAdd revienta, la capa rota se queda en
    // el mapa sin dibujar nada. Se saca, para que nadie la dé por buena después.
    console.warn('Recreación:', error?.message ?? error);
    if (mapa.getLayer('choque-carros-3d')) mapa.removeLayer('choque-carros-3d');
    return null;
  }
  if (mapa.getLayer('choque-carros')) mapa.setLayoutProperty('choque-carros', 'visibility', 'none');
  // Con la vía cuesta arriba, la cámara que sigue a un carro mira casi al horizonte. Y de cerca pide
  // un poco más del zoom 22 de siempre: con ese tope quedaba más atrás de lo pedido.
  mapa.setMaxPitch(INCLINACION_MAXIMA);
  mapa.setMaxZoom(23);
  // Las letras de los carros van como marcadores del mapa (HTML), no en la capa de letreros de la
  // zona: esa capa se rehace en otro hilo y, con la película andando, las letras se quedaban varios
  // metros atrás de su carro (medido el 14-nov). Un marcador se mueve en el mismo cuadro.
  if (mapa.getLayer('choque-carros-nombre')) mapa.setLayoutProperty('choque-carros-nombre', 'visibility', 'none');
  const letras = new Map(
    rec.carros.map((c) => {
      const letrero = document.createElement('span');
      letrero.className = 'rec-letra';
      letrero.textContent = c.letra;
      letrero.setAttribute('aria-hidden', 'true');
      return [c.letra, new globalThis.maplibregl.Marker({ element: letrero, anchor: 'bottom', offset: [0, -12] }).setLngLat([croquis.golpe.lon, croquis.golpe.lat]).addTo(mapa)];
    }),
  );
  // Lo que se apaga cuando la cámara sigue a un carro: los puntos, que en la pantalla miden lo mismo
  // a 1 m que a 100 y tapaban la vía. (Las letras se esconden por CSS, con `siguiendo-carro`.)
  const SE_APAGAN = ['choque-precision', 'choque-precision-borde', 'choque-punto', 'choque-punto-texto', 'choque-golpe', 'choque-senales', 'choque-sol-texto'];
  // Cómo estaba cada una se anota al apagarlas, no al montar: la zona apaga el letrero «Choque»
  // cuando llega el análisis, y con lo anotado al montar aquí se le volvía a encender.
  let comoEstaban = null;
  const apagarLosPuntos = (apagar) => {
    if (apagar === !!comoEstaban) return;
    if (apagar) {
      comoEstaban = new Map(SE_APAGAN.filter((id) => mapa.getLayer(id)).map((id) => [id, mapa.getLayoutProperty(id, 'visibility') ?? 'visible']));
      for (const id of comoEstaban.keys()) mapa.setLayoutProperty(id, 'visibility', 'none');
    } else {
      for (const [id, visibilidad] of comoEstaban) if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', visibilidad);
      comoEstaban = null;
    }
  };

  sello.textContent = selloDeLaRecreacion({ ejemplo, hecho: !!croquis.hecho });
  sello.hidden = false;
  // Lo de abajo sale de lo que la película hace con ESTE croquis (recreacion.js): a la misma rapidez,
  // o quién tiene que ir más rápido para que se junten, y por qué algún carro no se mueve. Antes decía
  // siempre «todos llegan al golpe a la vez» y «no dice quién iba más rápido», también cuando una
  // flecha más larga hacía ver a un carro el doble de rápido (revisión del 14-nov).
  // Sin película (nadie se mueve) no hay «en movimiento» ni golpe que encienda las piezas.
  const conGolpe = !rec.nadaSeMueve && rec.hayGolpe;
  nota.textContent = [
    ejemplo ? 'Ejemplo inventado: los carros, sus flechas y sus daños no son de nadie.' : rec.nadaSeMueve ? 'Es el croquis del paso 7 en 3D, quieto.' : 'Es el croquis del paso 7 en movimiento: cada carro por su flecha.',
    ...avisosDeLaRecreacion(rec),
    danos.length && conGolpe ? (ejemplo ? 'En el golpe se encienden las piezas dañadas del ejemplo, cada una con el color de su daño' : 'En el golpe se encienden las piezas que se marcaron como dañadas en el paso 6, cada una con el color de su daño') + aclaradoEn(capa.aclarados) : '',
    'La maqueta no tiene árboles, barrancos ni carros parqueados: no dice qué alcanzaba a ver cada conductor.',
  ]
    .filter(Boolean)
    .join(' ');

  // `t` null: todavía no se ha reproducido, y se ve el croquis tal cual.
  let t = null;
  let jugando = false;
  let yaJugo = false;
  let ultimo = 0;
  let cuadro = 0;
  // 'libre' (la mueve la persona), 'todos' (los muestra a todos) o 'sigue' (detrás de `letra`).
  let modo = 'libre';
  let letra = null;
  // Si la persona ya escogió desde dónde mirar: entonces reproducir no le mueve la cámara.
  let eligioCamara = false;
  let rumboDeTodos = 0;
  // De dónde viene la cámara mientras llega a su sitio, o null si ya llegó.
  let entrada = null;
  let cuadroDeEntrada = 0;
  const menosMovimiento = quiereMenosMovimiento();
  // El momento de la película que corresponde a lo que se ve. Con el croquis quieto: el instante en
  // que la película pasa por él, o el golpe si la película no pasa por ahí (cuando uno tiene que ir
  // más rápido, ver recreacion.js).
  const momento = () => t ?? rec.tCroquis ?? GOLPE_EN;

  // Con menos movimiento, «Los carros» no se va cerrando: un solo encuadre donde cabe toda la
  // película, hecho con los de varios momentos.
  const encuadreFijo = (() => {
    const todos = [0, 0.2, 0.4, 0.6, GOLPE_EN].map((m) => encuadreDeLosCarros(rec, m));
    const centro = todos[0].centro;
    return { centro, radio: Math.max(...todos.map((e) => Math.hypot(e.centro.x - centro.x, e.centro.y - centro.y) + e.radio)) };
  })();

  // Adónde quiere ir la cámara en este momento de la película, o null si la mueve la persona.
  const camaraDelModo = () => {
    if (modo === 'todos') {
      const e = menosMovimiento ? encuadreFijo : encuadreDeLosCarros(rec, momento());
      const c = rec.plano.aGrados(e.centro);
      // Un píxel de MapLibre mide 78.271,5 × cos(latitud) / 2^zoom metros (teselas de 512).
      const metrosPorPixel = (2 * e.radio) / ((mapa.getContainer().clientWidth || 360) * LLENO);
      return { center: [c.lon, c.lat], zoom: Math.log2((78271.517 * Math.cos(c.lat * GRADO)) / metrosPorPixel), pitch: INCLINACION_DE_TODOS, bearing: rumboDeTodos };
    }
    if (modo === 'sigue') {
      const c = camaraQueSigue(rec, letra, momento());
      if (!c) return null;
      const desde = rec.plano.aGrados(c.desde);
      const hacia = rec.plano.aGrados(c.hacia);
      // Alturas relativas al centro de la pantalla (así las da MapLibre): solo importa la diferencia.
      const suelo = (p) => mapa.queryTerrainElevation([p.lon, p.lat]) ?? 0;
      const o = mapa.calculateCameraOptionsFromTo([desde.lon, desde.lat], suelo(desde) + c.desde.alto, [hacia.lon, hacia.lat], suelo(hacia) + c.hacia.alto);
      return { center: [o.center.lng, o.center.lat], zoom: o.zoom, pitch: Math.min(INCLINACION_MAXIMA, o.pitch), bearing: o.bearing };
    }
    return null;
  };

  const ponerCamara = (ahora = performance.now()) => {
    const objetivo = camaraDelModo();
    if (!objetivo) return;
    if (entrada) {
      const k = (ahora - entrada.t0) / ENTRADA_MS;
      if (k < 1) {
        const s = k <= 0 ? 0 : k * k * (3 - 2 * k);
        const entre = (a, b) => a + (b - a) * s;
        mapa.jumpTo({
          center: [entre(entrada.center[0], objetivo.center[0]), entre(entrada.center[1], objetivo.center[1])],
          zoom: entre(entrada.zoom, objetivo.zoom),
          pitch: entre(entrada.pitch, objetivo.pitch),
          bearing: entrada.bearing + giro(entrada.bearing, objetivo.bearing) * s,
        });
        return;
      }
      entrada = null;
    }
    mapa.jumpTo(objetivo);
  };
  // Con la película en pausa nadie pinta cada cuadro: la entrada de la cámara trae su propio bucle.
  const pasoDeEntrada = (ahora) => {
    if (!entrada || jugando) return;
    ponerCamara(ahora);
    if (entrada) cuadroDeEntrada = requestAnimationFrame(pasoDeEntrada);
  };
  const entrar = () => {
    cancelAnimationFrame(cuadroDeEntrada);
    // Con menos movimiento la cámara llega de una vez: un corte, no un vuelo.
    if (menosMovimiento) {
      entrada = null;
      return;
    }
    const c = mapa.getCenter();
    entrada = { center: [c.lng, c.lat], zoom: mapa.getZoom(), pitch: mapa.getPitch(), bearing: mapa.getBearing(), t0: performance.now() };
    if (!jugando) cuadroDeEntrada = requestAnimationFrame(pasoDeEntrada);
  };

  const estado = () => (jugando ? 'jugando' : t === null ? 'listo' : t >= 1 ? 'fin' : t > 0 ? 'pausa' : 'listo');
  const ponerBotones = () => {
    const e = estado();
    if (boton.dataset.estado === e) return;
    boton.dataset.estado = e;
    boton.setAttribute('aria-label', PARA_LECTORES[e]);
    enMapa.dataset.estado = e;
    textoEnMapa.textContent = TEXTOS[e];
  };

  const pintar = (ahora) => {
    const f = t === null ? fotogramaDelCroquis(rec) : fotograma(rec, t);
    apagarLosPuntos(modo === 'sigue');
    capa.poner(f);
    // Primero la cámara y después las letras: un marcador se acomoda con la cámara que encuentra.
    ponerCamara(ahora);
    for (const c of f.carros) {
      const g = rec.plano.aGrados(c);
      letras.get(c.letra)?.setLngLat([g.lon, g.lat]);
    }
    // Con el croquis quieto, la línea marca el instante en que la película pasa por él.
    linea.value = String(Math.round((t ?? rec.tCroquis ?? 0) * 1000));
    // Solo si cambia: el renglón se lee en voz alta (aria-live) y repetirlo en cada cuadro lo trababa.
    const texto = textoDeLaFase(rec, t);
    if (fase.textContent !== texto) fase.textContent = texto;
    ponerBotones();
  };

  const marcar = () => {
    for (const b of camaras.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.modo === modo && (b.dataset.letra || null) === letra));
  };
  const ponerModo = (nuevo, nuevaLetra = null) => {
    modo = nuevo;
    letra = nuevaLetra;
    // La de todos mira hacia donde miraba la zona (a lo largo de la vía): no marea al entrar.
    if (modo === 'todos') rumboDeTodos = camaraGeneral().bearing;
    // Siguiendo a un carro la cámara es de la película: los botones de acercar y la brújula se
    // esconden (a 85° de inclinación MapLibre aplasta la brújula hasta dejarla en una raya).
    mapa.getContainer().classList.toggle('siguiendo-carro', modo === 'sigue');
    marcar();
    if (modo === 'libre') {
      entrada = null;
      cancelAnimationFrame(cuadroDeEntrada);
    } else {
      alTomarLaCamara();
      entrar();
    }
    pintar();
  };

  const parar = () => {
    jugando = false;
    cancelAnimationFrame(cuadro);
    // Si la cámara iba llegando a su sitio, que termine de llegar: sin esto, pausar en ese momento la
    // dejaba congelada a medio camino (revisión del 14-nov).
    if (entrada) {
      cancelAnimationFrame(cuadroDeEntrada);
      cuadroDeEntrada = requestAnimationFrame(pasoDeEntrada);
    }
    ponerBotones();
  };
  const paso = (ahora) => {
    if (!jugando) return;
    const duracion = DURACION_MS * (lento.getAttribute('aria-pressed') === 'true' ? LENTO : 1);
    t = Math.min(1, t + Math.min(SALTO_MAXIMO_MS, Math.max(0, ahora - ultimo)) / duracion);
    ultimo = ahora;
    pintar(ahora);
    // Al terminar, como una pausa: si la cámara iba llegando a su sitio, que termine de llegar.
    if (t >= 1) parar();
    else cuadro = requestAnimationFrame(paso);
  };
  const jugar = () => {
    if (t === null || t >= 1) t = 0;
    // La primera vez, con la cámara que los muestra a todos: la de la zona deja los carros de 30 px.
    // Si la persona ya escogió desde dónde mirar, no se le mueve.
    if (!eligioCamara && modo === 'libre') ponerModo('todos');
    eligioCamara = true;
    yaJugo = true;
    jugando = true;
    ultimo = performance.now();
    ponerBotones();
    cuadro = requestAnimationFrame(paso);
  };

  for (const b of [boton, enMapa]) b.addEventListener('click', () => (jugando ? parar() : jugar()));
  linea.addEventListener('input', () => {
    parar();
    t = Number(linea.value) / 1000;
    pintar();
  });
  lento.addEventListener('click', () => lento.setAttribute('aria-pressed', String(lento.getAttribute('aria-pressed') !== 'true')));
  // Si la persona se va a otra app, la película la espera en pausa.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && jugando) parar();
  });

  // Las cámaras: la de todos y la de cada carro que se mueve (uno quieto no va a ninguna parte).
  const opciones = [{ modo: 'todos', letra: null, texto: rec.carros.length > 1 ? 'Los carros' : 'El carro' }, ...rec.carros.filter((c) => c.camino).map((c) => ({ modo: 'sigue', letra: c.letra, texto: `Seguir a ${c.letra}` }))];
  camaras.replaceChildren(
    ...opciones.map((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'boton boton-suave boton-chico';
      b.dataset.modo = o.modo;
      if (o.letra) b.dataset.letra = o.letra;
      b.textContent = o.texto;
      b.addEventListener('click', () => {
        eligioCamara = true;
        ponerModo(o.modo, o.letra);
      });
      return b;
    }),
  );
  marcar();

  // Si la persona mueve el mapa, la película le suelta la cámara: no se le pelea. 'movestart' es
  // por los botones de acercar y girar del mapa, que no pasan por el lienzo.
  const soltar = () => {
    if (modo !== 'libre') ponerModo('libre');
  };
  const laPersonaTomaLaCamara = () => {
    // Antes de la primera vez que se reproduce, mover el mapa es mirar la zona, no escoger cámara.
    if (yaJugo || modo !== 'libre') eligioCamara = true;
    soltar();
  };
  for (const evento of ['mousedown', 'touchstart', 'wheel', 'movestart']) {
    mapa.on(evento, (e) => {
      if (e.originalEvent) laPersonaTomaLaCamara();
    });
  }
  // Arrastrar la brújula gira e inclina el mapa sin que MapLibre lo cuente como un gesto de la persona
  // (su movestart llega sin originalEvent), y el dedo cae fuera del lienzo: la película le devolvía la
  // cámara en cada cuadro, debajo del dedo (revisión del 14-nov).
  mapa.getContainer().querySelector('.maplibregl-ctrl-top-right')?.addEventListener('pointerdown', laPersonaTomaLaCamara);
  // Al girar el teléfono, MapLibre conserva el zoom y la cámara que sigue al carro se acercaba sola a
  // 8 m (la distancia sale del alto del mapa). Con la película andando cada cuadro la rehace.
  mapa.on('resize', () => {
    if (!jugando && modo !== 'libre') pintar();
  });

  // Si nadie se mueve (ninguna flecha dice de dónde venían, o se tocan desde que arrancan), no hay qué
  // reproducir: se queda el croquis en 3D y abajo se dice por qué.
  seccion.hidden = false;
  barra.hidden = rec.nadaSeMueve;
  camaras.hidden = rec.nadaSeMueve;
  enMapa.hidden = rec.nadaSeMueve;
  pintar();
  return {
    // Para los botones de la zona (Vista 3D, Desde arriba, Dar la vuelta): escogen cámara ellos.
    soltar() {
      eligioCamara = true;
      soltar();
    },
    // Para el arnés de pruebas: ir a un momento y a una cámara sin esperar la película. null: el croquis.
    irA(nuevoMomento) {
      parar();
      t = nuevoMomento === null ? null : Math.min(1, Math.max(0, nuevoMomento));
      pintar();
    },
    camara(nuevoModo, nuevaLetra = null) {
      ponerModo(nuevoModo, nuevaLetra);
    },
  };
}
