// La base de los roles (supabase/migrations/20261114150000_fase2_roles.sql), corrida de verdad
// en Postgres dentro de Node (PGlite: sin servidor, sin ventanas, sin red) y comparada caso por
// caso con la tabla de js/permisos.js.
//
// Por qué así: el RLS es justo lo que una prueba de JavaScript no ve. Una política con un
// «or» de más deja ver los reclamos de otra aseguradora y todo lo demás sigue verde. Aquí cada
// persona de prueba intenta cada acción sobre cada reclamo, y lo que la base deja hacer tiene
// que ser exactamente lo que dice la tabla.
//
// Cuenta como «no» SOLO el 42501 (permiso negado) o una consulta que vuelve vacía. Cualquier
// otro error es un defecto de la migración y la prueba lo muestra: si no, una función rota se
// leería como «no tiene permiso» y coincidiría con un «no» de la tabla.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { ACCIONES, puede, rolDeMiembro } from '../js/permisos.js';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const SUPABASE = leer('./supabase-de-mentira.sql');
const MIGRACION = leer('../supabase/migrations/20261114150000_fase2_roles.sql');
const sha = (texto) => createHash('sha256').update(texto, 'utf8').digest('hex');

// ---------------------------------------------------------------------------------------------
// El mundo de prueba, escrito como datos: de aquí salen las filas de la base Y el contexto que
// se le pasa a permisos.js. Así las dos partes miran exactamente lo mismo.
// ---------------------------------------------------------------------------------------------

const ASEGURADORAS = {
  X: { codigo: 'seguros-x', activa: true },
  Y: { codigo: 'seguros-y', activa: true },
  Z: { codigo: 'seguros-z', activa: false }, // un piloto que terminó
};

const PERSONAS = {
  joan: { base: 'super_admin', aseg: null },
  jefeX: { base: 'jefe', aseg: 'X' },
  analistaX: { base: 'analista', aseg: 'X' },
  abogadoX: { base: 'abogado', aseg: 'X' },
  apagadoX: { base: 'analista', aseg: 'X', apagado: true },
  jefeY: { base: 'jefe', aseg: 'Y' },
  abogadoY: { base: 'abogado', aseg: 'Y' },
  jefeZ: { base: 'jefe', aseg: 'Z' }, // su aseguradora está apagada
  conductor1: { base: null },
  conductor2: { base: null },
  conductor3: { base: null },
};
const MIEMBROS = Object.keys(PERSONAS).filter((p) => PERSONAS[p].base);

const RECLAMOS = {
  x1: { aseg: 'X', conductor: 'conductor1', estado: 'recibido' },
  x2: { aseg: 'X', conductor: 'conductor1', estado: 'subiendo' },
  x3: { aseg: 'X', conductor: 'conductor2', estado: 'en_revision' },
  y1: { aseg: 'Y', conductor: 'conductor2', estado: 'cerrado' },
  z1: { aseg: 'Z', conductor: 'conductor3', estado: 'recibido' },
};

const ASIGNACIONES = [['x1', 'abogadoX'], ['x3', 'analistaX'], ['y1', 'abogadoY']];

const ENLACES = {
  'enlace-vigente-de-x1-000000000000': { reclamo: 'x1', vigente: true },
  'enlace-vencido-de-x1-000000000000': { reclamo: 'x1', vencido: true },
  'enlace-quitado-de-x1-000000000000': { reclamo: 'x1', quitado: true },
  'enlace-vigente-de-y1-000000000000': { reclamo: 'y1', vigente: true },
  'enlace-que-nadie-creo-00000000000': { reclamo: null },
};

const ids = { aseg: {}, persona: {}, reclamo: {}, nuevo: randomUUID() };
for (const k of Object.keys(ASEGURADORAS)) ids.aseg[k] = randomUUID();
for (const k of Object.keys(PERSONAS)) ids.persona[k] = randomUUID();
for (const k of Object.keys(RECLAMOS)) ids.reclamo[k] = randomUUID();

const numeroDe = (k) => `CC-261114-${sha(k).slice(0, 6).toUpperCase()}`;

function rolDe(p) {
  if (p === 'anon') return 'abogado_conductor';
  const persona = PERSONAS[p];
  if (!persona.base) return 'conductor';
  if (persona.apagado) return null;
  if (persona.aseg && !ASEGURADORAS[persona.aseg].activa) return null;
  return rolDeMiembro(persona.base);
}

function ctxDeReclamo(p, r) {
  const persona = PERSONAS[p] ?? {};
  const reclamo = RECLAMOS[r];
  return {
    estado: reclamo.estado,
    mismaAseguradora: persona.aseg != null && persona.aseg === reclamo.aseg,
    asignado: ASIGNACIONES.some(([rr, pp]) => rr === r && pp === p),
    esSuyo: reclamo.conductor === p,
    enlaceVigente: false,
  };
}

// ---------------------------------------------------------------------------------------------
// La base
// ---------------------------------------------------------------------------------------------

let db;

async function sembrar(base) {
  for (const [k, a] of Object.entries(ASEGURADORAS)) {
    await base.query('insert into public.aseguradoras (id, nombre, codigo, activa) values ($1, $2, $3, $4)',
      [ids.aseg[k], `Seguros ${k}`, a.codigo, a.activa]);
  }
  await base.query('insert into auth.users (id) values ($1)', [ids.nuevo]);
  for (const [k, p] of Object.entries(PERSONAS)) {
    await base.query('insert into auth.users (id, is_anonymous) values ($1, $2)', [ids.persona[k], !p.base]);
    if (p.base) {
      await base.query('insert into public.miembros (user_id, aseguradora_id, rol, nombre, activo) values ($1, $2, $3, $4, $5)',
        [ids.persona[k], p.aseg ? ids.aseg[p.aseg] : null, p.base, k, !p.apagado]);
    }
  }
  for (const [k, r] of Object.entries(RECLAMOS)) {
    await base.query(`insert into public.reclamos (id, numero, aseguradora_id, conductor_id, sello, ultima_huella, lugar, declarado, fotos_esperadas, estado, recibido_en)
      values ($1, $2, $3, $4, $5, $6, $7, $8, 2, $9, case when $9 = 'subiendo' then null else now() end)`,
      [ids.reclamo[k], numeroDe(k), ids.aseg[r.aseg], ids.persona[r.conductor], sha(`${k}-sello`), sha(`${k}-ultima`), `Lugar ${k}`, `{"reclamo":"${k}"}`, r.estado]);
    for (const orden of [0, 1]) {
      await base.query('insert into public.reclamo_fotos (reclamo_id, orden, huella, verificada) values ($1, $2, $3, $4)',
        [ids.reclamo[k], orden, sha(`${k}-${orden}`), r.estado !== 'subiendo']);
    }
    // Una fila de bitácora por reclamo, para que «ver la bitácora» tenga algo que ver.
    await base.query(`insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion) values ($1, $2, null, 'prueba', 'abrio')`,
      [ids.reclamo[k], ids.aseg[r.aseg]]);
  }
  for (const [r, p] of ASIGNACIONES) {
    await base.query('insert into public.asignaciones (reclamo_id, user_id, asignado_por) values ($1, $2, $3)',
      [ids.reclamo[r], ids.persona[p], ids.persona.joan]);
  }
  for (const [token, e] of Object.entries(ENLACES)) {
    if (!e.reclamo) continue;
    await base.query(`insert into public.enlaces_abogado (reclamo_id, token_hash, creado, vence, revocado)
      values ($1, $2, now() - interval '31 days' * $3::int, now() + case when $3::int = 1 then interval '-1 day' else interval '29 days' end, case when $4 then now() end)`,
      [ids.reclamo[e.reclamo], sha(token), e.vencido ? 1 : 0, !!e.quitado]);
  }
}

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE);
  await db.exec(MIGRACION);
  await db.exec(MIGRACION); // idempotente: la base real y el repo se desincronizan
  await sembrar(db);
});

after(async () => { await db?.close(); });

// Ponerse en los zapatos de alguien dentro de una transacción que siempre se deshace: cada caso
// arranca del mismo mundo, sin lo que dejó el anterior.
async function ser(quien) {
  if (quien === 'anon' || quien === 'servidor') {
    await db.query("select set_config('request.jwt.claims', '', true)");
    await db.exec(`set local role ${quien === 'anon' ? 'anon' : 'service_role'}`);
    return;
  }
  if (quien === 'dueño') { await db.exec('reset role'); return; }
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ids.persona[quien], role: 'authenticated' })]);
  await db.exec('set local role authenticated');
}

async function como(quien, fn) {
  await db.exec('begin');
  try {
    await ser(quien);
    return await fn();
  } finally {
    await db.exec('rollback');
  }
}

// Con savepoint: un error esperado aborta la transacción entera, y el paso siguiente del mismo
// caso saldría con 25P02 en vez de decir lo que de verdad hace la base.
async function intentar(sql, params = []) {
  await db.exec('savepoint intento');
  try {
    const r = await db.query(sql, params);
    await db.exec('release savepoint intento');
    return { ok: true, filas: r.rows };
  } catch (e) {
    await db.exec('rollback to savepoint intento');
    return { ok: false, codigo: e.code, mensaje: e.message };
  }
}

// Lo que dice la base: true (sí), false (no: 42501 o vacío) o un texto con el error inesperado.
async function dice(quien, sql, params, forma) {
  return como(quien, async () => {
    const r = await intentar(sql, params);
    if (!r.ok) return r.codigo === '42501' ? false : `error ${r.codigo}: ${r.mensaje}`;
    return forma === 'fila' ? r.filas.length > 0 : true;
  });
}

// ---------------------------------------------------------------------------------------------
// La comparación grande
// ---------------------------------------------------------------------------------------------

const otroEstado = (r) => (RECLAMOS[r].estado === 'cerrado' ? 'en_revision' : 'cerrado');

const SOBRE_UN_RECLAMO = {
  ver_estado: (r) => ['select id from public.reclamos where id = $1', [ids.reclamo[r]], 'fila'],
  abrir_reclamo: (r) => ['select public.abrir_reclamo($1)', [ids.reclamo[r]], 'ok'],
  cambiar_estado: (r) => ['select public.cambiar_estado($1, $2)', [ids.reclamo[r], otroEstado(r)], 'ok'],
  escribir_nota: (r) => ['select public.agregar_nota($1, $2)', [ids.reclamo[r], 'Llamé al conductor.'], 'ok'],
  ver_bitacora: (r) => ['select id from public.bitacora where reclamo_id = $1', [ids.reclamo[r]], 'fila'],
  crear_enlace: (r) => ['select public.crear_enlace_abogado($1, $2, 30)', [ids.reclamo[r], sha(`nuevo-${r}`)], 'ok'],
};

const ACTORES = [...Object.keys(PERSONAS), 'anon'];
const OBJETIVOS_DE_ASIGNAR = ['analistaX', 'abogadoX', 'apagadoX', 'abogadoY', 'jefeX'];
const PARA_CREAR = [['X', 'analista'], ['X', 'abogado'], ['X', 'jefe'], ['Y', 'analista'], ['Z', 'analista'], [null, 'super_admin']];
const CODIGOS = ['seguros-x', 'seguros-z', 'no-existe'];

async function casos() {
  const lista = [];
  const agregar = (actor, accion, ctx, que, args) => lista.push({ actor, accion, ctx, que, args });

  for (const actor of ACTORES) {
    for (const r of Object.keys(RECLAMOS)) {
      for (const [accion, armar] of Object.entries(SOBRE_UN_RECLAMO)) {
        agregar(actor, accion, ctxDeReclamo(actor, r), r, armar(r));
      }
      for (const o of OBJETIVOS_DE_ASIGNAR) {
        const objetivo = PERSONAS[o];
        agregar(actor, 'asignar', {
          ...ctxDeReclamo(actor, r),
          rolObjetivo: rolDeMiembro(objetivo.base),
          objetivoActivo: !objetivo.apagado,
          objetivoDeLaAseguradora: objetivo.aseg === RECLAMOS[r].aseg,
        }, `${r} → ${o}`, ['select public.asignar($1, $2)', [ids.reclamo[r], ids.persona[o]], 'ok']);
      }
    }
    for (const o of MIEMBROS) {
      const ctx = {
        esUnoMismo: actor === o,
        mismaAseguradora: PERSONAS[actor]?.aseg != null && PERSONAS[actor].aseg === PERSONAS[o].aseg,
        rolObjetivo: rolDeMiembro(PERSONAS[o].base),
      };
      agregar(actor, 'ver_equipo', ctx, o, ['select user_id from public.miembros where user_id = $1', [ids.persona[o]], 'fila']);
      agregar(actor, 'apagar_miembro', ctx, o, ['select public.apagar_miembro($1, false)', [ids.persona[o]], 'ok']);
    }
    for (const codigo of CODIGOS) {
      agregar(actor, 'enviar_reclamo', { aseguradoraActiva: codigo === 'seguros-x' }, codigo, [
        'select public.crear_reclamo($1, $2, $3, $4, $5, $6, $7::text[])',
        [codigo, 'CC-261114-ABCDEF', sha('s'), sha('u'), 'Los Verjones', '{"a":1}', [sha('f0'), sha('f1')]], 'ok']);
    }
    agregar(actor, 'crear_aseguradora', {}, '', ["select public.crear_aseguradora('Seguros Nuevos', 'seguros-nuevos')", [], 'ok']);
  }

  // El abogado del conductor entra con el token, sin sesión.
  for (const [token, e] of Object.entries(ENLACES)) {
    for (const accion of ['ver_estado', 'abrir_reclamo']) {
      agregar('anon', accion, { enlaceVigente: !!e.vigente }, token, ['select public.abrir_enlace($1)', [token], 'ok']);
    }
  }

  // Crear cuentas lo hace el servidor con la clave de servicio, en nombre de quien lo pide.
  for (const actor of Object.keys(PERSONAS)) {
    for (const [aseg, rol] of PARA_CREAR) {
      lista.push({
        actor, accion: 'crear_miembro', que: `${rol} en ${aseg ?? 'ninguna'}`, quien: 'servidor',
        ctx: { mismaAseguradora: PERSONAS[actor].aseg != null && PERSONAS[actor].aseg === aseg, rolObjetivo: rolDeMiembro(rol) },
        args: ['select public.registrar_miembro($1, $2, $3, $4, $5)',
          [ids.persona[actor], ids.nuevo, aseg ? ids.aseg[aseg] : null, rol, 'Persona Nueva'], 'ok'],
      });
    }
  }
  return lista;
}

test('cada persona, cada acción, cada reclamo: la base hace exactamente lo que dice permisos.js', async () => {
  const diferencias = [];
  const vistos = Object.fromEntries(Object.keys(ACCIONES).map((a) => [a, { si: 0, no: 0 }]));
  const lista = await casos();
  for (const c of lista) {
    const espera = puede(rolDe(c.actor), c.accion, c.ctx);
    const [sql, params, forma] = c.args;
    const real = await dice(c.quien ?? c.actor, sql, params, forma);
    vistos[c.accion][espera ? 'si' : 'no'] += 1;
    if (real !== espera) {
      diferencias.push(`${c.actor} · ${c.accion} · ${c.que}: la tabla dice ${espera ? 'sí' : 'no'}, la base ${typeof real === 'string' ? real : real ? 'sí' : 'no'}`);
    }
  }
  assert.deepEqual(diferencias, [], `\n${diferencias.join('\n')}`);
  // Que la prueba no sea de mentira: cada acción se probó con casos de sí y de no.
  for (const [accion, n] of Object.entries(vistos)) {
    assert.ok(n.si > 0 && n.no > 0, `${accion}: ${n.si} de sí y ${n.no} de no`);
  }
  assert.ok(lista.length > 600, `solo ${lista.length} casos`);
});

// ---------------------------------------------------------------------------------------------
// Lo que la tabla no alcanza a decir
// ---------------------------------------------------------------------------------------------

test('la migración quedó bien puesta: la consulta de verificación de su pie da las seis en true', async () => {
  const consulta = MIGRACION.split('-- Verificar que se aplicó')[1].split('-- Las seis en true.')[0]
    .split('\n').filter((l) => l.startsWith('--   ')).map((l) => l.slice(4)).join('\n');
  const { rows } = await db.query(consulta);
  assert.deepEqual(Object.values(rows[0]), [true, true, true, true, true, true], JSON.stringify(rows[0]));
});

test('el Supabase de mentira sí abre las tablas nuevas como el de verdad (si no, lo de abajo no prueba nada)', async () => {
  await como('dueño', async () => {
    await db.exec('create table public.cualquiera (id int)');
    const { rows } = await db.query("select has_table_privilege('anon', 'public.cualquiera', 'select') as abierta");
    assert.equal(rows[0].abierta, true);
  });
});

test('sin sesión solo se pueden llamar dos funciones: el nombre de la aseguradora y el enlace del abogado', async () => {
  const { rows } = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
  assert.deepEqual(rows.map((r) => r.proname), ['abrir_enlace', 'aseguradora_por_codigo']);
  const internas = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('contenido_del_reclamo', 'revisar_asignacion', 'permiso_crear_miembro', 'registrar_miembro', 'marcar_recibido')
      and has_function_privilege('authenticated', p.oid, 'execute')`);
  assert.deepEqual(internas.rows, [], 'una función interna quedó abierta a cualquier sesión');
});

test('lo declarado y el conductor no salen por un select: solo por abrir_reclamo, que deja rastro', async () => {
  await como('analistaX', async () => {
    for (const columna of ['declarado', 'conductor_id', 'sello']) {
      const r = await intentar(`select ${columna} from public.reclamos where id = $1`, [ids.reclamo.x1]);
      assert.equal(r.codigo, '42501', columna);
    }
  });
  await como('analistaX', async () => {
    const { rows } = await db.query('select public.abrir_reclamo($1) as c', [ids.reclamo.x1]);
    // Tal cual se guardó, byte por byte: si la base lo reordenara, la huella no coincidiría.
    assert.equal(rows[0].c.declarado, '{"reclamo":"x1"}');
    assert.equal(rows[0].c.fotos.length, 2);
    await ser('dueño');
    const rastro = await db.query(`select rol, accion from public.bitacora where reclamo_id = $1 and actor = $2`, [ids.reclamo.x1, ids.persona.analistaX]);
    assert.deepEqual(rastro.rows, [{ rol: 'analista', accion: 'abrio' }]);
  });
});

test('cuando Joan abre un reclamo, el jefe de esa aseguradora lo ve en su bitácora', async () => {
  await como('joan', async () => {
    await db.query('select public.abrir_reclamo($1)', [ids.reclamo.x1]);
    await ser('jefeX');
    const { rows } = await db.query('select rol, accion, actor from public.bitacora where reclamo_id = $1 and rol = $2', [ids.reclamo.x1, 'super_admin']);
    assert.deepEqual(rows, [{ rol: 'super_admin', accion: 'abrio', actor: ids.persona.joan }]);
    // El conductor también ve que se abrió, pero no el detalle.
    await ser('conductor1');
    const suyo = await db.query("select rol from public.bitacora where reclamo_id = $1 and rol = 'super_admin'", [ids.reclamo.x1]);
    assert.equal(suyo.rows.length, 1);
    assert.equal((await intentar('select detalle from public.bitacora')).codigo, '42501');
  });
});

test('nadie cambia nada por fuera de las funciones: ni la bitácora, ni el estado, ni una nota', async () => {
  const intentos = [
    ['jefeX', 'insert into public.bitacora (reclamo_id, aseguradora_id, rol, accion) values ($1, $2, $3, $4)', [ids.reclamo.x1, ids.aseg.X, 'jefe', 'abrio']],
    ['jefeX', "update public.reclamos set estado = 'cerrado' where id = $1", [ids.reclamo.x1]],
    ['joan', 'delete from public.bitacora where reclamo_id = $1', [ids.reclamo.x1]],
    ['analistaX', 'delete from public.notas', []],
    ['jefeX', "update public.miembros set rol = 'jefe' where user_id = $1", [ids.persona.analistaX]],
    ['conductor1', "update public.reclamo_fotos set verificada = true where reclamo_id = $1", [ids.reclamo.x2]],
    ['conductor1', 'insert into public.reclamos (numero, aseguradora_id, conductor_id, sello, ultima_huella, declarado, fotos_esperadas) values ($1, $2, $3, $4, $4, $5, 1)',
      ['CC-261114-AAAAAA', ids.aseg.X, ids.persona.conductor1, sha('x'), '{}']],
  ];
  for (const [quien, sql, params] of intentos) {
    const r = await como(quien, () => intentar(sql, params));
    assert.equal(r.codigo, '42501', `${quien}: ${sql}`);
  }
});

test('las fotos: el conductor sube solo lo que declaró, y el equipo las baja solo después de abrir', async () => {
  await como('conductor1', async () => {
    const { rows } = await db.query('select public.crear_reclamo($1, $2, $3, $4, $5, $6, $7::text[]) as id',
      ['seguros-x', 'CC-261114-B0B0B0', sha('s'), sha('u'), 'Calle 80', '{"n":1}', [sha('a'), sha('b')]]);
    const id = rows[0].id;
    const subir = (nombre) => intentar("insert into storage.objects (bucket_id, name) values ('reclamos', $1)", [nombre]);
    assert.equal((await subir(`${id}/0.jpg`)).ok, true, 'la foto declarada sube');
    assert.equal((await subir(`${id}/2.jpg`)).codigo, '42501', 'una foto que no declaró no sube');
    assert.equal((await subir(`${ids.reclamo.x1}/0.jpg`)).codigo, '42501', 'a un reclamo que ya llegó no se le agregan fotos');

    await ser('conductor2');
    assert.equal((await subir(`${id}/1.jpg`)).codigo, '42501', 'otro teléfono no sube a mi reclamo');

    await ser('servidor');
    const parcial = await db.query('select public.marcar_recibido($1, $2::int[]) as listo', [id, [0]]);
    assert.equal(parcial.rows[0].listo, false, 'con una foto sin verificar no queda recibido');
    const completo = await db.query('select public.marcar_recibido($1, $2::int[]) as listo', [id, [1]]);
    assert.equal(completo.rows[0].listo, true);
    const { rows: [r] } = await db.query('select estado, recibido_en from public.reclamos where id = $1', [id]);
    assert.equal(r.estado, 'recibido');
    assert.ok(r.recibido_en instanceof Date, 'la hora la pone el servidor');

    await ser('conductor1');
    assert.equal((await subir(`${id}/1.jpg`)).codigo, '42501', 'después de recibido ya no se sube nada');
  });

  await como('dueño', async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('reclamos', $1), ('reclamos', 'basura.jpg')", [`${ids.reclamo.x1}/0.jpg`]);
    await ser('analistaX');
    const ver = () => db.query("select name from storage.objects where bucket_id = 'reclamos'");
    assert.deepEqual((await ver()).rows, [], 'sin abrir el reclamo no se ve ninguna foto');
    await db.query('select public.abrir_reclamo($1)', [ids.reclamo.x1]);
    assert.deepEqual((await ver()).rows.map((f) => f.name), [`${ids.reclamo.x1}/0.jpg`], 'después de abrir, sí; y un nombre raro no revienta');
    await ser('jefeY');
    assert.deepEqual((await ver()).rows, [], 'otra aseguradora no la ve');
    await ser('anon');
    assert.equal((await intentar("select name from storage.objects where bucket_id = 'reclamos'")).ok, true);
    assert.deepEqual((await ver()).rows, [], 'sin sesión no se ve nada');
  });

  await como('servidor', async () => {
    assert.equal((await db.query('select public.marcar_recibido($1, $2::int[]) as listo', [randomUUID(), [0]])).rows[0].listo, false,
      'un reclamo sin fotos nunca queda recibido');
  });
  await como('conductor1', async () => {
    assert.equal((await intentar('select public.marcar_recibido($1, $2::int[])', [ids.reclamo.x2, [0, 1]])).codigo, '42501',
      'el teléfono no puede marcar sus propias fotos como verificadas');
  });
});

test('reenviar con el mismo número devuelve el mismo reclamo; otro teléfono con ese número, no', async () => {
  const args = ['seguros-x', 'CC-261114-C0C0C0', sha('s'), sha('u'), '', '{}', [sha('a')]];
  const sql = 'select public.crear_reclamo($1, $2, $3, $4, $5, $6, $7::text[]) as id';
  await como('conductor1', async () => {
    const a = (await db.query(sql, args)).rows[0].id;
    const b = (await db.query(sql, args)).rows[0].id;
    assert.equal(a, b);
    await ser('conductor2');
    assert.equal((await intentar(sql, args)).codigo, '23505');
  });
});

test('un teléfono envía hasta 10 reclamos al día, para que nadie llene la bandeja de una aseguradora', async () => {
  await como('conductor3', async () => {
    const sql = 'select public.crear_reclamo($1, $2, $3, $4, $5, $6, $7::text[])';
    let enviados = 1; // z1, de hoy
    let tope = null;
    for (let i = 0; i < 12 && !tope; i++) {
      const r = await intentar(sql, ['seguros-x', `CC-261114-D${String(i).padStart(5, '0')}`, sha('s'), sha('u'), '', '{}', [sha(`d${i}`)]]);
      if (r.ok) enviados += 1;
      else tope = r;
    }
    assert.equal(enviados, 10);
    assert.equal(tope.codigo, '53400');
    // «24 horas» y no «hoy»: la cuenta es corrida, y la pantalla no puede decir otra cosa.
    assert.match(tope.mensaje, /10 reclamos en las últimas 24 horas/);
  });
});

test('el enlace del abogado: solo el dueño lo crea y lo quita, dura máximo 30 días y no muestra las notas', async () => {
  const token = 'token-que-genero-el-telefono-1234567890';
  await como('analistaX', async () => {
    await db.query('select public.agregar_nota($1, $2)', [ids.reclamo.x1, 'Nota interna de la aseguradora.']);
    await ser('conductor1');
    assert.equal((await intentar('select id from public.notas')).filas.length, 0, 'el conductor no ve las notas internas');
    assert.equal((await intentar('select public.crear_enlace_abogado($1, $2, 31)', [ids.reclamo.x1, sha(token)])).codigo, '22023');
    const enlace = (await db.query('select public.crear_enlace_abogado($1, $2, 30) as id', [ids.reclamo.x1, sha(token)])).rows[0].id;

    await ser('anon');
    const { rows } = await db.query('select public.abrir_enlace($1) as c', [token]);
    assert.equal(rows[0].c.numero, numeroDe('x1'));
    assert.equal(rows[0].c.notas, null, 'las notas internas no salen por el enlace');
    assert.equal((await intentar('select public.abrir_reclamo($1)', [ids.reclamo.x1])).codigo, '42501');

    await ser('dueño');
    const rastro = await db.query("select actor, rol from public.bitacora where reclamo_id = $1 and accion = 'abrio_enlace'", [ids.reclamo.x1]);
    assert.deepEqual(rastro.rows, [{ actor: null, rol: 'abogado_conductor' }]);

    await ser('conductor2');
    assert.equal((await intentar('select public.quitar_enlace_abogado($1)', [enlace])).codigo, '42501', 'otro no lo quita');
    await ser('conductor1');
    await db.query('select public.quitar_enlace_abogado($1)', [enlace]);
    await ser('anon');
    assert.equal((await intentar('select public.abrir_enlace($1)', [token])).codigo, '42501', 'quitado, ya no abre');
  });
});

test('quitar una asignación deja rastro y le cierra el reclamo al abogado', async () => {
  await como('jefeX', async () => {
    await db.query('select public.quitar_asignacion($1, $2)', [ids.reclamo.x1, ids.persona.abogadoX]);
    const { rows } = await db.query("select accion from public.bitacora where reclamo_id = $1 and accion = 'quito_asignacion'", [ids.reclamo.x1]);
    assert.equal(rows.length, 1);
    await ser('abogadoX');
    assert.equal((await intentar('select public.abrir_reclamo($1)', [ids.reclamo.x1])).codigo, '42501');
  });
});

test('apagar a alguien le quita todo de una vez, y encenderlo se lo devuelve', async () => {
  await como('jefeX', async () => {
    await db.query('select public.apagar_miembro($1, false)', [ids.persona.analistaX]);
    await ser('analistaX');
    assert.equal((await db.query('select id from public.reclamos')).rows.length, 0);
    assert.equal((await intentar('select public.abrir_reclamo($1)', [ids.reclamo.x1])).codigo, '42501');
    const yo = await db.query('select activo from public.miembros where user_id = $1', [ids.persona.analistaX]);
    assert.deepEqual(yo.rows, [{ activo: false }], 've su propia cuenta, apagada, para que la pantalla se lo diga');
    await ser('jefeX');
    await db.query('select public.apagar_miembro($1, true)', [ids.persona.analistaX]);
    await ser('analistaX');
    assert.ok((await db.query('select id from public.reclamos')).rows.length > 0);
  });
});

test('reenviar el mismo reclamo a OTRA aseguradora no devuelve el viejo en silencio', async () => {
  const args = (codigo) => [codigo, 'CC-261114-E0E0E0', sha('s'), sha('u'), '', '{}', [sha('a')]];
  const sql = 'select public.crear_reclamo($1, $2, $3, $4, $5, $6, $7::text[]) as id';
  await como('conductor1', async () => {
    await db.query(sql, args('seguros-x'));
    const r = await intentar(sql, args('seguros-y'));
    assert.equal(r.codigo, '23505');
    assert.equal(r.mensaje, 'Este reclamo ya se envió a otra aseguradora.');
  });
});

test('las visitas del abogado del conductor las ven el conductor y Joan, no la aseguradora', async () => {
  const visitas = "select id from public.bitacora where reclamo_id = $1 and accion = 'abrio_enlace'";
  await como('anon', async () => {
    await db.query('select public.abrir_enlace($1)', ['enlace-vigente-de-x1-000000000000']);
    for (const [quien, cuantas] of [['jefeX', 0], ['analistaX', 0], ['conductor1', 1], ['joan', 1]]) {
      await ser(quien);
      assert.equal((await db.query(visitas, [ids.reclamo.x1])).rows.length, cuantas, quien);
    }
    // El resto de la bitácora el jefe la sigue viendo.
    await ser('jefeX');
    assert.ok((await db.query('select id from public.bitacora where reclamo_id = $1', [ids.reclamo.x1])).rows.length > 0);
  });
});

test('ningún error en inglés llega a la pantalla: lo que se escribe mal contesta en español', async () => {
  const enIngles = /violates|constraint|null value|invalid input|duplicate key|permission denied/i;
  const reclamo = (cambios) => {
    const base = { codigo: 'seguros-x', numero: 'CC-261114-F0F0F0', sello: sha('s'), ultima: sha('u'), lugar: '', declarado: '{}', huellas: [sha('a')] };
    const a = { ...base, ...cambios };
    return ['select public.crear_reclamo($1, $2, $3, $4, $5, $6, $7::text[])', [a.codigo, a.numero, a.sello, a.ultima, a.lugar, a.declarado, a.huellas]];
  };
  const casos = [
    ['conductor1', ...reclamo({ numero: 'CC-2611-XYZ' })],
    ['conductor1', ...reclamo({ sello: 'no-es-un-sha' })],
    ['conductor1', ...reclamo({ declarado: '' })],
    ['conductor1', ...reclamo({ lugar: 'x'.repeat(121) })],
    ['conductor1', ...reclamo({ huellas: [] })],
    ['conductor1', ...reclamo({ huellas: ['corta'] })],
    ['conductor1', 'select public.crear_enlace_abogado($1, $2, 30)', [ids.reclamo.x1, 'no-es-un-sha']],
    ['conductor1', 'select public.crear_enlace_abogado($1, $2, 30)', [ids.reclamo.x1, sha('enlace-vigente-de-x1-000000000000')]],
    ['analistaX', 'select public.agregar_nota($1, $2)', [ids.reclamo.x1, '   ']],
    ['analistaX', 'select public.agregar_nota($1, $2)', [ids.reclamo.x1, 'x'.repeat(4001)]],
    ['analistaX', 'select public.cambiar_estado($1, $2)', [ids.reclamo.x1, 'subiendo']],
    ['joan', 'select public.crear_aseguradora($1, $2)', ['A', 'seguros-a']],
    ['joan', 'select public.crear_aseguradora($1, $2)', ['Seguros A', 'Con Mayúsculas']],
    ['joan', 'select public.crear_aseguradora($1, $2)', ['Seguros Otra Vez', 'seguros-x']],
    ['servidor', 'select public.registrar_miembro($1, $2, $3, $4, $5)', [ids.persona.joan, ids.persona.analistaX, ids.aseg.X, 'analista', 'Ya Está']],
    ['servidor', 'select public.registrar_miembro($1, $2, $3, $4, $5)', [ids.persona.joan, ids.nuevo, ids.aseg.X, 'analista', 'x']],
  ];
  for (const [quien, sql, params] of casos) {
    const r = await como(quien, () => intentar(sql, params));
    const que = `${quien}: ${sql} ${JSON.stringify(params).slice(0, 80)}`;
    assert.equal(r.ok, false, que);
    assert.ok(['22023', '23505'].includes(r.codigo), `${que} → ${r.codigo} ${r.mensaje}`);
    assert.doesNotMatch(r.mensaje, enIngles, que);
  }
});
