// El expediente del choque: lo que la aseguradora, el perito o el abogado leen. Este módulo decide
// QUÉ dice y en qué orden; expediente-pdf.js lo pone en la hoja. Puro: se prueba en Node.
//
// Reglas del contenido (las mismas de toda la app):
//  - No dice nada que el reporte no diga. Lo que la persona declaró se presenta como declarado
//    («según la persona», «leída de la foto y revisada por ella»), y lo que salió del mapa o del
//    modelo del clima, con su fuente.
//  - No decide la culpa ni la insinúa: ni velocidades, ni «responsable», ni colores de culpa.
//  - Lo que falta se dice («falta la foto 5»), no se esconde: un expediente incompleto que lo
//    admite vale más que uno que parece completo.
//  - Cada foto lleva lo que se selló con ella (hora, GPS, rumbo, la revisión) y su SHA-256, para
//    que quien la saque del PDF compruebe que es la misma.
import { croquisUtilizable, puntaDeFlecha, relatoDelCroquis, tituloDelCaso, viaDesdeGuardado } from './croquis.js';
import { carrosDelReporte, esDelCarro, estadoDeLaPlaca, nombreDelCarro, nombreDeLaToma, placaParaMostrar, textoDeLaLinea, VISTAS_DEL_CARRO } from './carros.js';
import { filasDeDanos, resumenDeDanos } from './danos.js';
import { nombreDePiezaEn } from './carrocerias.js';
import { estadoDeLaVuelta, esDeLaEscena, TOMAS } from './escena.js';
import { NOMBRES_DE_PROBLEMAS } from './calidad.js';
import { colorDeCarro, COLORES } from './zona-3d.js';
import { enlacesDeGoogle } from './enlaces-google.js';
import { fechaLarga, fechaYHora, horaDeColombia } from './fechas.js';
import { distancia, numero, puntoCardinal } from './geo.js';
import { NO_ES_PRUEBA_DE_EMBRIAGUEZ, respuestasDeAntes, resumenDeAntes } from './antes.js';
import { queLeFalta } from './sello.js';
import { CLAVES, esDeLaPrueba, estadoDeLasPruebas, fotosDeLaPrueba, resumenDeLasPruebas, SALTADA, TIPOS, tituloDelRenglon } from './pruebas.js';

const GRADO = Math.PI / 180;

// Los nombres de los dos adjuntos del PDF (sello.js cuenta por qué van).
export const adjuntoDelContenido = (numero) => `contenido-sellado-${numero}.json`;
export const adjuntoDeLaCadena = (numero) => `cadena-de-fotos-${numero}.json`;

const PASOS = { escena: 'Escena', carro: 'Carro', danos: 'Daño' };

// --- Cada foto --------------------------------------------------------------------------------

// Lo que se selló con cada foto, en palabras, para imprimirlo debajo de ella. El GPS va con 5
// decimales (1 m: más no dice nada con ±8 m de precisión); el registro completo, con 7, va en el
// adjunto de la cadena.
export function datosDeLaFoto(r) {
  const problemas = r.calidad?.problemas ?? [];
  const fuente = r.rumboFuente === 'iphone' ? ' (brújula del iPhone)' : r.rumboFuente === 'android' ? ' (brújula del Android)' : '';
  return {
    registro: r.indice + 1,
    fecha: fechaLarga(r.hora),
    hora: horaDeColombia(r.hora, { segundos: true }),
    rumbo: r.rumbo === null || r.rumbo === undefined ? 'Sin brújula' : `Mirando al ${puntoCardinal(r.rumbo)}, ${numero(r.rumbo)}°${fuente}`,
    gps: r.gps ? `GPS ${r.gps.lat.toFixed(5)}, ${r.gps.lon.toFixed(5)}${Number.isFinite(r.gps.precision) ? ` (±${Math.round(r.gps.precision)}\u00a0m)` : ''}` : 'Sin GPS',
    revision: problemas.length ? `Aceptada aunque salió ${problemas.map((p) => (NOMBRES_DE_PROBLEMAS[p] || p).toLowerCase()).join(', ')}` : '',
  };
}

function fotoDelExpediente(r, titulo) {
  return { huella: r.huella, sha256: r.foto.sha256, ancho: r.foto.ancho, alto: r.foto.alto, titulo, ...datosDeLaFoto(r) };
}

// Las fotos que otra posterior reemplazó (se repitió la toma): siguen en la cadena y van al
// final, para que nadie piense que se escondieron.
export function huellasReemplazadas(registros) {
  const reemplazadas = new Map();
  for (const r of registros) if (r.reemplaza) reemplazadas.set(r.reemplaza, r);
  return reemplazadas;
}

const enLista = (cosas) => (cosas.length <= 1 ? cosas.join('') : cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1]);

function faltantes(vuelta, nombre) {
  const sectores = vuelta.tomadas.map((t, s) => (t ? null : s)).filter((s) => s !== null);
  if (!sectores.length) return '';
  const nombres = sectores.map((s) => `la ${s + 1}${nombre ? ` (${nombre(s).toLowerCase()})` : ''}`);
  return `${sectores.length === 1 ? 'Falta' : 'Faltan'} ${enLista(nombres)}.`;
}

// --- El plano del croquis ---------------------------------------------------------------------

// El último pedazo de `metros` de una línea, quitado: la flecha que llega al golpe termina antes
// de la estrella, no debajo de ella.
function recortarAlFinal(puntos, metros) {
  const salida = puntos.map((p) => ({ ...p }));
  let resto = metros;
  while (salida.length >= 2 && resto > 0) {
    const fin = salida[salida.length - 1];
    const antes = salida[salida.length - 2];
    const d = distancia(antes, fin);
    if (d > resto) {
      const k = (d - resto) / d;
      salida[salida.length - 1] = { x: antes.x + (fin.x - antes.x) * k, y: antes.y + (fin.y - antes.y) * k };
      return salida;
    }
    salida.pop();
    resto -= d;
  }
  return salida;
}

// Un rectángulo girado: el carro visto desde arriba, en metros (x al este, y al norte).
function rectangulo(centro, rumbo, largo, ancho) {
  const a = { x: Math.sin(rumbo * GRADO), y: Math.cos(rumbo * GRADO) };
  const d = { x: a.y, y: -a.x };
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => ({ x: centro.x + (a.x * largo * i + d.x * ancho * j) / 2, y: centro.y + (a.y * largo * i + d.y * ancho * j) / 2 }));
}

// El croquis en metros alrededor de su centro, listo para dibujar: la vía, los carros (con el
// vidrio de adelante, que dice hacia dónde mira un carro quieto), las flechas con su punta y la
// estrella del golpe. `caja`: lo que hay que mostrar, con margen, en la proporción `proporcion`
// (ancho / alto del dibujo) y nunca de menos de `minimo` metros de ancho.
export function planoDelCroquis(croquis, { proporcion = 1.3, minimo = 34, margen = 5, carriles = null } = {}) {
  if (!croquisUtilizable(croquis)) return null;
  const via = viaDesdeGuardado(croquis);
  const aMetros = (p) => via.plano.aMetros(p);
  const golpe = croquis.golpe ? aMetros(croquis.golpe) : null;
  const carros = croquis.carros.map((c) => {
    const centro = aMetros(c);
    const adelante = { x: Math.sin(c.rumbo * GRADO), y: Math.cos(c.rumbo * GRADO) };
    const vidrio = { x: centro.x + adelante.x * c.largo * 0.17, y: centro.y + adelante.y * c.largo * 0.17 };
    return {
      letra: c.letra,
      color: colorDeCarro(c.letra),
      centro,
      rumbo: c.rumbo,
      cuerpo: rectangulo(centro, c.rumbo, c.largo, c.ancho),
      vidrio: rectangulo(vidrio, c.rumbo, c.largo * 0.16, c.ancho * 0.78),
    };
  });
  const flechas = (croquis.flechas || [])
    .filter((f) => f.puntos?.length >= 2)
    .map((f) => {
      let puntos = f.puntos.map(aMetros);
      if (golpe && distancia(puntos[puntos.length - 1], golpe) < 1.5) puntos = recortarAlFinal(puntos, 1.6);
      const punta = puntos.length >= 2 ? puntaDeFlecha(puntos.map((p) => via.plano.aGrados(p)), { largo: 2.4 }) : null;
      return { letra: f.letra, color: colorDeCarro(f.letra), puntos, punta: punta ? punta.map(aMetros) : null, guiada: croquis.modo !== 'libre' };
    })
    .filter((f) => f.puntos.length >= 2);

  // La caja: todo lo dibujado, con margen, en la proporción del dibujo.
  const todos = [...carros.flatMap((c) => c.cuerpo), ...flechas.flatMap((f) => f.puntos), ...(golpe ? [golpe] : [])];
  if (!todos.length) todos.push({ x: 0, y: 0 });
  let oeste = Math.min(...todos.map((p) => p.x)) - margen;
  let este = Math.max(...todos.map((p) => p.x)) + margen;
  let sur = Math.min(...todos.map((p) => p.y)) - margen;
  let norte = Math.max(...todos.map((p) => p.y)) + margen;
  let ancho = Math.max(este - oeste, minimo, (norte - sur) * proporcion);
  const alto = ancho / proporcion;
  const cx = (oeste + este) / 2;
  const cy = (sur + norte) / 2;
  oeste = cx - ancho / 2;
  este = cx + ancho / 2;
  sur = cy - alto / 2;
  norte = cy + alto / 2;

  // Una vía de dos carriles mide unos 7 m; con el número del mapa, 3,3 m por carril.
  const anchoDeLaVia = Number.isFinite(carriles) && carriles > 0 ? Math.min(14, Math.max(5, carriles * 3.3)) : 7;
  // La regla: la medida redonda más cercana a un quinto del ancho.
  const regla = [5, 10, 20, 50, 100].reduce((mejor, m) => (Math.abs(m - ancho / 5) < Math.abs(mejor - ancho / 5) ? m : mejor), 10);
  return {
    caja: { oeste, este, sur, norte, ancho, alto },
    via: { puntos: via.puntos, real: via.real, ancho: anchoDeLaVia, nombre: via.nombre },
    carros,
    flechas,
    golpe,
    regla,
    colorDelGolpe: COLORES.punto,
  };
}

function carrilesDelLugar(lugar) {
  const fila = lugar?.filasDeLaVia?.find((f) => f.clave === 'carriles');
  const n = fila ? parseInt(fila.valor, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

// --- El expediente entero ---------------------------------------------------------------------

// `revision`: lo que dio revisarCadena() al sellar (verificarCadena de evidencia.js).
export function armarExpediente({ reporte, registros = [], sello, revision = null }) {
  const carroceriaDe = new Map((reporte.carros ?? []).map((c) => [c.letra, c.linea?.carroceria ?? null]));
  // «Escena · 3», «Carro B · 5», «Daño A · bómper delantero».
  const queEs = (r) => {
    if (r.paso === 'danos') return `Daño ${r.carro}${r.pieza ? ' · ' + nombreDePiezaEn(carroceriaDe.get(r.carro), r.pieza).toLowerCase() : ''}`;
    if (r.paso === 'prueba') return `${tituloDelRenglon(r.prueba)}${Number.isInteger(r.sector) ? ' · ' + (r.sector + 1) : ''}`;
    return `${PASOS[r.paso] ?? r.paso}${r.carro ? ' ' + r.carro : ''}${Number.isInteger(r.sector) ? ' · ' + (r.sector + 1) : ''}`;
  };
  const lugar = reporte.lugar ?? null;
  const croquis = croquisUtilizable(reporte.croquis) ? reporte.croquis : null;
  const ejemplo = lugar?.origen === 'ejemplo' || !!croquis?.ejemplo;
  const reemplazadas = huellasReemplazadas(registros);
  const vigente = (r) => !reemplazadas.has(r.huella);
  const quienEs = (c) => (c.quien === 'tuyo' ? 'el tuyo' : c.letra === 'B' ? 'el otro' : null);

  // La escena. Si en «Antes de mover» se saltó la vuelta por seguridad, se dice: si no, parecería
  // olvido.
  const vueltaEscena = estadoDeLaVuelta(registros, { filtro: esDeLaEscena });
  const vueltaSaltada = reporte.pruebas?.renglones?.vuelta?.saltada === SALTADA && !vueltaEscena.completa;
  const porSeguridad = vueltaSaltada ? ' La persona marcó que no era seguro hacerla.' : '';
  const escena = {
    fotos: vueltaEscena.vigentes.filter(Boolean).map((r) => fotoDelExpediente(r, `Escena · foto ${r.sector + 1}`)),
    faltan: vueltaEscena.cuantas === 0 ? `No se tomaron fotos de la escena.${porSeguridad}` : `${faltantes(vueltaEscena, null)}${porSeguridad}`,
  };

  // «Antes de mover» (E1, 26-nov-2026): cada renglón con lo que se tomó, lo que la persona declaró y
  // lo que no se tomó. Va si se anotó algo o hay alguna de sus fotos; un reporte de antes de E1 no
  // lleva una sección entera de «sin fotos». La vuelta no se repite: está en «La escena». Un renglón
  // que ya no está en la lista (se cambió el tipo de choque) igual va si tiene fotos: ninguna se esconde.
  const conPruebas = !!reporte.pruebas || registros.some((r) => r.paso === 'prueba');
  const estadoPruebas = conPruebas ? estadoDeLasPruebas({ pruebas: reporte.pruebas, registros, lugar, ahora: new Date(sello.hora) }) : null;
  const pruebas = conPruebas
    ? (() => {
        const enLaLista = new Map(estadoPruebas.renglones.map((r) => [r.clave, r]));
        const renglones = CLAVES.filter((clave) => clave !== 'vuelta' && (enLaLista.has(clave) || registros.some(esDeLaPrueba(clave)))).map((clave) => {
          const r = enLaLista.get(clave) ?? null;
          const suyas = registros.filter(esDeLaPrueba(clave));
          const n = Math.max(r?.total ?? 0, ...suyas.map((x) => (Number.isInteger(x.sector) ? x.sector + 1 : 0)));
          const { vigentes } = fotosDeLaPrueba(registros, clave, n);
          const titulo = tituloDelRenglon(clave);
          return {
            clave,
            titulo,
            estado: r?.estado ?? 'fuera',
            resumen: r ? r.resumen : `${suyas.length === 1 ? '1 foto' : `${vigentes.filter(Boolean).length} fotos`}. Ya no estaba en la lista: la persona cambió el tipo de choque después de tomarlas.`,
            nota: r?.sinEscala ? 'La persona marcó que no tenía con qué medir: las fotos de cerca van sin medida al lado.' : '',
            fotos: vigentes.filter(Boolean).map((x) => fotoDelExpediente(x, `${titulo} · ${r?.fotos[x.sector]?.corto ?? `foto ${x.sector + 1}`}`)),
          };
        });
        const tipo = TIPOS.find((t) => t.valor === estadoPruebas.tipo);
        return {
          resumen: resumenDeLasPruebas(estadoPruebas),
          tipo: tipo && tipo.valor !== 'no-se' ? `${tipo.texto}, según la persona` : '',
          // «5:31 p. m.» ya termina en punto: no se le pone otro.
          movidos: estadoPruebas.movidos ? `La persona marcó que los movió a las ${horaDeColombia(estadoPruebas.movidos).replace(/\.$/, '')}.` : '',
          renglones,
          testigos: estadoPruebas.testigos.map((t) => ({ nombre: t.nombre, celular: t.celular })),
        };
      })()
    : null;

  // Los carros, cada uno con su vuelta, su placa y sus daños.
  const carros = carrosDelReporte(reporte).map((c) => {
    const vuelta = estadoDeLaVuelta(registros, { filtro: esDelCarro(c.letra) });
    const placa = estadoDeLaPlaca(c);
    const carroceria = c.linea?.carroceria ?? null;
    const filas = filasDeDanos(reporte.danos ?? [], registros, c.letra, carroceria);
    return {
      letra: c.letra,
      color: colorDeCarro(c.letra),
      titulo: nombreDelCarro(c),
      placa: {
        texto: placa.tipo === 'lista' || placa.tipo === 'propuesta' ? placaParaMostrar(placa.texto) : placa.tipo === 'sin-placa' ? 'Sin placa' : 'Sin leer',
        detalle: placa.tipo === 'propuesta' ? `Leída de la foto y SIN revisar por la persona.` : placa.detalle,
        revisada: placa.tipo === 'lista',
      },
      linea: textoDeLaLinea(c.linea) ? `${textoDeLaLinea(c.linea)}${carroceria ? ` (${carroceria})` : ''}, según la persona` : 'Sin línea elegida',
      fotos: vuelta.vigentes.filter(Boolean).map((r) => fotoDelExpediente(r, `Carro ${c.letra} · ${VISTAS_DEL_CARRO[r.sector].corto}`)),
      faltan: vuelta.cuantas === 0 ? 'No se le tomaron fotos a este carro.' : faltantes(vuelta, nombreDeLaToma),
      danos: {
        resumen: resumenDeDanos(filas),
        filas: filas.map((f) => ({
          pieza: f.nombre,
          tipo: f.nombreDelTipo,
          color: f.color,
          foto: f.foto ? fotoDelExpediente(f.foto, `${f.nombre} · ${f.nombreDelTipo}`) : null,
          nota: f.fotoComoOtroTipo ? `La foto se tomó cuando estaba marcado como «${f.fotoComoOtroTipo}».` : f.foto ? '' : 'Sin foto de cerca.',
        })),
      },
    };
  });

  // Lo que va al anexo: las fotos repetidas (otra las reemplazó) y las que ya no corresponden a
  // nada de lo declarado (la foto de un daño cuya marca se quitó después). Siguen en la cadena y
  // van en el PDF igual: nada de la cadena se esconde.
  const mostradas = new Set([...escena.fotos, ...(pruebas?.renglones.flatMap((r) => r.fotos) ?? []), ...carros.flatMap((c) => [...c.fotos, ...c.danos.filas.map((f) => f.foto).filter(Boolean)])].map((f) => f.huella));
  const anexo = registros
    .filter((r) => !mostradas.has(r.huella))
    .map((r) => {
      const nueva = reemplazadas.get(r.huella);
      const titulo = `${queEs(r)}${nueva ? ' · repetida' : ''}`;
      return { ...fotoDelExpediente(r, titulo), nota: nueva ? `La reemplaza el registro ${nueva.indice + 1}.` : 'Sigue en la cadena, pero ya no corresponde a lo declarado (por ejemplo, se quitó la marca de ese daño).' };
    });

  // La cadena: todas las fotos, en orden, con su SHA-256 completo.
  const cadena = {
    integra: revision ? revision.integra : null,
    texto: !revision
      ? 'La cadena no se revisó al preparar este expediente.'
      : revision.integra
        ? `Al preparar este expediente, el teléfono revisó la cadena de ${revision.total} ${revision.total === 1 ? 'registro' : 'registros'} con los bytes de cada foto: ninguna foto ni dato cambió desde que se tomó.`
        : `Al preparar este expediente, la cadena se rompió en el registro ${revision.rota.indice + 1}.`,
    filas: registros.map((r) => ({
      n: r.indice + 1,
      que: `${queEs(r)}${vigente(r) ? '' : ' (repetida)'}`,
      hora: horaDeColombia(r.hora, { segundos: true }),
      sha256: r.foto.sha256,
    })),
  };

  const viaNombre = lugar?.via?.nombre || croquis?.via?.nombre || null;
  const punto = lugar?.punto ?? croquis?.punto ?? croquis?.centro ?? null;
  const horaDelChoque = lugar?.hora ?? croquis?.hora ?? null;
  const conFotos = (n) => (n === 1 ? '1 foto' : `${n} fotos`);
  const cuantas = (filtro) => registros.filter((r) => vigente(r) && filtro(r)).length;

  const antes = resumenDeAntes(reporte.antes);
  // Lo que no se alcanzó a consultar hasta que se selló (por ejemplo, porque no había internet).
  const sinConsultar = queLeFalta(lugar, new Date(sello.hora));

  const resumen = [
    { etiqueta: 'El choque', valor: horaDelChoque ? fechaYHora(horaDelChoque) : 'Sin hora' },
    { etiqueta: 'Dónde', valor: [viaNombre, punto ? `${punto.lat.toFixed(6)}, ${punto.lon.toFixed(6)}` : 'Sin marcar'].filter(Boolean).join(' · ') },
    ...(antes ? [{ etiqueta: 'Antes de mover', valor: antes.startsWith('La persona') ? antes : `${antes}, según la persona` }] : []),
    ...(pruebas ? [{ etiqueta: 'Lo que se borra primero', valor: pruebas.resumen.replace(/\.$/, '') }] : []),
    ...carrosDelReporte(reporte).map((c, i) => ({ etiqueta: `Carro ${c.letra}`, valor: [quienEs(c), carros[i].placa.texto === 'Sin leer' ? 'placa sin leer' : carros[i].placa.texto, textoDeLaLinea(c.linea) || null].filter(Boolean).join(' · ') })),
    { etiqueta: 'Fotos', valor: `${conFotos(registros.length)} en la cadena: ${cuantas(esDeLaEscena)} de la escena, ${pruebas ? `${cuantas((r) => r.paso === 'prueba')} de antes de mover, ` : ''}${carros.map((c) => `${cuantas(esDelCarro(c.letra))} del carro ${c.letra}`).join(', ')} y ${cuantas((r) => r.paso === 'danos')} de los daños${anexo.length ? ` (${anexo.length} en el anexo)` : ''}` },
    { etiqueta: 'Daños', valor: carros.map((c) => `${c.letra}: ${c.danos.filas.length ? c.danos.filas.length + (c.danos.filas.length === 1 ? ' pieza' : ' piezas') : 'ninguno marcado'}`).join(' · ') },
    { etiqueta: 'Croquis', valor: croquis ? `${tituloDelCaso(croquis.caso)}${croquis.hecho ? '' : ' (sin terminar)'}` : 'No se hizo' },
  ];

  const noAfirma = [
    'No dice quién tuvo la culpa. Eso lo deciden la autoridad de tránsito, la aseguradora o un juez.',
    'El croquis, las placas revisadas, las líneas de los carros y los daños marcados son lo que la persona declaró en el teléfono, no una medición.',
    'La vía viene del mapa de OpenStreetMap y el clima de un modelo (Open-Meteo), no de una medición en el sitio.',
    'La hora de las fotos es la del reloj del teléfono, y el GPS en la ciudad se equivoca de 5 a 30 metros.',
    'Mientras el reporte estuvo solo en el teléfono, alguien con el teléfono y conocimientos pudo rehacerlo entero. Vale desde que salió de él: este PDF, y el número y la huella que la persona envió.',
  ];
  if (respuestasDeAntes(reporte.antes)?.embriaguez === 'si') noAfirma.splice(1, 0, NO_ES_PRUEBA_DE_EMBRIAGUEZ);
  if (pruebas) {
    // Va junto a la del croquis: es lo que la persona declaró, no una medición.
    const i = noAfirma.findIndex((t) => t.startsWith('El croquis'));
    noAfirma.splice(i + 1, 0, 'La app no calcula velocidades. La medida de la huella, si la hay, es la que anotó la persona, con cinta o con pasos; si hace falta una velocidad, la calcula un perito con las fotos.');
    if (pruebas.testigos.length) noAfirma.splice(i + 2, 0, 'El nombre y el celular de quien lo vio son los que la persona anotó, con su permiso; la app no los comprobó.');
  }
  if (ejemplo) noAfirma.unshift('ES UN EJEMPLO: el lugar es real, pero el choque es inventado.');

  return {
    numero: sello.numero,
    huella: sello.huella,
    sellado: sello.hora,
    selladoTexto: fechaYHora(sello.hora),
    ejemplo,
    titulo: `Expediente del choque ${sello.numero}`,
    resumen,
    lugar: punto
      ? {
          punto,
          precision: lugar?.precision ?? null,
          hora: horaDelChoque,
          horaTexto: horaDelChoque ? fechaYHora(horaDelChoque) : '',
          via: viaNombre,
          resumenDeLaVia: lugar?.via?.resumen || '',
          sinVias: !!lugar?.sinVias,
          sinConsultar: sinConsultar.length ? `No se alcanzó a consultar ${sinConsultar.join(' ni ')}: por ejemplo, porque no había internet.` : '',
          enlaces: enlacesDeGoogle(punto, { rumbo: lugar?.via?.rumbo ?? null }),
          filasDeLaVia: lugar?.filasDeLaVia ?? [],
          filasDeLaLuz: lugar?.filasDeLaLuz ?? [],
          origen: lugar?.origen ?? null,
        }
      : null,
    croquis: croquis
      ? {
          titulo: tituloDelCaso(croquis.caso),
          hecho: croquis.hecho,
          relato: relatoDelCroquis(croquis, viaDesdeGuardado(croquis)),
          plano: planoDelCroquis(croquis, { carriles: carrilesDelLugar(lugar) }),
        }
      : null,
    escena,
    pruebas,
    carros,
    anexo,
    cadena,
    noAfirma,
    adjuntos: { contenido: adjuntoDelContenido(sello.numero), cadena: adjuntoDeLaCadena(sello.numero) },
    tomas: TOMAS,
  };
}
