// Los carros del croquis en la maqueta abierta: el carro 3D del paso 6 (carro.js), del color de su
// letra, sobre el relieve, como una capa propia de MapLibre que comparte su WebGL. Así el cerro tapa
// al carro que queda detrás, como en la vía. La mueve la recreación (pantalla-recreacion.js), que le
// pasa cada fotograma. Hasta el sáb 14-nov-2026 los carros de la maqueta eran dos cajas oscuras de
// 1,5 m de alto que, vistas desde la cámara de la zona, medían unos pocos píxeles.
//
// Medido en MapLibre 4.7.1 (sáb 14-nov-2026), y decide si el carro queda en el suelo:
//  - La matriz que recibe una capa propia (customLayerMatrix) NO resta la altura del terreno en el
//    centro de la pantalla; la de los mosaicos sí.
//  - queryTerrainElevation devuelve la altura del punto MENOS la del centro: justo lo que le falta a
//    esa matriz. Con eso el carro queda sobre la vía y no a la altura del cerro (2.921 m en Los Verjones).
// Cada carro se inclina con la pendiente (cuatro alturas bajo sus ruedas): la vía de Los Verjones
// sube tanto que un carro plano quedaba con media trompa metida en el cerro.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { construirCarro, resaltar } from './carro.js';
import { coloresDelCarro } from './danos.js';

const GRADO = Math.PI / 180;
// El rojo del anillo del golpe: el del punto del choque.
const ROJO = 0xd92d20;
// Las piezas dañadas brillan más que en el paso 6: allá se miran de cerca y aquí a 15 m.
const BRILLO_DEL_DANO = 0.45;
// Cuánto del cuarto reflejado (RoomEnvironment) les llega a los carros.
const REFLEJO_DEL_CUARTO = 0.3;
// Una altura que se aleja más que esto de la del golpe es una tesela de relieve que no ha llegado
// (MapLibre la cuenta como 0 m): mejor el carro a la altura del golpe que enterrado 2.900 m.
const SALTO_IMPOSIBLE = 60;

// Hacia dónde mira el anillo del golpe recién hecho (RingGeometry va en el plano XY).
const HACIA_Z = new THREE.Vector3(0, 0, 1);

// El color del daño, entero, como tenir() del paso 6 (visor-danos.js). resaltar() de carro.js lo
// lleva a mitad de camino hacia la pintura, y la abolladura azul sobre el naranja de B salía lila,
// casi el morado de «suelto» (revisión del 14-nov).
function tenir(malla, color) {
  if (color == null || malla.userData.pintarVelo) return resaltar(malla, color);
  malla.material.color.set(color);
  malla.material.emissive.set(color);
  malla.material.emissiveIntensity = BRILLO_DEL_DANO;
}

// La sombra de contacto: una mancha suave debajo del carro. Sin ella el carro parece flotar, porque
// la luz del mapa no proyecta sombras.
function texturaDeSombra() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 64;
  lienzo.height = 64;
  const g = lienzo.getContext('2d');
  const gradiente = g.createRadialGradient(32, 32, 6, 32, 32, 32);
  gradiente.addColorStop(0, 'rgba(0,0,0,0.5)');
  gradiente.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradiente;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(lienzo);
}

// `origen`: el golpe ({lat, lon}), centro del plano de la recreación; `plano`: ese plano (geo.js).
// `carros`: [{ letra, color ('#rrggbb'), carroceria, medidas }]; `danos`: [{ carro, pieza, tipo }] del
// paso 6 (o los inventados del ejemplo), que se encienden en el golpe; `sol`: posicionDelSol a la hora
// del choque, de donde viene la luz de los carros, como la de los edificios del mapa.
export function capaDeLosCarros({ maplibregl, origen, plano, carros, danos = [], sol = null }) {
  const centro = maplibregl.MercatorCoordinate.fromLngLat([origen.lon, origen.lat], 0);
  const escala = centro.meterInMercatorCoordinateUnits();
  const escena = new THREE.Scene();
  const camara = new THREE.Camera();

  // En el plano de la escena: x al este, y hacia arriba, z al SUR (el eje y del Mercator crece al sur).
  // La luz del cielo da el color (pareja, venga de donde venga el sol) y el sol da la forma.
  escena.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 2.2));
  const luz = new THREE.DirectionalLight(0xffffff, 2);
  if (sol && sol.altura > 0) {
    const alto = sol.altura * GRADO;
    const rumbo = sol.azimut * GRADO;
    luz.position.set(Math.sin(rumbo) * Math.cos(alto), Math.sin(alto), -Math.cos(rumbo) * Math.cos(alto));
    // Un sol a ras del horizonte no alumbra como el del mediodía: con toda su fuerza, el costado
    // que lo mira quedaba blanco. Sube con la altura y llega a toda a los 20°.
    luz.intensity = 2 * Math.min(1, Math.max(0.35, Math.sin(alto) * 3));
  } else {
    // De noche no hay sol que ilumine: una luz floja desde arriba, como la de la maqueta.
    luz.position.set(0.3, 1, 0.2);
    luz.intensity = 0.6;
  }
  escena.add(luz);

  const sombra = texturaDeSombra();
  const modelos = new Map();
  for (const c of carros) {
    const { grupo, porId } = construirCarro({ colorBase: new THREE.Color(c.color).getHex(), carroceria: c.carroceria || 'sedan', medidas: c.medidas });
    // El carro del paso 6 está hecho para mirarse de cerca en su cuarto. A cielo abierto y a 15 m
    // (medido el 14-nov) dos cosas salían mal:
    //  - la pintura metálica reflejaba el techo del cuarto y el naranja de B quedaba rosado y blanco,
    //    distinto del color de su flecha: aquí va casi mate, y el color es el de la letra;
    //  - el vidrio dejaba ver el interior claro y el vidrio trasero parecía el platón de una
    //    camioneta: aquí va más cerrado y con menos reflejo.
    grupo.traverse((malla) => {
      const material = malla.material;
      if (material?.name === 'pintura') {
        material.metalness = 0.15;
        material.roughness = 0.5;
      } else if (malla.name === 'vidrio') {
        material.opacity = 0.94;
        material.envMapIntensity = 0.3;
      }
    });
    const tam = new THREE.Box3().setFromObject(grupo).getSize(new THREE.Vector3());
    const mancha = new THREE.Mesh(new THREE.PlaneGeometry(tam.x * 1.3, tam.z * 1.12), new THREE.MeshBasicMaterial({ map: sombra, transparent: true, depthWrite: false }));
    mancha.rotation.x = -Math.PI / 2;
    mancha.position.y = 0.05;
    const raiz = new THREE.Group();
    raiz.add(mancha, grupo);
    raiz.visible = false;
    escena.add(raiz);
    // Cada pieza del color de su daño, el mismo del paso 6 (abolladura azul, roto rojo, rayón
    // amarillo, suelto morado). Con un solo rojo para todo, las piezas golpeadas de A se confundían
    // con la pintura naranja de B (medido el 14-nov).
    const golpeadas = [...coloresDelCarro(danos, c.letra)].map(([pieza, color]) => ({ malla: porId.get(pieza), color })).filter((g) => g.malla);
    modelos.set(c.letra, { raiz, golpeadas, enRojo: false });
  }

  // El anillo se acuesta sobre la vía en cada cuadro (render), con la pendiente del golpe.
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 48), new THREE.MeshBasicMaterial({ color: ROJO, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  anillo.visible = false;
  escena.add(anillo);

  let mapa = null;
  let renderer = null;
  let poses = [];
  let golpe = false;

  return {
    id: 'choque-carros-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      mapa = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      // La pintura del paso 6 es metálica y refleja su cuarto; sin algo que reflejar salía casi negra
      // (lo mismo que pasó sobre la foto de Google el 14-nov). Aquí sí se le puede dar un cuarto.
      const pmrem = new THREE.PMREMGenerator(renderer);
      escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      // Flojo: solo para que el vidrio y los cromados tengan algo que reflejar.
      escena.environmentIntensity = REFLEJO_DEL_CUARTO;
      pmrem.dispose();
    },
    render(gl, matriz) {
      if (!mapa || !renderer) return;
      const base = mapa.queryTerrainElevation([origen.lon, origen.lat]);
      if (base == null) return;
      const alturaEn = (x, y) => {
        const p = plano.aGrados({ x, y });
        const h = mapa.queryTerrainElevation([p.lon, p.lat]);
        return h == null || Math.abs(h - base) > SALTO_IMPOSIBLE ? base : h;
      };
      for (const p of poses) {
        const modelo = modelos.get(p.letra);
        if (!modelo) continue;
        modelo.raiz.visible = true;
        const n = { x: Math.sin(p.rumbo * GRADO), y: Math.cos(p.rumbo * GRADO) };
        const izquierda = { x: -n.y, y: n.x };
        const eje = p.largo * 0.38;
        const lado = p.ancho * 0.45;
        const trompa = alturaEn(p.x + n.x * eje, p.y + n.y * eje);
        const cola = alturaEn(p.x - n.x * eje, p.y - n.y * eje);
        const izq = alturaEn(p.x + izquierda.x * lado, p.y + izquierda.y * lado);
        const der = alturaEn(p.x - izquierda.x * lado, p.y - izquierda.y * lado);
        modelo.raiz.position.set(p.x, (trompa + cola + izq + der) / 4 - base, -p.y);
        // Primero el rumbo, después la pendiente (trompa arriba) y el peralte (derecha arriba). La
        // trompa del carro del paso 6 mira hacia -z, que aquí es el norte.
        modelo.raiz.rotation.set(Math.atan2(trompa - cola, 2 * eje), -p.rumbo * GRADO, Math.atan2(der - izq, 2 * lado), 'YXZ');
      }
      for (const modelo of modelos.values()) {
        if (modelo.enRojo === golpe) continue;
        for (const { malla, color } of modelo.golpeadas) tenir(malla, golpe ? color : null);
        modelo.enRojo = golpe;
      }
      anillo.visible = golpe;
      if (golpe) {
        // Inclinado con la vía, como los carros: plano, en una pendiente del 15 % el borde de subida
        // quedaba 9 cm bajo el asfalto y se veía un arco cortado (revisión del 14-nov).
        const r = 1.15;
        const norte = alturaEn(0, r) - base;
        const sur = alturaEn(0, -r) - base;
        const este = alturaEn(r, 0) - base;
        const oeste = alturaEn(-r, 0) - base;
        // En la escena z va al sur: la subida hacia el sur es (sur - norte).
        const normal = new THREE.Vector3(-(este - oeste) / (2 * r), 1, -(sur - norte) / (2 * r)).normalize();
        anillo.quaternion.setFromUnitVectors(HACIA_Z, normal);
        anillo.position.set(0, (norte + sur + este + oeste) / 4 + 0.08, 0);
      }
      const transformacion = new THREE.Matrix4()
        .makeTranslation(centro.x, centro.y, base * escala)
        .scale(new THREE.Vector3(escala, -escala, escala))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      camara.projectionMatrix = new THREE.Matrix4().fromArray(matriz).multiply(transformacion);
      renderer.resetState();
      renderer.render(escena, camara);
    },
    // Un fotograma de recreacion.js.
    poner(fotograma) {
      poses = fotograma.carros;
      golpe = fotograma.golpe;
      mapa?.triggerRepaint();
    },
    onRemove() {
      escena.environment?.dispose();
      renderer?.dispose();
      renderer = null;
      mapa = null;
    },
  };
}
