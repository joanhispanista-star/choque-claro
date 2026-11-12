// Servidor estático mínimo, sin dependencias, para abrir la app en el
// navegador del PC: los módulos de JavaScript no cargan desde un archivo
// abierto con doble clic (file://).
//
// Copiado del Taller de Pintura el 12-nov-2026, SIN las cabeceras de
// aislamiento (COOP/COEP) de allá: aquí no hay motor con hilos, y COEP
// bloquearía las teselas del mapa, que vienen de otro dominio.
//
//   node herramientas/servidor.js            → http://127.0.0.1:8320
//   node herramientas/servidor.js 8320 --red → también desde el celular
//
// OJO con --red: por http y con la IP del Wi-Fi (http://192.168…) el
// celular NO entrega la ubicación, ni la cámara en vivo, ni la brújula; el
// navegador solo las da en https o en 127.0.0.1. Sirve para ver cómo se ve;
// para probar de verdad hay que publicar (GitHub Pages es https).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.argv[2]) || 8320;
const EN_RED = process.argv.includes('--red');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http
  .createServer((peticion, respuesta) => {
    // Una URL mal formada ("/%" o "/%E0") hace que decodeURIComponent lance,
    // y con --red cualquier aparato de la Wi-Fi puede mandarla: sin esta
    // captura tumbaba el servidor entero (pasó en el taller). El byte nulo,
    // además, hace lanzar a fs.readFile.
    let ruta;
    try {
      ruta = decodeURIComponent(new URL(peticion.url, 'http://x').pathname);
    } catch {
      respuesta.writeHead(400);
      respuesta.end();
      return;
    }
    if (ruta.includes(String.fromCharCode(0))) {
      respuesta.writeHead(400);
      respuesta.end();
      return;
    }
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = path.join(RAIZ, path.normalize(ruta));
    if (!archivo.startsWith(RAIZ)) {
      respuesta.writeHead(403);
      respuesta.end();
      return;
    }
    fs.readFile(archivo, (error, datos) => {
      if (error) {
        respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        respuesta.end('No existe: ' + ruta);
        return;
      }
      respuesta.writeHead(200, {
        'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
        // Sin caché: cada recarga trae el archivo recién editado.
        'Cache-Control': 'no-store',
      });
      respuesta.end(datos);
    });
  })
  .listen(PUERTO, EN_RED ? '0.0.0.0' : '127.0.0.1', () => {
    console.log('App en http://127.0.0.1:' + PUERTO + '/');
    if (EN_RED) {
      for (const interfaces of Object.values(os.networkInterfaces())) {
        for (const i of interfaces) {
          if (i.family === 'IPv4' && !i.internal) console.log('Desde el celular (sin GPS ni cámara, es http): http://' + i.address + ':' + PUERTO + '/');
        }
      }
    }
  });
