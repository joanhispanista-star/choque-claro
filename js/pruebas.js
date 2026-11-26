// «Antes de mover: lo que se borra primero» (paso 4, E1, 26-nov-2026): qué fotos se piden antes de
// mover los carros, en qué orden, con qué guía, y qué se dice de lo que se tomó, se saltó o la
// persona declaró que no había. Sin DOM: se prueba en Node. La pantalla es pantalla-pruebas.js.
//
// Por qué existe: hasta E1 la app pedía la vuelta de 8 fotos y nada más antes de mover. Lo que más
// pesa ante un perito —la huella de frenada, la marca en la llanta, dónde cayeron los vidrios, cómo
// quedaron las ruedas— se borra al mover los carros o con la primera lluvia, y nadie lo fotografía
// bien sin que se lo pidan. La guía de la policía de Nueva Zelanda, OSAC, SWGDE y el informe
// policial colombiano (Res. 11268/2012) coinciden en el orden: de lo general a lo particular, con
// una medida al lado y desde la altura correcta (PLAN.md, «Por qué las fotos de la gente no sirven»).
//
// Son reglas, no IA: la lista cambia con el tipo de choque, la luz y la lluvia, y nada más. La IA
// que mira la foto es otra etapa (E2) y no está aquí.
//
// Lo que NO hace, a propósito:
//  - No calcula velocidades. La huella se mide con cinta o con pasos y se anota cómo; la velocidad
//    es un dictamen (Código General del Proceso, arts. 226 y 227) y la calcula un perito.
//  - No dice «no había» de lo que no se tomó: dice «no se tomó» y por qué. «No había» solo sale
//    cuando la persona lo declaró, y va como lo que ella dijo.
//  - Nunca manda a la vía: la caminata es por el andén, y cada renglón se puede saltar por seguridad.
import { estadoDeLaVuelta, esDeLaEscena, TOMAS } from './escena.js';
import { momentoDelDia, posicionDelSol } from './sol.js';
import { numero } from './geo.js';
import { respuestasDeAntes } from './antes.js';

// La única razón para saltar un renglón que la app ofrece. Con prisa o sin ganas, la persona igual
// puede seguir a los carros sin tocar nada: lo que falte queda «sin tomar», sin razón.
export const SALTADA = 'no-era-seguro';
export const TEXTO_DE_SALTADA = 'No se tomó: «no era seguro»';

export const TIPOS = [
  { valor: 'por-detras', texto: 'Por detrás' },
  { valor: 'de-frente', texto: 'De frente' },
  { valor: 'cruce', texto: 'En un cruce' },
  { valor: 'carril', texto: 'Cambio de carril' },
  { valor: 'reversa', texto: 'En reversa' },
  { valor: 'quieto', texto: 'Contra algo quieto' },
  { valor: 'no-se', texto: 'No sé' },
];
const VALORES_DE_TIPO = new Set(TIPOS.map((t) => t.valor));

// --- La caminata --------------------------------------------------------------------------------

// Desde dónde empieza, en metros, según la velocidad máxima de la vía (la del mapa, paso 3): 30 m en
// ciudad, 40 m hasta 80 km/h y 60 m en carretera (PLAN.md, la caminata). Sin dato de la vía, como en
// ciudad: es donde pasan casi todos los choques, y una caminata más corta es más segura.
export function metrosDeLaCaminata(kmh) {
  if (!Number.isFinite(kmh) || kmh <= 60) return 30;
  if (kmh <= 80) return 40;
  return 60;
}

// Una foto cada 10 pasos, con pasos de 75 cm: 30 m son 40 pasos y 4 fotos; 60 m, 8.
export const PASO_EN_METROS = 0.75;
export const fotosDeLaCaminata = (metros) => Math.ceil(Math.round(metros / PASO_EN_METROS) / 10);

// --- Las condiciones ---------------------------------------------------------------------------

const filaDe = (filas, clave) => (filas ?? []).find((f) => f.clave === clave) ?? null;

// Lo que cambia la lista: el tipo de choque, si es de noche, si llueve, la velocidad de la vía y lo
// que ya se respondió de la huella y del piso. `lugar` es el del paso 3 en la forma en que se guarda
// en el reporte (sello.js, lugarParaElReporte), o null.
//
// De noche: con el lugar, por el sol (del crepúsculo civil en adelante ya no se ve sin luces). Sin
// lugar, por la hora de Colombia: en el trópico el sol sale y se pone cerca de las 6 todo el año.
export function condiciones({ lugar = null, pruebas = null, ahora = new Date() } = {}) {
  const p = limpiarPruebas(pruebas);
  let noche;
  const hora = lugar?.hora ? new Date(lugar.hora) : new Date(ahora);
  if (lugar?.punto && !Number.isNaN(hora.getTime())) {
    noche = ['crepusculo', 'noche'].includes(momentoDelDia(posicionDelSol(hora, lugar.punto.lat, lugar.punto.lon)));
  } else {
    // Colombia está en UTC-5 todo el año: no tiene horario de verano.
    const h = (hora.getUTCHours() + 19) % 24;
    noche = h < 6 || h >= 18;
  }
  const piso = p.renglones.piso?.respuesta ?? null;
  const filaLluvia = filaDe(lugar?.filasDeLaLuz, 'lluvia');
  // Lo que la persona ve en el piso manda sobre el modelo del clima: el modelo es de una celda de
  // kilómetros y una hora entera.
  const lluvia = piso === 'mojado' ? true : piso === 'seco' ? false : filaLluvia ? filaLluvia.aviso === 'atencion' : null;
  const maxima = filaDe(lugar?.filasDeLaVia, 'maxima');
  const kmh = maxima ? parseInt(maxima.valor, 10) : NaN;
  return {
    tipo: p.tipo,
    noche,
    lluvia,
    kmh: Number.isFinite(kmh) ? kmh : null,
    huella: p.renglones.huella?.respuesta ?? null,
    piso,
  };
}

// --- El catálogo -------------------------------------------------------------------------------
//
// Cada renglón: `corto` (para «Seguir: la llanta»), `titulo`, `porque` (la línea de abajo en la
// lista), `fotos(c)` con la guía de cada una, la `pregunta` si la tiene y `aplica(c)`. En cada foto:
//  - `completa`: se guarda sin reducir (las rayas de una huella no se ven a 1.280 px).
//  - `desdeArriba`: se toma mirando al piso, y la revisión no la rechaza por eso.
//  - `escala`: lleva algo de tamaño conocido al lado (y el botón «No tengo con qué medir»).
// Una opción con `sinFotos` cierra el renglón: es lo que la persona declara («No hay»).

const RENGLONES = [
  {
    clave: 'esquinas',
    corto: 'las esquinas',
    titulo: 'Las 4 esquinas de la escena',
    porque: () => 'Desde lejos, con algo fijo al fondo',
    fotos: () => [
      { corto: 'Esquina 1', guia: 'Desde una esquina, lejos: que salgan los dos carros y algo fijo al fondo, como un poste o una casa.' },
      { corto: 'Esquina 2', guia: 'Ahora desde la esquina contraria: los dos carros y algo que no se mueve.' },
      { corto: 'Esquina 3', guia: 'Desde el tercer lado, igual.' },
      { corto: 'Esquina 4', guia: 'Y desde el cuarto. Así queda dónde estaba cada carro.' },
    ],
  },
  {
    clave: 'huella',
    corto: 'la huella',
    titulo: 'La huella de frenada',
    porque: (c) => (c.lluvia ? 'Con lluvia se borra primero: va de primera' : 'La raya de las llantas en el piso'),
    pregunta: {
      texto: '¿Cómo se ve?',
      opciones: [
        { valor: 'corrida', texto: 'Corrida' },
        { valor: 'pedazos', texto: 'A pedazos' },
        { valor: 'no-hay', texto: 'No hay', sinFotos: true },
      ],
    },
    fotos: (c) => [
      {
        corto: 'A lo largo, de lado',
        guia:
          'De lado: que se vea dónde empieza la raya y dónde quedó la llanta.' +
          (c.huella === 'pedazos' ? ' Con frenos ABS son rayitas con huecos: que salgan todas.' : '') +
          (c.lluvia ? ' En piso mojado se ve como una línea clara.' : ''),
      },
      { corto: 'Desde atrás', guia: 'Desde atrás, en el sentido en que venía el carro: toda la raya en una foto.' },
      { corto: 'Dónde empieza', guia: 'Dónde empieza la raya, de cerca: el primer pedazo, aunque se vea débil. Si la raya se quiebra, toma también el quiebre.' },
      { corto: 'De cerca, con medida', guia: 'De cerca y desde arriba. Pon al lado una hoja, una tarjeta o la cinta. No pises la raya.', completa: true, desdeArriba: true, escala: true },
      { corto: 'Dónde termina', guia: 'Dónde termina, de cerca y desde arriba, con la hoja o la tarjeta al lado.', completa: true, desdeArriba: true, escala: true },
    ],
    medida: true,
  },
  {
    clave: 'piso',
    corto: 'el piso',
    titulo: 'Piso y luz',
    porque: (c) => textoDelPisoYLaLuz(c),
    pregunta: {
      texto: '¿Cómo está el piso?',
      opciones: [
        { valor: 'seco', texto: 'Seco' },
        { valor: 'mojado', texto: 'Mojado' },
        { valor: 'huecos', texto: 'Con huecos o arena' },
      ],
    },
    fotos: (c) => [
      { corto: 'El piso', guia: 'El piso donde fue el golpe: que se vea si está seco o mojado, y los huecos o la arena si hay.', desdeArriba: true },
      ...(c.noche ? [{ corto: 'El poste', guia: 'El poste de luz más cercano: que se vea si está prendido o apagado.' }] : []),
    ],
  },
  {
    clave: 'llanta',
    corto: 'la llanta',
    titulo: 'La llanta que la dejó',
    porque: () => 'La marca se borra al mover el carro',
    // Sin huella no hay llanta que la dejó.
    aplica: (c) => c.huella !== 'no-hay',
    fotos: () => [
      { corto: 'La llanta, de cerca', guia: 'La llanta que dejó la raya, de cerca: que se vea la banda donde pisa. No muevas el carro.', completa: true },
      { corto: 'La llanta y la raya', guia: 'Un paso atrás: la llanta y el final de la raya en la misma foto.' },
    ],
  },
  {
    clave: 'golpes',
    corto: 'los golpes',
    titulo: 'Los dos golpes juntos',
    porque: () => 'A la altura de la manija',
    fotos: (c) =>
      c.tipo === 'quieto'
        ? [
            { corto: 'El golpe y lo que golpeó', guia: 'Agáchate a la altura de la manija: el golpe del carro y lo que golpeó, juntos en la misma foto.' },
            { corto: 'Del otro lado', guia: 'Ahora desde el otro lado, a la misma altura.' },
          ]
        : [
            { corto: 'Los golpes, de un lado', guia: 'Agáchate a la altura de la manija: los dos golpes juntos en la misma foto.' },
            { corto: 'Del otro lado', guia: 'Ahora desde el otro lado del golpe, a la misma altura.' },
          ],
  },
  {
    clave: 'ruedas',
    corto: 'las ruedas',
    titulo: 'Hacia dónde quedaron las ruedas',
    porque: () => 'Las de adelante, antes de enderezarlas',
    fotos: (c) => [
      { corto: 'Las de tu carro', guia: 'Las ruedas de adelante de tu carro: que se vea hacia dónde quedaron giradas. No las enderezes.' },
      // Contra algo quieto (un poste, un carro parqueado) no hay otro conductor que girara las suyas.
      ...(c.tipo === 'quieto' ? [] : [{ corto: 'Las del otro', guia: 'Las ruedas de adelante del otro carro, igual.' }]),
    ],
  },
  {
    clave: 'vidrios',
    corto: 'los vidrios',
    titulo: 'Vidrios y líquidos en el piso',
    porque: () => 'Donde caen suele ser el punto del golpe',
    pregunta: {
      texto: '¿Hay vidrios, aceite o rayones en el piso?',
      opciones: [
        { valor: 'si', texto: 'Sí hay' },
        { valor: 'no-hay', texto: 'No hay', sinFotos: true },
      ],
    },
    fotos: () => [
      { corto: 'Desde arriba', guia: 'Desde arriba: dónde quedó el montón de vidrios o la mancha, y los rayones del metal si hay.', desdeArriba: true },
      { corto: 'Con los carros', guia: 'Un poco más lejos: los vidrios y los carros en la misma foto.' },
    ],
  },
  {
    clave: 'senal',
    corto: 'la señal',
    titulo: 'El semáforo o la señal',
    porque: () => 'Desde donde lo veía cada conductor',
    // En reversa o contra algo quieto, la prelación casi nunca es lo que se discute.
    aplica: (c) => c.tipo !== 'reversa' && c.tipo !== 'quieto',
    pregunta: {
      texto: '¿Había semáforo, PARE o una línea en el piso?',
      opciones: [
        { valor: 'si', texto: 'Sí' },
        { valor: 'no-hay', texto: 'No había', sinFotos: true },
      ],
    },
    fotos: () => [
      { corto: 'Como la veías', guia: 'Párate donde iba tu carro, sin meterte a la vía, y fotografía el semáforo o la señal como la veías.' },
      { corto: 'Como la veía el otro', guia: 'Ahora desde donde venía el otro carro.' },
    ],
  },
  {
    // La vuelta de 8 fotos desde el punto del golpe: la de siempre (pantalla-escena.js, escena.js).
    clave: 'vuelta',
    corto: 'la vuelta',
    titulo: 'La vuelta desde el golpe',
    porque: () => 'Párate donde fue el golpe y gira despacio',
    pantalla: 'escena',
    fotos: () => [],
  },
  {
    clave: 'caminata',
    corto: 'la caminata',
    titulo: 'La caminata, por el andén',
    porque: (c) => `Desde ${metrosDeLaCaminata(c.kmh)} m, una foto cada 10 pasos`,
    fotos: (c) => {
      const metros = metrosDeLaCaminata(c.kmh);
      const n = fotosDeLaCaminata(metros);
      return Array.from({ length: n }, (_, i) => {
        if (i === 0) {
          return {
            corto: `Desde ${metros} m`,
            guia: `Por el andén, nunca por la vía: camina ${metros} metros hacia atrás, por donde venía tu carro, y toma la foto mirando al choque.${c.noche ? ' Con el chaleco puesto.' : ''}`,
          };
        }
        if (i === n - 1) return { corto: 'Cerca del choque', guia: 'La última, ya cerca del choque.' };
        return { corto: `${i * 10} pasos después`, guia: 'Diez pasos más cerca, y otra foto.' };
      });
    },
  },
  {
    clave: 'testigos',
    corto: 'quien lo vio',
    titulo: 'Quien lo vio',
    porque: () => 'Su nombre y su celular, antes de que se vaya',
    pantalla: 'testigos',
    pregunta: {
      texto: '¿Alguien lo vio y se quedó?',
      opciones: [
        { valor: 'si', texto: 'Sí' },
        { valor: 'nadie', texto: 'Nadie', sinFotos: true },
      ],
    },
    fotos: () => [],
  },
];

const POR_CLAVE = new Map(RENGLONES.map((r) => [r.clave, r]));
export const CLAVES = RENGLONES.map((r) => r.clave);
export const tituloDelRenglon = (clave) => POR_CLAVE.get(clave)?.titulo ?? clave;

// «Seco, de día» o «Llovía, de noche»: del clima y la hora, o de lo que dijo la persona.
export function textoDelPisoYLaLuz(c) {
  const luz = c.noche ? 'de noche' : 'de día';
  if (c.piso === 'seco') return `Seco, ${luz}`;
  if (c.piso === 'mojado') return `Mojado, ${luz}`;
  if (c.piso === 'huecos') return `Con huecos o arena, ${luz}`;
  if (c.lluvia === true) return `Lluvia, ${luz} (del clima y la hora)`;
  if (c.lluvia === false) return `Sin lluvia, ${luz} (del clima y la hora)`;
  return `${luz[0].toUpperCase()}${luz.slice(1)} (por la hora)`;
}

// --- Lo guardado -------------------------------------------------------------------------------

const MOTIVOS = new Set([SALTADA]);
const LARGO_MAXIMO_M = 200;
const COMO_SE_MIDIO = new Set(['cinta', 'pasos']);
const MAXIMO_DE_TESTIGOS = 3;
const textoLimpio = (t, max) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function medidaLimpia(m) {
  if (!m || !COMO_SE_MIDIO.has(m.como)) return null;
  const valor = Number(m.valor);
  if (!Number.isFinite(valor) || valor <= 0 || valor > (m.como === 'pasos' ? 300 : LARGO_MAXIMO_M)) return null;
  return { valor: m.como === 'pasos' ? Math.round(valor) : Math.round(valor * 10) / 10, como: m.como, desde: textoLimpio(m.desde, 80) };
}

// Lo guardado, limpio: { tipo, renglones: { clave: { respuesta?, saltada?, medida?, sinEscala? } },
// testigos: [{ nombre, celular }], movidos, hora }. Lo que no se reconoce se descarta: la base de un
// teléfono puede traer cualquier cosa.
export function limpiarPruebas(p) {
  const renglones = {};
  for (const r of RENGLONES) {
    const g = p?.renglones?.[r.clave];
    if (!g) continue;
    const limpio = {};
    if (r.pregunta?.opciones.some((o) => o.valor === g.respuesta)) limpio.respuesta = g.respuesta;
    if (MOTIVOS.has(g.saltada)) limpio.saltada = g.saltada;
    if (r.medida) {
      const m = medidaLimpia(g.medida);
      if (m) limpio.medida = m;
      if (g.sinEscala === true) limpio.sinEscala = true;
    }
    if (Object.keys(limpio).length) renglones[r.clave] = limpio;
  }
  const testigos = (Array.isArray(p?.testigos) ? p.testigos : [])
    .map((t) => ({ nombre: textoLimpio(t?.nombre, 80), celular: textoLimpio(t?.celular, 20).replace(/[^\d+ ]/g, '') }))
    .filter((t) => t.nombre && t.celular)
    .slice(0, MAXIMO_DE_TESTIGOS);
  return {
    tipo: VALORES_DE_TIPO.has(p?.tipo) ? p.tipo : null,
    renglones,
    testigos,
    movidos: typeof p?.movidos === 'string' ? p.movidos : null,
    hora: typeof p?.hora === 'string' ? p.hora : null,
  };
}

// Lo que se guarda en el reporte: solo lo que tiene algo, para que el texto sellado no cambie por un
// objeto vacío.
function paraGuardar(p, hora) {
  const salida = { ...(p.tipo ? { tipo: p.tipo } : {}), renglones: p.renglones };
  if (p.testigos.length) salida.testigos = p.testigos;
  if (p.movidos) salida.movidos = p.movidos;
  salida.hora = new Date(hora).toISOString();
  return salida;
}

const conRenglon = (pruebas, clave, cambio, hora) => {
  if (!POR_CLAVE.has(clave)) throw new Error(`Renglón desconocido: ${clave}`);
  const p = limpiarPruebas(pruebas);
  const nuevo = cambio({ ...(p.renglones[clave] ?? {}) });
  for (const k of Object.keys(nuevo)) if (nuevo[k] === undefined) delete nuevo[k];
  return paraGuardar(limpiarPruebas({ ...p, renglones: { ...p.renglones, [clave]: nuevo } }), hora);
};

export function conTipo(pruebas, tipo, hora = new Date()) {
  if (!VALORES_DE_TIPO.has(tipo)) throw new Error(`Tipo desconocido: ${tipo}`);
  return paraGuardar({ ...limpiarPruebas(pruebas), tipo }, hora);
}

// Responder la pregunta de un renglón. Responder quita el «no era seguro»: ya pudo hacerlo.
export function conRespuesta(pruebas, clave, valor, hora = new Date()) {
  const r = POR_CLAVE.get(clave);
  if (!r?.pregunta?.opciones.some((o) => o.valor === valor)) throw new Error(`Respuesta desconocida: ${clave} = ${valor}`);
  return conRenglon(pruebas, clave, (g) => ({ ...g, respuesta: valor, saltada: undefined }), hora);
}

export const conSalto = (pruebas, clave, hora = new Date()) => conRenglon(pruebas, clave, (g) => ({ ...g, saltada: SALTADA }), hora);
export const sinSalto = (pruebas, clave, hora = new Date()) => conRenglon(pruebas, clave, (g) => ({ ...g, saltada: undefined }), hora);

// La medida de la huella: { valor, como: 'cinta'|'pasos', desde }. null la borra.
export function conMedida(pruebas, medida, hora = new Date()) {
  const m = medida === null ? null : medidaLimpia(medida);
  if (medida !== null && !m) throw new Error('Esa medida no se entiende');
  return conRenglon(pruebas, 'huella', (g) => ({ ...g, medida: m ?? undefined }), hora);
}

export const conSinEscala = (pruebas, sinEscala, hora = new Date()) => conRenglon(pruebas, 'huella', (g) => ({ ...g, sinEscala: sinEscala ? true : undefined }), hora);

// Quien lo vio: se agrega solo si la persona dijo que acepta quedar en el reporte (pantalla-pruebas.js
// no deja guardar sin esa casilla). Agregar a alguien responde «Sí» a la pregunta del renglón.
export function conTestigo(pruebas, { nombre, celular }, hora = new Date()) {
  const p = limpiarPruebas(pruebas);
  const t = limpiarPruebas({ testigos: [{ nombre, celular }] }).testigos[0];
  if (!t) throw new Error('Falta el nombre o el celular');
  if (p.testigos.length >= MAXIMO_DE_TESTIGOS) throw new Error(`Caben ${MAXIMO_DE_TESTIGOS} personas`);
  const conEl = { ...p, testigos: [...p.testigos, t] };
  return conRespuesta(paraGuardar(conEl, hora), 'testigos', 'si', hora);
}

export function sinTestigo(pruebas, indice, hora = new Date()) {
  const p = limpiarPruebas(pruebas);
  return paraGuardar({ ...p, testigos: p.testigos.filter((_, i) => i !== indice) }, hora);
}

// La primera vez que la persona dice que ya los movió: esa hora va al expediente («según la persona»).
export function conMovidos(pruebas, hora = new Date()) {
  const p = limpiarPruebas(pruebas);
  return paraGuardar({ ...p, movidos: p.movidos ?? new Date(hora).toISOString() }, hora);
}

// --- La lista ----------------------------------------------------------------------------------

// Los renglones que van, en orden. Con lluvia, la huella sube al primer lugar: en piso mojado es lo
// primero que se borra.
export function listaDePruebas(c) {
  const lista = RENGLONES.filter((r) => !r.aplica || r.aplica(c));
  if (!c.lluvia) return lista;
  const huella = lista.find((r) => r.clave === 'huella');
  return huella ? [huella, ...lista.filter((r) => r !== huella)] : lista;
}

export const esDeLaPrueba = (clave) => (r) => r.paso === 'prueba' && r.prueba === clave;

// Las fotos de un renglón, por su número: la última de cada número es la que vale (al repetir una,
// la nueva la reemplaza). `total` es cuántas pide hoy; las que sobran (era de noche y dejó de serlo
// al corregir la hora) se devuelven aparte para que el expediente no las esconda.
export function fotosDeLaPrueba(registros, clave, total) {
  const vigentes = new Array(total).fill(null);
  const sobran = new Map();
  for (const r of registros) {
    if (!esDeLaPrueba(clave)(r) || !Number.isInteger(r.sector) || r.sector < 0) continue;
    if (r.sector < total) vigentes[r.sector] = r;
    else sobran.set(r.sector, r);
  }
  return { vigentes, sobran: [...sobran.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r) };
}

const fotos = (n) => (n === 1 ? '1 foto' : `${n} fotos`);

// La medida en palabras: «11,4 m con cinta, desde el poste de la esquina» o «15 pasos».
export function textoDeLaMedida(m) {
  if (!m) return '';
  const cuanto = m.como === 'pasos' ? `${m.valor} ${m.valor === 1 ? 'paso' : 'pasos'}` : `${numero(m.valor, 1).replace(/,0$/, '')} m con cinta`;
  return m.desde ? `${cuanto}, desde ${m.desde}` : cuanto;
}

// Lo que la persona declaró con una opción «sin fotos», dicho como suyo.
const DECLARADO = {
  huella: 'Según la persona, no había huella de frenada',
  vidrios: 'Según la persona, no había vidrios ni líquidos en el piso',
  senal: 'Según la persona, no había semáforo, PARE ni línea',
  testigos: 'Según la persona, nadie que lo viera se quedó',
};
const RESPUESTAS_EN_TEXTO = { corrida: 'corrida', pedazos: 'a pedazos', seco: 'seco', mojado: 'mojado', huecos: 'con huecos o arena' };

// El estado de un renglón: { clave, corto, titulo, porque, fotos (guías), total, vigentes, sobran,
// tomadas, respuesta, saltada, medida, sinEscala, estado, resumen, pregunta, pantalla, siguienteFoto }.
// estado: 'tomado' (todas sus fotos o lo que pedía), 'declarado' («No hay»), 'saltado', 'a-medias'
// o 'falta'. `listo`: tomado o declarado; `resuelto`: listo o saltado.
function estadoDelRenglon(r, c, p, registros) {
  const g = p.renglones[r.clave] ?? {};
  const guias = r.fotos(c);
  const opcion = r.pregunta?.opciones.find((o) => o.valor === g.respuesta) ?? null;
  let total = guias.length;
  let vigentes;
  let sobran = [];
  if (r.pantalla === 'escena') {
    const v = estadoDeLaVuelta(registros, { filtro: esDeLaEscena });
    total = TOMAS;
    vigentes = v.vigentes;
  } else {
    ({ vigentes, sobran } = fotosDeLaPrueba(registros, r.clave, total));
  }
  const tomadas = vigentes.filter(Boolean).length;
  let estado;
  if (opcion?.sinFotos) estado = 'declarado';
  else if (r.pantalla === 'testigos') estado = p.testigos.length ? 'tomado' : g.saltada ? 'saltado' : 'falta';
  else if (total > 0 && tomadas === total) estado = 'tomado';
  else if (g.saltada) estado = 'saltado';
  else estado = tomadas ? 'a-medias' : 'falta';

  let resumen;
  // Tomó fotos y después marcó «No hay»: las fotos no se borran (la cadena no lo permite) y el
  // expediente las muestra; el resumen dice las dos cosas en vez de esconder una.
  if (estado === 'declarado') resumen = tomadas ? `${DECLARADO[r.clave]}; antes de marcarlo se ${tomadas === 1 ? 'tomó 1 foto' : `tomaron ${tomadas} fotos`}` : DECLARADO[r.clave];
  else if (estado === 'saltado') resumen = tomadas ? `${tomadas} de ${fotos(total)}. ${TEXTO_DE_SALTADA}` : TEXTO_DE_SALTADA;
  else if (r.pantalla === 'testigos') resumen = p.testigos.length ? p.testigos.map((t) => t.nombre).join(', ') : 'Sin anotar';
  else {
    const partes = [estado === 'tomado' ? fotos(total) : tomadas ? `${tomadas} de ${fotos(total)}` : 'Sin fotos'];
    if (r.clave === 'huella' && opcion) partes.push(RESPUESTAS_EN_TEXTO[opcion.valor]);
    if (r.clave === 'piso' && opcion) partes.push(`${RESPUESTAS_EN_TEXTO[opcion.valor]}, según la persona`);
    if (g.medida) partes.push(textoDeLaMedida(g.medida));
    resumen = partes.join(' · ');
  }
  const siguienteFoto = vigentes.findIndex((x) => !x);
  return {
    clave: r.clave,
    corto: r.corto,
    titulo: r.titulo,
    porque: r.porque(c),
    fotos: guias,
    pregunta: r.pregunta ?? null,
    pantalla: r.pantalla ?? null,
    medible: !!r.medida,
    total,
    vigentes,
    sobran,
    tomadas,
    respuesta: g.respuesta ?? null,
    saltada: g.saltada ?? null,
    medida: g.medida ?? null,
    sinEscala: !!g.sinEscala,
    estado,
    listo: estado === 'tomado' || estado === 'declarado',
    resuelto: estado === 'tomado' || estado === 'declarado' || estado === 'saltado',
    resumen,
    siguienteFoto: siguienteFoto === -1 ? null : siguienteFoto,
  };
}

// Todo junto: { condiciones, renglones, hechos, resueltos, total, fotos, minutos, siguiente,
// empezada }. `hechos` cuenta lo tomado y lo declarado; lo saltado no (el anillo del final dice «8 de
// 9» con la caminata saltada), pero sí deja de ser «lo que sigue».
export function estadoDeLasPruebas({ pruebas = null, registros = [], lugar = null, ahora = new Date() } = {}) {
  const p = limpiarPruebas(pruebas);
  const c = condiciones({ lugar, pruebas: p, ahora });
  const renglones = listaDePruebas(c).map((r) => estadoDelRenglon(r, c, p, registros));
  const deAntes = registros.filter((r) => r.paso === 'prueba' || esDeLaEscena(r));
  const horas = deAntes.map((r) => new Date(r.hora).getTime()).filter(Number.isFinite);
  const cuantas = renglones.reduce((t, r) => t + r.tomadas, 0);
  return {
    condiciones: c,
    renglones,
    hechos: renglones.filter((r) => r.listo).length,
    resueltos: renglones.filter((r) => r.resuelto).length,
    total: renglones.length,
    fotos: cuantas,
    minutos: horas.length > 1 ? Math.round((Math.max(...horas) - Math.min(...horas)) / 60000) : 0,
    siguiente: renglones.find((r) => !r.resuelto) ?? null,
    empezada: !!pruebas || deAntes.length > 0,
    testigos: p.testigos,
    tipo: p.tipo,
    movidos: p.movidos,
  };
}

// «19 fotos en 5 minutos.» y lo que sigue, para el final.
export function textoDelFinal(e) {
  if (!e.fotos) return 'Todavía no hay fotos de antes de mover.';
  const cuando = e.minutos < 1 ? 'en menos de un minuto' : `en ${e.minutos === 1 ? '1 minuto' : `${e.minutos} minutos`}`;
  const cola = e.hechos === e.total ? 'Lo que se iba a borrar ya quedó guardado.' : 'Lo que falta ya no se podrá tomar igual después de moverlos.';
  return `${fotos(e.fotos)} ${cuando}. ${cola}`;
}

// Lo que se le dice antes de moverlos, según lo que respondió en el paso 2. Siempre los arts. 76 y
// 144A; con sospecha de embriaguez, que puede esperar la prueba; si alguno no anda, que ese se queda.
export function avisosParaMover(antes) {
  const r = respuestasDeAntes(antes);
  const avisos = [];
  if (r?.embriaguez === 'si') {
    avisos.push({ tono: 'atencion', texto: 'Si sospechas que alguien manejaba borracho o drogado, puedes negarte a moverlos hasta que hagan las pruebas. Si dejarlos ahí es peligroso, muévelos: primero la vida.', articulo: 'Art. 144A' });
  }
  if (r?.andan === 'alguno-no') {
    avisos.push({ tono: 'atencion', texto: 'El que no anda se queda hasta la grúa, con las señales puestas.', articulo: 'Art. 144A' });
  }
  avisos.push({ tono: 'acento', texto: 'Con las luces de parqueo, déjalos donde no tapen la vía. Sobre el andén no se puede.', articulo: 'Art. 76' });
  avisos.push({ tono: 'acento', texto: 'Con solo daños, negarse a retirarlos es comparendo.', articulo: 'Art. 144A' });
  return avisos;
}

// Para el paso 8 y «Tus reportes»: «4 de 11 · 19 fotos · la caminata no se tomó («no era seguro»)».
export function resumenDeLasPruebas(e) {
  if (!e.empezada) return 'Sin empezar.';
  const saltados = e.renglones.filter((r) => r.estado === 'saltado');
  const partes = [`${e.hechos} de ${e.total}`, fotos(e.fotos)];
  if (saltados.length) {
    const nombres = saltados.map((r) => r.corto);
    const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
    partes.push(`${lista} no se ${saltados.length === 1 ? 'tomó' : 'tomaron'} («no era seguro»)`);
  }
  return partes.join(' · ') + '.';
}

// La guía que se dice en voz alta y se muestra encima del botón, para la foto `n` del renglón.
export function guiaDeLaFoto(renglon, n) {
  const f = renglon.fotos[n];
  if (!f) return null;
  return { ...f, numero: n + 1, de: renglon.total, cuenta: `Foto ${n + 1} de ${renglon.total}` };
}
