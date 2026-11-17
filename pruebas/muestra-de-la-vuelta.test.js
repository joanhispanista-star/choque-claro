// La muestra de la vuelta del ejemplo: cinco fotos reales de OTRO choque. Lo que se prueba es lo que
// no puede fallar: que digan siempre que son de otro choque, que cada una lleve su crédito completo
// (CC BY-SA 2.0 no da plazo para corregirlo) y que no se rellene un lado sin foto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LADOS, MUESTRA, NOTA_DE_LA_MUESTRA, PRESENTACION_DE_LA_MUESTRA, creditosDeLaMuestra, panelDeArranque, panelesDeLaMuestra, textoDeLaMuestra } from '../js/muestra-de-la-vuelta.js';
import { panelDeFrente } from '../js/escena-360.js';

const raiz = (ruta) => new URL('../' + ruta, import.meta.url);

test('ocho puestos cada 45°: cinco con foto y los tres de los que no hay foto publicada, vacíos', () => {
  const paneles = panelesDeLaMuestra();
  assert.equal(paneles.length, 8);
  assert.equal(LADOS.length, 8);
  assert.deepEqual(paneles.map((p) => p.desde), [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual(paneles.filter((p) => !p.foto).map((p) => p.lado), ['adelante', 'adelante a la derecha', 'atrás']);
  assert.equal(paneles.filter((p) => p.foto).length, MUESTRA.fotos.length);
  assert.equal(new Set(paneles.map((p) => p.angulo)).size, 8, 'cada panel en su puesto');
  // Ninguna foto repetida para tapar un hueco.
  assert.equal(new Set(paneles.filter((p) => p.foto).map((p) => p.foto.archivo)).size, 5);
});

test('girar a la derecha es correrse a la derecha alrededor de los carros', () => {
  const paneles = panelesDeLaMuestra();
  const arranque = panelDeArranque(paneles);
  assert.equal(arranque.desde, 315, 'arranca en la trompa hundida del carro rojo');
  assert.equal(arranque.foto.titulo, 'choque #2');
  // Desde adelante a la izquierda, a la derecha está el costado izquierdo; a la izquierda, el frente.
  assert.equal(panelDeFrente(paneles, arranque.angulo + 45).lado, 'la izquierda');
  assert.equal(panelDeFrente(paneles, arranque.angulo - 45).lado, 'adelante');
});

test('cada foto dice que es una muestra de otro choque, y los huecos por qué están vacíos', () => {
  const paneles = panelesDeLaMuestra();
  for (const p of paneles.filter((x) => x.foto)) {
    const texto = textoDeLaMuestra(p);
    assert.match(texto, /^Muestra desde .+ de los carros · «choque #\d»/);
    assert.match(texto, /otro choque, no el de este ejemplo/);
    assert.match(texto, /Ernesto \(etagwerker\)/);
    assert.match(texto, /CC BY-SA 2\.0/);
  }
  assert.equal(textoDeLaMuestra(paneles[0]), 'Desde adelante: no hay foto; ninguna de las 5 publicadas es de este lado.');
  // Lo que no se sabe no se afirma: el autor pudo tomar más fotos y no subirlas.
  for (const p of paneles.filter((x) => !x.foto)) assert.doesNotMatch(textoDeLaMuestra(p), /no la tomó/);
  assert.equal(textoDeLaMuestra(null), '');
  assert.match(PRESENTACION_DE_LA_MUESTRA, /MUESTRA/);
  assert.match(PRESENTACION_DE_LA_MUESTRA, /otro choque/);
  assert.match(PRESENTACION_DE_LA_MUESTRA, /No son de este ejemplo ni de este lugar/);
  assert.match(PRESENTACION_DE_LA_MUESTRA, /Buenos Aires/);
  assert.match(NOTA_DE_LA_MUESTRA, /no hay brújula/);
});

test('el crédito, completo, como lo pide CC BY-SA 2.0: autor, licencia, cambios y cada original', () => {
  const c = creditosDeLaMuestra();
  assert.match(c.texto, /Ernesto \(etagwerker\)/, 'el autor');
  assert.match(c.texto, /CC BY-SA 2\.0/, 'la licencia');
  assert.equal(c.urlLicencia, 'https://creativecommons.org/licenses/by-sa/2.0/deed.es');
  assert.match(c.texto, /las modificó \(placas, caras/, 'que se modificó y qué');
  assert.match(c.texto, /estas versiones también son CC BY-SA 2\.0/, 'compartir igual');
  assert.deepEqual(c.originales.map((f) => f.titulo), ['choque #1', 'choque #2', 'choque #3', 'choque #4', 'choque #5']);
  for (const f of c.originales) assert.match(f.pagina, /^https:\/\/www\.flickr\.com\/photos\/93433156@N00\/\d+\/$/, 'el enlace a la original');
  assert.equal(new Set(c.originales.map((f) => f.pagina)).size, 5);
  // Cada foto del círculo tiene su original en la lista.
  for (const f of MUESTRA.fotos) assert.ok(c.originales.some((o) => o.titulo === f.titulo && o.pagina === f.pagina), f.titulo);
});

test('las fotos están en el repositorio, livianas y sin EXIF, y el LEEME las nombra todas', () => {
  const leeme = fs.readFileSync(raiz('datos/ejemplo-fotos/LEEME.md'), 'utf8');
  for (const f of MUESTRA.fotos) {
    const datos = fs.readFileSync(raiz(f.archivo));
    assert.equal(datos[0], 0xff);
    assert.equal(datos[1], 0xd8, `${f.archivo} es un JPEG`);
    assert.ok(datos.length < 300 * 1024, `${f.archivo}: ${datos.length} bytes`);
    // Sin EXIF: la cámara guardó una hora y datos que no son de nadie que la página nombre.
    assert.equal(datos.indexOf(Buffer.from('Exif\0')), -1, `${f.archivo} trae EXIF`);
    const nombre = f.archivo.split('/').pop();
    assert.ok(leeme.includes('`' + nombre + '`'), `el LEEME nombra ${nombre}`);
    assert.ok(leeme.includes(f.pagina), `el LEEME enlaza ${f.pagina}`);
  }
  assert.match(leeme, /CC BY-SA 2\.0/);
});

test('la página tiene dónde decir que es una muestra: sello, presentación y créditos', () => {
  const html = fs.readFileSync(raiz('zona-3d.html'), 'utf8');
  for (const id of ['escena-360-presentacion', 'escena-360-sello', 'escena-360-creditos', 'escena-360-norte']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /id="escena-360-sello" hidden>MUESTRA · fotos de otro choque</);
});
