// Abrir el punto del choque en Google Maps y en Street View, para el abogado o
// el analista que quiera ver la zona con las imágenes de Google.
//
// Son las "URL de Maps" de Google (developers.google.com/maps/documentation/urls):
// no piden clave ni cuenta de facturación, y en el celular abren la app de
// Google Maps si está instalada. Ojo con lo que se ve allá: NO es del día del
// choque. Las fotos de Street View y del satélite pueden tener meses o años, y
// en ese tiempo se repinta una línea o se quita una señal. La pantalla lo dice;
// la prueba del día son las fotos de la escena.
//
// Al tocar el enlace, el punto se le manda a Google: lo hace la persona, no la app.
export function enlacesDeGoogle(punto, { rumbo = null } = {}) {
  const coordenadas = `${punto.lat.toFixed(6)},${punto.lon.toFixed(6)}`;
  const mapa = new URL('https://www.google.com/maps/search/');
  mapa.searchParams.set('api', '1');
  mapa.searchParams.set('query', coordenadas);
  const calle = new URL('https://www.google.com/maps/@');
  calle.searchParams.set('api', '1');
  calle.searchParams.set('map_action', 'pano');
  calle.searchParams.set('viewpoint', coordenadas);
  // Mirando a lo largo de la vía: así la primera vista de Street View es la vía, no una fachada.
  if (Number.isFinite(rumbo)) calle.searchParams.set('heading', String(Math.round(((rumbo % 360) + 360) % 360)));
  return { mapa: mapa.toString(), calle: calle.toString() };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-11-12T22:30:59Z" → "12-nov-2026", en la hora de Colombia (UTC-5, sin
// horario de verano): un dato guardado de noche en Bogotá es de ese día, no
// del siguiente en Londres.
export function fechaCorta(iso) {
  const f = new Date(Date.parse(iso) - 5 * 3600000);
  if (Number.isNaN(f.getTime())) return '';
  return `${f.getUTCDate()}-${MESES[f.getUTCMonth()]}-${f.getUTCFullYear()}`;
}
