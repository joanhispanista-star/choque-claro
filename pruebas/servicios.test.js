import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarJson, consultarOverpass } from '../js/servicios.js';

const respuesta = (status, cuerpo = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

test('si el primer servidor está lleno, pasa al siguiente', async () => {
  const pedidos = [];
  const buscar = async (url, opciones) => {
    pedidos.push({ url, opciones });
    return url.includes('uno') ? respuesta(504) : respuesta(200, { elements: [1] });
  };
  const r = await consultarOverpass('[out:json];', { buscar, servidores: ['https://uno.test/api', 'https://dos.test/api'] });
  assert.deepEqual(r, { elements: [1] });
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].opciones.method, 'POST');
  assert.equal(pedidos[1].opciones.body, 'data=%5Bout%3Ajson%5D%3B');
});

test('si todos fallan, lo dice en español y guarda el detalle', async () => {
  const buscar = async (url) => (url.includes('uno') ? respuesta(502) : Promise.reject(new TypeError('Failed to fetch')));
  await assert.rejects(consultarOverpass('x', { buscar, servidores: ['https://uno.test/api', 'https://dos.test/api'] }), (error) => {
    assert.match(error.message, /No se pudo consultar el mapa/);
    assert.equal(error.detalle, 'uno.test: 502 · dos.test: Failed to fetch');
    return true;
  });
});

test('sin internet no se culpa a los servidores: se dice que se completa al volver la señal', async (t) => {
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  t.after(() => (antes ? Object.defineProperty(globalThis, 'navigator', antes) : delete globalThis.navigator));
  const buscar = () => Promise.reject(new TypeError('Failed to fetch'));
  await assert.rejects(consultarOverpass('x', { buscar, servidores: ['https://uno.test/api'] }), /^Error: Sin internet no se puede consultar la vía\. Se completa sola al volver la señal\.$/);
  await assert.rejects(consultarJson('https://clima.test', { buscar }), /^Error: Sin internet\. Se consulta solo al volver la señal\.$/);
});

test('un servidor que no responde se corta a tiempo y se pasa al siguiente', async () => {
  const buscar = (url, { signal }) =>
    url.includes('lento')
      ? new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' }))))
      : Promise.resolve(respuesta(200, { elements: [] }));
  const inicio = Date.now();
  const r = await consultarOverpass('x', { buscar, servidores: ['https://lento.test/api', 'https://rapido.test/api'], limiteMs: 30 });
  assert.deepEqual(r, { elements: [] });
  assert.ok(Date.now() - inicio < 2000);
});

test('consultarJson: los errores del servicio en palabras', async () => {
  await assert.rejects(consultarJson('https://x.test', { buscar: async () => respuesta(500) }), /respondió con un error \(500\)/);
  await assert.rejects(consultarJson('https://x.test', { buscar: async () => Promise.reject(new TypeError('Failed to fetch')) }), /Sin conexión/);
  assert.deepEqual(await consultarJson('https://x.test', { buscar: async () => respuesta(200, { a: 1 }) }), { a: 1 });
});
