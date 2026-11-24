// La ciudad de la vista realista sobre la maqueta abierta: una capa propia de MapLibre que comparte su
// WebGL, como la de los carros (maqueta-carros.js, donde está medido cómo se sientan las cosas en el
// relieve y cómo se saca el ojo de la matriz del mapa). Las cuentas están en ciudad.js; qué se enciende
// y qué se dice de ella, en vista-realista.js.
//
// Tres cosas que hace y que no se ven en el código de una:
//  - Cada casa sabe la altura de su suelo y cuánto está «bajada» por una textura de un renglón
//    (uEstado): cambiar una casa es cambiar un punto, no rehacer la malla.
//  - Las casas que quedan entre la cámara y los carros se bajan solas hasta un zócalo, para poder ver.
//    Se bajan del todo, no a medias ni transparentes: a medias parecería que se ve a través.
//  - Los árboles son láminas que miran a la cámara. Desde arriba no se dibujan: ahí la copa es la de la
//    foto aérea, y una lámina de pie se ve como una raya.
import * as THREE from 'three';
import { armarCiudad, azar, queTapan } from './ciudad.js';

const HORIZONTE = '#dfe9f3';
const ZOCALO_M = 0.35;
const BAJAR_MS = 450;

// Una textura de una dirección, de una imagen ya cargada o de un lienzo.
function texturaDe(fuente, { repetir = false } = {}) {
  const lista = (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repetir) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.needsUpdate = true;
    return t;
  };
  if (typeof fuente !== 'string') return Promise.resolve(lista(new THREE.Texture(fuente)));
  return new Promise((bien, mal) => new THREE.TextureLoader().load(fuente, (t) => bien(lista(t)), undefined, () => mal(new Error('No llegó la imagen ' + fuente))));
}

function geometriaDe(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.posicion, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(m.color, 3));
  g.setAttribute('aCasa', new THREE.Float32BufferAttribute(m.edificio, 1));
  g.setIndex(m.indice);
  return g;
}

// `imagenes`: { ladrillo, estuco, apto, culata, cielo, arboles, pisos: [cerca, lejos, fondo], tejas }:
// direcciones, imágenes o lienzos. `pisos` son las fotos aéreas (o [] donde no hay) y `medios`, el medio
// lado en metros de cada una; sin fotos, los techos llevan las `tejas`.
// `objetivos()`: los puntos { x, y, z } que tienen que verse (los carros), o [] si no hay nada que ver.
export async function capaDeLaCiudad({ maplibregl, origen, plano, edificios, arboles = [], imagenes, medios, sol = null, objetivos = () => [] }) {
  const centro = maplibregl.MercatorCoordinate.fromLngLat([origen.lon, origen.lat], 0);
  const escala = centro.meterInMercatorCoordinateUnits();
  const [ladrillo, estuco, apto, culata, cielo, hojas] = await Promise.all([
    texturaDe(imagenes.ladrillo),
    texturaDe(imagenes.estuco),
    texturaDe(imagenes.apto),
    texturaDe(imagenes.culata, { repetir: true }),
    texturaDe(imagenes.cielo),
    arboles.length ? texturaDe(imagenes.arboles) : null,
  ]);
  const pisos = await Promise.all((imagenes.pisos ?? []).map((p) => texturaDe(p)));
  const tejas = pisos.length ? [] : await Promise.all((imagenes.tejas ?? []).map((t) => texturaDe(t, { repetir: true })));
  const { lista, mallas } = armarCiudad(edificios, { medios: pisos.length ? medios : [], tejas: tejas.length });
  const cuantos = lista.length + arboles.length;
  const estado = new Float32Array(Math.max(1, cuantos) * 4); // R: cuánto está bajada; G: su suelo
  const texturaDeEstado = new THREE.DataTexture(estado, Math.max(1, cuantos), 1, THREE.RGBAFormat, THREE.FloatType);
  texturaDeEstado.needsUpdate = true;

  const escena = new THREE.Scene();
  const camara = new THREE.Camera();
  escena.add(new THREE.HemisphereLight(0xffffff, 0xa39c92, 2.0));
  const luz = new THREE.DirectionalLight(0xfff4e2, 1.3);
  luz.position.set(-0.5, 0.75, 0.45);
  // La luz viene de donde estaba el sol a esa hora; de noche o al ras, de una dirección cualquiera (la
  // vista realista es una ilustración de día: no dice cuánta luz había).
  if (sol && sol.altura > 8) {
    const az = (sol.azimut * Math.PI) / 180;
    const al = (Math.max(25, sol.altura) * Math.PI) / 180;
    luz.position.set(Math.sin(az) * Math.cos(al), Math.sin(al), -Math.cos(az) * Math.cos(al));
  }
  escena.add(luz);

  // Las casas van sin neblina: MapLibre 4.7 solo se la pone al piso muy lejos (cuenta la altura sobre el mar;
  // en Bogotá, a unos 8 km), y con neblina solo en ellas las de atrás se veían como fantasmas.
  const comunes = { uEstado: { value: texturaDeEstado }, uOjo: { value: new THREE.Vector3() } };
  const SUBIR = 'vec4 est = texelFetch(uEstado, ivec2(int(aCasa + 0.5), 0), 0); transformed.y = mix(transformed.y, min(transformed.y, ' + ZOCALO_M.toFixed(2) + '), est.r) + est.g;';
  const vestir = (material) => {
    material.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, comunes);
      s.vertexShader = 'attribute float aCasa; uniform highp sampler2D uEstado;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SUBIR);
    };
    return material;
  };
  const lata = (map, extra = {}) => vestir(new THREE.MeshLambertMaterial({ map, vertexColors: true, toneMapped: false, ...extra }));
  const geometrias = [];
  const materiales = [];
  const poner = (m, material, orden = 0) => {
    if (!m.indice.length) return;
    const g = geometriaDe(m);
    geometrias.push(g);
    materiales.push(material);
    const malla = new THREE.Mesh(g, material);
    malla.frustumCulled = false; // se mueven en la tarjeta gráfica: la caja de three no las sigue
    malla.renderOrder = orden;
    escena.add(malla);
  };
  poner(mallas.ladrillo, lata(ladrillo));
  poner(mallas.estuco, lata(estuco));
  poner(mallas.apto, lata(apto));
  poner(mallas.culata, lata(culata));
  mallas.techos.forEach((t, i) => poner(t, lata(pisos[i])));
  mallas.tejas.forEach((t, i) => poner(t, lata(tejas[i])));
  const lienzo = document.createElement('canvas');
  lienzo.width = 4;
  lienzo.height = 64;
  const pincel = lienzo.getContext('2d');
  const degradado = pincel.createLinearGradient(0, 64, 0, 0);
  degradado.addColorStop(0, 'rgba(10,12,16,0.5)');
  degradado.addColorStop(1, 'rgba(10,12,16,0)');
  pincel.fillStyle = degradado;
  pincel.fillRect(0, 0, 4, 64);
  const sombra = new THREE.CanvasTexture(lienzo);
  poner(mallas.contacto, vestir(new THREE.MeshBasicMaterial({ map: sombra, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), 1);

  // Los árboles, de la hoja de cuatro (2 × 2): los dos de arriba y, uno de cada cinco, los de abajo.
  const materialDeArboles = new THREE.ShaderMaterial({
    uniforms: { ...comunes, uMapa: { value: hojas }, uVer: { value: 1 } },
    vertexShader: 'attribute float aCasa; attribute vec3 aPie; attribute vec3 aTam; uniform highp sampler2D uEstado; uniform vec3 uOjo; varying vec2 vUv; varying float vLuz; void main(){ vec4 est = texelFetch(uEstado, ivec2(int(aCasa + 0.5), 0), 0); vec3 pie = vec3(aPie.x, est.g, aPie.z); vec2 d = uOjo.xz - pie.xz; vec2 n = normalize(d + vec2(1e-5)); vec3 der = vec3(n.y, 0.0, -n.x); vec3 p = pie + der * position.x * aTam.x + vec3(0.0, position.y * aTam.y, 0.0); vUv = uv; vLuz = aTam.z * mix(0.78, 1.05, position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'uniform sampler2D uMapa; uniform float uVer; varying vec2 vUv; varying float vLuz; void main(){ vec4 c = texture2D(uMapa, vUv); if (c.a < 0.45) discard; if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) >= uVer) discard; gl_FragColor = vec4(c.rgb * vLuz, 1.0);\n#include <colorspace_fragment>\n}',
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  if (arboles.length) {
    const p = [];
    const pie = [];
    const tam = [];
    const uv = [];
    const casa = [];
    const idx = [];
    arboles.forEach((t, i) => {
      const d = azar(i + 13);
      const cual = d < 0.45 ? 0 : d < 0.82 ? 1 : d < 0.9 ? 2 : 3;
      const u0 = (cual % 2) / 2;
      const v0 = cual < 2 ? 0.5 : 0;
      const ancho = t.alto * 0.98;
      const brillo = 0.72 + 0.22 * azar(i + 41);
      const k = p.length / 3;
      const alReves = azar(i + 7) < 0.5;
      for (const [x, y] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) {
        p.push(x, y, 0);
        pie.push(t.x, 0, -t.y);
        tam.push(ancho, t.alto, brillo);
        uv.push(u0 + 0.5 * (alReves ? 0.5 - x : x + 0.5), v0 + 0.5 * y);
        casa.push(lista.length + i);
      }
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('aPie', new THREE.Float32BufferAttribute(pie, 3));
    g.setAttribute('aTam', new THREE.Float32BufferAttribute(tam, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aCasa', new THREE.Float32BufferAttribute(casa, 1));
    g.setIndex(idx);
    geometrias.push(g);
    const malla = new THREE.Mesh(g, materialDeArboles);
    malla.frustumCulled = false;
    escena.add(malla);
  }

  // El cielo: una bóveda alrededor del ojo, pintada en el fondo de la profundidad.
  cielo.wrapS = THREE.MirroredRepeatWrapping;
  const boveda = new THREE.Mesh(
    new THREE.SphereGeometry(600, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12),
    new THREE.ShaderMaterial({
      uniforms: { uMapa: { value: cielo }, uHorizonte: { value: new THREE.Color(HORIZONTE) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: 'uniform sampler2D uMapa; uniform vec3 uHorizonte; varying vec3 vDir; void main(){ vec3 n = normalize(vDir); float az = atan(n.x, -n.z) / 3.14159265; float al = clamp(n.y, 0.0, 1.0); vec3 c = texture2D(uMapa, vec2(az, sqrt(al) * 0.98 + 0.01)).rgb; gl_FragColor = vec4(mix(uHorizonte, c, smoothstep(0.0, 0.08, n.y)), 1.0);\n#include <colorspace_fragment>\n}',
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  boveda.frustumCulled = false;
  boveda.renderOrder = -1;
  escena.add(boveda);
  geometrias.push(boveda.geometry);
  materiales.push(boveda.material, materialDeArboles);

  let mapa = null;
  let renderer = null;
  let sentada = false;
  let muestra = NaN;
  let antes = 0;
  let deUna = false;
  // Cada casa y cada árbol, en su pedazo de relieve.
  const asentar = () => {
    if (!mapa) return;
    const base = mapa.queryTerrainElevation([origen.lon, origen.lat]);
    if (base == null) return;
    const altura = (x, y) => {
      const g = plano.aGrados({ x, y });
      const h = mapa.queryTerrainElevation([g.lon, g.lat]);
      return h == null || Math.abs(h - base) > 80 ? 0 : h - base;
    };
    lista.forEach((e, k) => {
      estado[k * 4 + 1] = altura(...e.centro);
    });
    arboles.forEach((t, i) => {
      estado[(lista.length + i) * 4 + 1] = altura(t.x, t.y);
    });
    texturaDeEstado.needsUpdate = true;
    sentada = true;
    mapa.triggerRepaint();
  };
  // El relieve llega por pedazos: se vuelve a sentar cuando cambió de verdad (medio palmo o más).
  const alQuedarseQuieto = () => {
    if (!mapa) return;
    const base = mapa.queryTerrainElevation([origen.lon, origen.lat]);
    if (base == null) return;
    let suma = 0;
    for (const [x, y] of [[180, 0], [-180, 0], [0, 180], [0, -180], [90, 90], [-90, -90]]) {
      const g = plano.aGrados({ x, y });
      suma += Math.abs((mapa.queryTerrainElevation([g.lon, g.lat]) ?? base) - base);
    }
    if (!sentada || Math.abs(suma - muestra) > 0.6) asentar();
    muestra = suma;
  };
  const bajarLasQueTapan = (ojo, inclinacion) => {
    const ahora = performance.now();
    const paso = deUna ? 1 : Math.min(1, Math.min(100, ahora - antes) / BAJAR_MS);
    antes = ahora;
    const puntos = inclinacion > 20 ? objetivos() : [];
    const tapan = puntos.length ? queTapan(lista, ojo, puntos, (k) => estado[k * 4 + 1]) : new Set();
    let moviendo = false;
    let cambio = false;
    for (let k = 0; k < lista.length; k++) {
      const meta = tapan.has(k) ? 1 : 0;
      const v = estado[k * 4];
      if (v === meta) continue;
      const nuevo = meta > v ? Math.min(meta, v + paso) : Math.max(meta, v - paso);
      estado[k * 4] = nuevo;
      cambio = true;
      if (nuevo !== meta) moviendo = true;
    }
    if (cambio) texturaDeEstado.needsUpdate = true;
    if (moviendo) mapa.triggerRepaint();
  };

  return {
    id: 'choque-ciudad',
    type: 'custom',
    renderingMode: '3d',
    casas: lista.length,
    arboles: arboles.length,
    asentar,
    // La foto k cambió en su lienzo (llegó una más nítida, del mismo tamaño): los techos la vuelven a subir.
    refrescarPiso(k) {
      if (!pisos[k]) return;
      pisos[k].needsUpdate = true;
      mapa?.triggerRepaint();
    },
    // Sin la transición de bajar y subir las casas: para grabar cuadro por cuadro.
    sinTransicion(si) {
      deUna = si;
    },
    onAdd(m, gl) {
      mapa = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      m.on('idle', alQuedarseQuieto);
      alQuedarseQuieto();
    },
    onRemove() {
      mapa?.off('idle', alQuedarseQuieto);
      // Solo lo de la tarjeta gráfica: al volver a poner la capa, three lo sube otra vez.
      for (const cosa of [...geometrias, ...materiales, ladrillo, estuco, apto, culata, cielo, hojas, sombra, ...pisos, ...tejas, texturaDeEstado]) cosa?.dispose();
      renderer?.dispose();
      renderer = null;
      mapa = null;
    },
    render(gl, matriz) {
      if (!mapa || !renderer) return;
      const base = mapa.queryTerrainElevation([origen.lon, origen.lat]);
      if (base == null) return;
      const total = new THREE.Matrix4()
        .fromArray(matriz)
        .multiply(new THREE.Matrix4().makeTranslation(centro.x, centro.y, base * escala).scale(new THREE.Vector3(escala, -escala, escala)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      const ojo = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(total.clone().invert());
      if (Math.abs(ojo.w) > 1e-9) camara.position.set(ojo.x / ojo.w, ojo.y / ojo.w, ojo.z / ojo.w);
      camara.updateMatrixWorld(true);
      camara.projectionMatrix.copy(total).multiply(camara.matrixWorld);
      camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
      comunes.uOjo.value.copy(camara.position);
      boveda.position.copy(camara.position);
      const inclinacion = mapa.getPitch();
      materialDeArboles.uniforms.uVer.value = Math.max(0, Math.min(1, (inclinacion - 26) / 16));
      bajarLasQueTapan({ x: camara.position.x, y: -camara.position.z, z: camara.position.y }, inclinacion);
      renderer.resetState();
      renderer.render(escena, camara);
    },
  };
}
