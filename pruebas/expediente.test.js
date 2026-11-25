// El expediente (paso 8): que diga lo que el reporte dice y nada más, que lo que falta se diga, que
// ninguna foto de la cadena se esconda (las repetidas van al anexo), que el croquis se dibuje con
// todo adentro y la flecha no tape la estrella del golpe, y que el PDF lleve cada foto y el texto
// sellado con sus bytes intactos: de eso depende que alguien lo compruebe sin la app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, verificarCadena } from '../js/evidencia.js';
import { sellarReporte } from '../js/sello.js';
import { adjuntoDeLaCadena, adjuntoDelContenido, armarExpediente, datosDeLaFoto, huellasReemplazadas, planoDelCroquis } from '../js/expediente.js';
import { pdfDelExpediente } from '../js/expediente-pdf.js';
import { nombreDeLaToma, placaParaMostrar, textoDeLaLinea } from '../js/carros.js';
import { nombreDePiezaEn } from '../js/carrocerias.js';
import { tituloDelCaso, viaDesdeGuardado } from '../js/croquis.js';
import { NOMBRES_DE_PROBLEMAS } from '../js/calidad.js';
import { fechaYHora } from '../js/fechas.js';
import { distancia } from '../js/geo.js';
import { CARROS, HORA_DEL_CHOQUE, reporteDePrueba } from './reporte-de-prueba.js';

const HORA_DEL_SELLO = new Date('2026-11-13T22:44:12Z');
const cerca = (a, b, tolerancia = 1e-6) => Math.abs(a - b) <= tolerancia;

async function expedienteDePrueba({ cambiar = (r) => r } = {}) {
  const base = await reporteDePrueba();
  const reporte = cambiar(base.reporte);
  const { registros, fotos } = base;
  const { sello, texto } = await sellarReporte({ reporte, registros, hora: HORA_DEL_SELLO });
  const revision = await verificarCadena(registros, { huellaDeLaFoto: async (r) => sha256Hex(fotos.get(r.huella)) });
  return { ...base, reporte, sello, texto, revision, modelo: armarExpediente({ reporte, registros, sello, revision }) };
}

test('cada foto lleva lo que se selló con ella, en palabras', async () => {
  const { registros } = await reporteDePrueba();
  const d = datosDeLaFoto(registros[0]);
  assert.equal(d.registro, 1);
  assert.equal(d.fecha, '13 de noviembre de 2026');
  assert.equal(d.hora, '5:24:22 p. m.');
  assert.match(d.rumbo, /^Mirando al .+, 20° \(brújula del iPhone\)$/);
  assert.equal(d.gps, 'GPS 4.64838, -74.01052 (±8\u00a0m)');
  assert.equal(d.revision, '');
  // La toma borrosa que la persona aceptó igual: se dice.
  assert.equal(datosDeLaFoto(registros[3]).revision, `Aceptada aunque salió ${NOMBRES_DE_PROBLEMAS.borrosa.toLowerCase()}`);
  const sinNada = datosDeLaFoto({ ...registros[0], rumbo: null, gps: null });
  assert.equal(sinNada.rumbo, 'Sin brújula');
  assert.equal(sinNada.gps, 'Sin GPS');
});

test('lo dicho antes de mover sale como dicho por la persona, y la sospecha no se vende como prueba', async () => {
  const sin = await expedienteDePrueba();
  assert.ok(!sin.modelo.resumen.some((f) => f.etiqueta === 'Antes de mover'));
  assert.ok(!sin.modelo.noAfirma.some((t) => /borracho/.test(t)));

  const con = await expedienteDePrueba({ cambiar: (r) => ({ ...r, antes: { embriaguez: 'si', andan: 'alguno-no', hora: '2026-11-13T22:20:00Z' } }) });
  const fila = con.modelo.resumen.find((f) => f.etiqueta === 'Antes de mover');
  assert.equal(fila.valor, 'La persona sospechaba que alguien manejaba borracho o drogado; alguno de los carros no podía andar (5:20 p. m.)');
  assert.ok(con.modelo.noAfirma.some((t) => /es una sospecha de la persona, no una prueba/.test(t)));
  // Sigue siendo lo primero lo de la culpa, después del aviso de ejemplo.
  assert.match(con.modelo.noAfirma[1], /^No dice quién tuvo la culpa/);
});

test('si no se alcanzó a consultar la vía o el clima, el expediente lo dice', async () => {
  const completo = await expedienteDePrueba();
  assert.equal(completo.modelo.lugar.sinConsultar, '');
  const { modelo } = await expedienteDePrueba({ cambiar: (r) => ({ ...r, lugar: { ...r.lugar, via: null, filasDeLaVia: [] } }) });
  assert.equal(modelo.lugar.sinConsultar, 'No se alcanzó a consultar la vía: por ejemplo, porque no había internet.');
  const sinVias = await expedienteDePrueba({ cambiar: (r) => ({ ...r, croquis: null, lugar: { ...r.lugar, via: null, sinVias: true, filasDeLaVia: [] } }) });
  assert.equal(sinVias.modelo.lugar.sinConsultar, '');
  assert.equal(sinVias.modelo.lugar.sinVias, true);
});

test('la escena y los carros: las fotos vigentes, lo que falta y la placa como se declaró', async () => {
  const { modelo, registros, sello } = await expedienteDePrueba();
  assert.equal(registros.length, 26, 'el reporte de prueba: 9 de la escena, 8 de A, 6 de B y 3 de daños');
  assert.equal(modelo.numero, sello.numero);
  assert.equal(modelo.titulo, `Expediente del choque ${sello.numero}`);
  assert.equal(modelo.selladoTexto, '13 de noviembre de 2026, 5:44 p. m.');

  // La escena: 8 fotos, y la del sector 4 es la que reemplazó a la borrosa.
  assert.equal(modelo.escena.fotos.length, 8);
  assert.equal(modelo.escena.fotos[3].huella, registros[4].huella);
  assert.equal(modelo.escena.fotos[3].titulo, 'Escena · foto 4');
  assert.equal(modelo.escena.faltan, '');

  const [a, b] = modelo.carros;
  assert.equal(a.fotos.length, 8);
  assert.equal(a.faltan, '');
  assert.deepEqual(a.placa, { texto: placaParaMostrar('JRK245'), detalle: a.placa.detalle, revisada: true });
  assert.equal(a.linea, `${textoDeLaLinea(CARROS[0].linea)} (hatchback), según la persona`);

  assert.equal(b.fotos.length, 6);
  assert.equal(b.faltan, `Faltan la 6 (${nombreDeLaToma(5).toLowerCase()}) y la 7 (${nombreDeLaToma(6).toLowerCase()}).`);
  // La placa de B la leyó la app y nadie la revisó: va, pero dicho así.
  assert.equal(b.placa.texto, placaParaMostrar('HTX918'));
  assert.equal(b.placa.revisada, false);
  assert.equal(b.placa.detalle, 'Leída de la foto y SIN revisar por la persona.');
  // La foto 8 de B salió oscura y se aceptó: lo dice debajo de la foto.
  assert.match(b.fotos.at(-1).revision, /^Aceptada aunque salió /);
});

test('los daños: con su foto de cerca, con la foto de otro tipo y sin foto', async () => {
  const { modelo } = await expedienteDePrueba();
  const [a, b] = modelo.carros;
  const fila = (carro, pieza, carroceria) => carro.danos.filas.find((f) => f.pieza === nombreDePiezaEn(carroceria, pieza));
  assert.equal(a.danos.filas.length, 3);
  assert.ok(fila(a, 'bomper-del', 'hatchback').foto);
  assert.equal(fila(a, 'bomper-del', 'hatchback').nota, '');
  // El capó se marcó abolladura, pero la foto se tomó cuando decía rayón: la foto va y se aclara.
  assert.ok(fila(a, 'capo', 'hatchback').foto);
  assert.match(fila(a, 'capo', 'hatchback').nota, /^La foto se tomó cuando estaba marcado como «.+»\.$/);
  assert.equal(fila(a, 'guardafango-del-der', 'hatchback').foto, null);
  assert.equal(fila(a, 'guardafango-del-der', 'hatchback').nota, 'Sin foto de cerca.');
  assert.equal(b.danos.filas.length, 1);
  assert.ok(fila(b, 'guardafango-del-izq', 'suv').foto);
});

test('el resumen y la cadena cuentan todas las fotos; la repetida va al anexo, no se esconde', async () => {
  const { modelo, registros } = await expedienteDePrueba();
  const valor = (etiqueta) => modelo.resumen.find((f) => f.etiqueta === etiqueta)?.valor;
  assert.equal(valor('El choque'), fechaYHora(HORA_DEL_CHOQUE));
  assert.match(valor('Dónde'), /Verjones/);
  assert.equal(valor('Carro A'), `el tuyo · ${placaParaMostrar('JRK245')} · ${textoDeLaLinea(CARROS[0].linea)}`);
  assert.equal(valor('Fotos'), '26 fotos en la cadena: 8 de la escena, 8 del carro A, 6 del carro B y 3 de los daños (1 en el anexo)');
  assert.equal(valor('Daños'), 'A: 3 piezas · B: 1 pieza');
  assert.equal(valor('Croquis'), tituloDelCaso('frente'));

  assert.equal(modelo.anexo.length, 1);
  assert.equal(modelo.anexo[0].huella, registros[3].huella);
  assert.equal(modelo.anexo[0].titulo, 'Escena · 4 · repetida');
  assert.equal(modelo.anexo[0].nota, 'La reemplaza el registro 5.');
  assert.deepEqual([...huellasReemplazadas(registros).keys()], [registros[3].huella]);

  assert.equal(modelo.cadena.integra, true);
  assert.match(modelo.cadena.texto, /revisó la cadena de 26 registros con los bytes de cada foto/);
  assert.equal(modelo.cadena.filas.length, 26);
  assert.deepEqual(modelo.cadena.filas.map((f) => f.sha256), registros.map((r) => r.foto.sha256));
  assert.equal(modelo.cadena.filas[3].que, 'Escena · 4 (repetida)');
  assert.equal(modelo.cadena.filas[4].que, 'Escena · 4');
  assert.equal(modelo.cadena.filas[23].que, `Daño A · ${nombreDePiezaEn('hatchback', 'bomper-del').toLowerCase()}`);

  assert.match(JSON.stringify(modelo.lugar.enlaces), /google\.com\/maps/);
  assert.deepEqual(modelo.adjuntos, { contenido: adjuntoDelContenido(modelo.numero), cadena: adjuntoDeLaCadena(modelo.numero) });
});

test('la foto de un daño cuya marca se quitó sigue en el expediente, en el anexo', async () => {
  const { modelo } = await expedienteDePrueba({ cambiar: (r) => ({ ...r, danos: r.danos.filter((d) => d.carro !== 'B') }) });
  assert.equal(modelo.anexo.length, 2);
  const suelta = modelo.anexo.find((f) => f.titulo.startsWith('Daño B'));
  assert.equal(suelta.titulo, `Daño B · ${nombreDePiezaEn('suv', 'guardafango-del-izq').toLowerCase()}`);
  assert.match(suelta.nota, /^Sigue en la cadena, pero ya no corresponde a lo declarado/);
  assert.match(modelo.resumen.find((f) => f.etiqueta === 'Fotos').valor, /\(2 en el anexo\)$/);
});

test('lo que el expediente NO afirma; si es el ejemplo, eso va primero', async () => {
  const { modelo } = await expedienteDePrueba();
  assert.equal(modelo.ejemplo, true);
  assert.match(modelo.noAfirma[0], /^ES UN EJEMPLO/);
  assert.ok(modelo.noAfirma.some((t) => /No dice quién tuvo la culpa/.test(t)));
  const real = (await expedienteDePrueba({ cambiar: (r) => ({ ...r, lugar: { ...r.lugar, origen: 'gps' }, croquis: { ...r.croquis, ejemplo: false } }) })).modelo;
  assert.equal(real.ejemplo, false);
  assert.ok(!real.noAfirma.some((t) => /EJEMPLO/.test(t)));
  assert.equal(real.noAfirma.length, modelo.noAfirma.length - 1);
});

test('la cadena sin revisar o rota se dice tal cual', async () => {
  const { reporte, registros, sello } = await expedienteDePrueba();
  const sinRevisar = armarExpediente({ reporte, registros, sello });
  assert.equal(sinRevisar.cadena.integra, null);
  assert.equal(sinRevisar.cadena.texto, 'La cadena no se revisó al preparar este expediente.');
  const rota = armarExpediente({ reporte, registros, sello, revision: { integra: false, total: 26, rota: { indice: 3, motivo: 'foto' } } });
  assert.equal(rota.cadena.integra, false);
  assert.equal(rota.cadena.texto, 'Al preparar este expediente, la cadena se rompió en el registro 4.');
});

test('el plano del croquis: todo adentro con margen, en la proporción de la hoja', async () => {
  const { reporte } = await reporteDePrueba();
  assert.equal(planoDelCroquis(null), null);
  const plano = planoDelCroquis(reporte.croquis);
  const { caja } = plano;
  assert.ok(cerca(caja.ancho / caja.alto, 1.3));
  assert.ok(caja.ancho >= 34);
  const dibujado = [...plano.carros.flatMap((c) => c.cuerpo), ...plano.flechas.flatMap((f) => f.puntos), ...(plano.golpe ? [plano.golpe] : [])];
  assert.ok(dibujado.length > 8);
  for (const p of dibujado) {
    assert.ok(p.x >= caja.oeste + 5 - 1e-9 && p.x <= caja.este - 5 + 1e-9, `x ${p.x} fuera de la caja`);
    assert.ok(p.y >= caja.sur + 5 - 1e-9 && p.y <= caja.norte - 5 + 1e-9, `y ${p.y} fuera de la caja`);
  }
  // La regla: la medida redonda más cercana a un quinto del ancho.
  const quinto = caja.ancho / 5;
  for (const m of [5, 10, 20, 50, 100]) assert.ok(Math.abs(plano.regla - quinto) <= Math.abs(m - quinto));

  // Cada carro mide lo que mide, y su vidrio de adelante queda hacia donde mira.
  plano.carros.forEach((c, i) => {
    const guardado = reporte.croquis.carros[i];
    assert.ok(cerca(distancia(c.cuerpo[0], c.cuerpo[2]), Math.hypot(guardado.largo, guardado.ancho)));
    const vidrio = { x: c.vidrio.reduce((s, p) => s + p.x, 0) / 4, y: c.vidrio.reduce((s, p) => s + p.y, 0) / 4 };
    const adelante = (vidrio.x - c.centro.x) * Math.sin((c.rumbo * Math.PI) / 180) + (vidrio.y - c.centro.y) * Math.cos((c.rumbo * Math.PI) / 180);
    assert.ok(cerca(adelante, guardado.largo * 0.17));
  });

  // El ancho de la vía: 3,3 m por carril, entre 5 y 14 m; sin dato, 7.
  assert.equal(plano.via.ancho, 7);
  assert.ok(cerca(planoDelCroquis(reporte.croquis, { carriles: 4 }).via.ancho, 13.2));
  assert.equal(planoDelCroquis(reporte.croquis, { carriles: 10 }).via.ancho, 14);
  assert.equal(planoDelCroquis(reporte.croquis, { carriles: 1 }).via.ancho, 5);
});

test('la flecha que llega al golpe termina antes de la estrella; las demás, donde terminan', async () => {
  const { reporte } = await reporteDePrueba();
  const croquis = reporte.croquis;
  const { plano } = viaDesdeGuardado(croquis);
  const g = plano.aMetros(croquis.golpe);
  const hasta = (dx, dy) => plano.aGrados({ x: g.x + dx, y: g.y + dy });
  const conFlechas = {
    ...croquis,
    flechas: [
      { letra: 'A', puntos: [hasta(-12, 0), hasta(-0.5, 0)] }, // a medio metro del golpe: se recorta 1,6 m
      { letra: 'B', puntos: [hasta(12, 5), hasta(5, 5)] }, // lejos del golpe: queda igual
      { letra: 'B', puntos: [hasta(3, 3)] }, // un solo punto: no es una flecha
    ],
  };
  const { flechas } = planoDelCroquis(conFlechas);
  assert.equal(flechas.length, 2);
  const finA = flechas[0].puntos.at(-1);
  assert.ok(cerca(finA.x - g.x, -2.1, 1e-6) && cerca(finA.y - g.y, 0, 1e-6), JSON.stringify(finA));
  const finB = flechas[1].puntos.at(-1);
  assert.ok(cerca(finB.x - g.x, 5, 1e-6) && cerca(finB.y - g.y, 5, 1e-6));
  for (const f of flechas) assert.ok(Array.isArray(f.punta) && f.punta.length >= 3);
  assert.equal(flechas[0].guiada, croquis.modo !== 'libre');
  assert.equal(planoDelCroquis({ ...conFlechas, modo: 'libre' }).flechas[0].guiada, false);
});

test('el PDF: cada foto y el texto sellado con sus bytes intactos, adjuntos y páginas numeradas', async () => {
  const { modelo, registros, fotos, sello, texto } = await expedienteDePrueba();
  const cadena = JSON.stringify(registros, null, 2);
  const bytes = pdfDelExpediente(modelo, {
    fotos,
    adjuntos: [
      { nombre: adjuntoDelContenido(sello.numero), bytes: texto, tipo: 'application/json', descripcion: 'El texto exacto que se selló' },
      { nombre: adjuntoDeLaCadena(sello.numero), bytes: cadena, tipo: 'application/json', descripcion: 'La cadena de fotos' },
    ],
  });
  const pdf = Buffer.from(bytes);
  const s = pdf.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.7\n'));
  assert.ok(s.endsWith('%%EOF\n'));

  // Cada foto de la cadena, la repetida incluida, va con los mismos bytes que se sellaron.
  for (const r of registros) assert.ok(pdf.indexOf(Buffer.from(fotos.get(r.huella))) >= 0, `falta la foto del registro ${r.indice + 1}`);
  assert.equal(s.match(/\/Subtype \/Image/g).length, registros.length);

  // El texto sellado viaja exacto: su SHA-256 es la huella del reporte.
  assert.equal(await sha256Hex(texto), sello.huella);
  assert.ok(pdf.indexOf(Buffer.from(`stream\n${texto}\nendstream`, 'utf8')) >= 0);
  assert.ok(pdf.indexOf(Buffer.from(`stream\n${cadena}\nendstream`, 'utf8')) >= 0);
  assert.ok(s.includes(`(${adjuntoDelContenido(sello.numero)})`));
  assert.ok(s.includes(`(${adjuntoDeLaCadena(sello.numero)})`));

  // El número en la portada, y «Página N de M» en cada hoja, con M el total real.
  assert.ok(s.includes(`(${sello.numero}) Tj`));
  const total = Number(s.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)[1]);
  assert.ok(total >= 6, `${total} páginas`);
  for (let n = 1; n <= total; n++) assert.ok(s.includes(`gina ${n} de ${total}) Tj`), `falta «Página ${n} de ${total}»`);
  assert.ok(s.includes('EJEMPLO'));

  // Un choque de verdad no lleva la palabra EJEMPLO en ninguna parte.
  const real = await expedienteDePrueba({ cambiar: (r) => ({ ...r, lugar: { ...r.lugar, origen: 'gps' }, croquis: { ...r.croquis, ejemplo: false } }) });
  const otro = Buffer.from(pdfDelExpediente(real.modelo, { fotos: real.fotos })).toString('latin1');
  assert.ok(!otro.includes('EJEMPLO'));
});
