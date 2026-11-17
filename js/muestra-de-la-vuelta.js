// La vuelta del EJEMPLO: cinco fotos reales de OTRO choque, puestas como muestra de cómo se ve la
// escena en 360°. Joan pidió el lun 16-nov-2026 «fotos reales de un accidente online, para tener una
// escena como ejemplo»; vio cuatro juegos con licencia libre y el mar 17-nov dijo «Sí, arranca» a
// este: Belgrano, Buenos Aires, 28-oct-2006, dos carros (un Daewoo Lanos rojo y un Renault 19
// oscuro), cinco fotos de Ernesto (etagwerker) en Flickr.
//
// Lo que NO son, y la página lo dice al lado de cada foto: no son de este ejemplo, ni de este lugar,
// ni del día. El choque del ejemplo es inventado; estas fotos son de un choque de verdad de otro país.
// Por eso no llevan GPS, ni hora, ni huella, ni van como conos en el mapa.
//
// También se toman distinto. La vuelta del paso 4 se hace PARADO en el golpe, girando sobre uno
// mismo; estas se tomaron CAMINANDO alrededor de los dos carros. Cada una va en el círculo según
// desde dónde se tomó (`desde`: 0° es delante de la trompa del carro rojo, en el sentido del reloj
// visto desde arriba). Esos ángulos los estimaron dos revisores mirando las fotos (el 16-nov), no una
// brújula: el autor no dejó coordenadas. Los tres lados sin foto (adelante, adelante a la derecha y
// atrás) salen vacíos: rellenarlos con otra foto mentiría sobre la vuelta.
//
// La licencia es CC BY-SA 2.0. Obliga a dar, con cada foto, el título, el autor, el enlace a la foto,
// el enlace a la licencia y que se modificó; y lo modificado (placas, caras, los avisos de cigarrillo
// por la Ley 1335 de 2009, y teléfonos de locales) se comparte con la misma licencia. La 2.0 no da
// plazo para corregir un crédito que falte: sin crédito, la licencia se termina. Por eso el texto
// sale de aquí y las pruebas exigen cada parte. Más detalle en datos/ejemplo-fotos/LEEME.md.
//
// Puro (sin DOM): la página es pantalla-escena-360.js.

export const MUESTRA = Object.freeze({
  lugar: 'Belgrano, Buenos Aires (Argentina)',
  fecha: '28 de octubre de 2006',
  autor: 'Ernesto (etagwerker)',
  perfil: 'https://www.flickr.com/photos/93433156@N00/',
  licencia: 'CC BY-SA 2.0',
  urlLicencia: 'https://creativecommons.org/licenses/by-sa/2.0/deed.es',
  cambios: 'placas, caras, avisos de cigarrillo y teléfonos difuminados',
  fotos: Object.freeze([
    { archivo: 'datos/ejemplo-fotos/choque-1.jpg', titulo: 'choque #1', pagina: 'https://www.flickr.com/photos/93433156@N00/282653457/', desde: 90 },
    { archivo: 'datos/ejemplo-fotos/choque-5.jpg', titulo: 'choque #5', pagina: 'https://www.flickr.com/photos/93433156@N00/282653497/', desde: 135 },
    { archivo: 'datos/ejemplo-fotos/choque-4.jpg', titulo: 'choque #4', pagina: 'https://www.flickr.com/photos/93433156@N00/282653489/', desde: 225 },
    { archivo: 'datos/ejemplo-fotos/choque-3.jpg', titulo: 'choque #3', pagina: 'https://www.flickr.com/photos/93433156@N00/282653474/', desde: 270 },
    { archivo: 'datos/ejemplo-fotos/choque-2.jpg', titulo: 'choque #2', pagina: 'https://www.flickr.com/photos/93433156@N00/282653467/', desde: 315 },
  ]),
});

// Los ocho puestos de la vuelta, cada 45°, con su nombre desde los carros.
export const LADOS = ['adelante', 'adelante a la derecha', 'la derecha', 'atrás a la derecha', 'atrás', 'atrás a la izquierda', 'la izquierda', 'adelante a la izquierda'];

// Las fotos son horizontales (2048 x 1536 en el original): alto / ancho.
export const PROPORCION_DE_LA_MUESTRA = 3 / 4;

const normal = (g) => ((g % 360) + 360) % 360;

// Los ocho paneles del círculo, con foto o vacíos. `angulo` es el puesto del panel en el visor (que
// crece hacia la derecha, como el rumbo), no una brújula. Va al revés que `desde` (180° - desde)
// porque estas fotos miran HACIA ADENTRO, a los carros, y el visor está hecho para la vuelta del
// paso 4, que mira hacia afuera. Así, girar a la derecha es correrse a la derecha alrededor de los
// carros (contra el reloj visto desde arriba), y lo que sale por el borde derecho de una foto sigue
// en la de al lado: desde adelante a la izquierda, el costado izquierdo de los carros se aleja hacia
// la derecha de la foto, y la siguiente a la derecha es la de la izquierda.
export function panelesDeLaMuestra(muestra = MUESTRA) {
  return LADOS.map((lado, k) => {
    const desde = k * 45;
    const foto = muestra.fotos.find((f) => normal(f.desde) === desde) ?? null;
    return { desde, angulo: normal(180 - desde), lado, foto };
  });
}

// La primera que se ve: la trompa hundida del carro rojo (desde adelante a la izquierda).
export function panelDeArranque(paneles) {
  return paneles.find((p) => p.desde === 315 && p.foto) ?? paneles.find((p) => p.foto) ?? paneles[0];
}

// Lo que se dice debajo del visor de la foto que queda de frente. Sin «3 de 5»: al lado del título
// del autor («choque #2») un número propio confundía.
export function textoDeLaMuestra(panel, muestra = MUESTRA) {
  if (!panel) return '';
  // De los lados vacíos solo se sabe que ninguna de las 5 fotos publicadas es de ahí: el autor pudo
  // tomar más y no subirlas (revisión del 17-nov-2026).
  if (!panel.foto) return `Desde ${panel.lado}: no hay foto; ninguna de las ${muestra.fotos.length} publicadas es de este lado.`;
  return `Muestra desde ${panel.lado} de los carros · «${panel.foto.titulo}», foto de ${muestra.autor} · ${muestra.licencia} · otro choque, no el de este ejemplo`;
}

// El crédito, completo, como lo pide CC BY-SA 2.0: el autor, la licencia con su enlace, qué se
// cambió y que lo cambiado sigue con la misma licencia, una vez para las cinco (son del mismo autor
// y la misma licencia: repetido cinco veces no se leía); y el título de cada foto con el enlace a su
// original, en el orden del autor. La página pone `urlLicencia` y cada `pagina` como enlaces.
export function creditosDeLaMuestra(muestra = MUESTRA) {
  return {
    texto: `Fotos de ${muestra.autor} en Flickr, con licencia ${muestra.licencia}. Choque Claro las modificó (${muestra.cambios}); estas versiones también son ${muestra.licencia}.`,
    urlLicencia: muestra.urlLicencia,
    originales: [...muestra.fotos].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true })).map((f) => ({ titulo: f.titulo, pagina: f.pagina })),
  };
}

export const PRESENTACION_DE_LA_MUESTRA = `En el ejemplo, la vuelta es una MUESTRA: 5 fotos reales de otro choque (${MUESTRA.lugar}, ${MUESTRA.fecha}), tomadas caminando alrededor de los dos carros. No son de este ejemplo ni de este lugar. En un reporte de verdad, aquí salen las 8 fotos de la vuelta del paso 4, tomadas parado en el golpe, con su hora, su GPS y su huella.`;

export const NOTA_DE_LA_MUESTRA = 'Cada foto va en el círculo según desde dónde se tomó, alrededor de los dos carros. Esos ángulos se estimaron mirando las fotos: no hay brújula. Los tres lados sin foto salen vacíos.';
