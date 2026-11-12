// Las consultas a servicios de afuera (el mapa y el clima), con lo que hay que
// aguantarles. Los Overpass públicos se llenan, así que se prueban tres
// servidores, cada uno con su tiempo límite, y si todos fallan se dice; no se
// inventa un análisis.
//
// El orden sale de una medición del 12-nov-2026 a las 5:30 p. m., con la
// misma consulta: openstreetmap.fr respondió en 0,8 s; mail.ru, en 17,6 s;
// overpass-api.de (el "oficial"), en 58 s; private.coffee y kumi.systems no
// respondieron en 75 s. Esa mañana overpass-api.de también dio 502 y 504.
// openstreetmap.fr y overpass-api.de dejan consultar desde el navegador
// (CORS); mail.ru no se pudo comprobar, por eso va de último.
//
// `buscar` es fetch, inyectable para las pruebas. OJO: fetch no se puede
// llamar como método de otro objeto (opciones.buscar(...) da "Illegal
// invocation" en Chrome); por eso se envuelve en una función.
export const SERVIDORES_OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const fetchDelNavegador = (...args) => globalThis.fetch(...args);

async function conLimite(buscar, url, opciones, limiteMs) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), limiteMs);
  try {
    return await buscar(url, { ...opciones, signal: control.signal });
  } finally {
    clearTimeout(reloj);
  }
}

export async function consultarOverpass(consulta, { buscar = fetchDelNavegador, servidores = SERVIDORES_OVERPASS, limiteMs = 25000 } = {}) {
  const fallas = [];
  for (const servidor of servidores) {
    try {
      // POST con formulario: es una petición "simple", sin preflight de CORS.
      const r = await conLimite(buscar, servidor, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(consulta) }, limiteMs);
      if (!r.ok) {
        fallas.push(`${new URL(servidor).host}: ${r.status}`);
        continue;
      }
      return await r.json();
    } catch (error) {
      fallas.push(`${new URL(servidor).host}: ${error.name === 'AbortError' ? 'no respondió a tiempo' : error.message}`);
    }
  }
  const error = new Error('No se pudo consultar el mapa: los servidores públicos no respondieron. Prueba otra vez en un momento.');
  error.detalle = fallas.join(' · ');
  throw error;
}

export async function consultarJson(url, { buscar = fetchDelNavegador, limiteMs = 15000 } = {}) {
  let r;
  try {
    r = await conLimite(buscar, url, {}, limiteMs);
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'El servicio no respondió a tiempo.' : 'Sin conexión con el servicio.');
  }
  if (!r.ok) throw new Error(`El servicio respondió con un error (${r.status}).`);
  return r.json();
}
