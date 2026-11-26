// El expediente en la hoja: toma lo que armó expediente.js y lo pone en un PDF tamaño carta, el
// que se imprime en las oficinas de Colombia. Puro (sin DOM): recibe los bytes de las fotos y
// devuelve los del PDF, así que se prueba y se mira en Node.
//
// Decisiones de diseño:
//  - Las fotos van con sus bytes originales (pdf.js lo explica). Se ven chicas en la hoja, cuatro
//    por fila, pero son las de 1280 px: quien acerque el PDF ve todo el detalle.
//  - Debajo de cada foto va lo que se selló con ella, en letra chica: hora, rumbo, GPS, la
//    revisión y el comienzo de su SHA-256. El SHA-256 completo está en la tabla de la cadena.
//  - El plano del croquis se dibuja con líneas, no con un pantallazo del mapa: a escala, con norte
//    y regla, sobre el trazado de la vía de OpenStreetMap. Las teselas del mapa no se pueden
//    meter en un documento así sin permiso, y una foto de satélite de otro día confundiría.
//  - Nada de rojo ni verde que sugiera culpa: los carros llevan su color de letra, el mismo de
//    la app, y el rojo es solo el de la estrella del golpe (y el aviso de ejemplo).
import { CARTA, crearPdf, envolver, anchoDeTexto } from './pdf.js';

const M = { izq: 42, der: 42, arriba: 52, abajo: 50 };
const ANCHO = CARTA.ancho - M.izq - M.der;
const DERECHA = CARTA.ancho - M.der;
const FONDO_DE_LA_HOJA = CARTA.alto - M.abajo;
const C = {
  texto: '#14181d',
  suave: '#5b6470',
  borde: '#d8dde3',
  fondo: '#f3f5f7',
  acento: '#0f6e56',
  acentoSuave: '#e6f2ee',
  peligro: '#b42318',
  peligroSuave: '#fbeae8',
  atencion: '#8a4b00',
  enlace: '#1a56a8',
  blanco: '#ffffff',
  suelo: '#eef0ea',
  via: '#cfd4da',
};
const COLOR_DEL_AVISO = { atencion: C.atencion, 'sin-dato': C.suave };

export function pdfDelExpediente(modelo, { fotos = new Map(), adjuntos = [] } = {}) {
  const pdf = crearPdf({ titulo: modelo.titulo, autor: 'Choque Claro', fecha: modelo.sellado, ancho: CARTA.ancho, alto: CARTA.alto });
  let y = 0;
  let seccion = '';

  // --- La hoja --------------------------------------------------------------------------------

  function pagina() {
    pdf.nuevaPagina();
    y = M.arriba;
    if (pdf.paginas > 1) {
      pdf.texto(M.izq, 30, `Choque Claro · Expediente ${modelo.numero}`, { tamano: 7.5, color: C.suave, fuente: 'negrita' });
      if (seccion) pdf.texto(DERECHA, 30, seccion, { tamano: 7.5, color: C.suave, alinear: 'derecha' });
      pdf.linea([[M.izq, 36], [DERECHA, 36]], { borde: C.borde, grosor: 0.6 });
    }
  }
  const cabe = (alto) => {
    if (y + alto > FONDO_DE_LA_HOJA) pagina();
  };

  // Un texto envuelto en `ancho`, renglón por renglón (un párrafo largo puede seguir en otra hoja).
  // Cada renglón ocupa tamaño × interlínea; la línea de base va al 72 % de esa altura.
  function parrafo(texto, { tamano = 9.5, fuente = 'normal', color = C.texto, x = M.izq, ancho = ANCHO, interlinea = 1.38, despues = 6 } = {}) {
    const alto = tamano * interlinea;
    for (const renglon of envolver(texto, ancho, tamano, fuente)) {
      cabe(alto);
      pdf.texto(x, y + alto * 0.72, renglon, { tamano, fuente, color });
      y += alto;
    }
    y += despues;
  }

  // Los renglones de un texto sin escribirlos: para medir antes de decidir si cabe.
  const renglones = (texto, ancho, tamano, fuente = 'normal') => (texto ? envolver(texto, ancho, tamano, fuente) : []);

  // El título de una sección. Lo que sigue debajo de un título nunca queda solo al pie de la hoja.
  function titulo(texto, { nuevaHoja = false } = {}) {
    seccion = texto;
    if (nuevaHoja) pagina();
    else cabe(110);
    if (y > M.arriba) y += 16;
    y += 18;
    pdf.texto(M.izq, y, texto, { tamano: 15, fuente: 'negrita', color: C.acento });
    y += 10;
  }

  function subtitulo(texto, { color = C.texto } = {}) {
    cabe(60);
    y += y > M.arriba ? 22 : 12;
    pdf.texto(M.izq, y, texto, { tamano: 11, fuente: 'negrita', color });
    y += 7;
  }

  // Etiqueta a la izquierda; valor (y su nota, en gris) a la derecha. Cada fila entera en una hoja.
  function tabla(filas, { anchoEtiqueta = 122 } = {}) {
    const xValor = M.izq + anchoEtiqueta;
    const anchoValor = ANCHO - anchoEtiqueta;
    for (const f of filas) {
      const e = renglones(f.etiqueta, anchoEtiqueta - 10, 8, 'negrita');
      const v = renglones(f.valor, anchoValor, 9.2);
      const n = renglones(f.nota, anchoValor, 7.6);
      const alto = Math.max(e.length * 11, v.length * 12.4 + n.length * 10.2) + 7;
      cabe(alto);
      let ye = y + 11;
      for (const r of e) {
        pdf.texto(M.izq, ye, r, { tamano: 8, fuente: 'negrita', color: C.suave });
        ye += 11;
      }
      let yv = y + 11.4;
      const color = COLOR_DEL_AVISO[f.aviso] ?? C.texto;
      for (const r of v) {
        pdf.texto(xValor, yv, r, { tamano: 9.2, color, fuente: f.aviso === 'atencion' ? 'negrita' : 'normal' });
        yv += 12.4;
      }
      yv -= 2;
      for (const r of n) {
        pdf.texto(xValor, yv + 0.6, r, { tamano: 7.6, color: C.suave });
        yv += 10.2;
      }
      y += alto;
      pdf.linea([[M.izq, y - 3], [DERECHA, y - 3]], { borde: C.borde, grosor: 0.5 });
    }
    y += 4;
  }

  function vinetas(lineas, { tamano = 9, color = C.texto } = {}) {
    for (const linea of lineas) {
      const r = renglones(linea, ANCHO - 14, tamano);
      cabe(r.length * tamano * 1.4 + 3);
      // El punto, a media altura de las minúsculas del primer renglón.
      const base = y + tamano * 1.4 - tamano * 0.38 + 0.2;
      pdf.circulo(M.izq + 3, base - tamano * 0.27, 1.4, { relleno: C.acento });
      for (const renglon of r) {
        y += tamano * 1.4;
        pdf.texto(M.izq + 12, y - tamano * 0.38 + 0.2, renglon, { tamano, color });
      }
      y += 3;
    }
    y += 3;
  }

  // --- Las fotos ------------------------------------------------------------------------------

  // Los renglones debajo de una foto: [texto, tamaño, fuente, color].
  function pie(f, ancho) {
    const lineas = [];
    for (const r of renglones(f.titulo, ancho, 7.2, 'negrita')) lineas.push([r, 7.2, 'negrita', C.texto]);
    const chicos = [`${f.hora} · registro ${f.registro}`, f.rumbo, f.gps];
    for (const t of chicos) for (const r of renglones(t, ancho, 6.3)) lineas.push([r, 6.3, 'normal', C.suave]);
    lineas.push([`SHA-256 ${f.sha256.slice(0, Math.floor(ancho / (6 * 0.6)) - 9)}…`, 6, 'fija', C.suave]);
    if (f.revision) for (const r of renglones(f.revision, ancho, 6.3)) lineas.push([r, 6.3, 'normal', C.atencion]);
    if (f.nota) for (const r of renglones(f.nota, ancho, 6.3)) lineas.push([r, 6.3, 'normal', C.atencion]);
    return lineas;
  }
  const altoDelPie = (lineas) => lineas.reduce((t, [, tamano]) => t + tamano * 1.32, 0);

  function foto(f, x, yArriba, ancho, altoCaja) {
    pdf.rect(x, yArriba, ancho, altoCaja, { relleno: C.fondo });
    const bytes = fotos.get(f.huella);
    if (bytes) {
      // Cabe entera en la caja, sin recortarla: la foto completa es la prueba.
      const k = Math.min(ancho / f.ancho, altoCaja / f.alto);
      const w = f.ancho * k;
      const h = f.alto * k;
      pdf.imagen(bytes, x + (ancho - w) / 2, yArriba + (altoCaja - h) / 2, w, h);
    } else {
      pdf.texto(x + ancho / 2, yArriba + altoCaja / 2, 'La foto no está en el teléfono', { tamano: 6.5, color: C.suave, alinear: 'centro' });
    }
    pdf.rect(x, yArriba, ancho, altoCaja, { borde: C.borde, grosor: 0.5 });
    let yp = yArriba + altoCaja + 2;
    for (const [texto, tamano, fuente, color] of pie(f, ancho)) {
      yp += tamano * 1.32;
      pdf.texto(x, yp - tamano * 0.3, texto, { tamano, fuente, color });
    }
  }

  // Una rejilla de fotos, fila por fila: una fila nunca se parte entre dos hojas. La caja toma la
  // forma de la mayoría (el teléfono parado da fotos verticales; acostado, horizontales).
  function rejilla(lista, { columnas = 4, separacion = 9, proporcion = null } = {}) {
    const ancho = (ANCHO - separacion * (columnas - 1)) / columnas;
    const verticales = lista.filter((f) => f.alto > f.ancho).length;
    const altoCaja = ancho * (proporcion ?? (verticales * 2 >= lista.length ? 4 / 3 : 3 / 4));
    for (let i = 0; i < lista.length; i += columnas) {
      const fila = lista.slice(i, i + columnas);
      const alto = altoCaja + 4 + Math.max(...fila.map((f) => altoDelPie(pie(f, ancho)))) + 12;
      cabe(alto);
      fila.forEach((f, k) => foto(f, M.izq + k * (ancho + separacion), y, ancho, altoCaja));
      y += alto;
    }
  }

  // --- El plano del croquis -------------------------------------------------------------------

  // La estrella del golpe: la misma de la app (8 puntas).
  function estrella(cx, cy, r, relleno, borde = null) {
    const puntas = [];
    for (let i = 0; i < 16; i++) {
      const radio = i % 2 ? r * 0.45 : r;
      const a = (Math.PI * i) / 8;
      puntas.push([cx + radio * Math.sin(a), cy - radio * Math.cos(a)]);
    }
    pdf.linea(puntas, { cerrar: true, relleno, borde, grosor: 0.8 });
  }

  function plano(p, x0, y0, w, h) {
    const s = w / p.caja.ancho;
    const X = (m) => x0 + (m.x - p.caja.oeste) * s;
    const Y = (m) => y0 + (p.caja.norte - m.y) * s;
    const aHoja = (m) => [X(m), Y(m)];
    pdf.rect(x0, y0, w, h, { relleno: C.suelo });
    pdf.recortado(x0, y0, w, h, () => {
      const viaReal = p.via.real;
      pdf.linea(p.via.puntos.map(aHoja), { borde: viaReal ? C.via : '#e1e4e8', grosor: p.via.ancho * s });
      // La raya del centro, blanca y a trozos, como en la vía.
      pdf.linea(p.via.puntos.map(aHoja), { borde: C.blanco, grosor: Math.max(0.6, 0.15 * s), punteada: [3 * s, 3 * s] });
      for (const f of p.flechas) {
        pdf.linea(f.puntos.map(aHoja), { borde: f.color, grosor: Math.max(1.4, 0.35 * s), punteada: f.guiada ? [1.1 * s, 0.8 * s] : null });
        if (f.punta) pdf.linea(f.punta.map(aHoja), { cerrar: true, relleno: f.color });
      }
      for (const c of p.carros) {
        pdf.linea(c.cuerpo.map(aHoja), { cerrar: true, relleno: c.color, borde: C.blanco, grosor: 0.9 });
        pdf.linea(c.vidrio.map(aHoja), { cerrar: true, relleno: C.blanco, alfa: 0.78 });
        // La letra, hacia atrás del centro: adelante va el vidrio.
        const atras = { x: c.centro.x - Math.sin((c.rumbo * Math.PI) / 180) * 0.9, y: c.centro.y - Math.cos((c.rumbo * Math.PI) / 180) * 0.9 };
        const tamano = Math.max(7, Math.min(12, 1.15 * s));
        pdf.texto(X(atras), Y(atras) + tamano * 0.36, c.letra, { tamano, fuente: 'negrita', color: C.blanco, alinear: 'centro' });
      }
      if (p.golpe) estrella(X(p.golpe), Y(p.golpe), Math.max(6.5, 1.5 * s), p.colorDelGolpe, C.blanco);
    });
    // El norte, arriba a la derecha.
    const nx = x0 + w - 18;
    const ny = y0 + 12;
    pdf.linea([[nx, ny], [nx + 5, ny + 13], [nx, ny + 10], [nx - 5, ny + 13]], { cerrar: true, relleno: C.texto });
    pdf.texto(nx, ny + 23, 'N', { tamano: 8, fuente: 'negrita', color: C.texto, alinear: 'centro' });
    // La regla, abajo a la izquierda.
    const largo = p.regla * s;
    const rx = x0 + 12;
    const ry = y0 + h - 14;
    pdf.rect(rx - 4, ry - 13, largo + 8 + 26, 19, { relleno: C.blanco, alfa: 0.8 });
    pdf.linea([[rx, ry - 3], [rx, ry], [rx + largo, ry], [rx + largo, ry - 3]], { borde: C.texto, grosor: 1 });
    pdf.texto(rx + largo + 4, ry + 0.5, `${p.regla} m`, { tamano: 7, fuente: 'negrita', color: C.texto });
    pdf.texto(x0 + w - 6, y0 + h - 5, p.via.real ? 'Trazado de la vía: © colaboradores de OpenStreetMap' : 'Vía imaginaria: el mapa no tenía la vía en este punto', { tamano: 5.8, color: C.suave, alinear: 'derecha' });
    pdf.rect(x0, y0, w, h, { borde: C.borde, grosor: 0.6 });
  }

  // --- Las secciones --------------------------------------------------------------------------

  function portada() {
    pagina();
    pdf.texto(M.izq, 48, 'CHOQUE CLARO', { tamano: 9, fuente: 'negrita', color: C.acento });
    pdf.texto(DERECHA, 48, 'Expediente del choque', { tamano: 9, color: C.suave, alinear: 'derecha' });
    pdf.linea([[M.izq, 56], [DERECHA, 56]], { borde: C.acento, grosor: 1.2 });
    y = 100;
    pdf.texto(M.izq, y, modelo.numero, { tamano: 30, fuente: 'negrita', color: C.texto });
    y += 20;
    pdf.texto(M.izq, y, `Sellado el ${modelo.selladoTexto} (hora de Colombia)`, { tamano: 10, color: C.suave });
    y += 10;
    // La huella completa, en dos renglones de 32.
    const cajaY = y + 6;
    pdf.rect(M.izq, cajaY, ANCHO, 52, { relleno: C.acentoSuave });
    pdf.texto(M.izq + 12, cajaY + 15, 'Huella del reporte (SHA-256)', { tamano: 7.8, fuente: 'negrita', color: C.acento });
    pdf.texto(M.izq + 12, cajaY + 29, modelo.huella.slice(0, 32), { tamano: 10.5, fuente: 'fija', color: C.texto });
    pdf.texto(M.izq + 12, cajaY + 43, modelo.huella.slice(32), { tamano: 10.5, fuente: 'fija', color: C.texto });
    y = cajaY + 52 + 8;
    if (modelo.ejemplo) {
      pdf.rect(M.izq, y + 4, ANCHO, 24, { relleno: C.peligroSuave });
      pdf.texto(M.izq + 12, y + 20, 'EJEMPLO: el lugar es real, pero el choque es inventado.', { tamano: 9.5, fuente: 'negrita', color: C.peligro });
      y += 34;
    }
    y += 10;
    tabla(modelo.resumen);
    subtitulo('Qué es este documento');
    parrafo(
      'Lo que la persona documentó con su teléfono, con la app Choque Claro, después del choque: las fotos de la escena y de cada carro, las placas, los daños y el croquis. Las fotos van dentro de este PDF tal como se tomaron, sin volverlas a comprimir: su SHA-256 es el de la tabla de la cadena de huellas, al final.',
      { tamano: 9.2 },
    );
    subtitulo('Lo que este expediente NO afirma');
    vinetas(modelo.noAfirma, { tamano: 8.8 });
  }

  function dondeYCuando() {
    const l = modelo.lugar;
    if (!l) return;
    titulo('Dónde y cuándo', { nuevaHoja: true });
    const origen = { mapa: 'marcado por la persona en el mapa', 'gps-ajustado': 'del GPS, corregido a mano por la persona', gps: 'del GPS del teléfono', ejemplo: 'el del ejemplo' }[l.origen] ?? '';
    tabla([
      { etiqueta: 'Fecha y hora', valor: l.horaTexto || 'Sin hora', nota: 'la que la persona dijo en el paso 3 (por defecto, la del teléfono al abrir la app)' },
      { etiqueta: 'Punto', valor: `${l.punto.lat.toFixed(6)}, ${l.punto.lon.toFixed(6)}`, nota: [origen, l.precision ? `precisión del GPS: ±${l.precision}\u00a0m` : ''].filter(Boolean).join(' · ') },
      ...(l.via ? [{ etiqueta: 'Vía', valor: l.via, nota: l.resumenDeLaVia }] : []),
      ...(!l.via && l.sinVias ? [{ etiqueta: 'Vía', valor: 'El mapa no trae una vía cerca de este punto' }] : []),
    ]);
    if (l.sinConsultar) parrafo(l.sinConsultar, { tamano: 9.2 });
    // Los enlaces: el texto azul es el área que se toca.
    cabe(40);
    y += 14;
    const a = pdf.texto(M.izq, y, 'Abrir el punto en Google Maps', { tamano: 9.2, fuente: 'negrita', color: C.enlace });
    pdf.enlace(M.izq, y - 10, a, 13, l.enlaces.mapa);
    const xCalle = M.izq + a + 22;
    const b = pdf.texto(xCalle, y, 'Ver la calle en Street View', { tamano: 9.2, fuente: 'negrita', color: C.enlace });
    pdf.enlace(xCalle, y - 10, b, 13, l.enlaces.calle);
    y += 6;
    parrafo('Lo que se ve en Google no es del día del choque: sus imágenes pueden tener meses o años. La prueba del día son las fotos de este expediente.', { tamano: 7.6, color: C.suave });
    if (l.filasDeLaVia.length) {
      subtitulo('La vía, según el mapa');
      tabla(l.filasDeLaVia);
    }
    if (l.filasDeLaLuz.length) {
      subtitulo('La luz y el clima a esa hora');
      tabla(l.filasDeLaLuz);
    }
    parrafo('Fuentes: el trazado y los datos de la vía, © colaboradores de OpenStreetMap (ODbL); el clima, Open-Meteo.com (CC BY 4.0), un modelo y no una estación en el sitio; el sol, calculado con la hora y el punto.', { tamano: 7.4, color: C.suave });
  }

  function croquis() {
    const c = modelo.croquis;
    if (!c) return;
    titulo('El croquis', { nuevaHoja: !modelo.lugar || y > 420 });
    parrafo(`${c.titulo}${c.hecho ? '' : ' · la persona no lo dio por terminado'}. Visto desde arriba, con el norte hacia arriba y a escala.`, { tamano: 9.2, color: C.suave });
    if (c.plano) {
      const alto = (ANCHO * c.plano.caja.alto) / c.plano.caja.ancho;
      cabe(alto + 30);
      plano(c.plano, M.izq, y, ANCHO, alto);
      y += alto + 8;
      // La leyenda: el color de cada letra, la estrella y las flechas.
      let x = M.izq;
      const yl = y + 9;
      for (const carro of c.plano.carros) {
        pdf.rect(x, yl - 7, 10, 8, { relleno: carro.color });
        const quien = modelo.carros.find((k) => k.letra === carro.letra)?.titulo.replace(/^Carro /, '') ?? carro.letra;
        x += 14 + pdf.texto(x + 14, yl, quien, { tamano: 7.8, color: C.texto }) + 14;
      }
      if (c.plano.golpe) {
        estrella(x + 4.5, yl - 3, 5, c.plano.colorDelGolpe);
        x += 12 + pdf.texto(x + 12, yl, 'el golpe', { tamano: 7.8, color: C.texto }) + 14;
      }
      if (c.plano.flechas.length) pdf.texto(x, yl, c.plano.flechas[0].guiada ? 'flechas a trozos: el recorrido que arma el caso' : 'flechas: dibujadas por la persona', { tamano: 7.8, color: C.suave });
      y += 20;
    }
    subtitulo('En palabras');
    vinetas(c.relato, { tamano: 9 });
    parrafo('El croquis es lo que la persona declaró, no una medición. Los carros se dibujan con las medidas de su línea, si la eligió, o con unas medias.', { tamano: 7.6, color: C.suave });
  }

  function escena() {
    titulo('La escena', { nuevaHoja: true });
    const e = modelo.escena;
    if (e.fotos.length) {
      parrafo(`Una vuelta alrededor del punto del golpe, el ${e.fotos[0].fecha}. ${e.faltan}`, { tamano: 9, color: C.suave });
      rejilla(e.fotos);
    } else {
      parrafo(e.faltan, { tamano: 9.2, color: C.atencion });
    }
  }

  // «Antes de mover» (E1): primero, en una tabla, lo que no tiene fotos (lo declarado, lo saltado y lo
  // que falta, dicho así); después cada renglón con las suyas. Quien lo vio va en su propia tabla.
  function pruebas() {
    const p = modelo.pruebas;
    if (!p) return;
    titulo('Antes de mover: lo que se borra primero', { nuevaHoja: true });
    parrafo([p.resumen, p.tipo ? `Tipo de choque: ${p.tipo}.` : '', p.movidos].filter(Boolean).join(' '), { tamano: 9, color: C.suave });
    const sinFotos = p.renglones.filter((r) => !r.fotos.length && !(r.clave === 'testigos' && p.testigos.length));
    if (sinFotos.length) tabla(sinFotos.map((r) => ({ etiqueta: r.titulo, valor: r.resumen, nota: r.nota, aviso: r.estado === 'falta' || r.estado === 'saltado' ? 'sin-dato' : null })));
    for (const r of p.renglones.filter((x) => x.fotos.length)) {
      subtitulo(r.titulo);
      parrafo([r.resumen, r.nota].filter(Boolean).join('. '), { tamano: 8.8, color: C.suave });
      rejilla(r.fotos);
    }
    if (p.testigos.length) {
      subtitulo('Quien lo vio');
      tabla(p.testigos.map((t) => ({ etiqueta: t.nombre, valor: t.celular, nota: 'Lo anotó la persona, con su permiso' })));
    }
  }

  function carros() {
    for (const c of modelo.carros) {
      titulo(c.titulo, { nuevaHoja: true });
      tabla([
        { etiqueta: 'Placa', valor: c.placa.texto, nota: c.placa.detalle, aviso: c.placa.revisada ? null : 'atencion' },
        { etiqueta: 'Marca y línea', valor: c.linea },
      ]);
      if (c.fotos.length) {
        if (c.faltan) parrafo(c.faltan, { tamano: 8.6, color: C.atencion });
        rejilla(c.fotos);
      } else {
        parrafo(c.faltan, { tamano: 9.2, color: C.atencion });
      }
      subtitulo(`Los daños del carro ${c.letra}`);
      parrafo(`${c.danos.resumen} Marcados por la persona en el carro 3D de la app.`, { tamano: 9, color: C.suave });
      // Primero las que tienen su foto de cerca, en la misma rejilla de la vuelta (así el carro
      // entero cabe en su hoja); después, en una tabla, las que se marcaron sin foto.
      const conFoto = c.danos.filas.filter((f) => f.foto);
      const sinFoto = c.danos.filas.filter((f) => !f.foto);
      if (conFoto.length) rejilla(conFoto.map((f) => ({ ...f.foto, nota: f.nota })));
      if (sinFoto.length) tabla(sinFoto.map((f) => ({ etiqueta: f.pieza, valor: f.tipo, nota: f.nota, aviso: 'sin-dato' })));
    }
  }

  function anexo() {
    if (!modelo.anexo.length) return;
    titulo('Anexo: fotos repetidas', { nuevaHoja: true });
    parrafo('Fotos que se repitieron (otra posterior las reemplaza) o que ya no corresponden a nada de lo declarado. Siguen en la cadena y van aquí para que ninguna quede por fuera.', { tamano: 9, color: C.suave });
    rejilla(modelo.anexo);
  }

  function cadena() {
    const k = modelo.cadena;
    titulo('La cadena de huellas', { nuevaHoja: true });
    parrafo(k.texto, { tamano: 9.2, color: k.integra === false ? C.peligro : C.texto, fuente: k.integra === false ? 'negrita' : 'normal' });
    parrafo('Cada foto se selló al tomarla con su hora, su GPS, su rumbo y el SHA-256 de sus bytes, y cada registro lleva la huella del anterior: si se cambia, se quita o se reordena una foto, la cadena deja de cuadrar desde ahí.', { tamano: 8.4, color: C.suave });
    const col = { n: M.izq, que: M.izq + 26, hora: M.izq + 176, sha: M.izq + 238 };
    const encabezado = () => {
      cabe(30);
      y += 12;
      pdf.texto(col.n, y, 'N.º', { tamano: 7.2, fuente: 'negrita', color: C.suave });
      pdf.texto(col.que, y, 'Qué', { tamano: 7.2, fuente: 'negrita', color: C.suave });
      pdf.texto(col.hora, y, 'Hora', { tamano: 7.2, fuente: 'negrita', color: C.suave });
      pdf.texto(col.sha, y, 'SHA-256 de la foto', { tamano: 7.2, fuente: 'negrita', color: C.suave });
      y += 4;
      pdf.linea([[M.izq, y], [DERECHA, y]], { borde: C.borde, grosor: 0.6 });
    };
    encabezado();
    for (const f of k.filas) {
      if (y + 10 > FONDO_DE_LA_HOJA) {
        pagina();
        encabezado();
      }
      y += 10;
      pdf.texto(col.n, y, String(f.n), { tamano: 7, color: C.texto });
      let que = f.que;
      while (anchoDeTexto(que, 7) > col.hora - col.que - 6 && que.length > 4) que = que.slice(0, -2) + '…';
      pdf.texto(col.que, y, que, { tamano: 7, color: C.texto });
      pdf.texto(col.hora, y, f.hora, { tamano: 7, color: C.texto });
      pdf.texto(col.sha, y, f.sha256, { tamano: 6.6, fuente: 'fija', color: C.texto });
    }
    y += 8;
    subtitulo('Cómo comprobarlo, sin esta app');
    vinetas(
      [
        `Una foto: sáquela del PDF sin volverla a comprimir (por ejemplo, «pdfimages -all» de Poppler) y calcule su SHA-256. Debe ser el de esta tabla.`,
        `El reporte: este PDF lleva adjunto «${modelo.adjuntos.contenido}», el texto exacto que se selló. Su SHA-256 es la huella de la portada.`,
        `La cadena: el adjunto «${modelo.adjuntos.cadena}» trae el registro de cada foto. La huella de cada uno es el SHA-256 del registro sin el campo «huella», escrito en JSON con las claves en orden alfabético y sin espacios; incluye la huella del anterior.`,
      ],
      { tamano: 8.4 },
    );
  }

  portada();
  dondeYCuando();
  croquis();
  escena();
  pruebas();
  carros();
  anexo();
  cadena();
  for (const a of adjuntos) pdf.adjunto(a.nombre, a.bytes, { tipo: a.tipo, descripcion: a.descripcion });

  // El pie de cada hoja, ya sabiendo cuántas son.
  const total = pdf.paginas;
  for (let n = 1; n <= total; n++) {
    pdf.irAPagina(n);
    pdf.linea([[M.izq, CARTA.alto - 34], [DERECHA, CARTA.alto - 34]], { borde: C.borde, grosor: 0.5 });
    pdf.texto(M.izq, CARTA.alto - 22, `Huella del reporte ${modelo.huella.slice(0, 16)}…`, { tamano: 6.8, fuente: 'fija', color: C.suave });
    if (modelo.ejemplo) pdf.texto(CARTA.ancho / 2, CARTA.alto - 22, 'EJEMPLO · choque inventado', { tamano: 7, fuente: 'negrita', color: C.peligro, alinear: 'centro' });
    pdf.texto(DERECHA, CARTA.alto - 22, `Página ${n} de ${total}`, { tamano: 7, color: C.suave, alinear: 'derecha' });
  }
  return pdf.bytes();
}
