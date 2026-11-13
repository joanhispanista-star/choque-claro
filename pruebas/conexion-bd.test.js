// conexion-bd.js vino del Taller de Pintura con sus pruebas; aquí van las que
// no dependen del registro del taller (garaje.js), más una con la base del
// reporte. Lo que se prueba: que la conexión que iOS mata se levante, y que lo
// que no se arregla reconectando salga como error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { aBlob, aBytes, conTope, conexionViva, seCayoLaConexion } from '../js/conexion-bd.js';
import { abrirBaseDelReporte } from '../js/reporte-bd.js';

const PERDIDA = () => new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError');

test('un error de datos no es una caída: reconectar no lo arregla', () => {
  assert.equal(seCayoLaConexion(new DOMException('no se puede copiar', 'DataCloneError')), false);
  assert.equal(seCayoLaConexion(new DOMException('sin espacio', 'QuotaExceededError')), false);
  assert.equal(seCayoLaConexion(new Error('La cadena de fotos cambió')), false);
  assert.equal(seCayoLaConexion(PERDIDA()), true);
  assert.equal(seCayoLaConexion(new DOMException('The database connection is closing', 'InvalidStateError')), true);
  assert.equal(seCayoLaConexion(null), false);
});

test('si la base no vuelve, el error sale: la pantalla tiene que poder decidir', async () => {
  let intentos = 0;
  const conexion = conexionViva({ close() {} }, async () => {
    intentos++;
    throw PERDIDA();
  }, { esperas: [0, 0] });
  await assert.rejects(conexion.protegida(async () => {
    throw PERDIDA();
  })(), /server lost/);
  assert.equal(intentos, 2);
});

test('una operación que nunca responde no deja la pantalla colgada para siempre', async () => {
  let abiertas = 0;
  const conexion = conexionViva({ close() {} }, async () => {
    abiertas++;
    return { close() {} };
  }, { esperas: [0], tope: 20 });
  await assert.rejects(conexion.protegida(() => new Promise(() => {}))(), (e) => e.name === 'TimeoutError');
  assert.equal(abiertas, 1, 'probó con una conexión nueva antes de rendirse');
  await assert.rejects(conTope(new Promise(() => {}), 5), (e) => e.name === 'TimeoutError');
  assert.equal(await conTope(Promise.resolve(7), 50), 7);
});

test('dos operaciones que caen a la vez comparten la reconexión', async () => {
  const real = new IDBFactory();
  const abiertas = [];
  const fabrica = {
    open(...datos) {
      const peticion = real.open(...datos);
      peticion.addEventListener('success', () => abiertas.push(peticion.result));
      return peticion;
    },
  };
  const base = await abrirBaseDelReporte({ indexedDB: fabrica });
  const { id } = await base.reporteEnCurso();
  abiertas[abiertas.length - 1].transaction = () => {
    throw PERDIDA();
  };
  await Promise.all([base.fotos(id), base.fotos(id)]);
  assert.equal(abiertas.length, 2);
});

test('aBytes y aBlob dejan pasar lo que no es una imagen', async () => {
  assert.equal(await aBytes(null), null);
  assert.equal(aBlob(null), null);
  assert.equal(aBlob(undefined), undefined);
  const blob = new Blob(['x']);
  assert.equal(aBlob(blob), blob);
  const ida = await aBytes(new Blob(['jpeg'], { type: 'image/jpeg' }));
  assert.ok(ida.bytes instanceof ArrayBuffer);
  const vuelta = aBlob(ida);
  assert.equal(vuelta.type, 'image/jpeg');
  assert.equal(await vuelta.text(), 'jpeg');
});
