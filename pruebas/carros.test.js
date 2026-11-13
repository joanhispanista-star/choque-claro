// Los carros del choque (paso 5): la vuelta alrededor de cada uno con la
// misma cuenta de la escena, la placa leída que espera a que la persona la
// vea, y lo que dice la tarjeta de cada carro.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LETRAS,
  SECTOR_DE_ATRAS,
  SECTOR_DEL_FRENTE,
  TEXTOS_DEL_CARRO,
  VISTAS_DEL_CARRO,
  agregarCarro,
  cambiarCarro,
  cambiarPlaca,
  carroNuevo,
  carrosDelReporte,
  conLecturaDePlaca,
  conPlacaEscrita,
  confirmarPlacaLeida,
  debeLeerLaPlaca,
  esDelCarro,
  estadoDeLaPlaca,
  faltantesDeLaVuelta,
  formatoDePlaca,
  nombreDelCarro,
  normalizarPlaca,
  placaParaMostrar,
  quitarCarro,
  resumenDelCarro,
  sinPlaca,
  textoDeLasFaltantes,
} from '../js/carros.js';
import { TOMAS, estadoDeLaVuelta, etiquetaDeLaFoto, guiaDeLaVuelta, sectorParaLaFoto } from '../js/escena.js';

const CUANDO = new Date('2026-11-18T15:00:00Z');
const fotoDelCarro = (carro, sector, rumbo) => ({ paso: 'carro', carro, sector, rumbo, huella: `h-${carro}-${sector}` });

test('sin carros guardados, el reporte arranca con el tuyo y el otro', () => {
  const carros = carrosDelReporte({ id: 'r1' });
  assert.deepEqual(carros.map((c) => [c.letra, c.quien]), [['A', 'tuyo'], ['B', 'otro']]);
  assert.equal(nombreDelCarro(carros[0]), 'Carro A · el tuyo');
  assert.equal(nombreDelCarro(carros[1]), 'Carro B · el otro');
  assert.deepEqual(carrosDelReporte({ carros: [carroNuevo('A', 'tuyo')] }).map((c) => c.letra), ['A']);
});

test('se agregan carros hasta la F, y solo se quitan los agregados', () => {
  let carros = carrosDelReporte(null);
  for (let i = 0; i < 10; i++) carros = agregarCarro(carros);
  assert.deepEqual(carros.map((c) => c.letra), LETRAS);
  assert.equal(nombreDelCarro(carros[2]), 'Carro C');
  assert.deepEqual(quitarCarro(carros, 'C').map((c) => c.letra), ['A', 'B', 'D', 'E', 'F']);
  assert.equal(quitarCarro(carros, 'B'), carros);
  // Quitado el C, el siguiente que se agrega vuelve a ser C.
  assert.equal(agregarCarro(quitarCarro(carros, 'C')).at(-1).letra, 'C');
  assert.equal(cambiarCarro(carros, 'B', { linea: { marca: 'Kia' } })[1].linea.marca, 'Kia');
  assert.equal(cambiarCarro(carros, 'B', (c) => ({ ...c, quien: 'x' }))[0].quien, 'tuyo');
});

test('la vuelta de un carro cuenta solo sus fotos, con la misma cuenta de la escena', () => {
  const registros = [
    { paso: 'escena', sector: 0, rumbo: 10, huella: 'e0' },
    fotoDelCarro('A', 0, 200),
    fotoDelCarro('B', 0, 30),
    fotoDelCarro('A', 1, 245),
  ];
  const a = estadoDeLaVuelta(registros, { filtro: esDelCarro('A') });
  assert.equal(a.cuantas, 2);
  assert.equal(a.origen, 200);
  const b = estadoDeLaVuelta(registros, { filtro: esDelCarro('B') });
  assert.equal(b.cuantas, 1);
  // Caminando hacia la izquierda alrededor del carro el rumbo crece: la toma 2 es el lado derecho.
  assert.deepEqual(sectorParaLaFoto(a, 290, TEXTOS_DEL_CARRO), { sector: 2 });
  assert.equal(VISTAS_DEL_CARRO[2].corto, 'Lado derecho');
  // Parado en el frente, con el frente y la 2 tomadas: la que falta más cerca es la 8, a su derecha.
  assert.equal(sectorParaLaFoto(a, 200, TEXTOS_DEL_CARRO).error, 'Ese lado del carro ya tiene su foto. Camina hacia tu derecha: falta una de ese lado.');
  assert.equal(guiaDeLaVuelta(a, 270, TEXTOS_DEL_CARRO).texto, TEXTOS_DEL_CARRO.seguir);
});

test('la guía del carro habla de caminar alrededor y nombra el lado que sigue', () => {
  const vacia = estadoDeLaVuelta([], { filtro: esDelCarro('A') });
  assert.equal(guiaDeLaVuelta(vacia, 15, TEXTOS_DEL_CARRO).texto, 'Párate frente al carro y toma la primera foto: el frente, con la placa');
  // Sin brújula, en orden y diciendo qué lado.
  const sinBrujula = estadoDeLaVuelta([fotoDelCarro('A', 0, null)], { filtro: esDelCarro('A') });
  assert.equal(guiaDeLaVuelta(sinBrujula, null, TEXTOS_DEL_CARRO).texto, 'Camina hacia tu izquierda y toma la foto 2: el frente y el lado derecho');
  const repitiendo = estadoDeLaVuelta([fotoDelCarro('A', 0, null), fotoDelCarro('A', 1, null)], { filtro: esDelCarro('A'), porRepetir: 0 });
  assert.equal(guiaDeLaVuelta(repitiendo, null, TEXTOS_DEL_CARRO).texto, 'Repite la foto 1: el frente, con la placa');
  // Falta la última: la guía manda a la persona hacia su derecha.
  const casi = estadoDeLaVuelta([0, 1, 2, 3, 4, 5, 6].map((s) => fotoDelCarro('A', s, (200 + s * 45) % 360)), { filtro: esDelCarro('A') });
  assert.equal(guiaDeLaVuelta(casi, 200, TEXTOS_DEL_CARRO).texto, 'Camina hacia tu derecha: falta una de ese lado');
  assert.equal(etiquetaDeLaFoto(fotoDelCarro('A', 6, 110), (s) => VISTAS_DEL_CARRO[s].corto), 'Foto 7 · Lado izquierdo');
});

test('la placa se normaliza, se reconoce el formato y se muestra como en la calle', () => {
  assert.equal(normalizarPlaca(' abc-123 '), 'ABC123');
  assert.equal(formatoDePlaca('ABC123'), 'carro');
  assert.equal(formatoDePlaca('abc 12d'), 'moto');
  assert.equal(formatoDePlaca('R12345'), 'otra');
  assert.equal(formatoDePlaca(''), 'vacia');
  assert.equal(placaParaMostrar('jrx248'), 'JRX 248');
  assert.equal(placaParaMostrar('ABC12D'), 'ABC 12D');
  assert.equal(placaParaMostrar('R12345'), 'R12345');
});

test('se lee de la foto del frente o de la de atrás, una vez, y nunca sobre lo que decidió la persona', () => {
  const carro = carroNuevo('A', 'tuyo');
  assert.equal(debeLeerLaPlaca(carro, SECTOR_DEL_FRENTE), true);
  assert.equal(debeLeerLaPlaca(carro, SECTOR_DE_ATRAS), true);
  assert.equal(debeLeerLaPlaca(carro, 2), false);
  // En el frente no había placa amarilla: queda el intento y se prueba atrás.
  const sinPlacaAlFrente = conLecturaDePlaca(carro, { registro: { sector: 0, huella: 'h0' }, resultado: null, cuando: CUANDO });
  assert.equal(sinPlacaAlFrente.placa.lectura, null);
  assert.equal(debeLeerLaPlaca(sinPlacaAlFrente, SECTOR_DEL_FRENTE), false);
  assert.equal(debeLeerLaPlaca(sinPlacaAlFrente, SECTOR_DE_ATRAS), true);
  assert.match(estadoDeLaPlaca(sinPlacaAlFrente).detalle, /No se encontró una placa amarilla de la foto del frente\. Se va a probar con la foto de atrás/);
  // Atrás sí: queda como propuesta, sin texto definitivo.
  const leida = conLecturaDePlaca(sinPlacaAlFrente, { registro: { sector: 4, huella: 'h4' }, resultado: { placa: 'JRX248', crudo: 'JRX248', confianza: 0.91234, milisegundos: 8 }, cuando: CUANDO });
  assert.deepEqual(leida.placa.lectura, { texto: 'JRX248', sector: 4, foto: 'h4', confianza: 0.912 });
  assert.equal(leida.placa.texto, '');
  assert.equal(leida.placa.fuente, null);
  assert.equal(estadoDeLaPlaca(leida).tipo, 'propuesta');
  assert.match(estadoDeLaPlaca(leida).detalle, /^Leída de la foto de atrás\. Revísala/);
  assert.equal(debeLeerLaPlaca(leida, SECTOR_DEL_FRENTE), false);
  // La persona dice que sí.
  const confirmada = confirmarPlacaLeida(leida);
  assert.equal(confirmada.placa.texto, 'JRX248');
  assert.equal(confirmada.placa.fuente, 'leida');
  assert.deepEqual(estadoDeLaPlaca(confirmada), { tipo: 'lista', texto: 'JRX248', detalle: 'Leída de la foto de atrás y revisada por ti.' });
  // Una lectura que llega después de que la persona escribió la placa no la pisa.
  const escrita = conPlacaEscrita(carro, 'abc123').carro;
  const tarde = conLecturaDePlaca(escrita, { registro: { sector: 0, huella: 'h0' }, resultado: { placa: 'ABC128', crudo: 'ABC128', confianza: 0.5, milisegundos: 9 }, cuando: CUANDO });
  assert.equal(tarde.placa.texto, 'ABC123');
  assert.equal(tarde.placa.lectura, null);
  assert.equal(tarde.placa.intentos.length, 1);
});

test('corregir lo leído deja constancia de lo que había leído la app', () => {
  const leida = conLecturaDePlaca(carroNuevo('B'), { registro: { sector: 0, huella: 'h0' }, resultado: { placa: 'JRK248', crudo: 'JRK248', confianza: 0.6, milisegundos: 8 }, cuando: CUANDO });
  const { carro, aviso } = conPlacaEscrita(leida, 'jrx 248');
  assert.equal(aviso, null);
  assert.deepEqual(estadoDeLaPlaca(carro), { tipo: 'lista', texto: 'JRX248', detalle: 'Escrita por ti. La app había leído JRK 248.' });
  // Lo que no parece placa colombiana se guarda igual, con aviso; vacío no.
  assert.match(conPlacaEscrita(carroNuevo('B'), 'R12345').aviso, /No parece una placa colombiana/);
  assert.equal(conPlacaEscrita(carroNuevo('B'), 'R12345').carro.placa.texto, 'R12345');
  assert.equal(conPlacaEscrita(carroNuevo('B'), '  ').carro.placa.fuente, null);
  assert.equal(estadoDeLaPlaca(sinPlaca(carroNuevo('B'))).tipo, 'sin-placa');
  // Cambiar deja la placa sin decidir, con lo leído todavía a mano.
  const otraVez = cambiarPlaca(confirmarPlacaLeida(leida));
  assert.equal(otraVez.placa.fuente, null);
  assert.equal(estadoDeLaPlaca(otraVez).tipo, 'propuesta');
});

test('mientras se lee, y cuando el lector no abre, la pantalla lo dice', () => {
  assert.match(estadoDeLaPlaca(carroNuevo('A'), { leyendo: true }).detalle, /^Leyendo la placa en la foto… La primera vez el teléfono baja el lector \(unos 17 MB\)/);
  const fallo = conLecturaDePlaca(carroNuevo('A'), { registro: { sector: 0, huella: 'h0' }, error: 'TypeError: Failed to fetch', cuando: CUANDO });
  assert.equal(fallo.placa.intentos[0].resultado, 'fallo');
  assert.match(estadoDeLaPlaca(fallo).detalle, /El lector de placas no abrió \(la primera vez necesita internet\)/);
  const ilegible = conLecturaDePlaca(carroNuevo('A'), { registro: { sector: 4, huella: 'h4' }, resultado: { placa: '', crudo: 'J2', confianza: 0.2, milisegundos: 8 }, cuando: CUANDO });
  assert.equal(estadoDeLaPlaca(ilegible).detalle, 'Se encontró la placa de la foto de atrás, pero no se pudo leer entera (se leyó «J2»). También la puedes escribir.');
  // Lo leído a medias va al campo, para completarlo.
  assert.equal(estadoDeLaPlaca(ilegible).sugerida, 'J2');
  assert.equal(estadoDeLaPlaca(fallo).sugerida, '');
  assert.match(estadoDeLaPlaca(carroNuevo('A')).detalle, /^Se lee sola de la foto del frente/);
});

test('la tarjeta del carro dice cuántas fotos, la placa y la línea', () => {
  const carro = { ...confirmarPlacaLeida(conLecturaDePlaca(carroNuevo('A', 'tuyo'), { registro: { sector: 0, huella: 'h' }, resultado: { placa: 'ABC123', crudo: 'ABC123', confianza: 0.9, milisegundos: 7 }, cuando: CUANDO })), linea: { marca: 'Chevrolet', linea: 'Spark GT', carroceria: 'hatchback' } };
  const vuelta = estadoDeLaVuelta([0, 1, 2].map((s) => fotoDelCarro('A', s, s * 45)), { filtro: esDelCarro('A') });
  assert.deepEqual(resumenDelCarro(carro, vuelta), { titulo: 'Carro A · el tuyo', lineas: ['3 de 8 fotos', 'Placa ABC 123', 'Chevrolet Spark GT'], boton: 'Seguir', completa: false });
  const vacia = estadoDeLaVuelta([], { filtro: esDelCarro('B') });
  assert.deepEqual(resumenDelCarro(carroNuevo('B'), vacia).lineas, ['Sin fotos todavía', 'Placa sin leer']);
  assert.equal(resumenDelCarro(carroNuevo('B'), vacia).boton, 'Fotografiar');
  const llena = estadoDeLaVuelta(Array.from({ length: TOMAS }, (_, s) => fotoDelCarro('A', s, s * 45)), { filtro: esDelCarro('A') });
  assert.equal(resumenDelCarro(carro, llena).boton, 'Ver');
  // Las que faltan, en palabras.
  assert.deepEqual(faltantesDeLaVuelta(vuelta), [3, 4, 5, 6, 7]);
  assert.equal(textoDeLasFaltantes([4, 6]), 'la 5 (atrás) y la 7 (lado izquierdo)');
  assert.equal(textoDeLasFaltantes([3, 4, 5]), 'la 4 (atrás y lado derecho), la 5 (atrás) y la 6 (atrás y lado izquierdo)');
  assert.equal(textoDeLasFaltantes([4]), 'la 5 (atrás)');
});
