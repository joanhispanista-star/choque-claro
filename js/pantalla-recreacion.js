// La recreación en la página de la zona (zona-3d.html), sobre la maqueta abierta: los carros 3D
// (maqueta-carros.js) recorren el croquis (recreacion.js) con un botón de reproducir encima del
// mapa, una línea de tiempo para ir a cualquier momento, cámara lenta y tres cámaras: la que los
// muestra a todos y se va cerrando sobre el golpe, y la que sigue a cada carro.
//
// Solo en la maqueta abierta, no en el 3D de Google: las condiciones de Google no dejan guardar ni
// sacar su 3D, y la recreación es justo lo que más adelante tiene que salir en el expediente.
//
// Lo que se dice siempre, en el mapa mismo y no solo debajo: que es lo declarado y no una medición.
// Un pantallazo de la recreación no puede salir sin esa advertencia.
import { DURACION_MS, GOLPE_EN, camaraQueSigue, encuadreDeLosCarros, fotograma, recreacionDelCroquis } from './recreacion.js';
import { colorDeCarro } from './zona-3d.js';

const $ = (selector) => document.querySelector(selector);
const GRADO = Math.PI / 180;
// Cámara lenta: cuatro veces más despacio, para ver el golpe.
const LENTO = 4;
// Lo que tarda la cámara en llegar a su sitio al cambiar de cámara: sin esto saltaba de golpe y no
// se entendía desde dónde se estaba mirando.
const ENTRADA_MS = 900;
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

function textoDeLaFase(rec, t) {
  if (t < GOLPE_EN) return 'Antes del golpe: cada carro por su flecha.';
  return rec.toque
    ? 'El golpe. De aquí en adelante la recreación se queda quieta: cómo quedaron los carros lo cuentan las fotos de la escena.'
    : 'Fin de las flechas: no juntan los carros, así que la recreación para donde termina la flecha. Las fotos de la escena cuentan el resto.';
}

// `camaraGeneral()`: la cámara de la zona en ese momento (la de la maqueta, con el análisis si llegó).
// Devuelve { soltar() } para que los botones de la zona le quiten la cámara a la película, o null
// si no hay nada que recrear o este teléfono no pudo dibujar los carros.
// `alTomarLaCamara()`: se llama cada vez que la película se queda con la cámara, para que la zona
// deje de moverla por su cuenta (la vuelta, o el análisis de la vía que llega tarde).
export async function montarRecreacion({ mapa, croquis, sol, lineas = {}, danos = [], ejemplo = false, camaraGeneral, alTomarLaCamara = () => {} }) {
  const rec = recreacionDelCroquis(croquis);
  if (!rec) return null;
  let capa;
  try {
    const { capaDeLosCarros } = await import('./maqueta-carros.js');
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
    console.warn('Recreación:', error?.message ?? error);
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

  const seccion = $('#recreacion');
  const boton = $('#rec-jugar');
  const enMapa = $('#rec-jugar-mapa');
  const linea = $('#rec-tiempo');
  const lento = $('#rec-lento');
  const camaras = $('#rec-camaras');
  const fase = $('#rec-fase');
  $('#sello-recreacion').hidden = false;
  $('#rec-nota').textContent = (ejemplo ? 'Ejemplo inventado: los carros, sus flechas y sus daños no son de nadie. ' : '') +
    'Es el croquis del paso 7 en movimiento: cada carro sigue su flecha a ritmo parejo y todos llegan al golpe a la vez. Nadie declaró velocidades, así que no dice quién iba más rápido ni si alguien frenó. ' +
    (danos.length ? 'En el golpe se encienden las piezas que se marcaron como dañadas en el paso 6, cada una con el color de su daño. ' : '') +
    'La maqueta no tiene árboles, barrancos ni carros parqueados: no dice qué alcanzaba a ver cada conductor.';

  let t = 0;
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

  // Adónde quiere ir la cámara en este momento de la película, o null si la mueve la persona.
  const camaraDelModo = () => {
    if (modo === 'todos') {
      const e = encuadreDeLosCarros(rec, t);
      const c = rec.plano.aGrados(e.centro);
      // Un píxel de MapLibre mide 78.271,5 × cos(latitud) / 2^zoom metros (teselas de 512).
      const metrosPorPixel = (2 * e.radio) / ((mapa.getContainer().clientWidth || 360) * LLENO);
      return { center: [c.lon, c.lat], zoom: Math.log2((78271.517 * Math.cos(c.lat * GRADO)) / metrosPorPixel), pitch: INCLINACION_DE_TODOS, bearing: rumboDeTodos };
    }
    if (modo === 'sigue') {
      const c = camaraQueSigue(rec, letra, t);
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
    const c = mapa.getCenter();
    entrada = { center: [c.lng, c.lat], zoom: mapa.getZoom(), pitch: mapa.getPitch(), bearing: mapa.getBearing(), t0: performance.now() };
    cancelAnimationFrame(cuadroDeEntrada);
    if (!jugando) cuadroDeEntrada = requestAnimationFrame(pasoDeEntrada);
  };

  const estado = () => (jugando ? 'jugando' : t >= 1 ? 'fin' : t > 0 ? 'pausa' : 'listo');
  const ponerBotones = () => {
    const e = estado();
    if (boton.dataset.estado === e) return;
    boton.dataset.estado = e;
    boton.setAttribute('aria-label', PARA_LECTORES[e]);
    enMapa.dataset.estado = e;
    $('#rec-jugar-mapa-texto').textContent = TEXTOS[e];
  };

  const pintar = (ahora) => {
    const f = fotograma(rec, t);
    apagarLosPuntos(modo === 'sigue');
    capa.poner(f);
    // Primero la cámara y después las letras: un marcador se acomoda con la cámara que encuentra.
    ponerCamara(ahora);
    for (const c of f.carros) {
      const g = rec.plano.aGrados(c);
      letras.get(c.letra)?.setLngLat([g.lon, g.lat]);
    }
    linea.value = String(Math.round(t * 1000));
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
    if (modo === 'libre') entrada = null;
    else {
      alTomarLaCamara();
      entrar();
    }
    pintar();
  };

  const parar = () => {
    jugando = false;
    cancelAnimationFrame(cuadro);
    ponerBotones();
  };
  const paso = (ahora) => {
    if (!jugando) return;
    const duracion = DURACION_MS * (lento.getAttribute('aria-pressed') === 'true' ? LENTO : 1);
    t = Math.min(1, t + Math.max(0, ahora - ultimo) / duracion);
    ultimo = ahora;
    if (t >= 1) jugando = false;
    pintar(ahora);
    if (jugando) cuadro = requestAnimationFrame(paso);
  };
  const jugar = () => {
    if (t >= 1) t = 0;
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
  for (const evento of ['mousedown', 'touchstart', 'wheel', 'movestart']) {
    mapa.on(evento, (e) => {
      if (!e.originalEvent) return;
      // Antes de la primera vez que se reproduce, mover el mapa es mirar la zona, no escoger cámara.
      if (yaJugo || modo !== 'libre') eligioCamara = true;
      soltar();
    });
  }

  seccion.hidden = false;
  enMapa.hidden = false;
  pintar();
  return {
    // Para los botones de la zona (Vista 3D, Desde arriba, Dar la vuelta): escogen cámara ellos.
    soltar() {
      eligioCamara = true;
      soltar();
    },
    // Para el arnés de pruebas: ir a un momento y a una cámara sin esperar la película.
    irA(momento) {
      parar();
      t = Math.min(1, Math.max(0, momento));
      pintar();
    },
    camara(nuevoModo, nuevaLetra = null) {
      ponerModo(nuevoModo, nuevaLetra);
    },
  };
}
