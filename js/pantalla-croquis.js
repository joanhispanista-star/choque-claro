// La pantalla del croquis (paso 7). La lógica está en croquis.js; aquí van las tarjetas de los
// casos, el mapa (Leaflet, el mismo de «¿Dónde fue?»), los dedos y el guardado.
//
// Cómo se agarra lo que hay en el mapa: a escala real un carro mide unos 28 × 12 px en el zoom del
// croquis, y ningún dedo le atina a eso. Cada carro lleva encima una MANIJA invisible de 44 px (un
// marcador de Leaflet que se arrastra) con su letra al lado; el carro elegido muestra además la de
// girar (⟳) delante de la trompa. La carrocería, las flechas y las puntas se redibujan con cada
// movimiento: son unos pocos polígonos.
//
// Se guarda solo, un momento después de cada cambio: iOS recarga la pestaña cuando quiere y nadie
// debería volver a armar el croquis por eso. «Listo: así fue» lo marca como hecho, con su hora.
import {
  CASOS,
  armarCaso,
  cambiarCarro,
  croquisDesdeGuardado,
  croquisLibre,
  croquisParaGuardar,
  croquisUtilizable,
  faltaParaTerminar,
  flechasDelCroquis,
  intercambiar,
  largoDelTrazo,
  limitesDelCroquis,
  medidasDelCarro,
  metrosPorPixel,
  ponerCarro,
  ponerFlecha,
  puntaDeFlecha,
  quienEs,
  quitarCarro,
  relatoDelCroquis,
  simplificarTrazo,
  tituloDelCaso,
  viaDesdeElAnalisis,
  viaDesdeGuardado,
} from './croquis.js';
import { carrosDelReporte } from './carros.js';
import { COLORES, colorDeCarro, desplazar, rectanguloDeCarro } from './zona-3d.js';
import { planoLocal, rumbo as rumboEntre } from './geo.js';
import { detalle } from './reporte-en-curso.js';

const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>';
const GUARDAR_DESPUES_DE = 700; // ms después del último cambio
// Si el pin del paso 3 se movió más que esto después de hacer el croquis, se avisa (m).
const OTRO_LUGAR = 30;

// ------------------------------------------------------------------- los dibujos de los casos

// Cada tarjeta lleva su dibujo, el de las maquetas que Joan aprobó: A verde (el tuyo), B naranja,
// la estrella roja es el golpe. Vista desde arriba, 120 × 80. Lo que el dibujo pinta es lo que el
// caso arma: en «Por detrás» y «En reversa» B no tiene flecha porque sale quieto.
function carroSvg(x, y, giro, color, letra) {
  return (
    `<g transform="translate(${x} ${y}) rotate(${giro})"><rect x="-6" y="-11" width="12" height="22" rx="3" fill="${color}"/></g>` +
    `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${letra}</text>`
  );
}

function flechaSvg(x1, y1, x2, y2, color, punteada = false) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const ala = (d) => `${(x2 - 6 * Math.cos(a + d)).toFixed(1)},${(y2 - 6 * Math.sin(a + d)).toFixed(1)}`;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"${punteada ? ' stroke-dasharray="3 3"' : ''}/><polygon points="${x2},${y2} ${ala(0.5)} ${ala(-0.5)}" fill="${color}"/>`;
}

function puntosDeEstrella(x, y, r) {
  const puntos = [];
  for (let i = 0; i < 16; i++) {
    const radio = i % 2 ? r * 0.45 : r;
    const angulo = (Math.PI * i) / 8;
    puntos.push(`${(x + radio * Math.sin(angulo)).toFixed(1)},${(y - radio * Math.cos(angulo)).toFixed(1)}`);
  }
  return puntos.join(' ');
}

const estrellaSvg = (x, y, r = 7) => `<polygon points="${puntosDeEstrella(x, y, r)}" fill="${COLORES.punto}"/>`;
const viaSvg = (x1, x2) => `<rect x="${x1}" y="0" width="${x2 - x1}" height="80" fill="#e3e6ea"/><line x1="${(x1 + x2) / 2}" y1="0" x2="${(x1 + x2) / 2}" y2="80" stroke="#fff" stroke-width="1.5" stroke-dasharray="5 4"/>`;

const A = COLORES.carroA;
const B = COLORES.carroB;
const DIBUJOS = {
  detras: viaSvg(40, 80) + carroSvg(60, 18, 0, B, 'B') + carroSvg(60, 46, 0, A, 'A') + flechaSvg(60, 79, 60, 60, A) + estrellaSvg(60, 32),
  frente: viaSvg(36, 84) + carroSvg(50, 52, 0, A, 'A') + flechaSvg(50, 79, 50, 66, A) + carroSvg(70, 26, 180, B, 'B') + flechaSvg(70, 1, 70, 12, B) + estrellaSvg(60, 39),
  cruce: viaSvg(48, 72) + '<rect x="0" y="19" width="120" height="22" fill="#e3e6ea"/>' + carroSvg(60, 56, 0, A, 'A') + flechaSvg(60, 80, 60, 70, A) + carroSvg(42, 30, 90, B, 'B') + flechaSvg(10, 30, 28, 30, B) + estrellaSvg(57, 42),
  carril: viaSvg(30, 90) + carroSvg(54, 48, 18, A, 'A') + `<path d="M42 79 Q44 66 49 60" fill="none" stroke="${A}" stroke-width="2.5" stroke-linecap="round"/>` + carroSvg(73, 34, 0, B, 'B') + flechaSvg(73, 79, 73, 49, B) + estrellaSvg(64, 40),
  reversa: viaSvg(40, 80) + carroSvg(60, 28, 0, A, 'A') + flechaSvg(78, 18, 78, 44, A, true) + carroSvg(60, 64, 0, B, 'B') + estrellaSvg(60, 47),
  quieto: viaSvg(40, 80) + carroSvg(60, 52, 0, A, 'A') + flechaSvg(60, 79, 60, 66, A) + '<circle cx="60" cy="16" r="7" fill="#8a8f98"/>' + estrellaSvg(60, 31),
};

const aLatLng = (p) => [p.lat, p.lon];
const mayuscula = (texto) => texto[0].toUpperCase() + texto.slice(1);

// --------------------------------------------------------------------------- la pantalla

// `lugar()`: lo del paso 3 que sigue en la memoria ({ punto, origen, via, precision, fecha }) o null.
export function iniciarPantallaCroquis(raiz, { reporte, lugar }) {
  const $ = (selector) => raiz.querySelector(selector);
  const estado = {
    vista: null, // 'sin-lugar' | 'casos' | 'mapa' | 'listo'
    via: null,
    croquis: null,
    carros: [], // los del reporte (paso 5)
    elegido: null,
    herramienta: 'mover', // 'mover' | 'flecha' (solo a mano)
    punto: null,
    ejemplo: false,
    hora: null,
    precision: null,
    hecho: null,
    lugarNuevo: null, // el paso 3 cambió de lugar después de este croquis
  };
  let mapa = null;
  let capaDibujo = null;
  const manijas = new Map();
  let giro = null;
  let girando = false;
  let marcaGolpe = null;
  let trazo = null;
  let dibujoPedido = false;
  let reloj = null;
  let guardando = Promise.resolve();

  function avisarError(texto) {
    $('#croquis-error').textContent = texto;
    $('#croquis-error').hidden = !texto;
  }

  function avisar(texto) {
    $('#croquis-aviso').textContent = texto;
    $('#croquis-aviso').hidden = !texto;
  }

  // --- De dónde sale el croquis -------------------------------------------------------------

  function tomarLugar(l) {
    estado.via = viaDesdeElAnalisis(l.via, l.punto);
    estado.punto = l.punto;
    estado.ejemplo = l.origen === 'ejemplo';
    estado.hora = l.fecha instanceof Date && !Number.isNaN(l.fecha.getTime()) ? l.fecha.toISOString() : null;
    estado.precision = l.precision ?? null;
    estado.lugarNuevo = null;
    estado.hecho = null;
  }

  const lejos = (a, b) => {
    const p = planoLocal(a).aMetros(b);
    return Math.hypot(p.x, p.y) > OTRO_LUGAR;
  };

  // Los carros del reporte pueden haber cambiado desde el croquis (la línea elegida después, un
  // carro C que se quitó): el croquis toma sus medidas de ahora y suelta los que ya no están.
  function alDiaConElReporte(croquis) {
    const carros = [];
    for (const c of croquis.carros) {
      const delReporte = estado.carros.find((r) => r.letra === c.letra);
      if (delReporte) carros.push({ ...c, quien: delReporte.quien, ...medidasDelCarro(delReporte) });
    }
    const letras = new Set(carros.map((c) => c.letra));
    return { ...croquis, carros, flechas: croquis.flechas.filter((f) => letras.has(f.letra)) };
  }

  async function entrar() {
    avisarError('');
    let rep;
    try {
      rep = await reporte.cargar();
    } catch (error) {
      avisarError(`No se pudo abrir el reporte en este teléfono (${detalle(error)}). Recarga la página.`);
      return;
    }
    estado.carros = carrosDelReporte(rep);
    const l = lugar();
    if (croquisUtilizable(rep.croquis)) {
      const g = rep.croquis;
      estado.via = viaDesdeGuardado(g);
      estado.croquis = alDiaConElReporte(croquisDesdeGuardado(g));
      estado.punto = g.punto;
      estado.ejemplo = !!g.ejemplo;
      estado.hora = g.hora;
      estado.hecho = g.hecho;
      estado.lugarNuevo = l && l.punto && lejos(l.punto, g.punto || g.centro) ? l : null;
      if (l && !estado.lugarNuevo && l.precision) estado.precision = l.precision;
      if (!estado.elegido || !estado.croquis.carros.some((c) => c.letra === estado.elegido)) estado.elegido = estado.croquis.carros[0]?.letra ?? null;
      mostrarVista(g.hecho ? 'listo' : 'mapa');
    } else if (l && l.punto) {
      tomarLugar(l);
      estado.croquis = null;
      mostrarVista('casos');
    } else {
      mostrarVista('sin-lugar');
    }
  }

  function salir() {
    if (trazo) trazo = null;
    if (reloj) guardarYa();
  }

  // --- Las vistas -----------------------------------------------------------------------------

  function mostrarVista(vista) {
    const antes = estado.vista;
    estado.vista = vista;
    if (vista !== 'mapa' || estado.croquis?.modo !== 'libre') estado.herramienta = 'mover';
    aplicarHerramienta();
    $('#croquis-sin-lugar').hidden = vista !== 'sin-lugar';
    $('#croquis-casos').hidden = vista !== 'casos';
    $('#croquis-editor').hidden = vista !== 'mapa' && vista !== 'listo';
    $('#croquis-controles').hidden = vista !== 'mapa';
    $('#croquis-hecho').hidden = vista !== 'listo';
    $('#croquis-titulo').textContent = vista === 'casos' ? '¿Cómo fue el choque?' : 'El croquis';
    $('#croquis-ejemplo').hidden = !estado.ejemplo || vista === 'sin-lugar';
    avisar('');
    if (vista === 'casos') pintarCasos();
    if (vista === 'mapa' || vista === 'listo') {
      if (!asegurarMapa()) return;
      const encuadrarAhora = antes !== 'mapa' && antes !== 'listo';
      requestAnimationFrame(() => {
        mapa.invalidateSize();
        if (encuadrarAhora) encuadrar();
        pintarTodo();
      });
      pintarTextos();
    }
    if (antes && antes !== vista) window.scrollTo(0, 0);
  }

  function pintarCasos() {
    $('#croquis-lista-casos').replaceChildren(
      ...CASOS.map((caso) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'tipo-dano caso';
        boton.dataset.caso = caso.id;
        boton.setAttribute('aria-pressed', String(estado.croquis?.caso === caso.id));
        boton.innerHTML = `<svg viewBox="0 0 120 80" aria-hidden="true" font-family="system-ui, sans-serif">${DIBUJOS[caso.id]}</svg><strong></strong><small></small>`;
        boton.querySelector('strong').textContent = caso.titulo;
        boton.querySelector('small').textContent = caso.detalle;
        return boton;
      }),
    );
    $('#croquis-volver-al-mapa').hidden = !estado.croquis;
  }

  function elegirCaso(id) {
    if (estado.lugarNuevo) tomarLugar(estado.lugarNuevo);
    estado.croquis = armarCaso(id, estado.via, estado.carros);
    estado.elegido = 'A';
    estado.hecho = null;
    estado.vista = 'casos'; // para que mostrarVista encuadre
    mostrarVista('mapa');
    programarGuardado();
  }

  function aMano() {
    let anterior = estado.croquis;
    if (estado.lugarNuevo) {
      tomarLugar(estado.lugarNuevo);
      anterior = null;
    }
    estado.croquis = croquisLibre(estado.via, anterior);
    estado.elegido = estado.croquis.carros[0]?.letra ?? null;
    estado.hecho = null;
    estado.vista = 'casos';
    mostrarVista('mapa');
    programarGuardado();
  }

  // --- El mapa --------------------------------------------------------------------------------

  function asegurarMapa() {
    if (mapa) return true;
    const L = globalThis.L;
    if (!L) {
      avisarError('El mapa no cargó. Recarga la página.');
      return false;
    }
    // zoomSnap 0,25: con zoom entero, fitBounds se quedaba un escalón entero más lejos cuando el
    // croquis no cabía por unos píxeles, y los carros salían de la mitad del tamaño (medido el 13-nov
    // en «Por detrás» y «De frente» a 390 px). Los botones + y − siguen saltando de a 1.
    mapa = L.map($('#croquis-mapa'), { zoomControl: true, attributionControl: true, maxZoom: 21, zoomSnap: 0.25 });
    // Hasta 21, estirando las teselas de 19 (la última que da OpenStreetMap): un carro de 4 m
    // necesita ese zoom para verse más grande que un dedo.
    L.tileLayer(TESELAS, { maxZoom: 21, maxNativeZoom: 19, attribution: ATRIBUCION }).addTo(mapa);
    mapa.attributionControl.setPrefix(false);
    const c = estado.via.centro;
    mapa.setView([c.lat, c.lon], 19);
    capaDibujo = L.layerGroup().addTo(mapa);
    mapa.on('zoomend', () => {
      pintarGiro();
      pintarDibujo();
    });
    prepararTrazo();
    return true;
  }

  function encuadrar() {
    const c = estado.croquis;
    if (!c.carros.length) {
      // A 20 un carro mide unos 30 px; a 19 salía de 15 y había que acercarse antes de poder agarrarlo.
      const centro = c.golpe || estado.via.centro;
      mapa.setView([centro.lat, centro.lon], 20);
      return;
    }
    const caja = limitesDelCroquis(c, flechasDelCroquis(estado.via, c));
    // Tope 20,5: a 20 un carro medía 30 px y los casos compactos («Por detrás») se quedaban ahí
    // aunque cupieran más cerca; a 20,5 mide unos 42 y la curva todavía se ve entera alrededor.
    mapa.fitBounds(caja, { padding: [30, 30], maxZoom: 20.5 });
  }

  const metros = () => metrosPorPixel(estado.via.centro.lat, mapa.getZoom());
  const editable = () => estado.vista === 'mapa';
  const carroElegido = () => estado.croquis?.carros.find((c) => c.letra === estado.elegido) || null;

  function pintarTodo() {
    if (!mapa || !estado.croquis) return;
    sincronizarManijas();
    pintarGolpe();
    pintarGiro();
    pintarDibujo();
    pintarControles();
    pintarTextos();
  }

  function pedirDibujo() {
    if (dibujoPedido) return;
    dibujoPedido = true;
    requestAnimationFrame(() => {
      dibujoPedido = false;
      pintarDibujo();
    });
  }

  function pintarDibujo() {
    if (!mapa || !estado.croquis) return;
    const L = globalThis.L;
    capaDibujo.clearLayers();
    const c = estado.croquis;
    const mpp = metros();
    // La punta y el recorte se miden en píxeles: a 16 px la punta se ve en cualquier zoom, y
    // recortar 16 px deja la punta pegada a la estrella del golpe en vez de debajo de ella.
    const flechas = flechasDelCroquis(estado.via, c, { recorte: 16 * mpp });
    const largoDeLaPunta = Math.max(2.4, 16 * mpp);
    for (const f of flechas) {
      const color = colorDeCarro(f.letra);
      L.polyline(f.puntos.map(aLatLng), { color, weight: 4, opacity: 0.95, dashArray: c.modo === 'guiado' ? '9 7' : null, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capaDibujo);
      const punta = puntaDeFlecha(f.puntos, { largo: largoDeLaPunta });
      if (punta) L.polygon(punta.map(aLatLng), { color, weight: 1, fillColor: color, fillOpacity: 1, interactive: false }).addTo(capaDibujo);
    }
    for (const carro of c.carros) {
      const elegido = editable() && carro.letra === estado.elegido;
      const cuerpo = rectanguloDeCarro(carro, carro.rumbo, carro.largo, carro.ancho).coordinates[0].map(([lon, lat]) => [lat, lon]);
      L.polygon(cuerpo, { color: elegido ? '#14181d' : '#ffffff', weight: elegido ? 3 : 2, fillColor: colorDeCarro(carro.letra), fillOpacity: 1, interactive: false }).addTo(capaDibujo);
      // El vidrio de adelante: sin él, un carro quieto (que no tiene flecha) no dice hacia dónde mira.
      const vidrio = rectanguloDeCarro(desplazar(carro, carro.rumbo, carro.largo * 0.17), carro.rumbo, carro.largo * 0.16, carro.ancho * 0.78).coordinates[0].map(([lon, lat]) => [lat, lon]);
      L.polygon(vidrio, { stroke: false, fillColor: '#ffffff', fillOpacity: 0.75, interactive: false }).addTo(capaDibujo);
    }
    if (trazo && trazo.puntos.length > 1) {
      L.polyline(trazo.puntos.map(aLatLng), { color: colorDeCarro(estado.elegido), weight: 4, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capaDibujo);
    }
    // La letra de cada carro, a su izquierda, fuera de la carrocería.
    for (const carro of c.carros) {
      const insignia = manijas.get(carro.letra)?.getElement()?.querySelector('.insignia');
      if (!insignia) continue;
      const d = carro.ancho / 2 / mpp + 14;
      const h = (carro.rumbo * Math.PI) / 180;
      insignia.style.transform = `translate(${(-Math.cos(h) * d).toFixed(1)}px, ${(-Math.sin(h) * d).toFixed(1)}px)`;
    }
  }

  function sincronizarManijas() {
    const L = globalThis.L;
    const presentes = new Set(estado.croquis.carros.map((c) => c.letra));
    for (const [letra, manija] of manijas) {
      if (!presentes.has(letra)) {
        manija.remove();
        manijas.delete(letra);
      }
    }
    for (const carro of estado.croquis.carros) {
      const letra = carro.letra;
      let manija = manijas.get(letra);
      if (!manija) {
        const icono = L.divIcon({ className: 'croquis-manija', html: `<span class="insignia" style="background:${colorDeCarro(letra)}">${letra}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
        manija = L.marker(aLatLng(carro), { icon: icono, draggable: true, keyboard: false, autoPan: true, zIndexOffset: 500, title: `Carro ${letra}`, alt: `Carro ${letra}` }).addTo(mapa);
        manija.on('click', () => {
          if (editable()) elegir(letra);
        });
        manija.on('dragstart', () => elegir(letra));
        manija.on('drag', () => {
          const p = manija.getLatLng();
          estado.croquis = cambiarCarro(estado.croquis, letra, { lat: p.lat, lon: p.lng });
          pintarGiro();
          pedirDibujo();
        });
        manija.on('dragend', cambio);
        manijas.set(letra, manija);
      } else {
        manija.setLatLng(aLatLng(carro));
      }
      if (editable() && estado.herramienta === 'mover') manija.dragging.enable();
      else manija.dragging.disable();
    }
  }

  function pintarGolpe() {
    const L = globalThis.L;
    const golpe = estado.croquis.golpe;
    if (!golpe) {
      if (marcaGolpe) marcaGolpe.remove();
      marcaGolpe = null;
      return;
    }
    if (!marcaGolpe) {
      const icono = L.divIcon({ className: 'croquis-golpe', html: `<svg viewBox="-16 -16 32 32" aria-hidden="true"><polygon points="${puntosDeEstrella(0, 0, 14)}" fill="${COLORES.punto}" stroke="#fff" stroke-width="1.6"/></svg>`, iconSize: [32, 32], iconAnchor: [16, 16] });
      marcaGolpe = L.marker(aLatLng(golpe), { icon: icono, draggable: true, keyboard: false, autoPan: true, zIndexOffset: 1000, title: 'El golpe', alt: 'El golpe' }).addTo(mapa);
      marcaGolpe.on('drag', () => {
        const p = marcaGolpe.getLatLng();
        estado.croquis = { ...estado.croquis, golpe: { lat: p.lat, lon: p.lng } };
        pedirDibujo();
      });
      marcaGolpe.on('dragend', cambio);
    } else {
      marcaGolpe.setLatLng(aLatLng(golpe));
    }
    if (editable() && estado.herramienta === 'mover') marcaGolpe.dragging.enable();
    else marcaGolpe.dragging.disable();
  }

  // La manija de girar va delante de la trompa del elegido, a 30 px por lo menos: más cerca, el
  // dedo agarraba la manija del carro en vez de la de girar.
  function pintarGiro() {
    const L = globalThis.L;
    const carro = carroElegido();
    if (!mapa || !carro || !editable() || estado.herramienta !== 'mover') {
      if (giro) giro.remove();
      giro = null;
      return;
    }
    if (girando) return;
    const p = desplazar(carro, carro.rumbo, Math.max(carro.largo / 2 + 1.2, 30 * metros()));
    if (giro) {
      giro.setLatLng(aLatLng(p));
      return;
    }
    const icono = L.divIcon({ className: '', html: '<div class="croquis-giro" aria-hidden="true">⟳</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
    giro = L.marker(aLatLng(p), { icon: icono, draggable: true, keyboard: false, zIndexOffset: 1200, title: 'Girar el carro', alt: 'Girar el carro' }).addTo(mapa);
    giro.on('dragstart', () => {
      girando = true;
    });
    giro.on('drag', () => {
      const elegido = carroElegido();
      if (!elegido) return;
      const ll = giro.getLatLng();
      const rumbo = rumboEntre({ x: 0, y: 0 }, planoLocal(elegido).aMetros({ lat: ll.lat, lon: ll.lng }));
      estado.croquis = cambiarCarro(estado.croquis, elegido.letra, { rumbo });
      pedirDibujo();
    });
    giro.on('dragend', () => {
      girando = false;
      pintarGiro();
      cambio();
    });
  }

  function elegir(letra) {
    if (estado.elegido === letra) return;
    estado.elegido = letra;
    if (giro) giro.remove();
    giro = null;
    pintarGiro();
    pintarDibujo();
    pintarControles();
    pintarTextos();
  }

  // Después de cada cambio de la persona: se repinta y se guarda en un momento.
  function cambio() {
    pintarTodo();
    programarGuardado();
  }

  // --- El trazo a mano (modo libre, herramienta «Flecha») -------------------------------------

  // Con «Flecha», el mapa deja de moverse y un dedo dibuja. Se escucha en la fase de captura para
  // ganarle a Leaflet: si no, el dedo que empieza encima de un carro lo arrastraba en vez de
  // dibujar, y el carro es justo donde uno empieza la flecha.
  function prepararTrazo() {
    const caja = $('#croquis-mapa');
    const dibujando = () => editable() && estado.croquis?.modo === 'libre' && estado.herramienta === 'flecha';
    const puntoDe = (e) => {
      const ll = mapa.mouseEventToLatLng(e);
      return { lat: ll.lat, lon: ll.lng };
    };
    caja.addEventListener(
      'pointerdown',
      (e) => {
        if (!dibujando() || e.target.closest('.leaflet-control')) return;
        e.stopPropagation();
        e.preventDefault();
        if (trazo) {
          // Un segundo dedo: no es una flecha.
          trazo = null;
          pedirDibujo();
          return;
        }
        if (!estado.elegido) {
          avisar('Elige primero un carro: toca su letra en el mapa con «Mover».');
          return;
        }
        trazo = { id: e.pointerId, puntos: [puntoDe(e)] };
        try {
          caja.setPointerCapture(e.pointerId);
        } catch {
          // Sin captura el trazo sigue igual mientras el dedo no salga del mapa.
        }
      },
      { capture: true },
    );
    caja.addEventListener(
      'pointermove',
      (e) => {
        if (!trazo || e.pointerId !== trazo.id) return;
        e.stopPropagation();
        const p = puntoDe(e);
        const ultimo = mapa.latLngToContainerPoint(aLatLng(trazo.puntos.at(-1)));
        if (ultimo.distanceTo(mapa.latLngToContainerPoint(aLatLng(p))) < 4) return;
        trazo.puntos.push(p);
        pedirDibujo();
      },
      { capture: true },
    );
    const terminar = (e) => {
      if (!trazo || e.pointerId !== trazo.id) return;
      e.stopPropagation();
      const { puntos } = trazo;
      trazo = null;
      if (e.type === 'pointerup' && largoDelTrazo(puntos) >= 2) {
        estado.croquis = ponerFlecha(estado.croquis, estado.elegido, simplificarTrazo(puntos));
        // Quien dibuja por dónde venía un carro dice que se movía: «quieto» con flecha se contradice.
        if (carroElegido()?.movimiento === 'quieto') estado.croquis = cambiarCarro(estado.croquis, estado.elegido, { movimiento: 'adelante' });
        cambio();
      } else {
        pedirDibujo();
      }
    };
    caja.addEventListener('pointerup', terminar, { capture: true });
    caja.addEventListener('pointercancel', terminar, { capture: true });
  }

  function ponerHerramienta(herramienta) {
    estado.herramienta = herramienta;
    aplicarHerramienta();
    pintarTodo();
  }

  // El mapa, según la herramienta. Sin la clase de Leaflet para arrastrar, el navegador vuelve a
  // mover la página con el dedo (touch-action: pan-x pan-y) y el trazo se corta: .dibujando lo
  // apaga. Se llama también al cambiar de vista: salir de «Flecha» por otro lado no puede dejar el
  // mapa quieto.
  function aplicarHerramienta() {
    if (!mapa) return;
    const flecha = estado.herramienta === 'flecha';
    $('#croquis-mapa').classList.toggle('dibujando', flecha);
    if (flecha) mapa.dragging.disable();
    else mapa.dragging.enable();
  }

  // --- Los controles y los textos -------------------------------------------------------------

  function pintarControles() {
    const c = estado.croquis;
    if (!c) return;
    const libre = c.modo === 'libre';
    // Las fichas: los carros del reporte que no están en el mapa.
    const faltan = estado.carros.filter((carro) => !c.carros.some((x) => x.letra === carro.letra));
    const fichas = $('#croquis-fichas');
    fichas.hidden = !faltan.length;
    const texto = document.createElement('p');
    texto.className = 'fichas-texto';
    texto.textContent = c.caso === 'quieto' && faltan.some((f) => f.letra === 'B') ? 'Si lo quieto era un carro parqueado, toca B:' : 'Toca para ponerlo en el mapa:';
    fichas.replaceChildren(
      texto,
      ...faltan.map((carro) => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'ficha';
        boton.dataset.letra = carro.letra;
        const letra = document.createElement('b');
        letra.style.background = colorDeCarro(carro.letra);
        letra.textContent = carro.letra;
        boton.append(letra, mayuscula(quienEs(carro)));
        return boton;
      }),
    );
    $('#croquis-herramientas').hidden = !libre;
    for (const boton of raiz.querySelectorAll('[data-herramienta]')) boton.setAttribute('aria-pressed', String(boton.dataset.herramienta === estado.herramienta));
    $('[data-herramienta="flecha"]').textContent = estado.elegido ? `Flecha de ${estado.elegido}` : 'Flecha';
    const elegido = carroElegido();
    $('#croquis-elegido').hidden = !elegido;
    if (elegido) {
      const nombre = $('#croquis-elegido-nombre');
      const muestra = document.createElement('span');
      muestra.className = 'muestra';
      muestra.style.background = colorDeCarro(elegido.letra);
      nombre.replaceChildren(muestra, `${elegido.letra}, ${quienEs(elegido)}: ¿cómo iba?`);
      for (const boton of raiz.querySelectorAll('[data-movimiento]')) boton.setAttribute('aria-pressed', String(boton.dataset.movimiento === elegido.movimiento));
    }
    $('#croquis-cambiar').disabled = !(c.carros.some((x) => x.letra === 'A') && c.carros.some((x) => x.letra === 'B'));
    $('#croquis-otro-caso').textContent = libre ? 'Volver a los casos' : 'Otro caso';
  }

  function pintarTextos() {
    const c = estado.croquis;
    if (!c) return;
    const sinVia = estado.via.real ? '' : ' El mapa no trajo la vía: los carros salen en una recta, gíralos como iban.';
    let guia;
    if (estado.vista === 'listo') guia = 'Así quedó. Léelo antes de seguir: es lo que vas a declarar.';
    else if (c.modo === 'libre') guia = `Dibujado a mano. Pon cada carro donde iba justo antes del golpe y, con «Flecha», dibuja por dónde venía.${sinVia}`;
    else guia = `${tituloDelCaso(c.caso)}. Así lo armó la app sobre la vía del mapa: acomódalo a como fue.${sinVia}`;
    $('#croquis-guia').textContent = guia;
    let ayuda = 'Arrastra un carro para moverlo; el elegido se gira con ⟳. Arrastra la estrella a donde fue el golpe.';
    if (c.modo === 'libre' && estado.herramienta === 'flecha') {
      ayuda = estado.elegido ? `Dibuja con el dedo por dónde venía ${estado.elegido}, hasta el golpe. Mientras dibujas, el mapa no se mueve: vuelve a «Mover» para moverlo.` : 'Elige primero un carro: toca su letra en el mapa con «Mover».';
    }
    $('#croquis-ayuda').textContent = ayuda;
    if (estado.lugarNuevo && estado.vista === 'mapa') avisar('El punto del choque cambió en «¿Dónde fue?» después de este croquis. Si ya no sirve, toca «Otro caso»: se arma sobre el punto nuevo.');
    if (estado.vista === 'listo') pintarHecho();
  }

  function pintarHecho() {
    $('#croquis-relato').replaceChildren(
      ...relatoDelCroquis(estado.croquis, estado.via).map((linea) => {
        const li = document.createElement('li');
        li.textContent = linea;
        return li;
      }),
    );
    // La zona en 3D es otra página: el punto y la hora viajan en la dirección, y el croquis lo lee
    // ella misma del teléfono (zona-3d.js, croquisDeEstaZona).
    const punto = estado.punto || estado.via.centro;
    const q = new URLSearchParams({ lat: punto.lat.toFixed(6), lon: punto.lon.toFixed(6) });
    if (estado.hora) q.set('t', estado.hora);
    if (estado.precision) q.set('p', String(Math.round(estado.precision)));
    if (estado.ejemplo) q.set('ejemplo', '1');
    $('#croquis-ver-3d').href = 'zona-3d.html?' + q.toString();
  }

  // --- Guardar --------------------------------------------------------------------------------

  function programarGuardado() {
    clearTimeout(reloj);
    reloj = setTimeout(guardarYa, GUARDAR_DESPUES_DE);
  }

  function guardarYa() {
    clearTimeout(reloj);
    reloj = null;
    if (!estado.croquis || !estado.via) return guardando;
    const datos = croquisParaGuardar(estado.croquis, estado.via, { punto: estado.punto, ejemplo: estado.ejemplo, hora: estado.hora, hecho: estado.hecho });
    // En fila: dos guardados al tiempo podrían llegar al revés y dejar el viejo.
    guardando = guardando
      .then(() => reporte.guardarDatos({ croquis: datos }))
      .then(
        () => avisarError(''),
        (error) => avisarError(`No se pudo guardar el croquis en el teléfono (${detalle(error)}). Se vuelve a intentar con el próximo cambio.`),
      );
    return guardando;
  }

  // --- Los botones ----------------------------------------------------------------------------

  raiz.addEventListener('click', (e) => {
    const caso = e.target.closest('[data-caso]');
    if (caso) return elegirCaso(caso.dataset.caso);
    const ficha = e.target.closest('.ficha[data-letra]');
    if (ficha) {
      const carro = estado.carros.find((x) => x.letra === ficha.dataset.letra);
      if (!carro) return;
      estado.croquis = ponerCarro(estado.croquis, estado.via, carro);
      estado.elegido = carro.letra;
      if (giro) giro.remove();
      giro = null;
      cambio();
      // Encuadrar todo, no solo traer el carro a la vista: así el que se acaba de poner sale del
      // tamaño en que se puede agarrar, junto a los demás y al golpe.
      encuadrar();
      return;
    }
    const herramienta = e.target.closest('[data-herramienta]');
    if (herramienta) return ponerHerramienta(herramienta.dataset.herramienta);
    const movimiento = e.target.closest('[data-movimiento]');
    if (movimiento && carroElegido()) {
      estado.croquis = cambiarCarro(estado.croquis, estado.elegido, { movimiento: movimiento.dataset.movimiento });
      return cambio();
    }
    const girar = e.target.closest('[data-girar]');
    if (girar && carroElegido()) {
      estado.croquis = cambiarCarro(estado.croquis, estado.elegido, { rumbo: carroElegido().rumbo + Number(girar.dataset.girar) });
      return cambio();
    }
  });

  $('#croquis-a-mano').addEventListener('click', aMano);
  $('#croquis-volver-al-mapa').addEventListener('click', () => mostrarVista(estado.hecho ? 'listo' : 'mapa'));
  $('#croquis-otro-caso').addEventListener('click', () => mostrarVista('casos'));
  $('#croquis-cambiar').addEventListener('click', () => {
    estado.croquis = intercambiar(estado.croquis);
    cambio();
  });
  $('#croquis-quitar').addEventListener('click', () => {
    if (!carroElegido()) return;
    estado.croquis = quitarCarro(estado.croquis, estado.elegido);
    estado.elegido = estado.croquis.carros[0]?.letra ?? null;
    cambio();
  });
  $('#croquis-listo').addEventListener('click', async () => {
    const falta = faltaParaTerminar(estado.croquis);
    if (falta.length) {
      avisar(falta.join(' '));
      return;
    }
    estado.hecho = new Date().toISOString();
    await guardarYa();
    mostrarVista('listo');
    pintarTodo();
  });
  $('#croquis-cambiar-croquis').addEventListener('click', () => {
    estado.hecho = null;
    mostrarVista('mapa');
    programarGuardado();
  });

  return { entrar, salir, estado: () => estado, mapa: () => mapa, guardarYa };
}
