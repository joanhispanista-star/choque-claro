// Quién puede hacer qué en Choque Claro cuando haya cuentas (fase 2). Joan lo decidió el sáb
// 14-nov-2026 y el plan está en PLAN-ROLES.md, que va fuera de git.
//
// Este archivo NO protege nada. La protección vive en la base: RLS y funciones de
// supabase/migrations/20261114150000_fase2_roles.sql. Este archivo sirve para dos cosas:
//   1. que la pantalla muestre solo los botones que la base va a aceptar, y que diga por qué
//      cuando algo no se puede, en vez de dejar que la base conteste con un error en inglés;
//   2. que las pruebas comparen ESTA tabla con lo que la base hace de verdad
//      (pruebas/roles-postgres.test.js). Si una regla cambia en un lado y no en el otro, la
//      prueba falla. Así la regla escrita y la que se cumple no pueden separarse sin que nadie
//      se entere.
//
// Sin dependencias y sin tocar el DOM: corre igual en el teléfono, en el PC y en Node.

export const ROLES = Object.freeze({
  conductor: 'el conductor que reporta',
  analista: 'analista de la aseguradora',
  jefe: 'jefe de siniestros',
  abogado_aseguradora: 'abogado de la aseguradora',
  abogado_conductor: 'abogado del conductor',
  super_admin: 'Choque Claro (Joan)',
});

// Los roles con cuenta, tal como se guardan en la tabla `miembros`. El conductor no tiene
// cuenta (una sesión anónima en su teléfono) y su abogado tampoco (un enlace).
const DE_LA_BASE = Object.freeze({ super_admin: 'super_admin', jefe: 'jefe', analista: 'analista', abogado: 'abogado_aseguradora' });

export function rolDeMiembro(rolEnLaBase) {
  return DE_LA_BASE[rolEnLaBase] ?? null;
}

export function rolParaLaBase(rol) {
  return Object.keys(DE_LA_BASE).find((k) => DE_LA_BASE[k] === rol) ?? null;
}

export const ACCIONES = Object.freeze({
  enviar_reclamo: 'enviar un reclamo',
  ver_estado: 'ver un reclamo en la lista, con su estado',
  abrir_reclamo: 'abrir el reclamo completo: fotos y lo declarado',
  cambiar_estado: 'cambiar el estado de un reclamo',
  escribir_nota: 'escribir una nota interna',
  asignar: 'asignar un reclamo',
  ver_bitacora: 'ver quién abrió el reclamo',
  crear_enlace: 'crear el enlace para el abogado',
  ver_equipo: 'ver a una persona del equipo',
  crear_miembro: 'crear una cuenta del equipo',
  apagar_miembro: 'apagar o encender una cuenta del equipo',
  crear_aseguradora: 'dar de alta una aseguradora',
});

const DEL_EQUIPO = ['analista', 'abogado_aseguradora'];

// Un reclamo «subiendo» todavía no llegó entero: las fotos van en camino y el servidor no las
// ha verificado. La aseguradora no lo ve hasta que llega completo, porque un expediente a
// medias se puede leer mal. Joan sí lo ve, para dar soporte cuando una subida se queda trabada.
const llego = (ctx) => ctx.estado !== 'subiendo';

const NO_LLEGO = 'Ese reclamo todavía se está subiendo.';
const NO_ES_TUYO = 'Ese reclamo es de otra aseguradora.';

// Cada regla devuelve true, o el motivo del no en español, para mostrarlo tal cual.
// ctx es lo que se sabe del recurso frente a quien pregunta:
//   estado              'subiendo' | 'recibido' | 'en_revision' | 'cerrado'
//   mismaAseguradora    el reclamo, o la persona, es de la aseguradora de quien pregunta
//   asignado            el reclamo le fue asignado a quien pregunta
//   esSuyo              quien pregunta es el conductor que envió el reclamo
//   enlaceVigente       (abogado del conductor) el enlace existe, no venció y no lo quitaron
//   aseguradoraActiva   (enviar) el enlace es de una aseguradora que existe y está activa
//   rolObjetivo         (equipo, asignar) el rol de la persona sobre la que se actúa
//   objetivoActivo      (asignar) esa persona tiene la cuenta encendida
//   objetivoDeLaAseguradora (asignar) esa persona es de la aseguradora del reclamo
//   esUnoMismo          (equipo) quien pregunta actúa sobre su propia cuenta
const REGLAS = {
  enviar_reclamo(rol, ctx) {
    if (rol !== 'conductor') return 'Los reclamos se envían desde el teléfono del conductor, no con una cuenta del equipo.';
    return ctx.aseguradoraActiva ? true : 'Ese enlace no es de una aseguradora activa.';
  },

  ver_estado(rol, ctx) {
    if (rol === 'conductor') return ctx.esSuyo ? true : 'Solo ves los reclamos que enviaste desde este teléfono.';
    if (rol === 'abogado_conductor') return ctx.enlaceVigente ? true : 'Ese enlace no existe, venció o el conductor lo quitó.';
    return verComoEquipo(rol, ctx);
  },

  abrir_reclamo(rol, ctx) {
    // El conductor ya tiene todo en su teléfono. Por el servidor solo ve el estado.
    if (rol === 'conductor') return 'Tu reclamo completo está en tu teléfono.';
    return REGLAS.ver_estado(rol, ctx);
  },

  cambiar_estado(rol, ctx) {
    if (!llego(ctx)) return NO_LLEGO;
    if (rol === 'super_admin') return true;
    if (rol === 'jefe' || rol === 'analista') return ctx.mismaAseguradora ? true : NO_ES_TUYO;
    return 'El estado lo cambian el analista y el jefe de siniestros.';
  },

  escribir_nota(rol, ctx) {
    if (!llego(ctx)) return NO_LLEGO;
    if (rol === 'super_admin') return true;
    if (rol === 'jefe' || rol === 'analista') return ctx.mismaAseguradora ? true : NO_ES_TUYO;
    if (rol === 'abogado_aseguradora') return ctx.asignado ? true : 'Solo escribes en los reclamos que te asignaron.';
    return 'Las notas son internas de la aseguradora.';
  },

  asignar(rol, ctx) {
    if (!llego(ctx)) return NO_LLEGO;
    if (rol !== 'super_admin' && !(rol === 'jefe' && ctx.mismaAseguradora)) return 'Los reclamos los asigna el jefe de siniestros.';
    if (!DEL_EQUIPO.includes(ctx.rolObjetivo) || !ctx.objetivoActivo || !ctx.objetivoDeLaAseguradora) {
      return 'Solo se asigna a un analista o un abogado activo de esa aseguradora.';
    }
    return true;
  },

  ver_bitacora(rol, ctx) {
    // El conductor ve quién abrió su reclamo: el dueño de los datos sabe quién los usó
    // (Ley 1581). Ve el rol y la hora, no los nombres del equipo.
    if (rol === 'conductor') return ctx.esSuyo ? true : 'Solo ves la bitácora de tus reclamos.';
    if (rol === 'super_admin') return true;
    if (rol === 'jefe') return !llego(ctx) ? NO_LLEGO : ctx.mismaAseguradora ? true : NO_ES_TUYO;
    return 'La bitácora la ven el jefe de siniestros y el conductor.';
  },

  crear_enlace(rol, ctx) {
    if (rol !== 'conductor' || !ctx.esSuyo) return 'El enlace para el abogado lo crea el conductor, desde su teléfono.';
    // Un enlace a un reclamo a medio subir le mostraría al abogado un expediente incompleto.
    return llego(ctx) ? true : NO_LLEGO;
  },

  ver_equipo(rol, ctx) {
    if (rol === 'super_admin') return true;
    if (rol === 'jefe') return ctx.mismaAseguradora ? true : 'Esa persona es de otra aseguradora.';
    return 'El equipo lo ve el jefe de siniestros.';
  },

  crear_miembro(rol, ctx) {
    if (rol === 'super_admin') {
      return ['jefe', ...DEL_EQUIPO].includes(ctx.rolObjetivo) ? true : 'Ese rol no se crea desde aquí.';
    }
    if (rol === 'jefe') {
      if (!ctx.mismaAseguradora) return 'Solo creas cuentas de tu aseguradora.';
      return DEL_EQUIPO.includes(ctx.rolObjetivo) ? true : 'El jefe crea analistas y abogados; otro jefe lo crea Choque Claro.';
    }
    return 'Las cuentas las crea el jefe de siniestros.';
  },

  apagar_miembro(rol, ctx) {
    if (ctx.esUnoMismo) return 'No puedes apagar tu propia cuenta.';
    if (rol === 'super_admin') return ctx.rolObjetivo !== 'super_admin' ? true : 'Esa cuenta no se apaga desde aquí.';
    if (rol === 'jefe') {
      if (!ctx.mismaAseguradora) return 'Esa persona es de otra aseguradora.';
      return DEL_EQUIPO.includes(ctx.rolObjetivo) ? true : 'El jefe apaga analistas y abogados.';
    }
    return 'Las cuentas las apaga el jefe de siniestros.';
  },

  crear_aseguradora(rol) {
    return rol === 'super_admin' ? true : 'Las aseguradoras las da de alta Choque Claro.';
  },
};

function verComoEquipo(rol, ctx) {
  if (rol === 'super_admin') return true;
  if (!llego(ctx)) return NO_LLEGO;
  if (rol === 'jefe' || rol === 'analista') return ctx.mismaAseguradora ? true : NO_ES_TUYO;
  if (rol === 'abogado_aseguradora') return ctx.asignado ? true : 'Solo ves los reclamos que te asignaron.';
  return 'No tienes acceso a ese reclamo.';
}

// rol: una clave de ROLES, o null cuando la cuenta está apagada, cuando su aseguradora está
// apagada o cuando no hay sesión. Apagar a alguien le quita TODO de una vez, salvo ver su
// propia cuenta: así la pantalla puede decirle «tu cuenta está apagada» en vez de quedarse muda.
export function motivo(rol, accion, ctx = {}) {
  const regla = REGLAS[accion];
  if (!regla) throw new Error(`Acción desconocida: ${accion}`);
  if (accion === 'ver_equipo' && ctx.esUnoMismo) return '';
  if (rol == null) return 'Tu cuenta está apagada.';
  if (!(rol in ROLES)) throw new Error(`Rol desconocido: ${rol}`);
  const r = regla(rol, ctx);
  return r === true ? '' : r;
}

export function puede(rol, accion, ctx = {}) {
  return motivo(rol, accion, ctx) === '';
}
