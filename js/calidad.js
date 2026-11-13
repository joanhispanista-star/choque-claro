// El control de calidad de una foto ANTES de aceptarla: borrosa, oscura o
// torcida. Si falla, la app pide repetirla en el momento, que es cuando todavía
// se puede: mañana la escena ya no existe. Todo puro: se prueba en Node.
//
// - Borrosa: la varianza del laplaciano, pero POR EJES. El laplaciano responde
//   a los bordes; una foto desenfocada casi no tiene, y su varianza se
//   desploma. Pero aquí la persona está GIRANDO, y una foto movida al girar
//   solo se borra de lado: las rayas horizontales (el andén, las líneas de la
//   vía, el techo de un carro) siguen nítidas y sostienen el laplaciano
//   completo. Medido con una textura el 13-nov-2026: nítida 4.188, movida 17 px
//   todavía 581 (pasaba por buena); por ejes, la misma foto movida da 7 en
//   horizontal y 562 en vertical. Por eso vale el eje más borroso. El
//   laplaciano completo se guarda igual, para comparar con lo que se publica.
//   Se mide siempre a la misma escala (LADO_DE_REVISION de lado corto) porque
//   el número cambia con la escala: así el aviso en vivo y la revisión de la
//   foto dicen lo mismo.
// - Oscura: el brillo medio (luma de 0 a 255). Una foto oscura también da un
//   laplaciano bajo; ahí se dice solo "oscura", que es lo que hay que arreglar.
// - Torcida: no se adivina de la imagen. La dice el sensor de orientación en el
//   instante de tomarla (orientacion.js). Sin sensor no se juzga.
//
// OJO: los umbrales NO están calibrados con fotos de un iPhone. Salen de la
// práctica habitual (laplaciano completo bajo ~100 con la foto a ~500 px =
// borrosa; por eje es más o menos la mitad) y se dejaron más permisivos: a la
// orilla de una vía, hacer repetir una foto buena cuesta más que aceptar una un
// poco blanda. Cada foto guarda sus números para calibrarlos con las primeras
// pruebas de verdad.
export const LADO_DE_REVISION = 480;

export const UMBRALES = {
  // Varianza de la segunda derivada en el eje más borroso.
  nitidez: 30,
  brillo: 40,
  // Grados de horizonte torcido. A 12° ya se nota a simple vista.
  giro: 12,
  // Mirando más abajo de esto, la foto es casi solo piso; más arriba, cielo.
  // Un poco hacia abajo sí sirve: ahí salen las rayas de la vía y los vidrios.
  mirandoAlPiso: -55,
  mirandoAlCielo: 40,
};

// Luma de Rec. 601 con enteros: en un celular, cada cuadro en vivo cuenta.
export function aGris(rgba, ancho, alto) {
  const n = ancho * alto;
  const gris = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) gris[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return gris;
}

// La varianza del laplaciano y la de sus dos mitades: la segunda derivada en x
// (la que borra una foto movida al girar) y en y.
export function bordesDeLaImagen(gris, ancho, alto) {
  if (ancho < 3 || alto < 3) return { laplaciano: 0, horizontal: 0, vertical: 0 };
  let sx = 0;
  let sx2 = 0;
  let sy = 0;
  let sy2 = 0;
  let sl = 0;
  let sl2 = 0;
  for (let y = 1; y < alto - 1; y++) {
    const fila = y * ancho;
    for (let x = 1; x < ancho - 1; x++) {
      const i = fila + x;
      const dx = gris[i - 1] + gris[i + 1] - 2 * gris[i];
      const dy = gris[i - ancho] + gris[i + ancho] - 2 * gris[i];
      const l = dx + dy;
      sx += dx;
      sx2 += dx * dx;
      sy += dy;
      sy2 += dy * dy;
      sl += l;
      sl2 += l * l;
    }
  }
  const n = (ancho - 2) * (alto - 2);
  const varianza = (s, s2) => s2 / n - (s / n) ** 2;
  return { laplaciano: varianza(sl, sl2), horizontal: varianza(sx, sx2), vertical: varianza(sy, sy2) };
}

export function varianzaDelLaplaciano(gris, ancho, alto) {
  return bordesDeLaImagen(gris, ancho, alto).laplaciano;
}

export function brilloMedio(gris) {
  if (!gris.length) return 0;
  let suma = 0;
  for (let i = 0; i < gris.length; i++) suma += gris[i];
  return suma / gris.length;
}

// `nitidez`: la del eje más borroso. `laplaciano`: el número clásico, para
// comparar.
export function medirFoto(gris, ancho, alto) {
  const { laplaciano, horizontal, vertical } = bordesDeLaImagen(gris, ancho, alto);
  return { nitidez: Math.min(horizontal, vertical), laplaciano, brillo: brilloMedio(gris) };
}

// { ok, problemas } con los problemas en el orden en que se arreglan.
export function revisarFoto({ nitidez, brillo, elevacion = null, giro = null }, umbrales = UMBRALES) {
  const problemas = [];
  if (brillo < umbrales.brillo) problemas.push('oscura');
  else if (nitidez < umbrales.nitidez) problemas.push('borrosa');
  if (giro !== null && Math.abs(giro) > umbrales.giro) problemas.push('torcida');
  if (elevacion !== null && elevacion < umbrales.mirandoAlPiso) problemas.push('piso');
  else if (elevacion !== null && elevacion > umbrales.mirandoAlCielo) problemas.push('cielo');
  return { ok: problemas.length === 0, problemas };
}

// Lo que dice la pantalla de cada problema: qué pasó y qué hacer.
export const TEXTOS_DE_PROBLEMAS = {
  oscura: 'Salió muy oscura. Apunta hacia donde haya algo de luz y quédate quieto.',
  borrosa: 'Salió movida o borrosa. Quédate quieto un segundo al tocar el botón.',
  torcida: 'Salió torcida. Endereza el celular hasta que la raya blanca quede derecha.',
  piso: 'Salió mirando al piso. Levanta un poco el celular y apunta al frente.',
  cielo: 'Salió mirando al cielo. Baja un poco el celular y apunta al frente.',
};

export const NOMBRES_DE_PROBLEMAS = {
  oscura: 'Oscura',
  borrosa: 'Borrosa',
  torcida: 'Torcida',
  piso: 'Mirando al piso',
  cielo: 'Mirando al cielo',
};

export function textoDeLaRevision({ problemas }) {
  return problemas.map((p) => TEXTOS_DE_PROBLEMAS[p]).join(' ');
}

// La pastilla de la cámara en vivo: si lo que se ve ahora saldría bien.
export function nitidezEnVivo(medida, umbrales = UMBRALES) {
  if (!medida) return { texto: 'Revisando…', estado: 'neutro' };
  if (medida.brillo < umbrales.brillo) return { texto: 'Oscura', estado: 'mal' };
  if (medida.nitidez < umbrales.nitidez) return { texto: 'Movida', estado: 'mal' };
  return { texto: 'Nítida', estado: 'bien' };
}
