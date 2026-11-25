// «Antes de mover los carros» (paso 2): qué dice la app con cada respuesta, con su artículo; que la
// embriaguez mande sobre lo demás; que nunca diga quién fue; y que lo que sale al reporte sea lo que
// la persona dijo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_ES_PRUEBA_DE_EMBRIAGUEZ, PREGUNTAS, avisoDeAntes, conRespuesta, respuestasDeAntes, resumenDeAntes } from '../js/antes.js';

const HORA = new Date('2026-11-25T22:44:00Z'); // 5:44 p. m. en Bogotá

test('las dos preguntas, con dos respuestas cada una y todas con su aviso o su silencio', () => {
  assert.deepEqual(PREGUNTAS.map((p) => p.clave), ['embriaguez', 'andan']);
  for (const p of PREGUNTAS) assert.equal(p.opciones.length, 2);
  // «No sospecho» no trae aviso: es lo normal y la persona sigue derecho.
  assert.equal(avisoDeAntes({ embriaguez: 'no' }), null);
  for (const r of [{ embriaguez: 'si' }, { andan: 'si' }, { andan: 'alguno-no' }]) {
    const a = avisoDeAntes(r);
    assert.ok(a.titulo && a.texto && /^Arts?\. \d/.test(a.articulos), JSON.stringify(r));
    assert.equal(a.tras, Object.keys(r)[0]);
  }
});

test('si se sospecha embriaguez, eso manda aunque los carros anden, y solo ahí se ofrece el 123', () => {
  const a = avisoDeAntes({ embriaguez: 'si', andan: 'si' });
  assert.equal(a.titulo, 'No los muevas todavía');
  assert.equal(a.tras, 'embriaguez');
  assert.equal(a.llamar, true);
  assert.match(a.texto, /cualquiera de los dos puede negarse/);
  // Quedarse en la vía no puede costar una vida: se dice en el mismo aviso.
  assert.match(a.texto, /primero la vida/);
  assert.equal(avisoDeAntes({ embriaguez: 'no', andan: 'si' }).llamar, false);
  assert.equal(avisoDeAntes({ andan: 'alguno-no' }).llamar, false);
});

test('los que andan: primero las fotos, y nunca sobre el andén', () => {
  for (const andan of ['si', 'alguno-no']) {
    const a = avisoDeAntes({ embriaguez: 'no', andan });
    assert.match(a.texto, /sobre el andén no se puede/);
    assert.match(a.articulos, /76/);
  }
  assert.equal(avisoDeAntes({ andan: 'si' }).titulo, 'Primero las fotos, después se mueven');
});

test('la app no acusa: ni quién, ni velocidades, ni culpa', () => {
  const todo = [...PREGUNTAS.flatMap((p) => [p.texto, ...p.opciones.map((o) => o.texto)]), ...[{ embriaguez: 'si' }, { andan: 'si' }, { andan: 'alguno-no' }].flatMap((r) => [avisoDeAntes(r).titulo, avisoDeAntes(r).texto])].join(' ');
  assert.doesNotMatch(todo, /culp|responsable|el otro conductor|velocidad/i);
});

test('responder, cambiar y limpiar lo guardado', () => {
  const una = conRespuesta(null, 'embriaguez', 'no', HORA);
  assert.deepEqual(una, { embriaguez: 'no', hora: '2026-11-25T22:44:00.000Z' });
  const dos = conRespuesta(una, 'andan', 'alguno-no', new Date('2026-11-25T22:45:00Z'));
  assert.deepEqual(dos, { embriaguez: 'no', andan: 'alguno-no', hora: '2026-11-25T22:45:00.000Z' });
  assert.equal(conRespuesta(dos, 'embriaguez', 'si', HORA).embriaguez, 'si');
  assert.throws(() => conRespuesta(null, 'embriaguez', 'tal vez'), /Respuesta desconocida/);
  assert.throws(() => conRespuesta(null, 'culpa', 'si'), /Respuesta desconocida/);
  // Lo que no es una respuesta no entra: una base de otra versión no puede inventar una.
  assert.equal(respuestasDeAntes(null), null);
  assert.equal(respuestasDeAntes({ hora: '2026-11-25T22:44:00Z' }), null);
  assert.deepEqual(respuestasDeAntes({ embriaguez: 'quizá', andan: 'si', otra: 1 }), { andan: 'si', hora: null });
});

test('lo que va al reporte: lo que la persona dijo, con la hora', () => {
  assert.equal(resumenDeAntes({ embriaguez: 'si', andan: 'si', hora: '2026-11-25T22:44:00Z' }), 'La persona sospechaba que alguien manejaba borracho o drogado; los carros podían andar (5:44 p. m.)');
  assert.equal(resumenDeAntes({ embriaguez: 'no', andan: 'alguno-no', hora: '2026-11-25T22:44:00Z' }), 'La persona no sospechaba embriaguez; alguno de los carros no podía andar (5:44 p. m.)');
  assert.equal(resumenDeAntes({ andan: 'si' }), 'Los carros podían andar');
  assert.equal(resumenDeAntes(null), '');
  assert.match(NO_ES_PRUEBA_DE_EMBRIAGUEZ, /sospecha/);
});
