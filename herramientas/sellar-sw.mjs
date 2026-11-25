// Escribe en sw.js la lista de archivos de la app con el SHA-256 de cada uno (sw.js cuenta para qué).
//
//   npm run sellar   → después de cambiar cualquier archivo de la página y antes del commit.
//
// Si se olvida, pruebas/sin-senal.test.js falla: publicar es `git push`, y una lista vieja dejaría a
// la gente con la app anterior.
//
// Qué va en el núcleo (se baja entero al instalar) no se escribe a mano: sale de seguir los import
// desde js/app.js, también los dinámicos. Así un módulo nuevo entra solo, y uno que se borra sale.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Lo que es de la página. Nada más entra: ni las herramientas, ni las pruebas, ni los documentos
// (PLAN.md vive en esta misma carpeta y no puede salir nunca), ni el video, ni sw.js.
const PAGINAS = ['index.html', 'zona-3d.html', 'manifest.webmanifest'];
const CARPETAS = ['css', 'js', 'img', 'datos'];
const EXTENSIONES = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.png', '.jpg', '.webp', '.wasm', '.onnx']);
const DE_TEXTO = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg']);

// Lo del núcleo que ningún import nombra.
const NUCLEO_APARTE = ['index.html', 'manifest.webmanifest', 'css/app.css', 'js/vendor/leaflet/leaflet.css', 'js/vendor/leaflet/leaflet.js', 'datos/ejemplo-teusaquillo.json'];
const ENTRADA = 'js/app.js';
// El motor del lector de placas (18 MB) no puede retrasar que la app abra: se guarda al usarlo.
const NUNCA_EN_EL_NUCLEO = /^js\/vendor\/placa\//;

const aBarras = (ruta) => ruta.split(path.sep).join('/');

function recorrer(carpeta) {
  const salida = [];
  for (const e of fs.readdirSync(path.join(RAIZ, carpeta), { withFileTypes: true })) {
    const ruta = `${carpeta}/${e.name}`;
    if (e.isDirectory()) salida.push(...recorrer(ruta));
    else if (EXTENSIONES.has(path.extname(e.name).toLowerCase())) salida.push(ruta);
  }
  return salida;
}

export function archivosDeLaPagina() {
  return [...PAGINAS.filter((p) => fs.existsSync(path.join(RAIZ, p))), ...CARPETAS.flatMap(recorrer)].map(aBarras).sort();
}

// Los bytes que GitHub va a servir. Git guarda los textos con LF aunque en este PC (Windows) estén
// con CRLF: si se calculara con lo que hay en el disco, el SHA no cuadraría con lo publicado y el
// service worker no se instalaría nunca.
export function bytesPublicados(ruta) {
  const bytes = fs.readFileSync(path.join(RAIZ, ruta));
  if (!DE_TEXTO.has(path.extname(ruta).toLowerCase())) return bytes;
  return Buffer.from(bytes.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
}

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Los módulos que se alcanzan desde `entrada`: import, export … from e import('…') con un texto fijo.
export function grafoDeModulos(entrada) {
  const vistos = new Set();
  const pendientes = [entrada];
  while (pendientes.length) {
    const ruta = pendientes.pop();
    if (vistos.has(ruta)) continue;
    vistos.add(ruta);
    const texto = fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
    const nombres = [
      ...texto.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?\bfrom\s*['"]([^'"]+)['"]/g),
      ...texto.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g),
      ...texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
      // Los import de varios renglones: «} from './x.js'».
      ...texto.matchAll(/\}\s*from\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);
    for (const nombre of nombres) {
      const destino = nombre === 'three' ? 'js/vendor/three/three.module.min.js' : nombre.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(ruta), nombre)) : null;
      if (destino && !NUNCA_EN_EL_NUCLEO.test(destino)) pendientes.push(destino);
    }
  }
  return vistos;
}

// Los íconos que la página y el manifiesto nombran: sin ellos, agregarla a inicio sin señal dejaría
// un cuadro en blanco.
function iconos() {
  const ruta = path.join(RAIZ, 'manifest.webmanifest');
  if (!fs.existsSync(ruta)) return [];
  const delManifiesto = JSON.parse(fs.readFileSync(ruta, 'utf8')).icons.map((i) => i.src);
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const deLaPagina = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set([...delManifiesto, ...deLaPagina])].map((r) => r.replace(/^\.\//, ''));
}

export function armarLista() {
  const todos = archivosDeLaPagina();
  const enNucleo = new Set([...NUCLEO_APARTE, ...iconos(), ...grafoDeModulos(ENTRADA)]);
  for (const ruta of enNucleo) if (!todos.includes(ruta)) throw new Error(`El núcleo pide «${ruta}» y no está en la página`);
  const nucleo = {};
  const despues = {};
  for (const ruta of todos) (enNucleo.has(ruta) ? nucleo : despues)[ruta] = sha(bytesPublicados(ruta));
  const version = sha(JSON.stringify({ nucleo, despues })).slice(0, 12);
  return { version, nucleo, despues };
}

const BLOQUE = /(\/\* LISTA:[^\n]*\*\/\n)const LISTA = [^\n]*;(\n\/\* FIN DE LA LISTA \*\/)/;

export function listaEscrita() {
  const texto = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').replaceAll('\r\n', '\n');
  const m = /\nconst LISTA = ([^\n]*);\n/.exec(texto);
  return m ? JSON.parse(m[1]) : null;
}

export function sellar() {
  const ruta = path.join(RAIZ, 'sw.js');
  const texto = fs.readFileSync(ruta, 'utf8').replaceAll('\r\n', '\n');
  if (!BLOQUE.test(texto)) throw new Error('sw.js no tiene el bloque de la lista');
  const lista = armarLista();
  const nuevo = texto.replace(BLOQUE, (_, antes, despues) => `${antes}const LISTA = ${JSON.stringify(lista)};${despues}`);
  if (nuevo !== texto) fs.writeFileSync(ruta, nuevo);
  return { lista, cambio: nuevo !== texto };
}

export const pesoDe = (rutas) => rutas.reduce((t, r) => t + bytesPublicados(r).length, 0);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { lista, cambio } = sellar();
  const mb = (rutas) => (pesoDe(rutas) / 1e6).toFixed(2) + ' MB';
  const nucleo = Object.keys(lista.nucleo);
  const despues = Object.keys(lista.despues);
  console.log(`${cambio ? 'sw.js sellado' : 'sw.js ya estaba al día'}: versión ${lista.version}`);
  console.log(`  Al instalar: ${nucleo.length} archivos, ${mb(nucleo)}`);
  console.log(`  Al usarlos:  ${despues.length} archivos, ${mb(despues)}`);
}
