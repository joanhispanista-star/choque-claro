-- Choque Claro, fase 2: cuentas y roles. Lo decidió Joan el sáb 14-nov-2026; el plan está en
-- PLAN-ROLES.md, que va fuera de git.
--
-- Quién es quién:
--   conductor            sesión anónima de Supabase en su teléfono, sin correo ni clave. Está en
--                        la vía con el carro chocado: pedirle una cuenta ahí es perder el reclamo.
--   analista, jefe       cuentas del equipo de UNA aseguradora (tabla miembros). El jefe de
--                        siniestros crea a su equipo y asigna.
--   abogado              el de la aseguradora: cuenta del equipo, ve solo lo que le asignan.
--   abogado del conductor sin cuenta: un enlace que crea el conductor, vence y se puede quitar.
--   super_admin          Joan. Ve todo, y cada vez que abre un reclamo queda escrito en la
--                        bitácora que ve el jefe de esa aseguradora. Eso es lo que hace aceptable
--                        «Joan viendo todo» en la revisión de seguridad de una aseguradora.
--
-- Las reglas, en dos sitios que se vigilan entre sí: aquí, que es lo único que protege, y
-- js/permisos.js, que es lo que usa la pantalla. pruebas/roles-postgres.test.js corre esta
-- migración en Postgres (PGlite) y compara las dos, caso por caso.
--
-- Cómo está armado:
--   * El equipo SOLO LEE de las tablas. Todo lo que cambia algo pasa por una función que deja
--     rastro en la bitácora. Si el equipo pudiera hacer update directo, la bitácora sería
--     opcional.
--   * Lo declarado y las fotos solo se entregan dejando rastro: «declarado» no tiene permiso
--     de select para nadie, solo sale por abrir_reclamo(); las fotos del almacenamiento solo se
--     bajan si hay un «abrió» de esa persona en las últimas 2 horas.
--   * Nadie puede escribir en la bitácora a mano: no tiene política de insert. La escriben las
--     funciones, que corren como dueñas de la tabla.
--
-- Idempotente: se puede correr dos veces (la prueba lo hace). Nunca se edita una vez aplicada:
-- se escribe otra migración.
--
-- Al aplicarla en Supabase, lo que no va en SQL:
--   * Authentication → Sign In / Providers: Anonymous sign-ins ENCENDIDO (el conductor) y
--     «Allow new users to sign up» APAGADO para correo (las cuentas del equipo las crea la
--     función crear-miembro, con la clave de servicio).
--   * El primer super admin se mete a mano, con el uid de la cuenta de Joan:
--       insert into public.miembros (user_id, rol, nombre) values ('<uid>', 'super_admin', 'Joan');
--   * Verificar que se aplicó de verdad (una vez ya pasó que no): la consulta del final.

-- ============================================================================================
-- Tablas
-- ============================================================================================

create table if not exists public.aseguradoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  -- Lo que va en el enlace que la aseguradora le da al conductor: ?a=seguros-ejemplo.
  codigo text not null unique check (codigo ~ '^[a-z0-9-]{3,40}$'),
  -- Apagarla le quita el acceso a todo su equipo de una vez y no deja enviar más reclamos.
  -- Es como termina un piloto sin borrar nada.
  activa boolean not null default true,
  creada timestamptz not null default now()
);

create table if not exists public.miembros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  aseguradora_id uuid references public.aseguradoras (id),
  rol text not null check (rol in ('super_admin', 'jefe', 'analista', 'abogado')),
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  activo boolean not null default true,
  creado timestamptz not null default now(),
  -- Joan no es de ninguna aseguradora; todos los demás son de exactamente una.
  constraint miembros_aseguradora_segun_rol check ((rol = 'super_admin') = (aseguradora_id is null))
);

create table if not exists public.reclamos (
  id uuid primary key default gen_random_uuid(),
  -- El número del paso 8 (js/sello.js): CC, el día del sello en Colombia y 6 letras de la huella.
  numero text not null unique check (numero ~ '^CC-[0-9]{6}-[0-9A-F]{6}$'),
  aseguradora_id uuid not null references public.aseguradoras (id),
  conductor_id uuid not null references auth.users (id),
  sello text not null check (sello ~ '^[0-9a-f]{64}$'),
  ultima_huella text not null check (ultima_huella ~ '^[0-9a-f]{64}$'),
  -- Lo que va en la lista de la bandeja («Los Verjones»). Lo demás del lugar va en lo declarado.
  lugar text not null default '' check (length(lugar) <= 120),
  -- El texto canónico tal cual se selló, como TEXTO y no como jsonb: jsonb reordena las
  -- claves y normaliza los números, y la huella dejaría de coincidir con lo que se guardó.
  declarado text not null check (length(declarado) between 2 and 2000000),
  fotos_esperadas int not null check (fotos_esperadas between 1 and 200),
  -- subiendo: las fotos van en camino. recibido: el servidor recalculó todas las huellas y le
  -- puso su hora. Solo la función recibir-reclamo (clave de servicio) lo pasa a recibido.
  estado text not null default 'subiendo' check (estado in ('subiendo', 'recibido', 'en_revision', 'cerrado')),
  -- La hora DEL SERVIDOR al verificar. Es lo que hace valer el sello contra el dueño del
  -- teléfono: desde aquí, una foto cambiada ya no puede rehacer la cadena sin que se note.
  recibido_en timestamptz,
  creado timestamptz not null default now()
);

create table if not exists public.reclamo_fotos (
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  orden int not null check (orden between 0 and 199),
  -- El SHA-256 que declaró el teléfono. El servidor lo recalcula sobre el archivo que llegó.
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  verificada boolean not null default false,
  -- Dónde queda en el almacenamiento. Se calcula sola: así el teléfono no puede declarar una
  -- foto y subir otra con otro nombre.
  ruta text generated always as (reclamo_id::text || '/' || orden::text || '.jpg') stored,
  primary key (reclamo_id, orden)
);

create table if not exists public.asignaciones (
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  user_id uuid not null references public.miembros (user_id) on delete cascade,
  asignado_por uuid not null,
  creada timestamptz not null default now(),
  primary key (reclamo_id, user_id)
);

-- Sin update ni delete: una nota interna de un siniestro no se reescribe después.
create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  autor uuid not null references public.miembros (user_id),
  texto text not null check (length(btrim(texto)) between 1 and 4000),
  creada timestamptz not null default now()
);

create table if not exists public.enlaces_abogado (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  -- Solo la huella del token. El token lo tiene el conductor y se lo pasa a su abogado: si
  -- alguien se lleva esta tabla, no se lleva los enlaces.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  creado timestamptz not null default now(),
  vence timestamptz not null,
  revocado timestamptz,
  constraint enlaces_vencen_en_30_dias check (vence <= creado + interval '30 days')
);

-- Sin on delete cascade a propósito: borrar un reclamo (una solicitud de supresión, por
-- ejemplo) tiene que decidir a mano qué pasa con su rastro. No puede desaparecer de paso.
create table if not exists public.bitacora (
  id bigint generated always as identity primary key,
  reclamo_id uuid not null references public.reclamos (id),
  aseguradora_id uuid not null references public.aseguradoras (id),
  actor uuid, -- null: el abogado del conductor, que no tiene cuenta (el enlace va en detalle)
  rol text not null,
  accion text not null check (accion in ('abrio', 'abrio_enlace', 'cambio_estado', 'asigno', 'quito_asignacion', 'nota')),
  detalle jsonb,
  en timestamptz not null default now()
);

create index if not exists reclamos_aseguradora_idx on public.reclamos (aseguradora_id, creado desc);
create index if not exists reclamos_conductor_idx on public.reclamos (conductor_id, creado desc);
create index if not exists asignaciones_usuario_idx on public.asignaciones (user_id);
create index if not exists notas_reclamo_idx on public.notas (reclamo_id, creada);
create index if not exists enlaces_reclamo_idx on public.enlaces_abogado (reclamo_id);
create index if not exists bitacora_reclamo_idx on public.bitacora (reclamo_id, en desc);
create index if not exists bitacora_actor_idx on public.bitacora (actor, reclamo_id, en desc);

alter table public.aseguradoras enable row level security;
alter table public.miembros enable row level security;
alter table public.reclamos enable row level security;
alter table public.reclamo_fotos enable row level security;
alter table public.asignaciones enable row level security;
alter table public.notas enable row level security;
alter table public.enlaces_abogado enable row level security;
alter table public.bitacora enable row level security;

-- ============================================================================================
-- Permisos de tabla: se parte de cero
-- ============================================================================================
-- Supabase le da TODO a anon y authenticated sobre cada tabla nueva de public. Con RLS eso
-- casi no importa, pero un insert sin política o una columna nueva quedarían abiertos sin que
-- nadie lo note. Se quita todo y se da solo lo que hace falta.
--
-- Los select van por columna: el cliente tiene que pedir las columnas por nombre (un
-- select=* de PostgREST falla). Así «declarado» y «conductor_id» no salen nunca por ahí.

revoke all on public.aseguradoras, public.miembros, public.reclamos, public.reclamo_fotos,
  public.asignaciones, public.notas, public.enlaces_abogado, public.bitacora
  from public, anon, authenticated;

grant all on public.aseguradoras, public.miembros, public.reclamos, public.reclamo_fotos,
  public.asignaciones, public.notas, public.enlaces_abogado, public.bitacora
  to service_role;

grant select (id, nombre, codigo, activa, creada) on public.aseguradoras to authenticated;
grant select (user_id, aseguradora_id, rol, nombre, activo, creado) on public.miembros to authenticated;
grant select (id, numero, aseguradora_id, lugar, estado, fotos_esperadas, recibido_en, creado) on public.reclamos to authenticated;
grant select (reclamo_id, orden, huella, verificada, ruta) on public.reclamo_fotos to authenticated;
grant select (reclamo_id, user_id, creada) on public.asignaciones to authenticated;
grant select (id, reclamo_id, autor, texto, creada) on public.notas to authenticated;
grant select (id, reclamo_id, creado, vence, revocado) on public.enlaces_abogado to authenticated;
grant select (id, reclamo_id, actor, rol, accion, en) on public.bitacora to authenticated;

-- ============================================================================================
-- Quién es quien llama
-- ============================================================================================
-- security definer porque las políticas los llaman como quien consulta, y quien consulta no
-- puede leer miembros entero. search_path vacío: una función definer con search_path abierto
-- se puede engañar con una tabla del mismo nombre en otro esquema.

-- El rol de quien llama, o null si no es del equipo, si su cuenta está apagada o si su
-- aseguradora está apagada. Todo pasa por aquí: apagar a alguien le quita todo de una vez.
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select m.rol
  from public.miembros m
  left join public.aseguradoras a on a.id = m.aseguradora_id
  where m.user_id = auth.uid() and m.activo and (m.rol = 'super_admin' or a.activa)
$$;

create or replace function public.mi_aseguradora() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.aseguradora_id
  from public.miembros m
  join public.aseguradoras a on a.id = m.aseguradora_id
  where m.user_id = auth.uid() and m.activo and a.activa
$$;

-- Ver un reclamo en la lista. Un reclamo «subiendo» no le llega a la aseguradora hasta que el
-- servidor verifica todas sus fotos: un expediente a medias se puede leer mal. Joan sí lo ve,
-- para dar soporte cuando una subida se traba.
create or replace function public.puede_ver_reclamo(p_reclamo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.reclamos r
    where r.id = p_reclamo and (
      r.conductor_id = auth.uid()
      or public.mi_rol() = 'super_admin'
      or (r.estado <> 'subiendo' and public.mi_rol() in ('jefe', 'analista')
          and r.aseguradora_id = public.mi_aseguradora())
      or (r.estado <> 'subiendo' and public.mi_rol() = 'abogado'
          and exists (select 1 from public.asignaciones s where s.reclamo_id = r.id and s.user_id = auth.uid()))
    )
  )
$$;

-- La bitácora: Joan, el jefe de esa aseguradora y el conductor dueño del reclamo. El conductor
-- la ve porque es el dueño de sus datos y tiene derecho a saber quién los usó (Ley 1581): ve
-- el rol y la hora, no los nombres del equipo.
create or replace function public.puede_ver_bitacora(p_reclamo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.reclamos r
    where r.id = p_reclamo and (
      r.conductor_id = auth.uid()
      or public.mi_rol() = 'super_admin'
      or (r.estado <> 'subiendo' and public.mi_rol() = 'jefe' and r.aseguradora_id = public.mi_aseguradora())
    )
  )
$$;

create or replace function public.es_mi_reclamo(p_reclamo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reclamos r where r.id = p_reclamo and r.conductor_id = auth.uid())
$$;

create or replace function public.aseguradora_del_reclamo(p_reclamo uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.aseguradora_id from public.reclamos r where r.id = p_reclamo
$$;

-- ============================================================================================
-- Políticas: solo de lectura. Lo que cambia algo va por las funciones de abajo.
-- ============================================================================================

drop policy if exists aseguradoras_ver on public.aseguradoras;
create policy aseguradoras_ver on public.aseguradoras for select to authenticated
  using (public.mi_rol() = 'super_admin' or id = public.mi_aseguradora());

-- Cada quien ve su propia fila aunque esté apagada: así la pantalla le puede decir «tu cuenta
-- está apagada» en vez de quedarse muda.
drop policy if exists miembros_ver on public.miembros;
create policy miembros_ver on public.miembros for select to authenticated
  using (
    user_id = auth.uid()
    or public.mi_rol() = 'super_admin'
    or (public.mi_rol() = 'jefe' and aseguradora_id = public.mi_aseguradora())
  );

drop policy if exists reclamos_ver on public.reclamos;
create policy reclamos_ver on public.reclamos for select to authenticated
  using (public.puede_ver_reclamo(id));

drop policy if exists reclamo_fotos_ver on public.reclamo_fotos;
create policy reclamo_fotos_ver on public.reclamo_fotos for select to authenticated
  using (public.puede_ver_reclamo(reclamo_id));

drop policy if exists asignaciones_ver on public.asignaciones;
create policy asignaciones_ver on public.asignaciones for select to authenticated
  using (
    user_id = auth.uid()
    or public.mi_rol() = 'super_admin'
    or (public.mi_rol() in ('jefe', 'analista') and public.aseguradora_del_reclamo(reclamo_id) = public.mi_aseguradora())
  );

-- Las notas son internas: el conductor ve su reclamo, pero no lo que la aseguradora anota.
drop policy if exists notas_ver on public.notas;
create policy notas_ver on public.notas for select to authenticated
  using (public.mi_rol() is not null and public.puede_ver_reclamo(reclamo_id));

drop policy if exists enlaces_ver on public.enlaces_abogado;
create policy enlaces_ver on public.enlaces_abogado for select to authenticated
  using (public.es_mi_reclamo(reclamo_id));

drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated
  using (public.puede_ver_bitacora(reclamo_id));

-- ============================================================================================
-- Lo que hace el conductor
-- ============================================================================================

-- La pantalla del conductor muestra «Enviar a Seguros Ejemplo» con el código del enlace. Solo
-- devuelve el nombre de una aseguradora activa: no deja listar las demás.
create or replace function public.aseguradora_por_codigo(p_codigo text)
returns table (id uuid, nombre text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.nombre from public.aseguradoras a where a.codigo = p_codigo and a.activa
$$;

-- Crea el reclamo y una fila por foto, en una sola transacción. Las fotos se suben después al
-- almacenamiento, a la ruta que sale de aquí, y el servidor las verifica al final.
-- Reintentar con el mismo número devuelve el mismo reclamo: si la señal se cae en la vía, la
-- subida sigue donde iba, sin reclamos duplicados.
create or replace function public.crear_reclamo(
  p_codigo text, p_numero text, p_sello text, p_ultima_huella text,
  p_lugar text, p_declarado text, p_huellas text[]
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_aseguradora uuid;
  v_id uuid;
  v_dueno uuid;
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión en este teléfono para enviar.' using errcode = '42501';
  end if;
  if exists (select 1 from public.miembros m where m.user_id = auth.uid()) then
    raise exception 'Los reclamos se envían desde el teléfono del conductor, no con una cuenta del equipo.'
      using errcode = '42501';
  end if;

  select a.id into v_aseguradora from public.aseguradoras a where a.codigo = p_codigo and a.activa;
  if v_aseguradora is null then
    raise exception 'Ese enlace no es de una aseguradora activa.' using errcode = '42501';
  end if;

  select r.id, r.conductor_id into v_id, v_dueno from public.reclamos r where r.numero = p_numero;
  if v_id is not null then
    if v_dueno = auth.uid() then return v_id; end if;
    -- Otro teléfono con el mismo número: 1 en 16 millones el mismo día (js/sello.js).
    raise exception 'Ese número de reclamo ya existe. Vuelve a sellar el reporte.' using errcode = '23505';
  end if;

  -- Tope contra el abuso: una sesión anónima no cuesta nada, así que sin tope cualquiera podría
  -- llenar la bandeja de una aseguradora. Diez al día sobra para quien de verdad chocó.
  select count(*) into v_n from public.reclamos r
  where r.conductor_id = auth.uid() and r.creado > now() - interval '1 day';
  if v_n >= 10 then
    raise exception 'Este teléfono ya envió 10 reclamos hoy. Si es un error, llama a tu aseguradora.'
      using errcode = '53400';
  end if;

  v_n := coalesce(array_length(p_huellas, 1), 0);
  if v_n < 1 or v_n > 200 then
    raise exception 'Un reclamo lleva entre 1 y 200 fotos.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_huellas) h where h is null or h !~ '^[0-9a-f]{64}$') then
    raise exception 'Una de las huellas no es un SHA-256.' using errcode = '22023';
  end if;

  insert into public.reclamos (numero, aseguradora_id, conductor_id, sello, ultima_huella, lugar, declarado, fotos_esperadas)
  values (p_numero, v_aseguradora, auth.uid(), p_sello, p_ultima_huella, coalesce(p_lugar, ''), p_declarado, v_n)
  returning id into v_id;

  insert into public.reclamo_fotos (reclamo_id, orden, huella)
  select v_id, t.o - 1, t.h from unnest(p_huellas) with ordinality as t (h, o);

  return v_id;
end;
$$;

-- El token lo genera el teléfono y aquí solo llega su SHA-256. Hasta 30 días: un expediente
-- abierto para siempre es un expediente que alguien termina reenviando.
create or replace function public.crear_enlace_abogado(p_reclamo uuid, p_token_hash text, p_dias int default 30)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.reclamos r
    where r.id = p_reclamo and r.conductor_id = auth.uid() and r.estado <> 'subiendo'
  ) then
    raise exception 'El enlace para el abogado lo crea el conductor, cuando el reclamo ya llegó.' using errcode = '42501';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then
    raise exception 'El enlace dura entre 1 y 30 días.' using errcode = '22023';
  end if;
  insert into public.enlaces_abogado (reclamo_id, token_hash, vence)
  values (p_reclamo, p_token_hash, now() + make_interval(days => p_dias))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.quitar_enlace_abogado(p_enlace uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.enlaces_abogado e set revocado = now()
  where e.id = p_enlace and e.revocado is null and public.es_mi_reclamo(e.reclamo_id);
  if not found then
    raise exception 'Ese enlace no es tuyo o ya estaba quitado.' using errcode = '42501';
  end if;
end;
$$;

-- ============================================================================================
-- Lo que abre el expediente (y deja rastro)
-- ============================================================================================

-- Interna: nadie la puede llamar directo (se le quita el permiso abajo). La usan abrir_reclamo
-- y abrir_enlace, que primero escriben en la bitácora.
create or replace function public.contenido_del_reclamo(p_reclamo uuid, p_con_notas boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'numero', r.numero, 'lugar', r.lugar, 'estado', r.estado,
    'sello', r.sello, 'ultima_huella', r.ultima_huella, 'declarado', r.declarado,
    'fotos_esperadas', r.fotos_esperadas, 'recibido_en', r.recibido_en, 'creado', r.creado,
    'aseguradora', (select a.nombre from public.aseguradoras a where a.id = r.aseguradora_id),
    'fotos', coalesce((
      select jsonb_agg(jsonb_build_object('orden', f.orden, 'huella', f.huella, 'verificada', f.verificada, 'ruta', f.ruta) order by f.orden)
      from public.reclamo_fotos f where f.reclamo_id = r.id), '[]'::jsonb),
    'notas', case when p_con_notas then coalesce((
      select jsonb_agg(jsonb_build_object('autor', m.nombre, 'texto', n.texto, 'creada', n.creada) order by n.creada)
      from public.notas n join public.miembros m on m.user_id = n.autor where n.reclamo_id = r.id), '[]'::jsonb)
    else null end
  )
  from public.reclamos r where r.id = p_reclamo
$$;

create or replace function public.abrir_reclamo(p_reclamo uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_rol text := public.mi_rol();
  v_aseguradora uuid;
begin
  -- El conductor ya tiene su reclamo completo en el teléfono; por aquí entra solo el equipo.
  if v_rol is null or not public.puede_ver_reclamo(p_reclamo) then
    raise exception 'No tienes acceso a ese reclamo.' using errcode = '42501';
  end if;
  select r.aseguradora_id into v_aseguradora from public.reclamos r where r.id = p_reclamo;
  insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion)
  values (p_reclamo, v_aseguradora, auth.uid(), v_rol, 'abrio');
  return public.contenido_del_reclamo(p_reclamo, true);
end;
$$;

-- El abogado del conductor, sin cuenta: entra con el token del enlace (rol anon). Ve lo mismo
-- que la aseguradora menos las notas internas, y su visita también queda en la bitácora.
create or replace function public.abrir_enlace(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_enlace uuid;
  v_reclamo uuid;
  v_aseguradora uuid;
begin
  if p_token is null or length(p_token) not between 20 and 200 then
    raise exception 'Ese enlace no existe, venció o el conductor lo quitó.' using errcode = '42501';
  end if;
  select e.id, e.reclamo_id into v_enlace, v_reclamo
  from public.enlaces_abogado e
  where e.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and e.revocado is null and e.vence > now();
  if v_enlace is null then
    raise exception 'Ese enlace no existe, venció o el conductor lo quitó.' using errcode = '42501';
  end if;
  select r.aseguradora_id into v_aseguradora from public.reclamos r where r.id = v_reclamo;
  insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion, detalle)
  values (v_reclamo, v_aseguradora, null, 'abogado_conductor', 'abrio_enlace', jsonb_build_object('enlace', v_enlace));
  return public.contenido_del_reclamo(v_reclamo, false);
end;
$$;

-- ============================================================================================
-- Lo que hace el equipo de la aseguradora
-- ============================================================================================

create or replace function public.cambiar_estado(p_reclamo uuid, p_estado text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_rol text := public.mi_rol();
  v_de text;
  v_aseguradora uuid;
begin
  select r.estado, r.aseguradora_id into v_de, v_aseguradora from public.reclamos r where r.id = p_reclamo;
  -- «recibido» solo lo pone el servidor, al verificar las fotos; nadie lo devuelve a «subiendo».
  if v_de is null or v_de = 'subiendo' or v_rol is null or v_rol = 'abogado'
     or (v_rol in ('jefe', 'analista') and v_aseguradora is distinct from public.mi_aseguradora()) then
    raise exception 'No puedes cambiar el estado de ese reclamo.' using errcode = '42501';
  end if;
  if p_estado is null or p_estado not in ('en_revision', 'cerrado') then
    raise exception 'El estado pasa a en revisión o a cerrado.' using errcode = '22023';
  end if;
  update public.reclamos set estado = p_estado where id = p_reclamo;
  insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion, detalle)
  values (p_reclamo, v_aseguradora, auth.uid(), v_rol, 'cambio_estado', jsonb_build_object('de', v_de, 'a', p_estado));
end;
$$;

create or replace function public.agregar_nota(p_reclamo uuid, p_texto text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_rol text := public.mi_rol();
  v_estado text;
  v_aseguradora uuid;
  v_id uuid;
begin
  select r.estado, r.aseguradora_id into v_estado, v_aseguradora from public.reclamos r where r.id = p_reclamo;
  if v_rol is null or v_estado is null or v_estado = 'subiendo' or not public.puede_ver_reclamo(p_reclamo) then
    raise exception 'No puedes escribir en ese reclamo.' using errcode = '42501';
  end if;
  insert into public.notas (reclamo_id, autor, texto) values (p_reclamo, auth.uid(), p_texto) returning id into v_id;
  -- En la bitácora va que hubo una nota, no su texto: la bitácora la ve también el conductor.
  insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion, detalle)
  values (p_reclamo, v_aseguradora, auth.uid(), v_rol, 'nota', jsonb_build_object('nota', v_id));
  return v_id;
end;
$$;

-- Comprobación común de asignar y quitar: quién asigna y a quién.
create or replace function public.revisar_asignacion(p_reclamo uuid, p_usuario uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol text := public.mi_rol();
  v_estado text;
  v_aseguradora uuid;
  v_objetivo_rol text;
  v_objetivo_aseguradora uuid;
  v_objetivo_activo boolean;
begin
  select r.estado, r.aseguradora_id into v_estado, v_aseguradora from public.reclamos r where r.id = p_reclamo;
  -- coalesce: sin rol, v_rol es null, «not (null or false)» da null y un if con null NO frena.
  -- Así un conductor podía asignar reclamos; lo cazó roles-postgres.test.js el 14-nov.
  if v_estado is null or v_estado = 'subiendo'
     or not coalesce(v_rol = 'super_admin' or (v_rol = 'jefe' and v_aseguradora = public.mi_aseguradora()), false) then
    raise exception 'Los reclamos los asigna el jefe de siniestros.' using errcode = '42501';
  end if;
  select m.rol, m.aseguradora_id, m.activo into v_objetivo_rol, v_objetivo_aseguradora, v_objetivo_activo
  from public.miembros m where m.user_id = p_usuario;
  if v_objetivo_rol is null or v_objetivo_rol not in ('analista', 'abogado') or not v_objetivo_activo
     or v_objetivo_aseguradora is distinct from v_aseguradora then
    raise exception 'Solo se asigna a un analista o un abogado activo de esa aseguradora.' using errcode = '42501';
  end if;
  return v_aseguradora;
end;
$$;

create or replace function public.asignar(p_reclamo uuid, p_usuario uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_aseguradora uuid := public.revisar_asignacion(p_reclamo, p_usuario);
begin
  insert into public.asignaciones (reclamo_id, user_id, asignado_por)
  values (p_reclamo, p_usuario, auth.uid()) on conflict do nothing;
  if found then
    insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion, detalle)
    values (p_reclamo, v_aseguradora, auth.uid(), public.mi_rol(), 'asigno', jsonb_build_object('a', p_usuario));
  end if;
end;
$$;

create or replace function public.quitar_asignacion(p_reclamo uuid, p_usuario uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_aseguradora uuid := public.revisar_asignacion(p_reclamo, p_usuario);
begin
  delete from public.asignaciones s where s.reclamo_id = p_reclamo and s.user_id = p_usuario;
  if found then
    insert into public.bitacora (reclamo_id, aseguradora_id, actor, rol, accion, detalle)
    values (p_reclamo, v_aseguradora, auth.uid(), public.mi_rol(), 'quito_asignacion', jsonb_build_object('a', p_usuario));
  end if;
end;
$$;

-- ============================================================================================
-- Cuentas del equipo y aseguradoras
-- ============================================================================================

-- La regla de quién crea a quién, en un solo sitio: la usan puede_crear_miembro (la pantalla,
-- con la sesión de quien pregunta) y registrar_miembro (el servidor, con la clave de servicio).
create or replace function public.permiso_crear_miembro(p_creador uuid, p_aseguradora uuid, p_rol text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros c
    left join public.aseguradoras a on a.id = c.aseguradora_id
    where c.user_id = p_creador and c.activo and (
      (c.rol = 'super_admin' and p_rol in ('jefe', 'analista', 'abogado') and p_aseguradora is not null)
      or (c.rol = 'jefe' and a.activa and p_aseguradora = c.aseguradora_id and p_rol in ('analista', 'abogado'))
    )
  )
$$;

create or replace function public.puede_crear_miembro(p_aseguradora uuid, p_rol text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.permiso_crear_miembro(auth.uid(), p_aseguradora, p_rol)
$$;

-- Solo la llama la función crear-miembro del servidor, después de crear el usuario en Auth con
-- la clave de servicio. Vuelve a revisar al creador aquí: si un día esa función tiene un
-- defecto, la base sigue sin dejar que un analista cree un jefe.
create or replace function public.registrar_miembro(
  p_creador uuid, p_usuario uuid, p_aseguradora uuid, p_rol text, p_nombre text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.permiso_crear_miembro(p_creador, p_aseguradora, p_rol) then
    raise exception 'Esa persona no puede crear esa cuenta.' using errcode = '42501';
  end if;
  insert into public.miembros (user_id, aseguradora_id, rol, nombre)
  values (p_usuario, p_aseguradora, p_rol, p_nombre);
end;
$$;

-- Apagar en vez de borrar: lo que esa persona anotó y abrió sigue en la bitácora con su nombre.
create or replace function public.apagar_miembro(p_usuario uuid, p_activo boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_rol text := public.mi_rol();
  v_objetivo_rol text;
  v_objetivo_aseguradora uuid;
begin
  if p_usuario = auth.uid() then
    raise exception 'No puedes apagar tu propia cuenta.' using errcode = '42501';
  end if;
  select m.rol, m.aseguradora_id into v_objetivo_rol, v_objetivo_aseguradora
  from public.miembros m where m.user_id = p_usuario;
  -- coalesce por lo mismo que en revisar_asignacion: sin él, un conductor apagaba cuentas.
  if v_objetivo_rol is null or not coalesce(
    (v_rol = 'super_admin' and v_objetivo_rol <> 'super_admin')
    or (v_rol = 'jefe' and v_objetivo_aseguradora = public.mi_aseguradora() and v_objetivo_rol in ('analista', 'abogado')),
    false
  ) then
    raise exception 'No puedes apagar esa cuenta.' using errcode = '42501';
  end if;
  update public.miembros set activo = coalesce(p_activo, false) where user_id = p_usuario;
end;
$$;

create or replace function public.crear_aseguradora(p_nombre text, p_codigo text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.mi_rol() is distinct from 'super_admin' then
    raise exception 'Las aseguradoras las da de alta Choque Claro.' using errcode = '42501';
  end if;
  insert into public.aseguradoras (nombre, codigo) values (p_nombre, p_codigo) returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================================================
-- Lo que hace el servidor al recibir (función recibir-reclamo, con la clave de servicio)
-- ============================================================================================

-- El servidor baja cada foto, recalcula su SHA-256 y pasa aquí las que coinciden. Cuando están
-- todas, el reclamo queda «recibido» con la hora del servidor. Una foto que no coincide no se
-- marca nunca, y el reclamo se queda «subiendo»: no le llega a la aseguradora uno a medias.
create or replace function public.marcar_recibido(p_reclamo uuid, p_verificadas int[]) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.reclamo_fotos set verificada = true
  where reclamo_id = p_reclamo and orden = any (p_verificadas);
  if exists (select 1 from public.reclamo_fotos f where f.reclamo_id = p_reclamo and not f.verificada)
     or not exists (select 1 from public.reclamo_fotos f where f.reclamo_id = p_reclamo) then
    return false;
  end if;
  update public.reclamos set estado = 'recibido', recibido_en = now()
  where id = p_reclamo and estado = 'subiendo';
  return true;
end;
$$;

-- ============================================================================================
-- Permisos de las funciones
-- ============================================================================================
-- Postgres le da EXECUTE a PUBLIC sobre toda función nueva, y Supabase además se lo da a anon
-- y authenticated directo. Por eso se quita de los tres: quitarlo solo de PUBLIC no cierra
-- nada (ya pasó en Tu Garantía: 28 funciones abiertas).

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'mi_rol', 'mi_aseguradora', 'puede_ver_reclamo', 'puede_ver_bitacora', 'es_mi_reclamo',
      'aseguradora_del_reclamo', 'aseguradora_por_codigo', 'crear_reclamo', 'crear_enlace_abogado',
      'quitar_enlace_abogado', 'contenido_del_reclamo', 'abrir_reclamo', 'abrir_enlace',
      'cambiar_estado', 'agregar_nota', 'revisar_asignacion', 'asignar', 'quitar_asignacion',
      'permiso_crear_miembro', 'puede_crear_miembro', 'registrar_miembro', 'apagar_miembro',
      'crear_aseguradora', 'marcar_recibido', 'puede_subir_foto', 'abrio_hace_poco')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
end;
$$;

-- Las que usan las políticas tienen que poder correr como quien consulta.
grant execute on function public.mi_rol(), public.mi_aseguradora(), public.puede_ver_reclamo(uuid),
  public.puede_ver_bitacora(uuid), public.es_mi_reclamo(uuid), public.aseguradora_del_reclamo(uuid)
  to authenticated;

-- El conductor (sesión anónima, que en Supabase es el rol authenticated).
grant execute on function public.aseguradora_por_codigo(text) to anon, authenticated;
grant execute on function public.crear_reclamo(text, text, text, text, text, text, text[]),
  public.crear_enlace_abogado(uuid, text, int), public.quitar_enlace_abogado(uuid)
  to authenticated;

-- El abogado del conductor no tiene sesión.
grant execute on function public.abrir_enlace(text) to anon, authenticated;

-- El equipo.
grant execute on function public.abrir_reclamo(uuid), public.cambiar_estado(uuid, text),
  public.agregar_nota(uuid, text), public.asignar(uuid, uuid), public.quitar_asignacion(uuid, uuid),
  public.puede_crear_miembro(uuid, text), public.apagar_miembro(uuid, boolean),
  public.crear_aseguradora(text, text)
  to authenticated;

-- Solo el servidor.
grant execute on function public.registrar_miembro(uuid, uuid, uuid, text, text),
  public.marcar_recibido(uuid, int[])
  to service_role;

-- contenido_del_reclamo, revisar_asignacion y permiso_crear_miembro quedan sin permiso para
-- nadie: solo las llaman las demás funciones, que corren como dueñas.

-- ============================================================================================
-- Almacenamiento de las fotos
-- ============================================================================================
-- Privado. 5 MB por foto (salen de 1280 px, unos 300 KB) y solo JPEG. Sin políticas de update
-- ni de delete: una foto que llegó no se reemplaza ni se borra desde el teléfono.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamos', 'reclamos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Subir: solo el conductor, solo a su reclamo mientras se sube y solo a una ruta que declaró.
create or replace function public.puede_subir_foto(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.reclamo_fotos f join public.reclamos r on r.id = f.reclamo_id
    where f.ruta = p_ruta and r.conductor_id = auth.uid() and r.estado = 'subiendo'
  )
$$;

-- Bajar: solo quien puede ver el reclamo Y lo abrió (dejó su «abrió» en la bitácora) en las
-- últimas 2 horas. Así no hay forma de ver una foto sin dejar rastro.
create or replace function public.abrio_hace_poco(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  -- case y no and: SQL no promete evaluar un and de izquierda a derecha, y un nombre que no es
  -- de esta forma reventaría el ::uuid en vez de devolver false.
  select case when p_ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,3}\.jpg$' then
    public.mi_rol() is not null
    and public.puede_ver_reclamo(split_part(p_ruta, '/', 1)::uuid)
    and exists (
      select 1 from public.bitacora b
      where b.reclamo_id = split_part(p_ruta, '/', 1)::uuid and b.actor = auth.uid()
        and b.accion = 'abrio' and b.en > now() - interval '2 hours'
    )
  else false end
$$;

revoke all on function public.puede_subir_foto(text), public.abrio_hace_poco(text) from public, anon, authenticated;
grant execute on function public.puede_subir_foto(text), public.abrio_hace_poco(text) to authenticated;

drop policy if exists "reclamos: el conductor sube sus fotos" on storage.objects;
create policy "reclamos: el conductor sube sus fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'reclamos' and public.puede_subir_foto(name));

drop policy if exists "reclamos: se ven dejando rastro" on storage.objects;
create policy "reclamos: se ven dejando rastro" on storage.objects for select to authenticated
  using (bucket_id = 'reclamos' and public.abrio_hace_poco(name));

-- ============================================================================================
-- Verificar que se aplicó (correrla en el editor de SQL después de aplicar):
--   select
--     (select count(*) from pg_tables where schemaname = 'public' and rowsecurity
--        and tablename in ('aseguradoras','miembros','reclamos','reclamo_fotos','asignaciones',
--                          'notas','enlaces_abogado','bitacora')) = 8 as rls_en_las_8,
--     (select count(*) from pg_policies where schemaname = 'public') = 8 as politicas_public,
--     (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'reclamos:%') = 2 as politicas_fotos,
--     not has_function_privilege('anon', 'public.abrir_reclamo(uuid)', 'execute') as anon_no_abre,
--     not has_table_privilege('authenticated', 'public.bitacora', 'insert') as bitacora_cerrada,
--     exists (select 1 from storage.buckets where id = 'reclamos' and not public) as fotos_privadas;
-- Las seis en true.
-- ============================================================================================
