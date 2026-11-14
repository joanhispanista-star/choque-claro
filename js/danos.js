// Los daños de cada carro (paso 6): qué pieza, qué le pasó y su foto de cerca.
// Todo puro: la pantalla (pantalla-danos.js) y el carro en 3D (visor-danos.js)
// solo pintan lo que esto decide, y aquí se prueba en Node.
//
// Dos cosas distintas, a propósito:
// - La MARCA (pieza + tipo) es lo que la persona declara. Se puede cambiar o
//   quitar, y se guarda en el reporte (reporte-bd.js, guardarDatos); se sella
//   al enviar (paso 8).
// - La FOTO de cerca va a la cadena en el momento, con la pieza y el tipo que
//   la persona había elegido al tomarla (evidencia.js). Si después cambia el
//   tipo, la foto sigue diciendo el de ese momento y la lista lo muestra.
//
// Un tipo por pieza: el más grave. Cuatro tipos que cualquiera distingue sin
// saber de carros; lo fino (cuánto mide, si es la pintura o la lata) lo dice
// la foto, y lo decide el perito.
import { PIEZAS, esInterior } from './piezas.js';
import { nombreDePiezaEn } from './carrocerias.js';
import { revisarFoto } from './calidad.js';

// Los colores son por tipo de daño y se distinguen entre sí y del carro gris;
// igual nunca van solos: la lista y la hoja dicen el nombre.
export const TIPOS_DE_DANO = [
  { id: 'rayon', nombre: 'Rayón', ayuda: 'La pintura rayada o pelada', color: '#e0a800' },
  { id: 'abolladura', nombre: 'Abolladura', ayuda: 'La lata hundida o doblada', color: '#1e6fd9' },
  { id: 'roto', nombre: 'Roto', ayuda: 'Partido, rajado o con un hueco', color: '#d0312d' },
  { id: 'suelto', nombre: 'Suelto', ayuda: 'Desprendido, descolgado o fuera de sitio', color: '#7d3ac1' },
];

export const TIPO_POR_ID = new Map(TIPOS_DE_DANO.map((t) => [t.id, t]));

// Las piezas que se marcan son las de afuera. Las de adentro (vanos, marcos,
// caras interiores de las puertas) solo se ven con algo abierto, y en la vía
// nadie abre el capó para la foto: el carro 3D de este paso no abre nada.
export const PIEZAS_CON_DANO = PIEZAS.filter((p) => !esInterior(p.id)).map((p) => p.id);
const ORDEN = new Map(PIEZAS_CON_DANO.map((id, i) => [id, i]));

export const esFotoDeDano = (carro) => (registro) => registro.paso === 'danos' && registro.carro === carro;

// `danos`: [{ carro, pieza, tipo, cuando }]. Marcar una pieza ya marcada le
// cambia el tipo.
export function marcarDano(danos, { carro, pieza, tipo, cuando }) {
  if (!TIPO_POR_ID.has(tipo)) throw new Error('Tipo de daño desconocido: ' + tipo);
  if (!ORDEN.has(pieza)) throw new Error('Pieza que no se marca: ' + pieza);
  const marca = { carro, pieza, tipo, cuando: new Date(cuando).toISOString() };
  const otras = (danos || []).filter((d) => !(d.carro === carro && d.pieza === pieza));
  return [...otras, marca];
}

export function quitarDano(danos, carro, pieza) {
  return (danos || []).filter((d) => !(d.carro === carro && d.pieza === pieza));
}

export function danoDe(danos, carro, pieza) {
  return (danos || []).find((d) => d.carro === carro && d.pieza === pieza) || null;
}

export function danosDelCarro(danos, carro) {
  return (danos || []).filter((d) => d.carro === carro).sort((a, b) => ORDEN.get(a.pieza) - ORDEN.get(b.pieza));
}

// La foto de cerca vigente de cada pieza: la última de la cadena.
export function fotosDeLosDanos(registros, carro) {
  const fotos = new Map();
  for (const r of registros) if (esFotoDeDano(carro)(r) && r.pieza) fotos.set(r.pieza, r);
  return fotos;
}

// Lo que pinta el carro 3D: el color de cada pieza marcada.
export function coloresDelCarro(danos, carro) {
  return new Map(danosDelCarro(danos, carro).map((d) => [d.pieza, TIPO_POR_ID.get(d.tipo).color]));
}

// Las filas de la lista de un carro, en el orden de las piezas.
export function filasDeDanos(danos, registros, carro, carroceria) {
  const fotos = fotosDeLosDanos(registros, carro);
  return danosDelCarro(danos, carro).map((d) => {
    const tipo = TIPO_POR_ID.get(d.tipo);
    const foto = fotos.get(d.pieza) || null;
    return {
      pieza: d.pieza,
      nombre: nombreDePiezaEn(carroceria, d.pieza),
      tipo: d.tipo,
      nombreDelTipo: tipo.nombre,
      color: tipo.color,
      foto,
      // La foto se tomó cuando la persona había dicho otro tipo.
      fotoComoOtroTipo: foto && foto.dano && foto.dano !== d.tipo ? TIPO_POR_ID.get(foto.dano)?.nombre ?? foto.dano : null,
    };
  });
}

export function resumenDeDanos(filas) {
  if (!filas.length) return 'Sin daños marcados.';
  const conFoto = filas.filter((f) => f.foto).length;
  const piezas = filas.length === 1 ? '1 pieza marcada' : `${filas.length} piezas marcadas`;
  // «1 pieza marcada, todas con su foto» suena a error de la app: con una sola, «con su foto».
  if (conFoto === filas.length) return `${piezas}, ${filas.length === 1 ? 'con su foto' : 'todas con su foto'} de cerca.`;
  const faltan = filas.length - conFoto;
  return `${piezas}; ${faltan === 1 ? 'falta 1 foto' : `faltan ${faltan} fotos`} de cerca.`;
}

// La revisión de una foto de cerca: borrosa u oscura. Ni torcida, ni piso, ni
// cielo: un daño en el bómper se fotografía mirando hacia abajo y un rayón en
// el techo, de lado, y eso está bien.
export function revisarFotoDeCerca(medida) {
  return revisarFoto({ nitidez: medida.nitidez, brillo: medida.brillo });
}
