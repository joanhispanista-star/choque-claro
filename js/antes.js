// «Antes de mover los carros» (paso 2): las dos preguntas que deciden si se mueven, y lo que dice la
// ley con cada respuesta. Sin DOM: se prueba en Node.
//
// Por qué se pregunta: en un choque de solo daños hay que retirar los carros (Código Nacional de
// Tránsito, Ley 769 de 2002, art. 143) y negarse es comparendo (art. 144A, C3). Hay dos excepciones,
// las dos en el 144A: que un carro no se pueda mover por su estado, y que se presuma embriaguez —ahí
// «cualquiera de las partes» puede negarse hasta que se hagan las pruebas—. La app no lo preguntaba.
//
// Qué NO hace: no dice quién manejaba así ni si es cierto. La respuesta es una sospecha de la
// persona, va al reporte con esa palabra, y la prueba la hace la autoridad. «Embriaguez» en el Código
// es alcohol o drogas (arts. 2 y 150), y por eso la pregunta dice las dos.
//
// Los textos citan el artículo para que se puedan comprobar. Leídos en la edición vigente al
// 15-nov-2026 (Ley 2161/2021 art. 13 y Ley 2251/2022 art. 16). Falta que un abogado los revise, y el
// Gobierno anunció que el 1-dic-2026 radica una reforma: si cambia un artículo, cambia aquí.
import { horaDeColombia } from './fechas.js';

export const PREGUNTAS = [
  {
    clave: 'embriaguez',
    texto: '¿Crees que alguien manejaba borracho o drogado?',
    opciones: [
      { valor: 'si', texto: 'Sí, lo sospecho', atencion: true },
      { valor: 'no', texto: 'No' },
    ],
  },
  {
    clave: 'andan',
    texto: '¿Los carros pueden andar?',
    opciones: [
      { valor: 'si', texto: 'Sí' },
      { valor: 'alguno-no', texto: 'Alguno no', atencion: true },
    ],
  },
];

const VALORES = Object.fromEntries(PREGUNTAS.map((p) => [p.clave, p.opciones.map((o) => o.valor)]));

// Lo guardado, limpio: solo las respuestas que existen y la hora de la última. null si no hay nada.
export function respuestasDeAntes(antes) {
  const salida = {};
  for (const clave of Object.keys(VALORES)) if (VALORES[clave].includes(antes?.[clave])) salida[clave] = antes[clave];
  if (!Object.keys(salida).length) return null;
  return { ...salida, hora: typeof antes.hora === 'string' ? antes.hora : null };
}

// Responder (o cambiar) una pregunta. La hora es la de la última respuesta.
export function conRespuesta(antes, clave, valor, hora = new Date()) {
  if (!VALORES[clave]?.includes(valor)) throw new Error(`Respuesta desconocida: ${clave} = ${valor}`);
  return { ...(respuestasDeAntes(antes) ?? {}), [clave]: valor, hora: new Date(hora).toISOString() };
}

// Lo que se le dice a la persona según lo que respondió: { tras, tono, titulo, texto, articulos,
// llamar }, o null mientras no haya qué decir. `tras` es la pregunta debajo de la cual va. La
// embriaguez manda sobre lo demás: si se sospecha, los carros se pueden quedar aunque anden.
export function avisoDeAntes(antes) {
  const r = respuestasDeAntes(antes);
  if (!r) return null;
  if (r.embriaguez === 'si') {
    return {
      tras: 'embriaguez',
      tono: 'atencion',
      titulo: 'No los muevas todavía',
      texto: 'Si se presume embriaguez, cualquiera de los dos puede negarse a moverlos hasta que hagan las pruebas. Llama al 123, dilo así y sigue con las fotos mientras llegan. Si dejarlos ahí es peligroso, muévelos: primero la vida.',
      articulos: 'Art. 144A, Código de Tránsito',
      llamar: true,
    };
  }
  if (r.andan === 'alguno-no') {
    return {
      tras: 'andan',
      tono: 'atencion',
      titulo: 'El que no anda se queda hasta la grúa',
      texto: 'Si un carro no se puede mover por cómo quedó, no hay comparendo por dejarlo ahí. Deja puestas las señales. El que sí anda se mueve después de las fotos, a donde no tape la vía; sobre el andén no se puede.',
      articulos: 'Arts. 76 y 144A, Código de Tránsito',
      llamar: false,
    };
  }
  if (r.andan === 'si') {
    return {
      tras: 'andan',
      tono: 'acento',
      titulo: 'Primero las fotos, después se mueven',
      texto: 'Con solo daños hay que retirar los carros, y negarse es comparendo. Déjalos donde no tapen la vía; sobre el andén no se puede.',
      articulos: 'Arts. 76, 143 y 144A, Código de Tránsito',
      llamar: false,
    };
  }
  return null;
}

// Para la revisión del paso 8 y el expediente: lo que la persona dijo, dicho así.
export function resumenDeAntes(antes) {
  const r = respuestasDeAntes(antes);
  if (!r) return '';
  const partes = [];
  if (r.embriaguez === 'si') partes.push('la persona sospechaba que alguien manejaba borracho o drogado');
  if (r.embriaguez === 'no') partes.push('la persona no sospechaba embriaguez');
  if (r.andan === 'si') partes.push('los carros podían andar');
  if (r.andan === 'alguno-no') partes.push('alguno de los carros no podía andar');
  const texto = partes.join('; ');
  return texto[0].toUpperCase() + texto.slice(1) + (r.hora ? ` (${horaDeColombia(r.hora)})` : '');
}

// Lo que el expediente no afirma; solo si la sospecha está escrita en él.
export const NO_ES_PRUEBA_DE_EMBRIAGUEZ = 'Que alguien manejara borracho o drogado es una sospecha de la persona, no una prueba: eso lo dicen el examen y la autoridad.';
