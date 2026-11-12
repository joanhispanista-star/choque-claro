// Las cuentas de geometría que necesita el análisis de la vía.
//
// Todo pasa en distancias de decenas o cientos de metros alrededor del punto
// del choque. A esa escala, un plano local (equirrectangular) se equivoca en
// milímetros y es mucho más fácil de probar que las fórmulas esféricas. No
// sirve para distancias de kilómetros: aquí nunca hacen falta.
const RADIO_TIERRA = 6371008.8; // metros, radio medio
const GRADO = Math.PI / 180;

// Convierte {lat, lon} a metros {x: hacia el este, y: hacia el norte}
// alrededor de `origen`, y de vuelta.
export function planoLocal(origen) {
  const kLat = GRADO * RADIO_TIERRA;
  const kLon = kLat * Math.cos(origen.lat * GRADO);
  return {
    aMetros: (p) => ({ x: (p.lon - origen.lon) * kLon, y: (p.lat - origen.lat) * kLat }),
    aGrados: (m) => ({ lat: origen.lat + m.y / kLat, lon: origen.lon + m.x / kLon }),
  };
}

export function distancia(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// El punto del segmento a-b más cercano a p: { punto, t (0 a 1), distancia }.
export function proyectarEnSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const punto = { x: a.x + t * dx, y: a.y + t * dy };
  return { punto, t, distancia: distancia(p, punto) };
}

// Rumbo de a hacia b en grados: 0 = norte, 90 = este, 180 = sur, 270 = oeste.
export function rumbo(a, b) {
  const r = Math.atan2(b.x - a.x, b.y - a.y) / GRADO;
  return (r + 360) % 360;
}

// La diferencia más corta entre dos rumbos, de 0 a 180 grados.
export function diferenciaAngular(a, b) {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

const PUNTOS_CARDINALES = [
  'norte', 'norte-noreste', 'noreste', 'este-noreste',
  'este', 'este-sureste', 'sureste', 'sur-sureste',
  'sur', 'sur-suroeste', 'suroeste', 'oeste-suroeste',
  'oeste', 'oeste-noroeste', 'noroeste', 'norte-noroeste',
];

export function puntoCardinal(grados) {
  const g = ((grados % 360) + 360) % 360;
  return PUNTOS_CARDINALES[Math.round(g / 22.5) % 16];
}

// Números para leer en Colombia: coma decimal ("0,1 mm", "18,7 km").
export function numero(valor, decimales = 0) {
  return valor.toFixed(decimales).replace('.', ',');
}
