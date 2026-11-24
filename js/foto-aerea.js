// La foto aérea abierta de Bogotá para la vista realista: la ortofoto de 2017 del Catastro y la FAC
// (CC BY 4.0), servida por Catastro con CORS y sin llave. Aquí está de dónde se pide, cómo se le corrige
// el color y cuándo se da por perdida. Quien la usa es vista-realista.js.
//
// Se pide de dos maneras, y por eso la vista casi nunca se queda sin piso (medido el 24-nov-2026):
//  - Las teselas que el servicio ya tiene hechas, hasta el nivel 18 (60 cm por píxel): 64 en 1,9 s. Con
//    ellas se arma todo el piso, los techos y los niveles del color.
//  - Dos fotos a la medida, de 100 y 400 m, con 10 y 20 cm por píxel: de 0,7 s a más de 15 s cada una,
//    según el día. Si se demoran, la vista se enciende sin ellas y entran cuando lleguen.
// El nivel 19 sale en la ficha del servicio, pero llega vacío.
export const CREDITO_DE_LA_FOTO = 'Foto aérea 2017: <a href="https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/imagenes/Ortho2017/MapServer">Catastro de Bogotá y FAC</a> (CC BY 4.0)';
export const NIVEL_MAS_FINO = 18;
const SERVICIO = 'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/imagenes/Ortho2017/MapServer';
// Lo que cubre el servicio según su propia ficha (consultada el 24-nov-2026), con 1 km de margen.
const COBERTURA = { oeste: -74.222, este: -73.992, sur: 4.45, norte: 4.84 };
const LADO_DE_TESELA = 256;
// Medio lado de cada foto del reporte, en metros del plano de la app (geo.js): las dos nítidas y la de los
// techos de lejos (las casas llegan hasta 430 m). Los de 50 y 200 son los de Web Mercator, que toma una
// Tierra un 0,11 % más grande.
export const MEDIOS_DE_BOGOTA = [49.944, 199.776, 600];
// Cuánto se esperan las dos fotos a la medida antes de encender sin ellas.
const ESPERA_MS = 6000;
// Con menos de esta parte de las teselas, la foto se da por perdida: un piso a parches confunde más que el
// dibujo del mapa.
const PARTE_MINIMA = 0.7;

const RADIO_WEB = 6378137;
const RADIO_DEL_PLANO = 6371008.8;
const G = Math.PI / 180;

export const dentroDeLaFoto = ({ lat, lon }) => lat > COBERTURA.sur && lat < COBERTURA.norte && lon > COBERTURA.oeste && lon < COBERTURA.este;

// Una foto cuadrada a la medida, centrada en el punto. `medio`, en metros del plano de la app.
export function direccionDeLaFoto({ lat, lon }, medio, px) {
  const x = lon * G * RADIO_WEB;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * G) / 2)) * RADIO_WEB;
  const h = (medio * (RADIO_WEB / RADIO_DEL_PLANO)) / Math.cos(lat * G);
  const caja = [x - h, y - h, x + h, y + h].map((v) => v.toFixed(2)).join(',');
  return `${SERVICIO}/export?bbox=${caja}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=jpg&transparent=false&f=image`;
}

// Las teselas de ArcGIS van fila y columna, al revés de las de un mapa web.
export const direccionDeLaTesela = ({ z, x, y }) => `${SERVICIO}/tile/${z}/${y}/${x}`;

// El centro y el medio lado de un cuadro, en coordenadas de Mercator de 0 a 1 (las del mapa).
export function cuadroEnMercator({ lat, lon }, medio) {
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.asinh(Math.tan(lat * G)) / Math.PI) / 2,
    h: medio / (2 * Math.PI * RADIO_DEL_PLANO * Math.cos(lat * G)),
  };
}

// Las teselas que tocan un cuadro, y qué pedazo de ellas, juntas, es el cuadro: se pegan en un lienzo de
// `columnas` × `filas` y de ahí se recorta (`desde` y `lado`, en teselas).
export function teselasDelCuadro(centro, medio, z) {
  const { x, y, h } = cuadroEnMercator(centro, medio);
  const n = 2 ** z;
  const [i0, i1] = [Math.floor((x - h) * n), Math.floor((x + h) * n)];
  const [j0, j1] = [Math.floor((y - h) * n), Math.floor((y + h) * n)];
  const teselas = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) teselas.push({ z, x: i, y: j, columna: i - i0, fila: j - j0 });
  return { teselas, columnas: i1 - i0 + 1, filas: j1 - j0 + 1, desde: { x: (x - h) * n - i0, y: (y - h) * n - j0 }, lado: 2 * h * n };
}

// Los niveles de una foto: por canal, del 0,5 % más oscuro al 0,5 % más claro. La foto de 2017 trae la
// bruma azul de Bogotá; estirarla por canal la quita en cualquier barrio sin inventar nada.
export function nivelesDe(datos, paso = 4) {
  const cuenta = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let total = 0;
  for (let i = 0; i < datos.length; i += 4 * paso) {
    for (let c = 0; c < 3; c++) cuenta[c][datos[i + c]]++;
    total++;
  }
  const tope = total * 0.005;
  return cuenta.map((c) => {
    let abajo = 0;
    for (let s = c[0]; abajo < 255 && s < tope; s += c[abajo]) abajo++;
    let arriba = 255;
    for (let s = c[255]; arriba > 0 && s < tope; s += c[arriba]) arriba--;
    return arriba - abajo < 24 ? [0, 255] : [abajo, arriba];
  });
}

const [PISO, TECHO] = [14, 238];
export function tablaDeNiveles([abajo, arriba], { gama = 0.94 } = {}) {
  return Uint8ClampedArray.from({ length: 256 }, (_, v) => PISO + Math.pow(Math.min(1, Math.max(0, (v - abajo) / (arriba - abajo))), gama) * (TECHO - PISO));
}

// Cuánto hay que aclarar (o bajar) una foto para que lo de la mitad quede con el brillo de una calle de
// día. El vuelo se hizo en varios días y horas: con la misma curva para toda la ciudad, Teusaquillo
// quedaba bien y Chapinero, casi de noche.
const BRILLO_DEL_MEDIO = 105;
export function gamaPara(datos, niveles, paso = 4) {
  const cuenta = new Uint32Array(256);
  const recta = niveles.map(([abajo, arriba]) => (v) => Math.min(1, Math.max(0, (v - abajo) / (arriba - abajo))));
  let total = 0;
  for (let i = 0; i < datos.length; i += 4 * paso) {
    cuenta[Math.round(255 * (0.3 * recta[0](datos[i]) + 0.59 * recta[1](datos[i + 1]) + 0.11 * recta[2](datos[i + 2])))]++;
    total++;
  }
  let medio = 0;
  for (let s = cuenta[0]; medio < 255 && s < total / 2; s += cuenta[medio]) medio++;
  if (medio < 2 || medio > 253) return 1;
  return Math.min(1.1, Math.max(0.6, Math.log((BRILLO_DEL_MEDIO - PISO) / (TECHO - PISO)) / Math.log(medio / 255)));
}

// Corrige el color en el mismo arreglo: los niveles y un poco más de color, que la bruma apagó.
export function corregir(datos, tablas, color = 1.25) {
  for (let i = 0; i < datos.length; i += 4) {
    const r = tablas[0][datos[i]];
    const g = tablas[1][datos[i + 1]];
    const b = tablas[2][datos[i + 2]];
    const gris = 0.3 * r + 0.59 * g + 0.11 * b;
    datos[i] = gris + (r - gris) * color;
    datos[i + 1] = gris + (g - gris) * color;
    datos[i + 2] = gris + (b - gris) * color;
  }
  return datos;
}

// Si ahí no hay foto (el borde de lo que cubre el servicio): transparente, o de un solo color.
export function estaVacia(datos) {
  let distintos = 0;
  let huecos = 0;
  let total = 0;
  for (let i = 0; i < datos.length; i += 4 * 997) {
    total++;
    if (datos[i + 3] < 128) huecos++;
    else if (Math.abs(datos[i] - datos[0]) > 10) distintos++;
  }
  return huecos > total * 0.3 || distintos < Math.min(60, total * 0.15);
}

function lienzoDe(ancho, alto = ancho) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}
const pincelDe = (c) => c.getContext('2d', { willReadFrequently: true });

function corregirLienzo(c, tablas) {
  const pincel = pincelDe(c);
  const d = pincel.getImageData(0, 0, c.width, c.height);
  corregir(d.data, tablas);
  pincel.putImageData(d, 0, 0);
}

async function traerImagen(direccion, ms) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(new Error('se demoró más de ' + ms / 1000 + ' s')), ms);
  try {
    const r = await fetch(direccion, { signal: corte.signal });
    if (!r.ok) throw new Error('respondió ' + r.status);
    return await createImageBitmap(await r.blob());
  } finally {
    clearTimeout(reloj);
  }
}

// Una foto a la medida en un lienzo, o null si no llegó. El servidor a veces no contesta a la primera.
async function fotoALaMedida(centro, medio, px, ms) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const imagen = await traerImagen(direccionDeLaFoto(centro, medio, px), ms);
      const c = lienzoDe(px);
      pincelDe(c).drawImage(imagen, 0, 0, px, px);
      imagen.close?.();
      return c;
    } catch (error) {
      console.warn('Foto aérea:', error?.message ?? error);
    }
  }
  return null;
}

// Un cuadro armado con las teselas ya hechas: { lienzo, parte } (`parte`, qué tanto llegó, de 0 a 1). Se
// pegan a su tamaño y después se recorta: escaladas una por una dejan una raya en cada junta.
async function mosaico(centro, medio, z, px) {
  const { teselas, columnas, filas, desde, lado } = teselasDelCuadro(centro, medio, z);
  const T = LADO_DE_TESELA;
  const pegadas = lienzoDe(columnas * T, filas * T);
  const pincel = pincelDe(pegadas);
  let llegaron = 0;
  await Promise.all(
    teselas.map(async (t) => {
      try {
        const imagen = await traerImagen(direccionDeLaTesela(t), 9000);
        pincel.drawImage(imagen, t.columna * T, t.fila * T);
        imagen.close?.();
        llegaron++;
      } catch {
        // Un hueco: se cuenta en `parte`.
      }
    }),
  );
  const lienzo = lienzoDe(px);
  const suave = pincelDe(lienzo);
  suave.imageSmoothingQuality = 'high';
  suave.drawImage(pegadas, desde.x * T, desde.y * T, lado * T, lado * T, 0, 0, px, px);
  return { lienzo, parte: llegaron / teselas.length };
}

// Todo lo que la vista necesita de un punto de Bogotá: { lienzos, medios, tablas }, o { falta: 'mapa' } si
// ahí no hay foto, o { falta: 'sin-foto' } si la hay y no llegó. Los lienzos van de la foto más nítida a la
// más amplia, opacos y siempre del mismo tamaño: si una foto a la medida llega tarde, se pinta encima y se
// avisa con `alMejorar(k)`. `lados`: cuántos píxeles tiene cada uno.
export async function fotosDeBogota(centro, { lados = [1024, 2048, 1024], alMejorar = () => {}, espera = ESPERA_MS } = {}) {
  const reloj = new Promise((listo) => setTimeout(listo, espera));
  const nitidas = [0, 1].map((k) => fotoALaMedida(centro, MEDIOS_DE_BOGOTA[k], lados[k], 20000));
  const [media, amplia] = await Promise.all([mosaico(centro, MEDIOS_DE_BOGOTA[1], NIVEL_MAS_FINO, lados[1]), mosaico(centro, MEDIOS_DE_BOGOTA[2], NIVEL_MAS_FINO - 1, lados[2])]);
  if (media.parte < PARTE_MINIMA || amplia.parte < PARTE_MINIMA) return { falta: 'sin-foto' };
  const datos = pincelDe(media.lienzo).getImageData(0, 0, lados[1], lados[1]).data;
  if (estaVacia(datos)) return { falta: 'mapa' };
  // Los niveles salen de la de 400 m y se usan en todo: con los suyos propios, se notaría dónde empieza
  // cada foto.
  const niveles = nivelesDe(datos);
  const gama = gamaPara(datos, niveles);
  const tablas = niveles.map((n) => tablaDeNiveles(n, { gama }));
  corregirLienzo(media.lienzo, tablas);
  corregirLienzo(amplia.lienzo, tablas);
  const cerca = lienzoDe(lados[0]);
  const lienzos = [cerca, media.lienzo, amplia.lienzo];
  // Mientras llega la de cerca, va el centro de la otra.
  const prestarle = () => {
    const parte = MEDIOS_DE_BOGOTA[0] / MEDIOS_DE_BOGOTA[1];
    const pincel = pincelDe(cerca);
    pincel.imageSmoothingQuality = 'high';
    pincel.drawImage(media.lienzo, (lados[1] * (1 - parte)) / 2, (lados[1] * (1 - parte)) / 2, lados[1] * parte, lados[1] * parte, 0, 0, lados[0], lados[0]);
  };
  prestarle();
  let entregadas = false;
  let llegoLaDeCerca = false;
  const puestas = nitidas.map((promesa, k) =>
    promesa.then((c) => {
      if (!c) return;
      corregirLienzo(c, tablas);
      pincelDe(lienzos[k]).drawImage(c, 0, 0, lados[k], lados[k]);
      const cambiaron = [k];
      if (k === 0) llegoLaDeCerca = true;
      else if (!llegoLaDeCerca) {
        prestarle();
        cambiaron.push(0);
      }
      if (entregadas) alMejorar(cambiaron);
    }),
  );
  await Promise.race([Promise.all(puestas), reloj]);
  entregadas = true;
  return { lienzos, medios: MEDIOS_DE_BOGOTA, tablas };
}

// El resto del piso, tesela por tesela y con el mismo color: { imagen, x, y, lado } es el pedazo de la
// imagen que va en la tesela que pide el mapa (más cerca del nivel 18 se agranda), o null si no llegó.
export function pisoDeTeselas(tablas, { maximo = 48 } = {}) {
  const guardadas = new Map();
  const traer = async (t) => {
    const imagen = await traerImagen(direccionDeLaTesela(t), 12000);
    const c = lienzoDe(LADO_DE_TESELA);
    pincelDe(c).drawImage(imagen, 0, 0);
    imagen.close?.();
    corregirLienzo(c, tablas);
    return c;
  };
  return async ({ z, x, y }) => {
    const d = Math.max(0, z - NIVEL_MAS_FINO);
    const t = { z: z - d, x: x >> d, y: y >> d };
    const llave = `${t.z}/${t.x}/${t.y}`;
    const p = guardadas.get(llave) ?? traer(t);
    guardadas.delete(llave);
    guardadas.set(llave, p);
    if (guardadas.size > maximo) guardadas.delete(guardadas.keys().next().value);
    try {
      const lado = LADO_DE_TESELA / 2 ** d;
      return { imagen: await p, x: (x - (t.x << d)) * lado, y: (y - (t.y << d)) * lado, lado };
    } catch {
      guardadas.delete(llave);
      return null;
    }
  };
}
