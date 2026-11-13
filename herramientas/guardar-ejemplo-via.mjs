// Guarda respuestas REALES de Overpass para las pruebas, en pruebas/datos/.
// Se corre a mano (`npm run ejemplos-via`) cuando cambia la consulta de
// js/via.js: las pruebas nunca tocan internet.
// Datos © colaboradores de OpenStreetMap, licencia ODbL (ver pruebas/datos/LEEME.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consultaDeLaVia } from '../js/via.js';
import { consultarOverpass } from '../js/servicios.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'pruebas', 'datos');

// Desde Node sí se puede (y se debe) decir quién pregunta.
const buscar = (url, opciones) => fetch(url, { ...opciones, headers: { ...opciones.headers, 'User-Agent': 'choque-claro-pruebas/0.1' } });

// La curva más cerrada de la medición del 12-nov-2026 (radio 13 m).
const CURVA = { lat: 4.6484, lon: -74.0105 };

// Un semáforo cualquiera de Chapinero: se busca en el mapa, no se adivina la
// esquina.
async function semaforoEnChapinero() {
  const r = await consultarOverpass('[out:json][timeout:25];node(4.640,-74.070,4.660,-74.055)["highway"="traffic_signals"];out 1;', { buscar });
  const n = r.elements[0];
  if (!n) throw new Error('No hubo semáforo en la caja');
  return { lat: n.lat, lon: n.lon };
}

async function guardar(nombre, punto) {
  const consulta = consultaDeLaVia(punto);
  const respuesta = await consultarOverpass(consulta, { buscar });
  fs.mkdirSync(DESTINO, { recursive: true });
  const archivo = path.join(DESTINO, nombre + '.json');
  const contenido = { punto, fecha: new Date().toISOString(), fuente: '© colaboradores de OpenStreetMap (ODbL), vía Overpass', consulta, respuesta };
  fs.writeFileSync(archivo, JSON.stringify(contenido, null, 1));
  console.log(nombre, JSON.stringify(punto), respuesta.elements.length, 'elementos,', fs.statSync(archivo).size, 'bytes');
}

await guardar('curva-verjones-patios', CURVA);
await new Promise((r) => setTimeout(r, 1500));
await guardar('semaforo-chapinero', await semaforoEnChapinero());
