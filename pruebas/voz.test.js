// La guía en voz alta (voz.js): qué voz elige, que no repita la misma frase, que el botón la calle y
// lo recuerde, y que sin dónde guardar ni voz en el teléfono no se rompa nada. Con una voz de mentira:
// en estas pruebas nunca suena nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearVoz, elegirVoz } from '../js/voz.js';

const voz = (lang, localService = true) => ({ lang, localService, name: lang });

function sintesisDeMentira(voces = [voz('es-CO')]) {
  const dichas = [];
  let canceladas = 0;
  return {
    dichas,
    canceladas: () => canceladas,
    getVoices: () => voces,
    speak: (f) => dichas.push({ texto: f.texto, lang: f.lang, voz: f.voice?.lang ?? null }),
    cancel: () => {
      canceladas++;
    },
  };
}
class Frase {
  constructor(texto) {
    this.texto = texto;
  }
}
function almacenDeMentira({ falla = false } = {}) {
  const m = new Map();
  return {
    getItem: (k) => {
      if (falla) throw new Error('privado');
      return m.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (falla) throw new Error('privado');
      m.set(k, v);
    },
  };
}

test('la voz: la de Colombia, después Latinoamérica, después cualquiera en español; nunca otro idioma', () => {
  assert.equal(elegirVoz([voz('es-ES'), voz('es-MX'), voz('es-CO')]).lang, 'es-CO');
  assert.equal(elegirVoz([voz('es-ES'), voz('es-MX')]).lang, 'es-MX');
  assert.equal(elegirVoz([voz('en-US'), voz('es-ES')]).lang, 'es-ES');
  assert.equal(elegirVoz([voz('es_CO')]).lang, 'es_CO', 'Android las escribe con guion bajo');
  assert.equal(elegirVoz([voz('es-MX', false), voz('es-MX', true)]).localService, true, 'la del teléfono antes que la de internet');
  assert.equal(elegirVoz([voz('en-US'), voz('pt-BR')]), null);
  assert.equal(elegirVoz([]), null);
});

test('dice la guía una vez; lo nuevo reemplaza lo que estaba diciendo', () => {
  const s = sintesisDeMentira([voz('es-MX'), voz('es-CO')]);
  const v = crearVoz({ sintesis: s, Frase, almacen: almacenDeMentira() });
  assert.equal(v.disponible, true);
  assert.equal(v.decir('De lado: que se vea la raya.'), true);
  assert.equal(v.decir('De lado: que se vea la raya.'), false, 'la misma frase no se repite sola');
  assert.equal(v.decir('Desde atrás.'), true);
  assert.deepEqual(s.dichas.map((d) => [d.texto, d.voz]), [['De lado: que se vea la raya.', 'es-CO'], ['Desde atrás.', 'es-CO']]);
  assert.ok(s.canceladas() >= 2);
  v.olvidarLaUltima();
  assert.equal(v.decir('Desde atrás.'), true, 'al volver a la foto, se dice otra vez');
  assert.equal(v.decir('Desde atrás.', { aunqueSeaLaMisma: true }), true);
});

test('el botón la calla y el teléfono lo recuerda; sin dónde guardar, vuelve prendida', () => {
  const almacen = almacenDeMentira();
  const s = sintesisDeMentira();
  const v = crearVoz({ sintesis: s, Frase, almacen });
  assert.equal(v.encendida(), true, 'prendida de entrada: en la vía nadie lee');
  assert.equal(v.alternar(), false);
  assert.equal(v.decir('Algo'), false);
  assert.equal(s.dichas.length, 0);
  assert.equal(crearVoz({ sintesis: s, Frase, almacen }).encendida(), false, 'la próxima vez sigue callada');
  const sinAlmacen = crearVoz({ sintesis: s, Frase, almacen: almacenDeMentira({ falla: true }) });
  assert.equal(sinAlmacen.encendida(), true);
  assert.equal(sinAlmacen.alternar(), false, 'callarla funciona aunque no se pueda guardar');
});

test('sin voz en el navegador no hay botón ni error', () => {
  const v = crearVoz({ sintesis: undefined, Frase: undefined, almacen: null });
  assert.equal(v.disponible, false);
  assert.equal(v.encendida(), false);
  assert.equal(v.decir('Algo'), false);
  v.callar();
  // Sin voces en español, igual habla con el idioma pedido (el teléfono escoge).
  const s = sintesisDeMentira([voz('en-US')]);
  crearVoz({ sintesis: s, Frase, almacen: null }).decir('Hola');
  assert.deepEqual(s.dichas, [{ texto: 'Hola', lang: 'es-CO', voz: null }]);
});
