// Un PDF escrito a mano, sin librerías: lo justo para el expediente (texto, rayas, figuras, fotos y
// enlaces). Puro: corre igual en el teléfono y en las pruebas de Node.
//
// Por qué a mano y no jsPDF (unos 350 KB):
//  - Las fotos van DENTRO del PDF tal cual se tomaron. Un JPEG se mete en un PDF sin volverlo a
//    comprimir (filtro DCTDecode): quien saque la imagen del PDF obtiene los mismos bytes, y su
//    SHA-256 es la huella que dice la cadena. Una librería que la vuelva a comprimir rompe esa
//    prueba sin avisar.
//  - El texto va con las fuentes que trae todo lector de PDF (Helvetica y Courier) en WinAnsi, que
//    tiene las tildes, la ñ, ¿ y ¡. Lo que no cabe en WinAnsi sale como «?», nunca en blanco.
//
// Las coordenadas que recibe son las de una hoja que se lee: x desde la izquierda, y desde ARRIBA,
// en puntos (1/72 de pulgada). El PDF cuenta y desde abajo: aquí se convierte.

export const A4 = { ancho: 595.28, alto: 841.89 };
// Carta (8,5 × 11 pulgadas): la hoja de las oficinas en Colombia.
export const CARTA = { ancho: 612, alto: 792 };

// ------------------------------------------------------------------------------ el texto

// Los caracteres de WinAnsi que no son Latin-1 (la tabla de la especificación de PDF, anexo D).
const WIN_ANSI_EXTRA = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91],
  [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98],
  [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

// El texto en bytes de WinAnsi. Lo que no está en la tabla sale como «?».
export function aWinAnsi(texto) {
  const bytes = [];
  for (const c of String(texto)) {
    const n = c.codePointAt(0);
    if (n === 0x09) bytes.push(0x20);
    else if ((n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff)) bytes.push(n);
    else bytes.push(WIN_ANSI_EXTRA.get(n) ?? 0x3f);
  }
  return bytes;
}

// Los anchos de Helvetica y Helvetica-Bold (las métricas AFM de Adobe), en milésimas del tamaño,
// del espacio (32) a la tilde (126).
const ANCHOS = {
  normal: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
    556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  negrita: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
    611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
};
// Los de fuera del ASCII que más salen en un expediente en español.
const ANCHOS_EXTRA = {
  normal: { '¿': 611, '¡': 333, '°': 400, '·': 278, '×': 584, '±': 584, '–': 556, '—': 1000, '…': 1000, '•': 350, '“': 333, '”': 333, '‘': 222, '’': 222, 'º': 365, 'ª': 370 },
  negrita: { '¿': 611, '¡': 333, '°': 400, '·': 278, '×': 584, '±': 584, '–': 556, '—': 1000, '…': 1000, '•': 350, '“': 500, '”': 500, '‘': 278, '’': 278, 'º': 365, 'ª': 370 },
};

function anchoDeLetra(c, fuente) {
  if (fuente === 'fija') return 600;
  const tabla = ANCHOS[fuente] ?? ANCHOS.normal;
  const n = c.codePointAt(0);
  if (n >= 32 && n <= 126) return tabla[n - 32];
  const extra = (ANCHOS_EXTRA[fuente] ?? ANCHOS_EXTRA.normal)[c];
  if (extra) return extra;
  // Las letras con tilde miden lo de su letra, menos la í: sin el punto de la i, mide 278.
  const base = c.normalize('NFD')[0];
  if (base === 'i') return 278;
  const b = base.codePointAt(0);
  return b >= 32 && b <= 126 ? tabla[b - 32] : 556;
}

export function anchoDeTexto(texto, tamano, fuente = 'normal') {
  let total = 0;
  for (const c of String(texto)) total += anchoDeLetra(c, fuente);
  return (total * tamano) / 1000;
}

// Parte el texto en renglones que caben en `ancho`. Respeta los saltos de línea; una palabra que
// no cabe sola se corta letra a letra (una huella de 64 caracteres, por ejemplo).
export function envolver(texto, ancho, tamano, fuente = 'normal') {
  const renglones = [];
  for (const parrafo of String(texto).split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/ +/)) {
      const candidato = actual ? actual + ' ' + palabra : palabra;
      if (anchoDeTexto(candidato, tamano, fuente) <= ancho) {
        actual = candidato;
        continue;
      }
      if (actual) renglones.push(actual);
      actual = '';
      let resto = palabra;
      while (anchoDeTexto(resto, tamano, fuente) > ancho) {
        let n = resto.length - 1;
        while (n > 1 && anchoDeTexto(resto.slice(0, n), tamano, fuente) > ancho) n--;
        renglones.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      actual = resto;
    }
    renglones.push(actual);
  }
  return renglones;
}

// Una cadena literal de PDF: los paréntesis y la barra escapados, y lo que no es ASCII imprimible
// en octal. Así el contenido de la página es ASCII puro y su largo en bytes es su largo en letras.
function literal(bytes) {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b);
    else if (b >= 0x20 && b <= 0x7e) s += String.fromCharCode(b);
    else s += '\\' + b.toString(8).padStart(3, '0');
  }
  return s + ')';
}

// Un texto del documento (título, autor): UTF-16 con su marca, en hexadecimal.
function textoDeDocumento(texto) {
  let h = 'FEFF';
  for (let i = 0; i < texto.length; i++) h += texto.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${h}>`;
}

// ------------------------------------------------------------------------------ las fotos

// El ancho, el alto y los canales de un JPEG, leídos de su marca SOF. null si no es un JPEG.
export function medidaDeJpeg(bytes) {
  if (!(bytes?.length > 4) || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marca = bytes[i + 1];
    if (marca === 0xff) {
      i++;
      continue;
    }
    const largo = (bytes[i + 2] << 8) | bytes[i + 3];
    // SOF0 a SOF15, menos DHT (C4), JPG (C8) y DAC (CC).
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      return { alto: (bytes[i + 5] << 8) | bytes[i + 6], ancho: (bytes[i + 7] << 8) | bytes[i + 8], canales: bytes[i + 9] };
    }
    i += 2 + largo;
  }
  return null;
}

// ------------------------------------------------------------------------------ el documento

const num = (n) => (Math.round(n * 100) / 100).toString();
function color(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => num(c / 255)).join(' ');
}
const FUENTES = { normal: 'F1', negrita: 'F2', fija: 'F3' };

export function crearPdf({ titulo = '', autor = '', ancho = A4.ancho, alto = A4.alto, fecha = new Date() } = {}) {
  const paginas = [];
  const adjuntos = [];
  const imagenes = [];
  const porBytes = new Map();
  const transparencias = new Map();
  let pagina = null;
  const Y = (y) => num(alto - y);
  const escribir = (op) => {
    if (!pagina) throw new Error('Primero una página');
    pagina.ops.push(op);
  };
  // La transparencia va en un ExtGState por valor (/T30 = 0,30).
  function conAlfa(alfa, op) {
    if (alfa == null || alfa >= 1) return escribir(op);
    const clave = Math.round(alfa * 100);
    if (!transparencias.has(clave)) transparencias.set(clave, `T${clave}`);
    escribir(`q /${transparencias.get(clave)} gs ${op} Q`);
  }
  // La ruta de una figura, y cómo se pinta: relleno, borde o las dos.
  function pintar(ruta, { relleno = null, borde = null, grosor = 1, punteada = null, alfa = null }) {
    if (!relleno && !borde) return;
    const partes = [];
    if (relleno) partes.push(`${color(relleno)} rg`);
    if (borde) partes.push(`${color(borde)} RG ${num(grosor)} w 1 J 1 j ${punteada ? `[${punteada.map(num).join(' ')}] 0 d` : ''}`);
    partes.push(ruta, relleno && borde ? 'B' : relleno ? 'f' : 'S');
    conAlfa(alfa, partes.join(' '));
  }

  return {
    ancho,
    alto,
    get paginas() {
      return paginas.length;
    },
    nuevaPagina() {
      pagina = { ops: [], enlaces: [] };
      paginas.push(pagina);
      return paginas.length;
    },
    // Va a una página ya hecha (para el pie con «de N», que solo se sabe al final).
    irAPagina(n) {
      pagina = paginas[n - 1];
    },
    // `y` es la línea de base del texto.
    texto(x, y, cadena, { tamano = 10, fuente = 'normal', color: c = '#14181d', alinear = 'izquierda' } = {}) {
      const ancho = anchoDeTexto(cadena, tamano, fuente);
      const x0 = alinear === 'centro' ? x - ancho / 2 : alinear === 'derecha' ? x - ancho : x;
      escribir(`BT /${FUENTES[fuente] ?? 'F1'} ${num(tamano)} Tf ${color(c)} rg ${num(x0)} ${Y(y)} Td ${literal(aWinAnsi(cadena))} Tj ET`);
      return ancho;
    },
    rect(x, y, w, h, estilo = {}) {
      pintar(`${num(x)} ${num(alto - y - h)} ${num(w)} ${num(h)} re`, estilo);
    },
    // Una línea quebrada (o un polígono con `cerrar`) por [[x, y], ...].
    linea(puntos, { cerrar = false, ...estilo } = {}) {
      if (puntos.length < 2) return;
      const ruta = puntos.map(([x, y], i) => `${num(x)} ${Y(y)} ${i ? 'l' : 'm'}`).join(' ') + (cerrar ? ' h' : '');
      pintar(ruta, cerrar ? estilo : { ...estilo, relleno: null });
    },
    // Un círculo con cuatro curvas de Bézier (k = 0,5523: el error es de 0,03 %).
    circulo(cx, cy, r, estilo = {}) {
      const k = 0.5523 * r;
      const p = (x, y) => `${num(cx + x)} ${Y(cy + y)}`;
      const ruta = [`${p(r, 0)} m`, `${p(r, k)} ${p(k, r)} ${p(0, r)} c`, `${p(-k, r)} ${p(-r, k)} ${p(-r, 0)} c`, `${p(-r, -k)} ${p(-k, -r)} ${p(0, -r)} c`, `${p(k, -r)} ${p(r, -k)} ${p(r, 0)} c`, 'h'].join(' ');
      pintar(ruta, estilo);
    },
    // Un JPEG, sin tocar sus bytes. La misma foto dos veces se guarda una sola.
    imagen(bytes, x, y, w, h) {
      let img = porBytes.get(bytes);
      if (!img) {
        const medida = medidaDeJpeg(bytes);
        if (!medida) throw new Error('La foto no es un JPEG');
        img = { nombre: `Im${imagenes.length + 1}`, bytes, ...medida };
        imagenes.push(img);
        porBytes.set(bytes, img);
      }
      escribir(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(alto - y - h)} cm /${img.nombre} Do Q`);
      return img;
    },
    // Lo que dibuje `dibujar` queda recortado al rectángulo (el plano: la vía sigue más allá).
    recortado(x, y, w, h, dibujar) {
      escribir(`q ${num(x)} ${num(alto - y - h)} ${num(w)} ${num(h)} re W n`);
      try {
        dibujar();
      } finally {
        escribir('Q');
      }
    },
    enlace(x, y, w, h, url) {
      if (!pagina) throw new Error('Primero una página');
      pagina.enlaces.push({ rect: [x, alto - y - h, x + w, alto - y].map(num), url });
    },
    // Un archivo dentro del PDF (el clip de Acrobat, la lista de adjuntos de Chrome). Sus bytes van
    // sin comprimir: quien lo saque obtiene exactamente esos bytes, y su SHA-256 es el que se dijo.
    adjunto(nombre, bytes, { tipo = 'application/octet-stream', descripcion = '' } = {}) {
      const datos = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
      adjuntos.push({ nombre, datos, tipo, descripcion });
    },

    // El archivo entero.
    bytes() {
      const objetos = [];
      const nuevo = () => objetos.push(null);
      const CATALOGO = nuevo();
      const PAGINAS = nuevo();
      const F = [nuevo(), nuevo(), nuevo()];
      objetos[F[0] - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
      objetos[F[1] - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
      objetos[F[2] - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
      const deImagen = imagenes.map((img) => {
        const n = nuevo();
        const espacio = img.canales === 1 ? '/DeviceGray' : img.canales === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
        objetos[n - 1] = { dict: `<< /Type /XObject /Subtype /Image /Width ${img.ancho} /Height ${img.alto} /ColorSpace ${espacio} /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>`, flujo: img.bytes };
        return `/${img.nombre} ${n} 0 R`;
      });
      const alfas = [...transparencias].map(([clave, nombre]) => `/${nombre} << /ca ${num(clave / 100)} /CA ${num(clave / 100)} >>`);
      const RECURSOS = nuevo();
      objetos[RECURSOS - 1] = `<< /Font << /F1 ${F[0]} 0 R /F2 ${F[1]} 0 R /F3 ${F[2]} 0 R >> /XObject << ${deImagen.join(' ')} >> /ExtGState << ${alfas.join(' ')} >> /ProcSet [/PDF /Text /ImageB /ImageC] >>`;
      const hijas = paginas.map((p) => {
        const contenido = nuevo();
        const texto = p.ops.join('\n');
        objetos[contenido - 1] = { dict: `<< /Length ${texto.length} >>`, flujo: texto };
        const anotaciones = p.enlaces.map((e) => {
          const n = nuevo();
          objetos[n - 1] = `<< /Type /Annot /Subtype /Link /Rect [${e.rect.join(' ')}] /Border [0 0 0] /A << /S /URI /URI ${literal(aWinAnsi(e.url))} >> >>`;
          return `${n} 0 R`;
        });
        const n = nuevo();
        objetos[n - 1] = `<< /Type /Page /Parent ${PAGINAS} 0 R /MediaBox [0 0 ${num(ancho)} ${num(alto)}] /Resources ${RECURSOS} 0 R /Contents ${contenido} 0 R${anotaciones.length ? ` /Annots [${anotaciones.join(' ')}]` : ''} >>`;
        return n;
      });
      // Los adjuntos: el archivo (EmbeddedFile) y su ficha (Filespec), en el árbol de nombres del
      // catálogo, ordenados por nombre como pide la especificación.
      const fichas = [...adjuntos]
        .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0))
        .map((a) => {
          const archivo = nuevo();
          const subtipo = a.tipo.replace(/[^A-Za-z0-9.+-]/g, (c) => '#' + c.charCodeAt(0).toString(16).padStart(2, '0'));
          objetos[archivo - 1] = { dict: `<< /Type /EmbeddedFile /Subtype /${subtipo} /Length ${a.datos.length} /Params << /Size ${a.datos.length} >> >>`, flujo: a.datos };
          const ficha = nuevo();
          const nombre = literal(aWinAnsi(a.nombre));
          objetos[ficha - 1] = `<< /Type /Filespec /F ${nombre} /UF ${textoDeDocumento(a.nombre)} /EF << /F ${archivo} 0 R >>${a.descripcion ? ` /Desc ${textoDeDocumento(a.descripcion)}` : ''} >>`;
          return `${nombre} ${ficha} 0 R`;
        });
      const nombres = fichas.length ? ` /Names << /EmbeddedFiles << /Names [${fichas.join(' ')}] >> >>` : '';
      objetos[CATALOGO - 1] = `<< /Type /Catalog /Pages ${PAGINAS} 0 R${nombres} >>`;
      objetos[PAGINAS - 1] = `<< /Type /Pages /Kids [${hijas.map((n) => `${n} 0 R`).join(' ')}] /Count ${hijas.length} >>`;
      const f = new Date(fecha);
      const d = `D:${f.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`;
      const INFO = nuevo();
      objetos[INFO - 1] = `<< /Title ${textoDeDocumento(titulo)} /Author ${textoDeDocumento(autor)} /Producer (Choque Claro) /CreationDate (${d}) >>`;

      // Se juntan los pedazos contando bytes: el índice (xref) dice dónde empieza cada objeto.
      const pedazos = [];
      let largo = 0;
      const poner = (p) => {
        const b = typeof p === 'string' ? Uint8Array.from(p, (c) => c.charCodeAt(0)) : p;
        pedazos.push(b);
        largo += b.length;
      };
      // La segunda línea con bytes altos: así los programas saben que el archivo es binario.
      // 1.7 por los adjuntos con nombre en UTF-16 (/UF); lo demás es de la 1.4.
      poner('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');
      const donde = [];
      objetos.forEach((o, i) => {
        donde.push(largo);
        if (typeof o === 'string') poner(`${i + 1} 0 obj\n${o}\nendobj\n`);
        else {
          poner(`${i + 1} 0 obj\n${o.dict}\nstream\n`);
          poner(o.flujo);
          poner('\nendstream\nendobj\n');
        }
      });
      const xref = largo;
      poner(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` + donde.map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join(''));
      poner(`trailer\n<< /Size ${objetos.length + 1} /Root ${CATALOGO} 0 R /Info ${INFO} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      const salida = new Uint8Array(largo);
      let i = 0;
      for (const b of pedazos) {
        salida.set(b, i);
        i += b.length;
      }
      return salida;
    },
  };
}
