// El visor de la escena en 360°, dentro de la página de la zona (zona-3d.html).
// Es un cilindro hecho con CSS 3D, sin librerías: cada foto es un panel en su
// rumbo y el ojo está en el centro. Se gira arrastrando el dedo o con los
// botones. La lógica y las medidas están en escena-360.js (con pruebas).
//
// Los paneles de atrás se esconden a mano: con el ojo dentro del cilindro, lo
// que queda detrás de él no tiene un dibujo correcto en CSS, y Safari a veces
// lo pinta al revés.
//
// El ejemplo no tiene fotos de la escena (su choque es inventado). Desde el mar 17-nov-2026 muestra
// en su lugar una MUESTRA: cinco fotos reales de otro choque (muestra-de-la-vuelta.js), con un sello
// encima del visor, el crédito de cada una y los lados sin foto vacíos. Mismo visor, otro rótulo.
import { geometriaDelVisor, gradosPorPixel, panelDeFrente, panelesDelCirculo, textoDeLaFoto, transformacionDelMundo, transformacionDelPanel } from './escena-360.js';
import { diferenciaAngular, puntoCardinal } from './geo.js';
import { NOTA_DE_LA_MUESTRA, PRESENTACION_DE_LA_MUESTRA, PROPORCION_DE_LA_MUESTRA, creditosDeLaMuestra, panelDeArranque, panelesDeLaMuestra, textoDeLaMuestra } from './muestra-de-la-vuelta.js';

const NOTA_CON_BRUJULA = 'Las fotos van en círculo según la brújula de cada una. No están cosidas: entre una y otra puede haber un salto o un pedazo repetido. El norte es el de la brújula del celular, que se separa unos grados del norte del mapa.';
const NOTA_SIN_BRUJULA = 'Este celular no dio la brújula: las fotos van en el orden en que se tomaron, una cada octavo de vuelta. El círculo es aproximado.';

// `fotos`: [{ id, registro, archivo (Blob) }] del reporte de este teléfono.
// Devuelve { mirarA, cerrar } o null si no hay nada que mostrar.
export function montarEscena360(raiz, fotos, { ejemplo = false } = {}) {
  if (ejemplo) return montarLaMuestra(raiz);
  const $ = (selector) => raiz.querySelector(selector);
  const { paneles, conBrujula } = panelesDelCirculo(fotos.filter((f) => f.archivo));
  if (!paneles.length) {
    $('#escena-360-vacia-texto').textContent = 'Aún no hay fotos de la escena en este teléfono. Haz la vuelta en el paso 4 y aquí aparecen en círculo.';
    $('#escena-360-vacia').hidden = false;
    return null;
  }
  $('#escena-360-nota').textContent = conBrujula ? NOTA_CON_BRUJULA : NOTA_SIN_BRUJULA;
  const urls = [];
  const visor = montarVisor(raiz, {
    paneles: paneles.map((p) => {
      const url = URL.createObjectURL(p.archivo ?? fotos.find((f) => f.id === p.id).archivo);
      urls.push(url);
      return { angulo: p.angulo, src: url, alt: `Foto ${p.indice + 1} de la escena` };
    }),
    arranque: paneles[0].angulo,
    texto: (mirandoA) => {
      const frente = panelDeFrente(paneles, mirandoA);
      const hacia = ((mirandoA % 360) + 360) % 360;
      return (conBrujula ? `Mirando hacia el ${puntoCardinal(hacia)} (${Math.round(hacia)}°). ` : '') + textoDeLaFoto(frente.registro, { conBrujula });
    },
  });
  return {
    ...visor,
    cerrar() {
      visor.cerrar();
      for (const url of urls) URL.revokeObjectURL(url);
    },
  };
}

// La muestra del ejemplo. Lo que la separa de una vuelta de verdad se dice en cuatro lugares, para
// que ningún pantallazo la haga pasar por fotos del ejemplo: el párrafo de arriba, el sello sobre el
// visor, el texto de cada foto y los créditos. Sin brújula: no hay norte que mostrar.
function montarLaMuestra(raiz) {
  const $ = (selector) => raiz.querySelector(selector);
  const paneles = panelesDeLaMuestra();
  $('#escena-360-presentacion').textContent = PRESENTACION_DE_LA_MUESTRA;
  $('#escena-360-sello').hidden = false;
  $('#escena-360-norte').hidden = true;
  $('#escena-360-visor').setAttribute('aria-label', 'Muestra: fotos reales de otro choque, tomadas alrededor de los dos carros. Arrastra a los lados para girar');
  $('#escena-360-nota').textContent = NOTA_DE_LA_MUESTRA;
  const creditos = creditosDeLaMuestra();
  const enlace = (href, texto) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = texto;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  };
  const parrafo = $('#escena-360-creditos');
  parrafo.append(`${creditos.texto} (`, enlace(creditos.urlLicencia, 'ver la licencia'), '). Las originales: ');
  creditos.originales.forEach((f, i) => parrafo.append(i ? ', ' : '', enlace(f.pagina, `«${f.titulo}»`)));
  parrafo.append('.');
  parrafo.hidden = false;
  return montarVisor(raiz, {
    paneles: paneles.map((p) => (p.foto ? { angulo: p.angulo, src: p.foto.archivo, alt: `Muestra «${p.foto.titulo}»: foto de otro choque, desde ${p.lado} de los carros` } : { angulo: p.angulo, vacio: `Sin foto desde ${p.lado}: ninguna de las publicadas es de este lado` })),
    arranque: panelDeArranque(paneles).angulo,
    proporcion: PROPORCION_DE_LA_MUESTRA,
    texto: (mirandoA) => textoDeLaMuestra(panelDeFrente(paneles, mirandoA)),
  });
}

// El cilindro: `paneles` [{ angulo, src, alt } o { angulo, vacio: texto }]; `texto(mirandoA)` es lo
// que se dice debajo de la foto de frente.
function montarVisor(raiz, { paneles, arranque, proporcion, texto }) {
  const $ = (selector) => raiz.querySelector(selector);
  $('#escena-360-visor-caja').hidden = false;
  const visor = $('#escena-360-visor');
  const mundo = $('#escena-360-mundo');
  const elementos = paneles.map((p) => {
    const panel = document.createElement('div');
    panel.className = 'panel-360';
    if (p.vacio) {
      panel.classList.add('panel-vacio');
      panel.textContent = p.vacio;
    } else {
      const img = document.createElement('img');
      img.src = p.src;
      img.alt = p.alt;
      img.decoding = 'async';
      img.draggable = false;
      panel.append(img);
    }
    mundo.append(panel);
    return { panel, angulo: p.angulo };
  });

  let medidas = null;
  let mirandoA = arranque;

  function pintar() {
    mundo.style.transform = transformacionDelMundo(mirandoA, medidas.perspectiva);
    for (const { panel, angulo } of elementos) panel.style.visibility = diferenciaAngular(angulo, mirandoA) > 100 ? 'hidden' : 'visible';
    $('#escena-360-frente').textContent = texto(mirandoA);
  }

  function medir() {
    medidas = geometriaDelVisor(visor.clientWidth || 360, proporcion ? { proporcion } : undefined);
    visor.style.perspective = `${medidas.perspectiva}px`;
    visor.style.height = `${Math.round(medidas.altoPanel)}px`;
    for (const { panel, angulo } of elementos) {
      panel.style.width = `${medidas.anchoPanel}px`;
      panel.style.height = `${medidas.altoPanel}px`;
      panel.style.marginLeft = `${-medidas.anchoPanel / 2}px`;
      panel.style.marginTop = `${-medidas.altoPanel / 2}px`;
      panel.style.transform = transformacionDelPanel(angulo, medidas.radio);
    }
    pintar();
  }

  // Arrastrar: lo que está debajo del dedo se mueve con él, como en una foto.
  let arrastre = null;
  visor.addEventListener('pointerdown', (e) => {
    arrastre = { x: e.clientX, desde: mirandoA };
    visor.setPointerCapture(e.pointerId);
  });
  visor.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    mirandoA = arrastre.desde - (e.clientX - arrastre.x) * gradosPorPixel(visor.clientWidth);
    pintar();
  });
  const soltar = () => {
    arrastre = null;
  };
  visor.addEventListener('pointerup', soltar);
  visor.addEventListener('pointercancel', soltar);

  $('#escena-360-izquierda').addEventListener('click', () => {
    mirandoA -= 45;
    pintar();
  });
  $('#escena-360-derecha').addEventListener('click', () => {
    mirandoA += 45;
    pintar();
  });
  $('#escena-360-norte').addEventListener('click', () => {
    mirandoA = 0;
    pintar();
  });

  const alCambiarTamano = () => medir();
  window.addEventListener('resize', alCambiarTamano);
  medir();

  return {
    mirarA(rumbo) {
      mirandoA = rumbo;
      pintar();
    },
    cerrar() {
      window.removeEventListener('resize', alCambiarTamano);
    },
  };
}
