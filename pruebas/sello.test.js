// El sello del reporte (paso 8): que su huella sea el SHA-256 del texto que viaja en el PDF, que
// el número salga del día en Colombia, que se note cualquier cambio después de sellar (y en qué
// parte), y que lo que no es del reporte (la hora de guardado) no lo invalide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { INICIO_DE_LA_CADENA, sha256Hex, textoCanonico } from '../js/evidencia.js';
import { PARTES, completaElLugar, contenidoDelSello, estadoDelSello, leFaltaAlgo, lugarParaElReporte, queLeFalta, numeroDelReporte, sellarReporte, textoDelCambio } from '../js/sello.js';
import { fechaCompacta, fechaLarga, fechaYHora, horaDeColombia } from '../js/fechas.js';
import { CLIMA, HORA_DEL_CHOQUE, analisisDelEjemplo, reporteDePrueba } from './reporte-de-prueba.js';

test('las fechas van en la hora de Colombia, sin depender de la zona del teléfono', () => {
  assert.equal(fechaLarga('2026-11-13T22:15:00Z'), '13 de noviembre de 2026');
  // Las 11 de la noche en Bogotá son el día siguiente en UTC: sigue siendo el 13.
  assert.equal(fechaLarga('2026-11-14T04:00:00Z'), '13 de noviembre de 2026');
  assert.equal(horaDeColombia('2026-11-13T22:15:00Z'), '5:15 p. m.');
  assert.equal(horaDeColombia('2026-11-13T22:15:07Z', { segundos: true }), '5:15:07 p. m.');
  assert.equal(horaDeColombia('2026-11-13T17:00:00Z'), '12:00 p. m.');
  assert.equal(horaDeColombia('2026-11-13T05:05:00Z'), '12:05 a. m.');
  assert.equal(fechaYHora('2026-11-13T22:15:00Z'), '13 de noviembre de 2026, 5:15 p. m.');
  assert.equal(fechaCompacta('2026-11-14T04:00:00Z'), '261113');
  assert.equal(fechaLarga('no es fecha'), '');
});

test('el número: CC, el día del sello en Colombia y las 6 primeras de la huella', () => {
  const huella = '74b9f9f92575319a9f77fed6b7d2b1bbd2fd28bc72a0c397604a0c8b4644fd86';
  assert.equal(numeroDelReporte(huella, '2026-11-13T22:44:12Z'), 'CC-261113-74B9F9');
  assert.equal(numeroDelReporte(huella, '2026-11-14T03:30:00Z'), 'CC-261113-74B9F9');
  assert.equal(numeroDelReporte(huella, '2026-11-14T05:30:00Z'), 'CC-261114-74B9F9');
});

test('el lugar: las filas que mostró el paso 3, sin lo que todavía se consultaba', () => {
  const { punto, analisis } = analisisDelEjemplo();
  const lugar = lugarParaElReporte({ punto, origen: 'ejemplo', precision: 8.6, fecha: new Date(HORA_DEL_CHOQUE), via: analisis, clima: CLIMA });
  assert.equal(lugar.hora, new Date(HORA_DEL_CHOQUE).toISOString());
  assert.equal(lugar.precision, 9);
  assert.ok(lugar.via.nombre.includes('Verjones'));
  assert.ok(lugar.filasDeLaVia.some((f) => f.clave === 'forma' && /Curva cerrada/.test(f.valor)));
  assert.ok(lugar.filasDeLaLuz.some((f) => f.clave === 'luz'));
  assert.ok(lugar.filasDeLaLuz.some((f) => f.clave === 'cielo' && f.valor === 'Nublado'));
  for (const f of [...lugar.filasDeLaVia, ...lugar.filasDeLaLuz]) assert.deepEqual(Object.keys(f).sort(), ['aviso', 'clave', 'etiqueta', 'nota', 'valor']);
  const cargando = lugarParaElReporte({ punto, fecha: HORA_DEL_CHOQUE, via: analisis, clima: CLIMA, climaCargando: true });
  assert.ok(!cargando.filasDeLaLuz.some((f) => f.clave === 'cielo'));
  // Sin vía (el mapa no respondió): sin filas de la vía, pero con la luz.
  const sinVia = lugarParaElReporte({ punto, fecha: HORA_DEL_CHOQUE, via: { estado: 'error' } });
  assert.equal(sinVia.via, null);
  assert.deepEqual(sinVia.filasDeLaVia, []);
  assert.ok(sinVia.filasDeLaLuz.length > 0);
  assert.equal(lugarParaElReporte({ punto: null, fecha: HORA_DEL_CHOQUE }), null);
  assert.equal(lugarParaElReporte({ punto, fecha: 'no es fecha' }), null);
});

test('lo que se sella: lo declarado tal cual y la punta de la cadena, limpio para JSON', () => {
  const reporte = { id: 'r1', creado: '2026-11-13T22:20:00Z', carros: [{ letra: 'A', cuando: new Date('2026-11-13T22:30:00Z'), lista: [1, undefined, 2] }] };
  const c = contenidoDelSello({ reporte, registros: [], hora: '2026-11-13T22:44:00Z' });
  assert.deepEqual(c.fotos, { total: 0, ultimaHuella: INICIO_DE_LA_CADENA });
  // Una fecha (Date) queda como texto y un undefined dentro de una lista, como null: si no,
  // textoCanonico la volvería «{}» o no la podría sellar.
  assert.equal(c.carros[0].cuando, '2026-11-13T22:30:00.000Z');
  assert.deepEqual(c.carros[0].lista, [1, null, 2]);
  assert.equal(c.lugar, null);
  assert.equal(c.croquis, null);
  assert.doesNotThrow(() => textoCanonico(c));
});

test('sellar: la huella es el SHA-256 del texto del adjunto, y el sello queda vigente', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const { sello, contenido, texto } = await sellarReporte({ reporte, registros, hora: new Date('2026-11-13T22:44:12Z') });
  assert.equal(texto, textoCanonico(contenido));
  assert.equal(await sha256Hex(texto), sello.huella);
  assert.equal(sello.numero, numeroDelReporte(sello.huella, sello.hora));
  assert.equal(contenido.fotos.total, registros.length);
  assert.equal(contenido.fotos.ultimaHuella, registros.at(-1).huella);
  assert.deepEqual(Object.keys(sello.partes), PARTES);
  const sellado = { ...reporte, sello };
  const e = await estadoDelSello({ reporte: sellado, registros });
  assert.equal(e.estado, 'vigente');
  assert.equal(e.texto, texto);
  // Guardar otra vez (la hora de «actualizado» cambia) no toca el sello.
  assert.equal((await estadoDelSello({ reporte: { ...sellado, actualizado: '2026-11-14T10:00:00Z' }, registros })).estado, 'vigente');
});

test('después de sellar se nota cualquier cambio, y dice en qué parte', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const { sello } = await sellarReporte({ reporte, registros, hora: new Date('2026-11-13T22:44:12Z') });
  const sellado = { ...reporte, sello };
  assert.equal((await estadoDelSello({ reporte, registros })).estado, 'sin-sellar');

  const otraPlaca = { ...sellado, carros: sellado.carros.map((c) => (c.letra === 'B' ? { ...c, placa: { ...c.placa, texto: 'HTX918', fuente: 'leida' } } : c)) };
  assert.deepEqual(await estadoDelSello({ reporte: otraPlaca, registros }), { estado: 'cambio', cambios: ['carros'] });

  const sinUnaFoto = await estadoDelSello({ reporte: sellado, registros: registros.slice(0, -1) });
  assert.deepEqual(sinUnaFoto.cambios, ['fotos']);

  const otroCroquis = { ...sellado, croquis: { ...sellado.croquis, caso: 'detras' }, danos: [] };
  assert.deepEqual((await estadoDelSello({ reporte: otroCroquis, registros })).cambios, ['danos', 'croquis']);

  const otraHora = { ...sellado, lugar: { ...sellado.lugar, hora: '2026-11-13T22:30:00Z' } };
  assert.deepEqual((await estadoDelSello({ reporte: otraHora, registros })).cambios, ['lugar']);

  // Un sello de otra versión no se da por bueno.
  assert.equal((await estadoDelSello({ reporte: { ...sellado, sello: { ...sello, version: 99 } }, registros })).estado, 'sin-sellar');
});

test('lo que cambió, en una frase que concuerda', () => {
  assert.equal(textoDelCambio(['croquis']), 'Después de sellar cambió el croquis. Séllalo otra vez antes de enviarlo: el número va a cambiar.');
  assert.match(textoDelCambio(['carros']), /cambiaron los carros\./);
  assert.match(textoDelCambio(['antes']), /cambió lo que dijiste antes de mover los carros\./);
  assert.match(textoDelCambio(['antes', 'fotos']), /cambiaron lo que dijiste antes de mover los carros y las fotos\./);
  assert.match(textoDelCambio(['carros', 'danos', 'croquis']), /cambiaron los carros, los daños y el croquis\./);
  assert.match(textoDelCambio(['lugar']), /cambiaron los datos del lugar\./);
  assert.match(textoDelCambio([]), /cambió el reporte\./);
});

test('lo que llega solo completa el lugar guardado, nunca lo reemplaza', () => {
  const { punto, analisis } = analisisDelEjemplo();
  const base = { punto, origen: 'gps', precision: 9, fecha: new Date(HORA_DEL_CHOQUE) };
  const completo = lugarParaElReporte({ ...base, via: analisis, clima: CLIMA });
  const sinVia = lugarParaElReporte({ ...base, via: { estado: 'error' }, clima: CLIMA });
  const sinClima = lugarParaElReporte({ ...base, via: analisis, clima: { error: 'Sin internet' } });
  // En el lugar del choque no había internet: la vía o el clima que llegan después sí van.
  assert.equal(completaElLugar(completo, sinVia), true);
  assert.equal(completaElLugar(completo, sinClima), true, 'la fila «No se pudo consultar» no es clima');
  assert.equal(completaElLugar(completo, null), true);
  // Ya estaban: lo que diga hoy el mapa no reemplaza lo de ese día.
  assert.equal(completaElLugar(completo, completo), false);
  assert.equal(completaElLugar(sinVia, completo), false);
  assert.equal(completaElLugar(null, sinVia), false);
  // «El mapa no trae vías aquí» también es una respuesta, y no tapa una vía que ya se tenía.
  const sinVias = lugarParaElReporte({ ...base, via: { estado: 'sin-vias', radio: 60 }, clima: CLIMA });
  assert.equal(sinVias.sinVias, true);
  assert.equal(completaElLugar(sinVias, sinVia), true);
  assert.equal(completaElLugar(sinVias, sinVias), false);
  assert.equal(completaElLugar(sinVias, completo), false);
  assert.ok(!('sinVias' in completo) && !('sinVias' in sinVia), 'un lugar de antes sella con el mismo texto');
});

test('lo que le falta a un lugar marcado sin señal, mientras se pueda pedir', () => {
  const { punto, analisis } = analisisDelEjemplo();
  const base = { punto, origen: 'gps', precision: 9, fecha: new Date(HORA_DEL_CHOQUE) };
  const ahora = new Date('2026-11-25T15:00:00Z');
  const de = (via, clima) => queLeFalta(lugarParaElReporte({ ...base, via, clima }), ahora);
  assert.deepEqual(de(analisis, CLIMA), []);
  assert.deepEqual(de({ estado: 'error' }, { error: 'Sin internet' }), ['la vía', 'el clima']);
  assert.deepEqual(de(analisis, { error: 'Sin internet' }), ['el clima']);
  assert.deepEqual(de({ estado: 'sin-vias', radio: 60 }, CLIMA), []);
  // El clima de hace más de tres meses ya no se consigue: pedirlo para siempre no sirve.
  const viejo = lugarParaElReporte({ ...base, via: analisis, clima: null });
  assert.deepEqual(queLeFalta(viejo, new Date('2027-03-25T15:00:00Z')), []);
  assert.deepEqual(queLeFalta(null), []);
  assert.equal(leFaltaAlgo(null), false);
  assert.equal(leFaltaAlgo(viejo, ahora), true);
});

test('lo dicho antes de mover se sella, y los reportes de antes no cambian de número', async () => {
  const { reporte, registros } = await reporteDePrueba();
  const hora = new Date('2026-11-25T22:50:00Z');
  const sinAntes = await sellarReporte({ reporte, registros, hora });
  assert.ok(!sinAntes.texto.includes('"antes"'), 'sin respuesta, el texto sellado es el de siempre');

  const antes = { embriaguez: 'si', andan: 'si', hora: '2026-11-25T22:44:00.000Z' };
  const conAntes = await sellarReporte({ reporte: { ...reporte, antes }, registros, hora });
  assert.ok(conAntes.texto.includes('"antes"'));
  assert.notEqual(conAntes.sello.huella, sinAntes.sello.huella);
  const sellado = { ...reporte, antes, sello: conAntes.sello };
  assert.equal((await estadoDelSello({ reporte: sellado, registros })).estado, 'vigente');
  assert.deepEqual((await estadoDelSello({ reporte: { ...sellado, antes: { ...antes, embriaguez: 'no' } }, registros })).cambios, ['antes']);

  // Un sello de antes del 25-nov no trae esa parte: si se responde después, es lo único que cambió;
  // y si cambia otra cosa, no se culpa a esta.
  const { antes: _, ...partesViejas } = sinAntes.sello.partes;
  const viejo = { ...reporte, sello: { ...sinAntes.sello, partes: partesViejas } };
  assert.equal((await estadoDelSello({ reporte: viejo, registros })).estado, 'vigente');
  assert.deepEqual((await estadoDelSello({ reporte: { ...viejo, antes }, registros })).cambios, ['antes']);
  assert.deepEqual((await estadoDelSello({ reporte: { ...viejo, danos: [] }, registros })).cambios, ['danos']);
});
