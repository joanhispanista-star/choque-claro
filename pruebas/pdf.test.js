// El PDF escrito a mano: que el índice (xref) apunte a cada objeto, que el texto salga en WinAnsi
// con tildes y eñes, que las fotos y los adjuntos vayan con sus bytes intactos (de eso depende que
// su SHA-256 se pueda comprobar desde el PDF) y que el texto se parta en renglones que caben.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARTA, aWinAnsi, anchoDeTexto, crearPdf, envolver, medidaDeJpeg } from '../js/pdf.js';
import { jpegDePrueba } from './jpeg-de-prueba.js';

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
function contiene(grande, chico) {
  outer: for (let i = 0; i <= grande.length - chico.length; i++) {
    for (let j = 0; j < chico.length; j++) if (grande[i + j] !== chico[j]) continue outer;
    return true;
  }
  return false;
}

test('el texto va en WinAnsi: tildes, eñes y signos de Colombia; lo demás, «?»', () => {
  assert.deepEqual(aWinAnsi('ñÁ¿¡€—°'), [0xf1, 0xc1, 0xbf, 0xa1, 0x80, 0x97, 0xb0]);
  assert.deepEqual(aWinAnsi('a\tb'), [0x61, 0x20, 0x62]);
  assert.deepEqual(aWinAnsi('🚗'), [0x3f]);
});

test('los anchos son los de Helvetica, y la í mide como una i sin punto', () => {
  assert.equal(anchoDeTexto('Hola', 10), (722 + 556 + 222 + 556) / 100);
  assert.equal(anchoDeTexto('í', 10), 2.78);
  assert.equal(anchoDeTexto('Á', 10), anchoDeTexto('A', 10));
  assert.equal(anchoDeTexto('abc', 10, 'fija'), 18);
  assert.ok(anchoDeTexto('Hola', 10, 'negrita') > anchoDeTexto('Hola', 10));
});

test('envolver: cada renglón cabe, respeta los saltos y corta una huella larga', () => {
  const texto = 'El croquis es lo que la persona declaró, no una medición.\nSegundo párrafo.';
  const renglones = envolver(texto, 120, 10);
  assert.ok(renglones.length >= 4);
  for (const r of renglones) assert.ok(anchoDeTexto(r, 10) <= 120, r);
  assert.equal(renglones.at(-1), 'Segundo párrafo.');
  const huella = 'a'.repeat(64);
  const partida = envolver(huella, 100, 10, 'fija');
  assert.equal(partida.join(''), huella);
  for (const r of partida) assert.ok(anchoDeTexto(r, 10, 'fija') <= 100);
});

test('el espacio entre número y unidad mide lo de un espacio y no deja la unidad sola', () => {
  assert.equal(anchoDeTexto('13 m', 10), anchoDeTexto('13 m', 10));
  assert.equal(anchoDeTexto('13 m', 10, 'negrita'), anchoDeTexto('13 m', 10, 'negrita'));
  assert.deepEqual(aWinAnsi('13 m'), [0x31, 0x33, 0xa0, 0x6d]);
  // Donde cabe «Curva cerrada, radio 13» pero no la «m», baja «13 m» entero.
  const ancho = anchoDeTexto('Curva cerrada, radio 13', 10);
  assert.deepEqual(envolver('Curva cerrada, radio 13 m', ancho, 10), ['Curva cerrada, radio', '13 m']);
});

test('medidaDeJpeg lee la marca SOF, también la progresiva; lo que no es JPEG da null', () => {
  assert.deepEqual(medidaDeJpeg(jpegDePrueba(1280, 960)), { ancho: 1280, alto: 960, canales: 3 });
  assert.deepEqual(medidaDeJpeg(jpegDePrueba(960, 1280, { sof: 0xc2 })), { ancho: 960, alto: 1280, canales: 3 });
  assert.equal(medidaDeJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), null);
  assert.equal(medidaDeJpeg(null), null);
});

test('el archivo: índice exacto, páginas, texto escapado, foto y adjunto intactos, enlace', () => {
  const pdf = crearPdf({ titulo: 'Expediente ñ', autor: 'Choque Claro', ancho: CARTA.ancho, alto: CARTA.alto, fecha: '2026-11-14T15:00:00Z' });
  const foto = jpegDePrueba(1280, 960);
  pdf.nuevaPagina();
  pdf.texto(40, 60, 'Paréntesis (a) y barra \\ ñ', { tamano: 12, fuente: 'negrita' });
  pdf.imagen(foto, 40, 80, 200, 150);
  pdf.imagen(foto, 260, 80, 200, 150); // la misma foto, otra vez
  pdf.enlace(40, 300, 100, 12, 'https://www.google.com/maps/search/?api=1&query=4.6484,-74.0105');
  pdf.nuevaPagina();
  pdf.rect(10, 10, 50, 50, { relleno: '#0f6e56', alfa: 0.5 });
  pdf.circulo(100, 100, 20, { borde: '#b42318', grosor: 2, punteada: [3, 2] });
  pdf.recortado(0, 0, 100, 100, () => pdf.linea([[0, 0], [100, 100]], { borde: '#000000' }));
  pdf.adjunto('contenido.json', '{"a":1}', { tipo: 'application/json', descripcion: 'Lo sellado' });
  const bytes = pdf.bytes();
  const s = latin1(bytes);

  assert.ok(s.startsWith('%PDF-1.7\n'));
  assert.ok(s.endsWith('%%EOF\n'));
  // startxref apunta a la palabra xref, y cada entrada del índice a su «N 0 obj».
  const xref = Number(s.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.equal(s.slice(xref, xref + 4), 'xref');
  const [, total] = s.slice(xref).match(/^xref\n0 (\d+)\n/);
  const entradas = s.slice(xref).split('\n').slice(3, 3 + Number(total) - 1);
  entradas.forEach((linea, i) => {
    assert.equal(linea.length, 19, 'cada entrada mide 20 bytes con el salto');
    const donde = Number(linea.slice(0, 10));
    assert.equal(s.slice(donde, donde + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`);
  });
  assert.match(s, /\/Type \/Pages \/Kids \[\d+ 0 R \d+ 0 R\] \/Count 2/);
  // El texto: paréntesis y barra escapados, é y ñ en octal de WinAnsi.
  assert.ok(s.includes('(Par\\351ntesis \\(a\\) y barra \\\\ \\361) Tj'));
  assert.ok(s.includes('/F2 12 Tf'));
  // La foto entra una sola vez, con sus bytes intactos.
  assert.equal(s.match(/\/Subtype \/Image/g).length, 1);
  assert.ok(s.includes('/Width 1280 /Height 960 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode'));
  assert.ok(contiene(bytes, foto));
  // El enlace, la transparencia, el recorte y el adjunto.
  assert.ok(s.includes('/S /URI /URI (https://www.google.com/maps/search/?api=1&query=4.6484,-74.0105)'));
  assert.ok(s.includes('/T50 << /ca 0.5 /CA 0.5 >>'));
  assert.ok(s.includes('re W n'));
  assert.match(s, /\/Names << \/EmbeddedFiles << \/Names \[\(contenido.json\) \d+ 0 R\] >> >>/);
  assert.ok(s.includes('/Subtype /application#2fjson /Length 7'));
  assert.ok(s.includes('stream\n{"a":1}\nendstream'));
  // El título en UTF-16 con su marca: «Expediente ñ».
  assert.ok(s.includes('/Title <FEFF0045007800700065006400690065006E0074006500200' + '0F1>'));
  assert.ok(s.includes('/CreationDate (D:20261114150000Z)'));
});

test('sin página no se dibuja, y una foto que no es JPEG se rechaza', () => {
  const pdf = crearPdf();
  assert.throws(() => pdf.texto(0, 0, 'x'), /Primero una página/);
  pdf.nuevaPagina();
  assert.throws(() => pdf.imagen(Uint8Array.from([1, 2, 3, 4, 5, 6]), 0, 0, 10, 10), /no es un JPEG/);
});
