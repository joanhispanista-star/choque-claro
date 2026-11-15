// El mapa de la pantalla "¿Dónde fue?", sobre Leaflet 1.9.4 (copiado en
// js/vendor/leaflet, sin CDN, como el Three.js del taller).
//
// Las teselas son las de OpenStreetMap: sirven para el demo, pero su política
// no admite una app con mucho tráfico; para vender hay que pagar un proveedor
// o servir las propias (PLAN.md).
//
// Los colores no van aquí: cada capa lleva una clase y app.css la pinta con
// las variables de la paleta.
const BOGOTA = [4.65, -74.08];

const PIN = '<svg viewBox="0 0 36 46" aria-hidden="true"><path d="M18 44.5S3.5 27.6 3.5 17.2a14.5 14.5 0 0 1 29 0C32.5 27.6 18 44.5 18 44.5z"/><circle cx="18" cy="17" r="5.5"/></svg>';

export function crearMapa(contenedor, { alTocar = () => {}, alSoltarPin = () => {} } = {}) {
  const L = globalThis.L;
  if (!L) throw new Error('El mapa no cargó. Recarga la página.');
  const mapa = L.map(contenedor, { zoomControl: true, attributionControl: true }).setView(BOGOTA, 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>',
  }).addTo(mapa);
  mapa.attributionControl.setPrefix(false);
  const icono = L.divIcon({ className: 'pin-choque', html: PIN, iconSize: [36, 46], iconAnchor: [18, 45] });
  let pin = null;
  let circulo = null;
  const capaVia = L.layerGroup().addTo(mapa);
  mapa.on('click', (e) => alTocar({ lat: e.latlng.lat, lon: e.latlng.lng }));
  return {
    // `precision` (m) dibuja el círculo de lo que el GPS no sabe. Si el pin
    // se arrastra, el círculo se queda donde lo puso el GPS: es la prueba de
    // que el punto se corrigió a mano.
    ponerPin(punto, { precision = null, acercar = true } = {}) {
      const ll = [punto.lat, punto.lon];
      if (!pin) {
        pin = L.marker(ll, { icon: icono, draggable: true, keyboard: false, title: 'Punto del choque', alt: 'Punto del choque' }).addTo(mapa);
        pin.on('dragend', () => {
          const p = pin.getLatLng();
          alSoltarPin({ lat: p.lat, lon: p.lng });
        });
      } else {
        pin.setLatLng(ll);
      }
      if (circulo) {
        circulo.remove();
        circulo = null;
      }
      if (precision) circulo = L.circle(ll, { radius: precision, className: 'circulo-precision', interactive: false }).addTo(mapa);
      if (acercar) mapa.setView(ll, Math.max(mapa.getZoom(), 17));
    },
    dibujarVia(analisis) {
      capaVia.clearLayers();
      if (!analisis || analisis.estado !== 'ok') return;
      L.polyline(analisis.tramo, { className: 'tramo-analizado', interactive: false }).addTo(capaVia);
      for (const s of analisis.senales) {
        L.circleMarker([s.lat, s.lon], { radius: 7, className: 'senal-mapa' }).bindTooltip(`${s.texto} a ${Math.round(s.distancia)}\u00a0m`).addTo(capaVia);
      }
    },
    ajustar() {
      mapa.invalidateSize();
    },
  };
}
