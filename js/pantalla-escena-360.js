// El visor de la escena en 360°, dentro de la página de la zona (zona-3d.html).
// Es un cilindro hecho con CSS 3D, sin librerías: cada foto es un panel en su
// rumbo y el ojo está en el centro. Se gira arrastrando el dedo o con los
// botones. La lógica y las medidas están en escena-360.js (con pruebas).
//
// Los paneles de atrás se esconden a mano: con el ojo dentro del cilindro, lo
// que queda detrás de él no tiene un dibujo correcto en CSS, y Safari a veces
// lo pinta al revés.
import { geometriaDelVisor, gradosPorPixel, panelDeFrente, panelesDelCirculo, textoDeLaFoto, transformacionDelMundo, transformacionDelPanel } from './escena-360.js';
import { diferenciaAngular, puntoCardinal } from './geo.js';

const NOTA_CON_BRUJULA = 'Las fotos van en círculo según la brújula de cada una. No están cosidas: entre una y otra puede haber un salto o un pedazo repetido. El norte es el de la brújula del celular, que se separa unos grados del norte del mapa.';
const NOTA_SIN_BRUJULA = 'Este celular no dio la brújula: las fotos van en el orden en que se tomaron, una cada octavo de vuelta. El círculo es aproximado.';

// `fotos`: [{ id, registro, archivo (Blob) }] del reporte de este teléfono.
// Devuelve { cerrar } o null si no hay fotos de la escena.
export function montarEscena360(raiz, fotos, { ejemplo = false } = {}) {
  const $ = (selector) => raiz.querySelector(selector);
  const { paneles, conBrujula } = ejemplo ? { paneles: [], conBrujula: false } : panelesDelCirculo(fotos.filter((f) => f.archivo));
  if (!paneles.length) {
    $('#escena-360-vacia-texto').textContent = ejemplo
      ? 'El ejemplo no tiene fotos de la escena: el choque es inventado. En un reporte de verdad, aquí salen las 8 fotos de la vuelta, en círculo.'
      : 'Aún no hay fotos de la escena en este teléfono. Haz la vuelta en el paso 4 y aquí aparecen en círculo.';
    $('#escena-360-vacia').hidden = false;
    return null;
  }
  $('#escena-360-visor-caja').hidden = false;
  $('#escena-360-nota').textContent = conBrujula ? NOTA_CON_BRUJULA : NOTA_SIN_BRUJULA;

  const visor = $('#escena-360-visor');
  const mundo = $('#escena-360-mundo');
  const urls = [];
  const elementos = paneles.map((p) => {
    const panel = document.createElement('div');
    panel.className = 'panel-360';
    const img = document.createElement('img');
    const url = URL.createObjectURL(p.archivo ?? fotos.find((f) => f.id === p.id).archivo);
    urls.push(url);
    img.src = url;
    img.alt = `Foto ${p.indice + 1} de la escena`;
    img.decoding = 'async';
    img.draggable = false;
    panel.append(img);
    mundo.append(panel);
    return { panel, angulo: p.angulo };
  });

  let medidas = null;
  let mirandoA = paneles[0].angulo;

  function pintar() {
    mundo.style.transform = transformacionDelMundo(mirandoA, medidas.perspectiva);
    for (const { panel, angulo } of elementos) panel.style.visibility = diferenciaAngular(angulo, mirandoA) > 100 ? 'hidden' : 'visible';
    const frente = panelDeFrente(paneles, mirandoA);
    const hacia = ((mirandoA % 360) + 360) % 360;
    $('#escena-360-frente').textContent = (conBrujula ? `Mirando hacia el ${puntoCardinal(hacia)} (${Math.round(hacia)}°). ` : '') + textoDeLaFoto(frente.registro, { conBrujula });
  }

  function medir() {
    medidas = geometriaDelVisor(visor.clientWidth || 360);
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
      for (const url of urls) URL.revokeObjectURL(url);
    },
  };
}
