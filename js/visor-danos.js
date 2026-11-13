// El carro en 3D de los daños (paso 6): se gira con un dedo, se acerca con
// dos, y un toque sobre una pieza la marca (toque.js decide cuál, con el
// anillo de rayos que deja marcar el estribo y el espejo con un dedo gordo).
//
// Es lo mínimo del visor del taller (allá visor.js trae los escaneos, los
// modelos del catálogo, el piso y las puertas que se abren): aquí el carro
// genérico de carro.js, con la carrocería y las medidas de la línea que se
// eligió en el paso 5, y su placa. Nada se abre: en la vía nadie abre el capó
// para la foto, y las piezas de adentro no se marcan (danos.js).
//
// Se dibuja solo cuando algo cambia (el dedo, una marca, el tamaño), no
// sesenta veces por segundo: en la calle la batería cuenta.
import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { construirCarro, resaltar } from './carro.js';
import { ALTURA_DE_LA_MIRA, LENTE, VISTAS, distanciaQueEncuadra } from './encuadre.js';
import { piezaTocada } from './toque.js';

// Gris claro y neutro: los colores de los daños tienen que saltar a la vista,
// y el carro de la foto puede ser de cualquier color.
const COLOR_DEL_CARRO = 0xcfd4da;
// La pieza tocada mientras se elige qué le pasó.
const COLOR_ELEGIDA = '#0f6e56';
// Un toque es un dedo que baja y sube casi en el mismo sitio y rápido;
// cualquier otra cosa es girar el carro.
const TOQUE_PX = 10;
const TOQUE_MS = 400;
const DURACION_DEL_VIAJE_MS = 450;

export const SIN_3D = 'Este navegador no puede mostrar el carro en 3D. Marca los daños desde la lista de piezas.';

export function crearVisorDeDanos(lienzo, { alTocar = () => {} } = {}) {
  let renderizador;
  try {
    renderizador = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  } catch {
    throw new Error(SIN_3D);
  }
  renderizador.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  renderizador.toneMappingExposure = 1.05;

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xe9ecf0);
  // Un "cuarto" de luz suave reflejado en la pintura: es lo que hace que la
  // chapa se vea como metal pintado y no como plástico mate.
  function crearEntorno() {
    if (escena.environment) escena.environment.dispose();
    const pmrem = new THREE.PMREMGenerator(renderizador);
    escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  crearEntorno();
  escena.add(new THREE.HemisphereLight(0xffffff, 0x3a4048, 0.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.1);
  sol.position.set(3, 6, -4);
  escena.add(sol);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.4);
  relleno.position.set(-4, 1.5, 5);
  escena.add(relleno);

  const camara = new THREE.PerspectiveCamera(LENTE, 1, 0.1, 100);
  const controles = new OrbitControls(camara, lienzo);
  controles.enablePan = false;
  // Sin inercia: un toque justo después de girar marcaría lo que pasaba por
  // debajo (en el taller hubo que frenarla a mano).
  controles.enableDamping = false;
  controles.minPolarAngle = 0.15;
  controles.maxPolarAngle = Math.PI / 2 - 0.05; // nunca por debajo del piso
  controles.addEventListener('change', () => pedirCuadro());

  const estado = { modelo: null, clave: null, colores: new Map(), elegida: null, cuadro: 0, pausado: false, ancho: 0, alto: 0, viaje: 0 };

  function pedirCuadro() {
    if (estado.cuadro || estado.pausado) return;
    estado.cuadro = requestAnimationFrame(() => {
      estado.cuadro = 0;
      renderizador.render(escena, camara);
    });
  }

  function medidas() {
    return estado.modelo ? estado.modelo.disposicion : { largo: 4.5, ancho: 1.84, alto: 1.455 };
  }

  function posicionDeVista(nombre) {
    const direccion = new THREE.Vector3(...VISTAS[nombre]).sub(controles.target).normalize();
    const distancia = distanciaQueEncuadra({ direccion, medidas: medidas(), mira: controles.target, fov: camara.fov, aspecto: camara.aspect });
    controles.maxDistance = Math.max(controles.maxDistance, distancia * 1.6);
    return direccion.multiplyScalar(distancia).add(controles.target);
  }

  function ajustarTamano() {
    const caja = lienzo.getBoundingClientRect();
    const ancho = Math.round(caja.width);
    const alto = Math.round(caja.height);
    // Oculto mide cero: se espera a que se vea.
    if (!ancho || !alto || (ancho === estado.ancho && alto === estado.alto)) return;
    const primera = !estado.ancho;
    estado.ancho = ancho;
    estado.alto = alto;
    renderizador.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    if (primera && estado.modelo) camara.position.copy(posicionDeVista('inicio'));
    controles.update();
    renderizador.render(escena, camara);
  }
  new ResizeObserver(ajustarTamano).observe(lienzo);

  // En Android, al irse a WhatsApp y volver, Chrome puede tirar el contexto
  // WebGL: three.js lo recupera, pero el entorno se pierde y nadie pide un
  // cuadro nuevo (pasó en el taller).
  lienzo.addEventListener('webglcontextrestored', () => {
    crearEntorno();
    pedirCuadro();
  });

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

  // El color del daño, entero. resaltar() de carro.js lo lleva a mitad de
  // camino a propósito (en el taller la pieza marcada tiene que seguir
  // pareciendo del carro), y así el rojo de "roto" salía rosado y no casaba
  // con la muestra de la leyenda (13-nov-2026). Aquí tiene que leerse de lejos.
  function tenir(malla, color) {
    if (color == null) return resaltar(malla, null);
    malla.material.color.set(color);
    malla.material.emissive.set(color);
    malla.material.emissiveIntensity = 0.22;
  }

  function pintarPiezas() {
    if (!estado.modelo) return;
    for (const [id, malla] of estado.modelo.porId) {
      const color = id === estado.elegida ? COLOR_ELEGIDA : estado.colores.get(id) ?? null;
      tenir(malla, color);
    }
    pedirCuadro();
  }

  // --- El toque -------------------------------------------------------------

  let toque = null;
  let dedos = 0;
  lienzo.addEventListener('pointerdown', (e) => {
    dedos += 1;
    toque = dedos === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  lienzo.addEventListener('pointerup', (e) => {
    dedos = Math.max(0, dedos - 1);
    if (!toque || !estado.modelo) return;
    const { x, y, t } = toque;
    toque = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) >= TOQUE_PX || performance.now() - t >= TOQUE_MS) return;
    const caja = lienzo.getBoundingClientRect();
    const id = piezaTocada({ camara, grupo: estado.modelo.grupo, x: e.clientX - caja.left, y: e.clientY - caja.top, ancho: caja.width, alto: caja.height });
    if (id) alTocar(id);
  });
  lienzo.addEventListener('pointercancel', () => {
    dedos = 0;
    toque = null;
  });

  return {
    // Pone el carro de la línea elegida (o el sedán genérico). Si es el mismo
    // de antes, no lo vuelve a construir.
    mostrarCarro({ carroceria = 'sedan', medidas: medidasDeLaLinea = null, placa = '' } = {}) {
      const clave = JSON.stringify([carroceria, medidasDeLaLinea, placa]);
      if (clave === estado.clave) return;
      if (estado.modelo) {
        escena.remove(estado.modelo.grupo);
        liberar(estado.modelo.grupo);
      }
      estado.modelo = construirCarro({ colorBase: COLOR_DEL_CARRO, carroceria, medidas: medidasDeLaLinea || undefined, placa });
      estado.clave = clave;
      // La placa, la parrilla y las luces no son piezas de la lista, y en el
      // taller paran el dedo (allá no se pintan). Aquí un golpe en ellas es un
      // golpe en lo que las sostiene: el dedo las atraviesa y marca el bómper o
      // la compuerta. Sin esto, tocar el centro del bómper delantero no marcaba
      // nada: ahí están la parrilla y la placa (13-nov-2026). Los vidrios sí
      // paran el dedo: un parabrisas roto no es el capó de atrás.
      estado.modelo.grupo.traverse((objeto) => {
        if (objeto.isMesh && ['placa', 'parrilla', 'luz'].includes(objeto.name)) objeto.userData.decorativo = true;
      });
      escena.add(estado.modelo.grupo);
      controles.target.set(0, estado.modelo.disposicion.alto * ALTURA_DE_LA_MIRA, 0);
      controles.minDistance = Math.max(2.4, estado.modelo.disposicion.largo * 0.55);
      controles.maxDistance = 30;
      if (estado.ancho) camara.position.copy(posicionDeVista('inicio'));
      controles.update();
      pintarPiezas();
    },

    // `colores`: Map pieza → color del tipo de daño. `elegida`: la pieza
    // tocada que todavía espera su tipo.
    pintar(colores, elegida = null) {
      estado.colores = colores;
      estado.elegida = elegida;
      pintarPiezas();
    },

    // Lleva la cámara a una vista con un viaje corto, para que se entienda
    // desde dónde se está mirando.
    vista(nombre) {
      if (!VISTAS[nombre] || !estado.ancho) return;
      const desde = camara.position.clone();
      const hasta = posicionDeVista(nombre);
      const inicio = performance.now();
      cancelAnimationFrame(estado.viaje);
      const paso = (ahora) => {
        const k = Math.min(1, (ahora - inicio) / DURACION_DEL_VIAJE_MS);
        const suave = k * k * (3 - 2 * k);
        camara.position.lerpVectors(desde, hasta, suave);
        controles.update();
        if (k < 1) estado.viaje = requestAnimationFrame(paso);
      };
      estado.viaje = requestAnimationFrame(paso);
    },

    pausar() {
      estado.pausado = true;
      cancelAnimationFrame(estado.viaje);
    },
    reanudar() {
      estado.pausado = false;
      ajustarTamano();
      pedirCuadro();
    },
    // Para las pruebas en el navegador: qué pieza hay en un punto de la
    // pantalla, y dónde cae el centro de una pieza.
    piezaEn(x, y) {
      if (!estado.modelo) return null;
      const caja = lienzo.getBoundingClientRect();
      return piezaTocada({ camara, grupo: estado.modelo.grupo, x: x - caja.left, y: y - caja.top, ancho: caja.width, alto: caja.height });
    },
    dondeEsta(id) {
      const malla = estado.modelo && estado.modelo.porId.get(id);
      if (!malla) return null;
      const centro = new THREE.Box3().setFromObject(malla).getCenter(new THREE.Vector3()).project(camara);
      const caja = lienzo.getBoundingClientRect();
      return { x: caja.left + ((centro.x + 1) / 2) * caja.width, y: caja.top + ((1 - centro.y) / 2) * caja.height };
    },
  };
}
