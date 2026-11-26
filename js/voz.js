// La guía en voz alta (E1, 26-nov-2026): en la calle, con el celular apuntando al piso, nadie lee la
// pantalla. Usa la voz del propio teléfono (speechSynthesis): sin internet y sin que nada salga.
//
// Reglas:
//  - Un botón la calla y la vuelve a prender; la preferencia se guarda en el teléfono. Si el
//    navegador no deja guardar (Safari privado), se prende cada vez: es lo seguro en la vía.
//  - Solo habla cuando cambia lo que hay que hacer. Repetir la misma frase cada segundo aturde.
//  - iOS no deja hablar a una página hasta que la persona toque algo: la primera frase sale de un
//    toque (pantalla-pruebas.js la pide desde el botón que abre la cámara).
//
// SIN VERIFICAR en el iPhone de Joan: si suena con el interruptor de silencio puesto, y qué voz en
// español trae. En el Edge de las pruebas va con --mute-audio: nunca suena en el PC.
const CLAVE = 'choque-claro:voz';

// La mejor voz en español: la de Colombia, después las de Latinoamérica, después cualquiera en
// español. Entre iguales, la del teléfono (localService) antes que una de internet.
const PREFERIDAS = ['es-CO', 'es-419', 'es-MX', 'es-US', 'es-AR', 'es-CL', 'es-PE', 'es-VE'];
export function elegirVoz(voces = []) {
  const enEspanol = voces.filter((v) => /^es([-_]|$)/i.test(v.lang || ''));
  if (!enEspanol.length) return null;
  const puesto = (v) => {
    const i = PREFERIDAS.indexOf((v.lang || '').replace('_', '-'));
    return (i === -1 ? PREFERIDAS.length : i) * 2 + (v.localService === false ? 1 : 0);
  };
  return [...enEspanol].sort((a, b) => puesto(a) - puesto(b))[0];
}

function leer(almacen) {
  try {
    return almacen?.getItem(CLAVE) ?? null;
  } catch {
    return null;
  }
}

function escribir(almacen, valor) {
  try {
    almacen?.setItem(CLAVE, valor);
  } catch {
    // Sin dónde guardar: vale para esta visita.
  }
}

export function crearVoz({ sintesis = globalThis.speechSynthesis, Frase = globalThis.SpeechSynthesisUtterance, almacen = (() => { try { return globalThis.localStorage; } catch { return null; } })() } = {}) {
  const disponible = !!sintesis && typeof Frase === 'function';
  let encendida = leer(almacen) !== 'no';
  let ultima = '';

  function decir(texto, { aunqueSeaLaMisma = false } = {}) {
    if (!disponible || !encendida || !texto) return false;
    if (texto === ultima && !aunqueSeaLaMisma) return false;
    ultima = texto;
    try {
      // Lo nuevo reemplaza lo que estaba diciendo: la guía vieja ya no sirve.
      sintesis.cancel();
      const frase = new Frase(texto);
      frase.lang = 'es-CO';
      const voz = elegirVoz(sintesis.getVoices?.() ?? []);
      if (voz) {
        frase.voice = voz;
        frase.lang = voz.lang;
      }
      frase.rate = 1;
      sintesis.speak(frase);
      return true;
    } catch {
      return false;
    }
  }

  function callar() {
    ultima = '';
    try {
      if (disponible) sintesis.cancel();
    } catch {
      // Nada que callar.
    }
  }

  return {
    disponible,
    encendida: () => disponible && encendida,
    alternar() {
      encendida = !encendida;
      escribir(almacen, encendida ? 'si' : 'no');
      if (!encendida) callar();
      return encendida;
    },
    decir,
    // Para que «Repetir» diga otra vez lo mismo, y para que al volver a una foto se diga de nuevo.
    olvidarLaUltima: () => {
      ultima = '';
    },
    callar,
  };
}
