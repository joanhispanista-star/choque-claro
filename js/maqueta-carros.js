// Los carros del croquis en la maqueta abierta: el carro nuevo del Taller (generico/carro-nuevo.js),
// del color de su letra, sobre el relieve, como una capa propia de MapLibre que comparte su WebGL. Así el cerro tapa
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
//
// La luz y el carro (lun 16-nov-2026), porque Joan pidió que los carros se vieran mejor y eligió, de
// tres opciones en pantallazos, «C, carro nuevo»:
//  - El carro nuevo del Taller de Pintura (generico/carro-nuevo.js): una jaula subdividida, con
//    rines, faros, espejos y juntas finas, en vez de las cajas del paso 6. Cumple el mismo contrato
//    (las 29 piezas del catálogo en porId, en las cuatro carrocerías), así que el golpe enciende las
//    mismas piezas que se marcaron en el paso 6. Son unos 66.000 triángulos por carro (12 veces los
//    del paso 6). Si en un iPhone la película se traba, la vuelta al carro de carro.js es devolver
//    ESTE archivo a como quedó en e4e0eb1 (git show e4e0eb1:js/maqueta-carros.js) y quitar
//    pruebas/maqueta-carros.test.js. Solo cambiar la llamada no basta: aquel archivo también le
//    bajaba el metal a la pintura del paso 6 y reflejaba un cuarto a 0,3, no este cielo a 0,7; sin
//    eso, el naranja de B vuelve a salir rosado (el defecto del 14-nov).
//  - El ojo en su sitio. MapLibre entrega UNA matriz (de la escena a la pantalla), y antes iba entera
//    en la proyección de three: three creía que el ojo estaba en el punto del golpe, a ras del suelo,
//    y los brillos y los reflejos salían calculados desde ahí. Ahora se saca de esa matriz dónde está
//    el ojo de verdad, y la proyección se corrige para que el dibujo quede idéntico.
//  - Lo que reflejan los rines, las llantas y los cromos es el cielo de la maqueta, no el cuarto con
//    lámparas del paso 6. La lata, el vidrio, los lentes de los faros y los marcos negros traen su
//    propio reflejo, de estudio de fotos (generico/pintura.js, conReflejoDeEstudio): no cambia con
//    la hora, ni de noche, y no afirma nada de la vía.
//  - SIN sombra del sol, aunque se construyó y se vio en la hoja de opciones. Tres razones:
//      1. La zona no sabe si ese día hubo sol: las nubes del reporte (clima.nubes) no le llegan, y una
//         sombra dura sobre la vía afirma un sol que, nublado, nadie vio. El PDF diría «Nublado».
//      2. El relieve no proyecta sombra: con el sol bajo, el cerro ya pudo haberle tapado el sol a la
//         vía, y la maqueta no tiene cómo saberlo.
//      3. Salía o no según cuánto tardara en llegar el relieve (las alturas guardadas antes de tiempo
//         eran las de la tesela gruesa), y redibujaba 115.000 triángulos más en cada cuadro.
//    Por lo mismo el cielo reflejado no lleva disco de sol. La mancha suave debajo de cada carro sí
//    se queda: esa no depende del sol, porque debajo de un carro nunca llega la luz del cielo.
//  - El daño con su color entero, también sobre la laca nueva (ver tenir y pinturaEnSuSitio). Y más
//    claro cuando se parece al color del carro (colorDeLaSenal): si no, la pieza no se distinguía.
import * as THREE from 'three';
import { resaltar } from './carro.js';
import { construirCarroNuevo } from './generico/carro-nuevo.js';
import { crearPintura } from './generico/pintura.js';
import { coloresDelCarro } from './danos.js';
import { diferenciaPercibida } from './diferencia-de-color.js';

const GRADO = Math.PI / 180;
// El rojo del anillo del golpe: el del punto del choque.
const ROJO = 0xd92d20;
// Las piezas dañadas brillan más que en el paso 6: allá se miran de cerca y aquí a 15 m. En la laca
// del carro nuevo no suma luz: ahí solo dice «esta pieza va marcada» (ver pinturaEnSuSitio).
const BRILLO_DEL_DANO = 0.45;
// Cuánto del cielo reflejado les llega a los rines, las llantas y los cromos: three solo lo usa en las
// piezas que no traen un reflejo propio. La lata, el vidrio, los faros y los marcos negros llevan el
// estudio del Taller (generico/pintura.js), y los plásticos, la goma y los espejos su propia fuerza
// de reflejo (conEntorno, en generico/carro-nuevo.js).
const REFLEJO_DEL_CIELO = 0.7;
// La exposición y el tono con que el Taller calibró la pintura (js/visor.js de allá): la pintura
// calcula al revés el tono de cine (ACES) para que en pantalla salga el color pedido. Con otro tono
// el verde de A y el naranja de B dejarían de ser los de sus flechas.
const EXPOSICION_DEL_TALLER = 1.05;
// Una altura que se aleja más que esto de la del golpe es una tesela de relieve que no ha llegado
// (MapLibre la cuenta como 0 m): mejor el carro a la altura del golpe que enterrado 2.900 m.
const SALTO_IMPOSIBLE = 60;
// Los colores del cielo de la maqueta (pantalla-zona-3d.js, setSky): lo que se refleja en los rines y
// los cromos es el cielo que se ve detrás del cerro, no un cuarto. El suelo, un gris verdoso entre
// el asfalto y el pasto del mapa.
const CIELO = { cenit: '#9cc4e8', horizonte: '#e3edf5', suelo: '#6c7166' };

// Hacia dónde mira el anillo del golpe recién hecho (RingGeometry va en el plano XY).
const HACIA_Z = new THREE.Vector3(0, 0, 1);

// El color que hay que darle a la laca para que en pantalla salga el del daño tal cual: el mismo
// cálculo al revés del tono de cine con que la pintura del Taller saca el color del carro. Sin esto,
// un azul de abolladura pintado tal cual saldría oscuro y corrido por el tono. Uno por color de daño.
const calibrados = new Map();
function colorDeDanoEnLaca(color) {
  if (!calibrados.has(color)) {
    const pintura = crearPintura(new THREE.Color(color));
    calibrados.set(color, pintura.color.clone());
    pintura.dispose();
  }
  return calibrados.get(color);
}

// Cuándo el color de un daño se parece demasiado al del carro (ΔE00, ver diferencia-de-color.js), y
// hasta dónde se aclara entonces. Medido el 16-nov con la cuenta de la laca: la abolladura (#1e6fd9)
// sobre el azul de C (#2c64ad) está a 6,1, y en pantalla la pieza marcada quedaba a 3,4 de la lata,
// menos que el techo contra la puerta del mismo carro; el «suelto» sobre el morado de D, a 5,5. El
// rojo de «roto» sobre el naranja de B está a 10,9 y sí se distingue (10 en pantalla): por eso el
// límite es 10 y el ejemplo de A y B no cambia. Aclarar hasta 16 deja la pieza a más de 10 de su lata
// desde cualquier lado (pruebas/maqueta-carros.test.js).
const SE_PARECE = 10;
const SEPARADO = 16;
const BLANCO = new THREE.Color(1, 1, 1);

// El color con que se pinta la pieza dañada: el de su daño, o, si se parece al del carro, el mismo
// mezclado con blanco hasta que se separe. Más claro y no más oscuro: en el golpe la pieza «se
// enciende». Mezclar con blanco no le cambia el tono, así que sigue siendo azul o morado (más de 19
// de los otros daños). Exportada para las pruebas.
export function colorDeLaSenal(colorDelDano, colorDelCarro) {
  if (diferenciaPercibida(colorDelDano, colorDelCarro) >= SE_PARECE) return colorDelDano;
  let claro = colorDelDano;
  for (let paso = 1; paso <= 25; paso++) {
    claro = '#' + new THREE.Color(colorDelDano).lerp(BLANCO, paso * 0.02).getHexString();
    if (diferenciaPercibida(claro, colorDelCarro) >= SEPARADO) break;
  }
  return claro;
}

// El color del daño, entero, como tenir() del paso 6 (visor-danos.js). resaltar() de carro.js lo
// lleva a mitad de camino hacia la pintura, y la abolladura azul sobre el naranja de B salía lila,
// casi el morado de «suelto» (revisión del 14-nov). Exportada para las pruebas.
export function tenir(malla, color) {
  if (color == null || malla.userData.pintarVelo) return resaltar(malla, color);
  const material = malla.material;
  if (material.userData.lacaEnSuSitio) material.color.copy(colorDeDanoEnLaca(color));
  else material.color.set(color);
  material.emissive.set(color);
  material.emissiveIntensity = BRILLO_DEL_DANO;
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

// En el plano de la escena: x al este, y hacia arriba, z al SUR (el eje y del Mercator crece al sur).
function haciaElSol(sol) {
  const alto = sol.altura * GRADO;
  const rumbo = sol.azimut * GRADO;
  return new THREE.Vector3(Math.sin(rumbo) * Math.cos(alto), Math.sin(alto), -Math.cos(rumbo) * Math.cos(alto));
}

// Qué tanto alumbra el sol directo según su altura: a ras del horizonte el aire se come casi toda su
// luz, y el costado que lo mira quedaba blanco con toda su fuerza. Llega a toda a los 20°.
const fuerzaDelSol = (sol) => Math.min(1, Math.max(0.35, Math.sin(sol.altura * GRADO) * 3));

// El cielo que se refleja, armado como una escena (una esfera con el degradado): de ahí sale el mapa
// de reflejos (PMREM), el de los rines y los cromos. Sin disco de sol: la sombra se quitó porque
// afirmaba un sol que nadie sabe si hubo, y un disco en el reflejo es lo mismo en chiquito, un sol
// en cada rin. La luz directa sí se queda, desde donde estaba el sol a esa hora, como la de los
// edificios del mapa (setLight); también deja su brillo en los rines, igual que en las fachadas.
// De noche, el mismo cielo muy apagado.
function cieloParaReflejar(sol) {
  const escena = new THREE.Scene();
  const geometria = new THREE.SphereGeometry(10, 48, 24);
  const posiciones = geometria.attributes.position;
  const cenit = new THREE.Color(CIELO.cenit);
  const horizonte = new THREE.Color(CIELO.horizonte);
  const suelo = new THREE.Color(CIELO.suelo);
  const de = sol && sol.altura > 0 ? 1 : 0.12;
  const colores = [];
  const c = new THREE.Color();
  for (let i = 0; i < posiciones.count; i++) {
    const y = posiciones.getY(i) / 10;
    if (y >= 0) c.copy(horizonte).lerp(cenit, Math.pow(y, 0.5));
    // El horizonte termina en seco contra el suelo, como en la vía: esa raya es la que dibuja la
    // forma de una puerta vista de lado.
    else c.copy(horizonte).lerp(suelo, Math.min(1, -y * 8));
    c.multiplyScalar(de);
    colores.push(c.r, c.g, c.b);
  }
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  escena.add(new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  return escena;
}

// Lo que pinturaEnSuSitio cambia en el sombreador de la laca del Taller, texto por texto. Si el Taller
// cambia su pintura y algo deja de calzar, se nota en la consola (y en pruebas/maqueta-carros.test.js),
// no en un carro con los reflejos corridos que nadie sabe por qué.
export const CAMBIOS_EN_LA_LACA = [
  // En el Taller el carro está en el origen mirando a -z y el mundo es el carro; aquí cada carro va
  // en su sitio de la vía y con su rumbo. La laca calcula su luz con el ojo y el punto EN EL CARRO:
  // qué tan abajo está (el borde de abajo se oscurece), dónde empieza la nariz (ahí no se prenden los
  // reflejos) y si la lata mira de lado. Sin esto, la nariz del carro que iba al norte apagaba los
  // reflejos del carro entero, y la franja de los costados se encendía en la trompa del que iba al
  // este. `uLocal` lleva, cada cuadro, del mundo al carro.
  ['vec3 nM = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );', 'vec3 nM = normalize( mat3( uLocal ) * ( vec4( normal, 0.0 ) * viewMatrix ).xyz );'],
  ['vec3 pM = cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz;', 'vec3 pM = ( uLocal * vec4( cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz, 1.0 ) ).xyz;'],
  ['vec3 vM = normalize( cameraPosition - pM );', 'vec3 vM = normalize( ( uLocal * vec4( cameraPosition, 1.0 ) ).xyz - pM );'],
  // La pieza marcada. En el Taller sale del acento con un 22 % del color propio («para que se siga
  // leyendo como la misma lata»): aquí eso deshacía el color del daño, y la abolladura azul sobre el
  // naranja de B salía 105,143,220, un azul lavado hacia el lila (revisión del 15-nov). Aquí la
  // marcada lleva su color calibrado (el que tenir le pone, ver colorDeDanoEnLaca), y el emissive no
  // se suma encima: solo dice que va marcada. Sumado, aclaraba el color calibrado.
  [/colorBase = mix\( emissive \/ mayorE \* 0\.8, uPropio, 0\.22 \);\s*#ifdef USE_COLOR\s*colorBase \*= vColor;\s*#endif/, 'colorBase = diffuseColor.rgb;\n    totalEmissiveRadiance = vec3( 0.0 );'],
  // Y el cielo que refleja, teñido del color del daño, como el de cualquier lata (uTinte): en el
  // Taller va blanco, y en un capó o un techo visto desde arriba le subía azul al amarillo del rayón
  // (224,171,41 con 224,168,0 pedido). Teñido, la marcada es una lata del color de su daño.
  ['tinte = vec3( 1.0 );', 'tinte = max( diffuseColor.rgb, vec3( 0.0 ) ) / max( 0.001, max( diffuseColor.r, max( diffuseColor.g, diffuseColor.b ) ) );'],
];

// La pintura del carro nuevo (generico/pintura.js), puesta en el sitio de su carro (ver
// CAMBIOS_EN_LA_LACA). Exportada para las pruebas.
export function pinturaEnSuSitio(material, local) {
  const original = material.onBeforeCompile;
  material.onBeforeCompile = (s, r) => {
    original.call(material, s, r);
    s.uniforms.uLocal = local;
    let calzan = 0;
    let texto = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform mat4 uLocal;');
    for (const [antes, despues] of CAMBIOS_EN_LA_LACA) {
      const nuevo = texto.replace(antes, despues);
      if (nuevo !== texto) calzan++;
      texto = nuevo;
    }
    s.fragmentShader = texto;
    if (calzan < CAMBIOS_EN_LA_LACA.length) console.warn('Recreación: la pintura del carro nuevo cambió y no se pudo poner en su sitio (' + calzan + ' de ' + CAMBIOS_EN_LA_LACA.length + ')');
  };
  // Un programa propio: el de 'laca' del Taller no lleva estos cambios.
  material.customProgramCacheKey = () => 'laca-maqueta';
  material.userData.lacaEnSuSitio = true;
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

  // La luz del cielo da el color (pareja, venga de donde venga el sol) y el sol da la forma. La lata
  // del carro nuevo no pasa por estas luces (su color es el calibrado, generico/pintura.js): las usan
  // las llantas, los rines, los plásticos y el vidrio. El 2 de la del cielo viene de la opción B del
  // 15-nov, donde con 2,2 la pintura del paso 6 se aclaraba hacia el pastel; aquí no mueve el color
  // de ninguna lata, y se dejó como lo vio Joan en la hoja de opciones.
  escena.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 2));
  const luz = new THREE.DirectionalLight(0xffffff, 2);
  if (sol && sol.altura > 0) {
    luz.position.copy(haciaElSol(sol));
    luz.intensity = 2 * fuerzaDelSol(sol);
  } else {
    // De noche no hay sol que ilumine: una luz floja desde arriba, como la de la maqueta.
    luz.position.set(0.3, 1, 0.2);
    luz.intensity = 0.6;
  }
  escena.add(luz);

  const sombra = texturaDeSombra();
  const modelos = new Map();
  // Las letras de los carros con algún daño aclarado: la pantalla lo dice (pantalla-recreacion.js).
  const aclarados = [];
  for (const c of carros) {
    const { grupo, porId } = construirCarroNuevo({ colorBase: new THREE.Color(c.color).getHex(), carroceria: c.carroceria || 'sedan', medidas: c.medidas });
    // Sus materiales ya vienen hechos para que el color sea el pedido: aquí no se tocan, solo se
    // ponen en el sitio del carro (pinturaEnSuSitio).
    const local = { value: new THREE.Matrix4() };
    const puestos = new Set();
    grupo.traverse((malla) => {
      if (!malla.isMesh) return;
      const material = malla.material;
      if (!puestos.has(material) && material.customProgramCacheKey?.() === 'laca') {
        pinturaEnSuSitio(material, local);
        puestos.add(material);
      }
    });
    // Las piezas que no son de laca (el estribo de plástico de una camioneta o una SUV) van sin el
    // tono de cine, como iba todo hasta el 14-nov: si no, el color de su daño salía corrido por el
    // tono. Desde el comienzo y no al marcarla: cambiarlo en el golpe recompila el sombreador justo
    // en mitad de la película.
    for (const malla of porId.values()) if (!malla.material.userData.lacaEnSuSitio) malla.material.toneMapped = false;
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
    // con la pintura naranja de B (medido el 14-nov). Más claro si se parece al del carro.
    const golpeadas = [...coloresDelCarro(danos, c.letra)]
      .map(([pieza, color]) => ({ malla: porId.get(pieza), color: colorDeLaSenal(color, c.color), pedido: color }))
      .filter((g) => g.malla);
    if (golpeadas.some((g) => g.color !== g.pedido)) aclarados.push(c.letra);
    modelos.set(c.letra, { raiz, golpeadas, enRojo: false, local });
  }

  // El anillo se acuesta sobre la vía en cada cuadro (render), con la pendiente del golpe.
  // Es una señal, no un objeto de la vía: sin el tono de la cámara, su rojo es el del punto.
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 48), new THREE.MeshBasicMaterial({ color: ROJO, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  anillo.visible = false;
  escena.add(anillo);

  let mapa = null;
  let renderer = null;
  let poses = [];
  let golpe = false;

  // De la escena (metros) al Mercator de MapLibre, con el golpe en el origen.
  const transformacion = (base) =>
    new THREE.Matrix4()
      .makeTranslation(centro.x, centro.y, base * escala)
      .scale(new THREE.Vector3(escala, -escala, escala))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

  // Pone cada carro sobre el relieve, con su pendiente. Devuelve la altura del golpe (relativa al
  // centro de la pantalla) o null si el relieve todavía no ha llegado.
  const acomodar = () => {
    const base = mapa.queryTerrainElevation([origen.lon, origen.lat]);
    if (base == null) return null;
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
      // trompa del carro mira hacia -z, que aquí es el norte.
      modelo.raiz.rotation.set(Math.atan2(trompa - cola, 2 * eje), -p.rumbo * GRADO, Math.atan2(der - izq, 2 * lado), 'YXZ');
      modelo.raiz.updateMatrixWorld(true);
      modelo.local.value.copy(modelo.raiz.matrixWorld).invert();
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
    return base;
  };

  return {
    id: 'choque-carros-3d',
    type: 'custom',
    // Los carros (por su letra) en que algún daño va más claro que en el paso 6 (ver colorDeLaSenal).
    aclarados,
    renderingMode: '3d',
    onAdd(m, gl) {
      mapa = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      // El tono y la exposición del Taller: la pintura está calibrada para ellos.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = EXPOSICION_DEL_TALLER;
      // Las llantas, los rines y el vidrio del carro nuevo reflejan lo que tienen alrededor; sin
      // algo que reflejar salen negros. Aquí reflejan el cielo.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const cielo = cieloParaReflejar(sol);
      escena.environment = pmrem.fromScene(cielo, 0.02).texture;
      escena.environmentIntensity = REFLEJO_DEL_CIELO;
      pmrem.dispose();
      cielo.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      // Los sombreadores de todo, ya: three compila cada uno el primer cuadro en que lo dibuja, y el
      // anillo solo se dibuja en el golpe. Compilado ahí, la película se frenaba justo en el instante
      // que importa. compile() recorre también lo que está escondido (los carros, antes del relieve).
      renderer.compile(escena, camara);
    },
    render(gl, matriz) {
      if (!mapa || !renderer) return;
      const base = acomodar();
      if (base == null) return;
      // Toda la matriz de MapLibre, de la escena a la pantalla.
      const total = new THREE.Matrix4().fromArray(matriz).multiply(transformacion(base));
      // El ojo es el único punto que esa matriz manda a w = 0 con x = y = 0: el centro de la cámara.
      const ojo = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(total.clone().invert());
      if (Math.abs(ojo.w) > 1e-9) camara.position.set(ojo.x / ojo.w, ojo.y / ojo.w, ojo.z / ojo.w);
      else camara.position.set(0, 0, 0);
      camara.updateMatrixWorld(true);
      // Con el ojo en su sitio, la proyección se corrige para que proyección × vista siga siendo la
      // matriz de MapLibre: el carro queda donde estaba, y el relieve lo sigue tapando igual.
      camara.projectionMatrix.copy(total).multiply(camara.matrixWorld);
      camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
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
