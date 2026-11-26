// «Antes de mover: lo que se borra primero» (E1, 26-nov-2026): qué se pide y en qué orden, cómo
// cambia con el choque, la luz y la lluvia, qué se dice de lo tomado, lo declarado y lo saltado, y que
// nunca diga «no había» de lo que no se tomó ni mande a nadie a la vía.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVES,
  SALTADA,
  TEXTO_DE_SALTADA,
  avisosParaMover,
  condiciones,
  conMedida,
  conMovidos,
  conRespuesta,
  conSalto,
  conTestigo,
  conTipo,
  estadoDeLasPruebas,
  fotosDeLaCaminata,
  fotosDeLaPrueba,
  limpiarPruebas,
  listaDePruebas,
  metrosDeLaCaminata,
  resumenDeLasPruebas,
  sinTestigo,
  textoDeLaMedida,
  textoDelFinal,
  textoDelPisoYLaLuz,
} from '../js/pruebas.js';
import { reporteDePrueba } from './reporte-de-prueba.js';

// Jueves 26 de noviembre de 2026, 3:00 p. m. en Bogotá.
const DE_DIA = new Date('2026-11-26T20:00:00Z');
const HORA = new Date('2026-11-26T20:05:00Z');
const BOGOTA = { lat: 4.6484, lon: -74.0105 };

// Una foto de «Antes de mover», con lo mínimo que la lista mira.
const foto = (prueba, sector, minuto = 0, extra = {}) => ({ paso: 'prueba', prueba, sector, hora: new Date(DE_DIA.getTime() + minuto * 60000).toISOString(), huella: `${prueba}-${sector}-${minuto}`, ...extra });
const renglon = (e, clave) => e.renglones.find((r) => r.clave === clave);
const claves = (c) => listaDePruebas(c).map((r) => r.clave);
const base = { tipo: null, noche: false, lluvia: null, kmh: null, huella: null, piso: null };

test('la lista de siempre: lo que se borra primero, con cuántas fotos pide cada renglón', () => {
  const e = estadoDeLasPruebas({ ahora: DE_DIA });
  assert.deepEqual(
    e.renglones.map((r) => `${r.clave}:${r.total}`),
    ['esquinas:4', 'huella:5', 'piso:1', 'llanta:2', 'golpes:2', 'ruedas:2', 'vidrios:2', 'senal:2', 'vuelta:8', 'caminata:4', 'testigos:0'],
  );
  assert.deepEqual([e.hechos, e.resueltos, e.total, e.fotos, e.empezada], [0, 0, 11, 0, false]);
  assert.equal(e.siguiente.clave, 'esquinas');
  assert.deepEqual(CLAVES, e.renglones.map((r) => r.clave), 'el catálogo entero, en ese orden');
});

test('la lista cambia con el choque: sin huella no hay llanta; contra algo quieto ni señal ni ruedas del otro', () => {
  assert.ok(!claves({ ...base, huella: 'no-hay' }).includes('llanta'));
  assert.ok(claves({ ...base, huella: 'pedazos' }).includes('llanta'));
  const quieto = listaDePruebas({ ...base, tipo: 'quieto' });
  assert.ok(!quieto.some((r) => r.clave === 'senal'));
  assert.deepEqual(quieto.find((r) => r.clave === 'ruedas').fotos({ ...base, tipo: 'quieto' }).map((f) => f.corto), ['Las de tu carro']);
  assert.match(quieto.find((r) => r.clave === 'golpes').fotos({ ...base, tipo: 'quieto' })[0].guia, /lo que golpeó/);
  assert.ok(!claves({ ...base, tipo: 'reversa' }).includes('senal'));
  for (const tipo of ['por-detras', 'de-frente', 'cruce', 'carril', 'no-se', null]) assert.ok(claves({ ...base, tipo }).includes('senal'), tipo);
});

test('con lluvia la huella va de primera; de noche se pide el poste y el chaleco', () => {
  assert.equal(claves({ ...base, lluvia: true })[0], 'huella');
  assert.equal(claves({ ...base, lluvia: false })[0], 'esquinas');
  const e = estadoDeLasPruebas({ pruebas: { renglones: { piso: { respuesta: 'mojado' } } }, ahora: DE_DIA });
  assert.equal(e.renglones[0].clave, 'huella', 'el piso mojado que ve la persona también cuenta');
  assert.match(e.renglones[0].fotos[0].guia, /línea clara/);
  const noche = estadoDeLasPruebas({ ahora: new Date('2026-11-27T02:00:00Z') });
  assert.equal(noche.condiciones.noche, true);
  assert.deepEqual(renglon(noche, 'piso').fotos.map((f) => f.corto), ['El piso', 'El poste']);
  assert.match(renglon(noche, 'caminata').fotos[0].guia, /chaleco/);
  assert.equal(renglon(estadoDeLasPruebas({ ahora: DE_DIA }), 'piso').total, 1);
});

test('de noche: con el lugar, por el sol; sin lugar, por la hora de Colombia', () => {
  const lugar = (hora) => ({ punto: BOGOTA, hora });
  assert.equal(condiciones({ lugar: lugar('2026-11-26T17:00:00Z') }).noche, false, 'mediodía');
  assert.equal(condiciones({ lugar: lugar('2026-11-26T23:30:00Z') }).noche, true, '6:30 p. m.: ya oscureció');
  assert.equal(condiciones({ lugar: lugar('2026-11-26T22:30:00Z') }).noche, false, '5:30 p. m.: todavía hay sol');
  // Sin lugar: el reloj de la persona en Colombia (UTC-5, sin horario de verano).
  assert.equal(condiciones({ ahora: new Date('2026-11-26T23:00:00Z') }).noche, true, '6:00 p. m.');
  assert.equal(condiciones({ ahora: new Date('2026-11-26T10:59:00Z') }).noche, true, '5:59 a. m.');
  assert.equal(condiciones({ ahora: new Date('2026-11-26T11:00:00Z') }).noche, false, '6:00 a. m.');
});

test('la lluvia del clima, y el piso que ve la persona manda sobre ella', () => {
  const conLluvia = { punto: BOGOTA, hora: DE_DIA.toISOString(), filasDeLaLuz: [{ clave: 'lluvia', valor: '2,1 mm', aviso: 'atencion' }] };
  const sinLluvia = { ...conLluvia, filasDeLaLuz: [{ clave: 'lluvia', valor: 'Sin lluvia', aviso: null }] };
  assert.equal(condiciones({ lugar: conLluvia }).lluvia, true);
  assert.equal(condiciones({ lugar: sinLluvia }).lluvia, false);
  assert.equal(condiciones({ lugar: { punto: BOGOTA, hora: DE_DIA.toISOString() } }).lluvia, null, 'sin clima no se adivina');
  assert.equal(condiciones({ lugar: conLluvia, pruebas: { renglones: { piso: { respuesta: 'seco' } } } }).lluvia, false);
  assert.equal(condiciones({ lugar: sinLluvia, pruebas: { renglones: { piso: { respuesta: 'mojado' } } } }).lluvia, true);
  assert.equal(textoDelPisoYLaLuz({ ...base, lluvia: false }), 'Sin lluvia, de día (del clima y la hora)');
  assert.equal(textoDelPisoYLaLuz({ ...base, piso: 'mojado', noche: true }), 'Mojado, de noche');
  assert.equal(textoDelPisoYLaLuz(base), 'De día (por la hora)');
});

test('la caminata: 30 m en ciudad, 40 hasta 80 km/h, 60 en carretera; una foto cada 10 pasos, por el andén', () => {
  assert.deepEqual([null, 30, 60, 61, 80, 81, 120].map(metrosDeLaCaminata), [30, 30, 30, 40, 40, 60, 60]);
  assert.deepEqual([30, 40, 60].map(fotosDeLaCaminata), [4, 6, 8]);
  // La velocidad sale de la fila del mapa del paso 3, tal como se guarda.
  const lugar = { punto: BOGOTA, hora: DE_DIA.toISOString(), filasDeLaVia: [{ clave: 'maxima', valor: '80 km/h' }] };
  const e = estadoDeLasPruebas({ lugar, ahora: DE_DIA });
  assert.equal(e.condiciones.kmh, 80);
  const caminata = renglon(e, 'caminata');
  assert.equal(caminata.total, 6);
  assert.equal(caminata.porque, 'Desde 40 m, una foto cada 10 pasos');
  for (const kmh of [null, 50, 70, 100]) {
    const r = listaDePruebas({ ...base, kmh }).find((x) => x.clave === 'caminata');
    assert.match(r.fotos({ ...base, kmh })[0].guia, /^Por el andén, nunca por la vía/);
  }
});

test('cada renglón: tomado, a medias, declarado, saltado o falta; lo saltado no cuenta como hecho', () => {
  const registros = [...[0, 1, 2, 3].map((s) => foto('esquinas', s, s)), foto('huella', 0, 5), foto('golpes', 0, 6), foto('golpes', 1, 7)];
  const pruebas = { renglones: { vidrios: { respuesta: 'no-hay' }, caminata: { saltada: SALTADA }, huella: { respuesta: 'corrida' } } };
  const e = estadoDeLasPruebas({ pruebas, registros, ahora: DE_DIA });
  const estado = (c) => renglon(e, c).estado;
  assert.deepEqual(['esquinas', 'huella', 'golpes', 'vidrios', 'caminata', 'piso'].map(estado), ['tomado', 'a-medias', 'tomado', 'declarado', 'saltado', 'falta']);
  assert.equal(e.hechos, 3, 'esquinas, golpes y vidrios');
  assert.equal(e.resueltos, 4, 'más la caminata saltada');
  assert.equal(e.fotos, 7);
  assert.equal(e.minutos, 7);
  assert.equal(e.siguiente.clave, 'huella', 'lo que sigue es lo primero sin resolver');
  assert.equal(renglon(e, 'huella').siguienteFoto, 1);
  assert.equal(renglon(e, 'huella').resumen, '1 de 5 fotos · corrida');
  assert.equal(renglon(e, 'vidrios').resumen, 'Según la persona, no había vidrios ni líquidos en el piso');
  assert.equal(renglon(e, 'caminata').resumen, TEXTO_DE_SALTADA);
  assert.equal(TEXTO_DE_SALTADA, 'No se tomó: «no era seguro»');
  assert.equal(resumenDeLasPruebas(e), '3 de 11 · 7 fotos · la caminata no se tomó («no era seguro»).');
  assert.equal(resumenDeLasPruebas(estadoDeLasPruebas({ ahora: DE_DIA })), 'Sin empezar.');
});

test('nunca «no había» de lo que no se tomó: solo de lo que la persona declaró', () => {
  const e = estadoDeLasPruebas({ pruebas: { renglones: Object.fromEntries(CLAVES.map((c) => [c, { saltada: SALTADA }])) }, ahora: DE_DIA });
  for (const r of e.renglones) assert.doesNotMatch(r.resumen, /no hab[íi]a|nadie/i, r.clave);
  const declarado = estadoDeLasPruebas({ pruebas: { renglones: { huella: { respuesta: 'no-hay' }, senal: { respuesta: 'no-hay' }, testigos: { respuesta: 'nadie' } } }, ahora: DE_DIA });
  for (const c of ['huella', 'senal', 'testigos']) assert.match(renglon(declarado, c).resumen, /^Según la persona, /, c);
  // Primero las fotos y después «No hay»: no se esconde ninguna de las dos.
  const alReves = estadoDeLasPruebas({ pruebas: { renglones: { vidrios: { respuesta: 'no-hay' } } }, registros: [foto('vidrios', 0, 1), foto('vidrios', 1, 2)], ahora: DE_DIA });
  assert.equal(renglon(alReves, 'vidrios').resumen, 'Según la persona, no había vidrios ni líquidos en el piso; antes de marcarlo se tomaron 2 fotos');
});

test('tomar las fotos de un renglón saltado lo deja tomado, y la vuelta se cuenta con las fotos de la escena', () => {
  const registros = [0, 1].map((s) => foto('llanta', s, s));
  const e = estadoDeLasPruebas({ pruebas: { renglones: { llanta: { saltada: SALTADA } } }, registros, ahora: DE_DIA });
  assert.equal(renglon(e, 'llanta').estado, 'tomado');
  const vuelta = Array.from({ length: 8 }, (_, s) => ({ paso: 'escena', sector: s, hora: DE_DIA.toISOString(), huella: `e${s}` }));
  const conVuelta = estadoDeLasPruebas({ registros: vuelta, ahora: DE_DIA });
  assert.deepEqual([renglon(conVuelta, 'vuelta').estado, renglon(conVuelta, 'vuelta').tomadas], ['tomado', 8]);
  assert.equal(conVuelta.empezada, true);
});

test('al repetir una foto vale la última; las que sobran se devuelven aparte, no se pierden', () => {
  const registros = [foto('piso', 0, 0), foto('piso', 0, 1), foto('piso', 1, 2)];
  const { vigentes, sobran } = fotosDeLaPrueba(registros, 'piso', 1);
  assert.deepEqual(vigentes.map((r) => r.huella), ['piso-0-1']);
  assert.deepEqual(sobran.map((r) => r.huella), ['piso-1-2'], 'era de noche y dejó de serlo: la foto del poste sigue');
  assert.deepEqual(fotosDeLaPrueba(registros, 'piso', 2).vigentes.map((r) => r.huella), ['piso-0-1', 'piso-1-2']);
});

test('la medida de la huella: como la anotó la persona, en metros con cinta o en pasos', () => {
  assert.equal(textoDeLaMedida({ valor: 11.4, como: 'cinta', desde: 'el poste de la esquina' }), '11,4 m con cinta, desde el poste de la esquina');
  assert.equal(textoDeLaMedida({ valor: 12, como: 'cinta', desde: '' }), '12 m con cinta');
  assert.equal(textoDeLaMedida({ valor: 15, como: 'pasos', desde: '' }), '15 pasos');
  const p = conMedida(null, { valor: '11.43', como: 'cinta', desde: '  el   poste ' }, HORA);
  assert.deepEqual(p.renglones.huella.medida, { valor: 11.4, como: 'cinta', desde: 'el poste' });
  assert.throws(() => conMedida(null, { valor: 0, como: 'cinta' }), /no se entiende/);
  assert.throws(() => conMedida(null, { valor: 500, como: 'cinta' }), /no se entiende/);
  assert.throws(() => conMedida(null, { valor: 10, como: 'a ojo' }), /no se entiende/);
  assert.equal(conMedida(p, null, HORA).renglones.huella, undefined, 'null la borra');
  const e = estadoDeLasPruebas({ pruebas: p, ahora: DE_DIA });
  assert.equal(renglon(e, 'huella').resumen, 'Sin fotos · 11,4 m con cinta, desde el poste');
});

test('lo guardado se limpia: lo que no se reconoce se descarta, y responder quita el salto', () => {
  const sucio = { tipo: 'volando', renglones: { huella: { respuesta: 'quizas', saltada: 'pereza' }, inventado: { respuesta: 'si' }, piso: { respuesta: 'seco' } }, testigos: [{ nombre: 'Sin celular' }, 'nada'] };
  assert.deepEqual(limpiarPruebas(sucio), { tipo: null, renglones: { piso: { respuesta: 'seco' } }, testigos: [], movidos: null, hora: null });
  const saltada = conSalto(null, 'huella', HORA);
  assert.equal(saltada.renglones.huella.saltada, SALTADA);
  assert.deepEqual(conRespuesta(saltada, 'huella', 'corrida', HORA).renglones.huella, { respuesta: 'corrida' });
  assert.throws(() => conRespuesta(null, 'huella', 'quizas'), /desconocida/);
  assert.throws(() => conTipo(null, 'volando'), /desconocido/);
  assert.equal(conTipo(null, 'cruce', HORA).tipo, 'cruce');
  // Lo que se guarda no lleva objetos vacíos: cambiarían el texto sellado sin que nadie anotara nada.
  assert.deepEqual(Object.keys(conTipo(null, 'cruce', HORA)), ['tipo', 'renglones', 'hora']);
});

test('quien lo vio: nombre y celular, hasta tres, y agregarlo responde que sí', () => {
  let p = conTestigo(null, { nombre: ' Ana  Ruiz ', celular: '300-123 4567' }, HORA);
  assert.deepEqual(p.testigos, [{ nombre: 'Ana Ruiz', celular: '300123 4567' }]);
  assert.equal(p.renglones.testigos.respuesta, 'si');
  assert.equal(renglon(estadoDeLasPruebas({ pruebas: p, ahora: DE_DIA }), 'testigos').estado, 'tomado');
  assert.throws(() => conTestigo(p, { nombre: 'Sin celular', celular: '' }), /Falta el nombre o el celular/);
  p = conTestigo(conTestigo(p, { nombre: 'B', celular: '1' }, HORA), { nombre: 'C', celular: '2' }, HORA);
  assert.throws(() => conTestigo(p, { nombre: 'D', celular: '3' }), /Caben 3/);
  assert.deepEqual(sinTestigo(p, 0, HORA).testigos.map((t) => t.nombre), ['B', 'C']);
});

test('ya los movió: la primera hora es la que queda', () => {
  const p = conMovidos(null, HORA);
  assert.equal(p.movidos, HORA.toISOString());
  assert.equal(conMovidos(p, new Date('2026-11-26T21:00:00Z')).movidos, HORA.toISOString());
});

test('el final: cuántas fotos en cuánto tiempo, y lo que falta dicho sin adornos', () => {
  const todo = { fotos: 19, minutos: 5, hechos: 9, total: 9 };
  assert.equal(textoDelFinal(todo), '19 fotos en 5 minutos. Lo que se iba a borrar ya quedó guardado.');
  assert.equal(textoDelFinal({ ...todo, hechos: 8 }), '19 fotos en 5 minutos. Lo que falta ya no se podrá tomar igual después de moverlos.');
  assert.equal(textoDelFinal({ fotos: 1, minutos: 0, hechos: 1, total: 9 }), '1 foto en menos de un minuto. Lo que falta ya no se podrá tomar igual después de moverlos.');
  assert.equal(textoDelFinal({ fotos: 0, minutos: 0, hechos: 0, total: 9 }), 'Todavía no hay fotos de antes de mover.');
});

test('antes de moverlos: siempre el andén (76) y el comparendo (144A); con sospecha, que puede esperar', () => {
  const articulos = (antes) => avisosParaMover(antes).map((a) => a.articulo);
  assert.deepEqual(articulos(null), ['Art. 76', 'Art. 144A']);
  const conSospecha = avisosParaMover({ embriaguez: 'si', andan: 'si' });
  assert.equal(conSospecha.length, 3);
  assert.match(conSospecha[0].texto, /puedes negarte a moverlos hasta que hagan las pruebas/);
  assert.match(conSospecha[0].texto, /primero la vida/);
  assert.match(avisosParaMover({ andan: 'alguno-no' })[0].texto, /se queda hasta la grúa/);
  for (const a of avisosParaMover({ embriaguez: 'si', andan: 'alguno-no' })) assert.doesNotMatch(a.texto, /culpa|responsable/i);
});

test('la app no calcula velocidades: ninguna guía ni resumen habla de km/h', async () => {
  const { registros } = await reporteDePrueba({ conPruebas: true });
  const e = estadoDeLasPruebas({ pruebas: { renglones: { huella: { respuesta: 'pedazos', medida: { valor: 11.4, como: 'cinta' } } } }, registros, ahora: DE_DIA });
  const textos = e.renglones.flatMap((r) => [r.titulo, r.porque, r.resumen, ...r.fotos.map((f) => f.guia)]);
  for (const t of textos) assert.doesNotMatch(t, /km\/h|velocidad/i, t);
  assert.equal(renglon(e, 'huella').estado, 'tomado');
  // Las fotos de cerca de la huella se guardan completas y desde arriba.
  assert.deepEqual(renglon(e, 'huella').fotos.map((f) => !!f.completa), [false, false, false, true, true]);
  assert.ok(renglon(e, 'huella').fotos.filter((f) => f.escala).every((f) => f.desdeArriba));
});
