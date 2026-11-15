// La tabla de quién puede qué (js/permisos.js), leída como la decidió Joan el sáb 14-nov-2026.
// Las mismas reglas se comparan contra la base de verdad en roles-postgres.test.js; aquí van
// los casos que se leen en voz alta, para que un cambio de regla se note en una línea.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCIONES, ROLES, motivo, puede, rolDeMiembro, rolParaLaBase } from '../js/permisos.js';

const LLEGO = { estado: 'recibido' };

test('el conductor envía y ve lo suyo, pero no abre el expediente por el servidor', () => {
  assert.equal(puede('conductor', 'enviar_reclamo', { aseguradoraActiva: true }), true);
  assert.equal(motivo('conductor', 'enviar_reclamo', { aseguradoraActiva: false }), 'Ese enlace no es de una aseguradora activa.');
  assert.equal(puede('conductor', 'ver_estado', { ...LLEGO, esSuyo: true }), true);
  assert.equal(puede('conductor', 'ver_estado', { ...LLEGO, esSuyo: false }), false);
  // Ya lo tiene todo en su teléfono.
  assert.equal(motivo('conductor', 'abrir_reclamo', { ...LLEGO, esSuyo: true }), 'Tu reclamo completo está en tu teléfono.');
  // Ve quién abrió su reclamo: es el dueño de sus datos.
  assert.equal(puede('conductor', 'ver_bitacora', { ...LLEGO, esSuyo: true }), true);
  assert.equal(puede('conductor', 'escribir_nota', { ...LLEGO, esSuyo: true }), false);
});

test('el enlace para el abogado lo crea el conductor, y solo cuando el reclamo ya llegó', () => {
  assert.equal(puede('conductor', 'crear_enlace', { ...LLEGO, esSuyo: true }), true);
  assert.equal(motivo('conductor', 'crear_enlace', { estado: 'subiendo', esSuyo: true }), 'Ese reclamo todavía se está subiendo.');
  assert.equal(puede('conductor', 'crear_enlace', { ...LLEGO, esSuyo: false }), false);
  assert.equal(puede('jefe', 'crear_enlace', { ...LLEGO, mismaAseguradora: true }), false);
});

test('el analista trabaja los reclamos de su aseguradora, nunca los de otra', () => {
  for (const accion of ['ver_estado', 'abrir_reclamo', 'cambiar_estado', 'escribir_nota']) {
    assert.equal(puede('analista', accion, { ...LLEGO, mismaAseguradora: true }), true, accion);
    assert.equal(motivo('analista', accion, { ...LLEGO, mismaAseguradora: false }), 'Ese reclamo es de otra aseguradora.', accion);
  }
  assert.equal(puede('analista', 'asignar', { ...LLEGO, mismaAseguradora: true, rolObjetivo: 'analista', objetivoActivo: true, objetivoDeLaAseguradora: true }), false);
  assert.equal(puede('analista', 'ver_bitacora', { ...LLEGO, mismaAseguradora: true }), false);
  assert.equal(puede('analista', 'crear_miembro', { mismaAseguradora: true, rolObjetivo: 'analista' }), false);
});

test('a la aseguradora no le llega un reclamo a medio subir; a Joan sí, para dar soporte', () => {
  const subiendo = { estado: 'subiendo', mismaAseguradora: true, asignado: true };
  for (const rol of ['analista', 'jefe', 'abogado_aseguradora']) {
    assert.equal(motivo(rol, 'ver_estado', subiendo), 'Ese reclamo todavía se está subiendo.', rol);
  }
  assert.equal(puede('super_admin', 'ver_estado', subiendo), true);
  assert.equal(puede('super_admin', 'abrir_reclamo', subiendo), true);
  // Pero nadie le cambia el estado: «recibido» solo lo pone el servidor al verificar las fotos.
  assert.equal(puede('super_admin', 'cambiar_estado', subiendo), false);
});

test('el jefe de siniestros arma su equipo y asigna; otro jefe lo crea Joan', () => {
  const asignable = { ...LLEGO, mismaAseguradora: true, rolObjetivo: 'abogado_aseguradora', objetivoActivo: true, objetivoDeLaAseguradora: true };
  assert.equal(puede('jefe', 'asignar', asignable), true);
  assert.equal(puede('jefe', 'asignar', { ...asignable, objetivoActivo: false }), false);
  assert.equal(puede('jefe', 'asignar', { ...asignable, objetivoDeLaAseguradora: false }), false);
  assert.equal(puede('jefe', 'asignar', { ...asignable, rolObjetivo: 'jefe' }), false);
  assert.equal(puede('jefe', 'asignar', { ...asignable, mismaAseguradora: false }), false);

  assert.equal(puede('jefe', 'crear_miembro', { mismaAseguradora: true, rolObjetivo: 'analista' }), true);
  assert.equal(puede('jefe', 'crear_miembro', { mismaAseguradora: true, rolObjetivo: 'abogado_aseguradora' }), true);
  assert.equal(motivo('jefe', 'crear_miembro', { mismaAseguradora: true, rolObjetivo: 'jefe' }), 'El jefe crea analistas y abogados; otro jefe lo crea Choque Claro.');
  assert.equal(puede('jefe', 'crear_miembro', { mismaAseguradora: false, rolObjetivo: 'analista' }), false);
  assert.equal(puede('super_admin', 'crear_miembro', { rolObjetivo: 'jefe' }), true);
  assert.equal(puede('super_admin', 'crear_miembro', { rolObjetivo: 'super_admin' }), false);

  assert.equal(puede('jefe', 'ver_bitacora', { ...LLEGO, mismaAseguradora: true }), true);
  assert.equal(puede('jefe', 'ver_equipo', { mismaAseguradora: true }), true);
  assert.equal(puede('jefe', 'ver_equipo', { mismaAseguradora: false }), false);
});

test('nadie apaga su propia cuenta, y el jefe solo apaga a su equipo', () => {
  assert.equal(motivo('super_admin', 'apagar_miembro', { esUnoMismo: true, rolObjetivo: 'super_admin' }), 'No puedes apagar tu propia cuenta.');
  assert.equal(motivo('jefe', 'apagar_miembro', { esUnoMismo: true, mismaAseguradora: true, rolObjetivo: 'jefe' }), 'No puedes apagar tu propia cuenta.');
  assert.equal(puede('jefe', 'apagar_miembro', { mismaAseguradora: true, rolObjetivo: 'analista' }), true);
  assert.equal(puede('jefe', 'apagar_miembro', { mismaAseguradora: true, rolObjetivo: 'jefe' }), false);
  assert.equal(puede('jefe', 'apagar_miembro', { mismaAseguradora: false, rolObjetivo: 'analista' }), false);
  assert.equal(puede('super_admin', 'apagar_miembro', { rolObjetivo: 'jefe' }), true);
});

test('el abogado de la aseguradora solo ve y anota lo que le asignan', () => {
  assert.equal(puede('abogado_aseguradora', 'abrir_reclamo', { ...LLEGO, mismaAseguradora: true, asignado: true }), true);
  assert.equal(motivo('abogado_aseguradora', 'abrir_reclamo', { ...LLEGO, mismaAseguradora: true, asignado: false }), 'Solo ves los reclamos que te asignaron.');
  assert.equal(puede('abogado_aseguradora', 'escribir_nota', { ...LLEGO, asignado: true }), true);
  assert.equal(puede('abogado_aseguradora', 'cambiar_estado', { ...LLEGO, mismaAseguradora: true, asignado: true }), false);
});

test('el abogado del conductor entra solo con un enlace vigente, y solo a mirar', () => {
  assert.equal(puede('abogado_conductor', 'abrir_reclamo', { enlaceVigente: true }), true);
  assert.equal(motivo('abogado_conductor', 'abrir_reclamo', { enlaceVigente: false }), 'Ese enlace no existe, venció o el conductor lo quitó.');
  for (const accion of ['cambiar_estado', 'escribir_nota', 'asignar', 'ver_bitacora', 'crear_enlace', 'ver_equipo']) {
    assert.equal(puede('abogado_conductor', accion, { ...LLEGO, enlaceVigente: true }), false, accion);
  }
});

test('Joan ve y hace todo lo del equipo, y es el único que da de alta aseguradoras', () => {
  for (const accion of ['ver_estado', 'abrir_reclamo', 'cambiar_estado', 'escribir_nota', 'ver_bitacora', 'ver_equipo']) {
    assert.equal(puede('super_admin', accion, LLEGO), true, accion);
  }
  assert.equal(puede('super_admin', 'crear_aseguradora'), true);
  for (const rol of ['conductor', 'analista', 'jefe', 'abogado_aseguradora', 'abogado_conductor']) {
    assert.equal(puede(rol, 'crear_aseguradora'), false, rol);
  }
  // Joan no envía reclamos con su cuenta: se envían desde el teléfono del conductor.
  assert.equal(puede('super_admin', 'enviar_reclamo', { aseguradoraActiva: true }), false);
});

test('una cuenta apagada pierde todo menos ver su propia fila', () => {
  for (const accion of Object.keys(ACCIONES)) {
    assert.equal(puede(null, accion, { ...LLEGO, mismaAseguradora: true, asignado: true, esSuyo: true }), false, accion);
  }
  assert.equal(motivo(null, 'abrir_reclamo', LLEGO), 'Tu cuenta está apagada.');
  assert.equal(puede(null, 'ver_equipo', { esUnoMismo: true }), true);
});

test('los roles de la base y los de la pantalla se traducen ida y vuelta', () => {
  assert.equal(rolDeMiembro('abogado'), 'abogado_aseguradora');
  assert.equal(rolDeMiembro('super_admin'), 'super_admin');
  assert.equal(rolDeMiembro('conductor'), null);
  for (const r of ['super_admin', 'jefe', 'analista', 'abogado']) assert.equal(rolParaLaBase(rolDeMiembro(r)), r);
  assert.equal(rolParaLaBase('conductor'), null);
  assert.equal(Object.keys(ROLES).length, 6);
});

test('una acción o un rol mal escrito revienta en vez de decir que no', () => {
  // Un «no» silencioso por un error de dedo escondería un botón que debía salir.
  assert.throws(() => puede('jefe', 'borrar_todo'), /Acción desconocida/);
  assert.throws(() => puede('gerente', 'ver_estado', LLEGO), /Rol desconocido/);
});
