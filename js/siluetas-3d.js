// Las 8 siluetas guía de un carro, dibujadas una sola vez con Three.js desde
// las 8 tomas de la vuelta (silueta.js dice dónde se para la cámara y saca el
// contorno). Salen del mismo carro de los daños (carro.js), con la carrocería
// y las medidas de la línea que se eligió: un hatchback tiene su silueta.
//
// Se dibujan antes de que haga falta y se guardan como imágenes: así, con la
// cámara prendida, el 3D no está corriendo. El lienzo de WebGL se crea una vez
// y se vuelve a usar con el carro siguiente (en iPhone, crear y botar
// contextos de WebGL tiene tope).
import * as THREE from 'three';
import { construirCarro } from './carro.js';
import { TOMAS } from './escena.js';
import { MIRA, cajaDeLaMascara, contornoDeMascara, posicionDeLaCamara } from './silueta.js';

const ANCHO = 480;
const ALTO = 360;
// El lente de la silueta no es el del celular (cada uno tiene el suyo): solo
// pone la perspectiva. El tamaño lo pone el visor, que la estira.
const LENTE = 40;
const MARGEN = 4;

const guardadas = new Map();
let renderizador = null;

// Promesa de las 8 URL (data:image/png), en el orden de las tomas.
export function siluetasDelCarro({ carroceria = 'sedan', medidas = null } = {}) {
  const clave = JSON.stringify([carroceria, medidas]);
  if (!guardadas.has(clave)) {
    guardadas.set(
      clave,
      dibujar(carroceria, medidas).catch((error) => {
        guardadas.delete(clave);
        throw error;
      }),
    );
  }
  return guardadas.get(clave);
}

function liberar(grupo) {
  grupo.traverse((objeto) => {
    if (objeto.geometry) objeto.geometry.dispose();
    const materiales = Array.isArray(objeto.material) ? objeto.material : objeto.material ? [objeto.material] : [];
    for (const material of materiales) {
      if (material.map) material.map.dispose();
      material.dispose();
    }
  });
}

async function dibujar(carroceria, medidas) {
  if (!renderizador) {
    renderizador = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderizador.setPixelRatio(1);
    renderizador.setSize(ANCHO, ALTO, false);
    renderizador.setClearColor(0x000000, 0);
  }
  const escena = new THREE.Scene();
  const carro = construirCarro({ carroceria, medidas: medidas || undefined });
  escena.add(carro.grupo);
  // Todo blanco y sin luz: solo importa la mancha.
  const blanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
  escena.overrideMaterial = blanco;
  const camara = new THREE.PerspectiveCamera(LENTE, ANCHO / ALTO, 0.1, 60);
  const plano = Object.assign(document.createElement('canvas'), { width: ANCHO, height: ALTO });
  const ctx = plano.getContext('2d', { willReadFrequently: true });
  const urls = [];
  try {
    for (let sector = 0; sector < TOMAS; sector++) {
      camara.position.set(...posicionDeLaCamara(sector));
      camara.lookAt(...MIRA);
      renderizador.render(escena, camara);
      ctx.clearRect(0, 0, ANCHO, ALTO);
      ctx.drawImage(renderizador.domElement, 0, 0);
      const { data } = ctx.getImageData(0, 0, ANCHO, ALTO);
      const caja = cajaDeLaMascara(data, ANCHO, ALTO);
      if (!caja) throw new Error('La silueta salió vacía');
      const contorno = new ImageData(contornoDeMascara(data, ANCHO, ALTO), ANCHO, ALTO);
      const x = Math.max(0, caja.x1 - MARGEN);
      const y = Math.max(0, caja.y1 - MARGEN);
      const recorte = Object.assign(document.createElement('canvas'), {
        width: Math.min(ANCHO, caja.x2 + MARGEN + 1) - x,
        height: Math.min(ALTO, caja.y2 + MARGEN + 1) - y,
      });
      recorte.getContext('2d').putImageData(contorno, -x, -y);
      urls.push(recorte.toDataURL('image/png'));
      recorte.width = 0;
      // Una por cuadro: con la cámara abierta, el visor no se congela.
      await new Promise((listo) => setTimeout(listo, 0));
    }
  } finally {
    liberar(carro.grupo);
    blanco.dispose();
    plano.width = 0;
  }
  return urls;
}
