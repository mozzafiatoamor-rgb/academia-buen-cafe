-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 5: audiolibros
--  - Audiolibros guardados en Bunny Storage (links firmados que caducan).
--  - Se asignan igual que los cursos (área / sede / persona, fecha límite).
--  - Puntos por minuto escuchado (con regla anti-adelantar) + bono al terminar.
--  - Marcadores con nota.
--  - Catálogo: el empleado ve TODOS los títulos publicados (videos y audio);
--    los que no tiene asignados aparecen con candado.
--  Requiere haber corrido antes los pasos 1, 2 y 4.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
--  Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.academia_audiolibros (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  autor         text,
  descripcion   text,
  categoria     text not null default 'general',
  portada_url   text,
  archivo       text not null,                    -- ruta dentro de Bunny Storage, ej. "liderazgo/el-libro.m4b"
  duracion_seg  int,
  capitulos     jsonb not null default '[]'::jsonb, -- [{ "t": 0, "titulo": "Introducción" }, ...]
  publicado     boolean not null default false,
  orden         int not null default 0,
  creado_en     timestamptz not null default now()
);

create table if not exists public.academia_audio_asignaciones (
  id             uuid primary key default gen_random_uuid(),
  audiolibro_id  uuid not null references public.academia_audiolibros(id) on delete cascade,
  area           text,
  sede           text,
  user_id        uuid references public.academia_perfiles(user_id) on delete cascade,
  obligatorio    boolean not null default false,
  fecha_limite   date
);

create table if not exists public.academia_audio_progreso (
  user_id        uuid not null references public.academia_perfiles(user_id) on delete cascade,
  audiolibro_id  uuid not null references public.academia_audiolibros(id) on delete cascade,
  segundo_actual int not null default 0,
  max_segundo    int not null default 0,
  completado     boolean not null default false,
  completado_en  timestamptz,
  actualizado    timestamptz not null default now(),
  primary key (user_id, audiolibro_id)
);

create table if not exists public.academia_audio_marcadores (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.academia_perfiles(user_id) on delete cascade,
  audiolibro_id  uuid not null references public.academia_audiolibros(id) on delete cascade,
  segundo        int not null,
  nota           text,
  creado_en      timestamptz not null default now()
);
create index if not exists academia_audio_marcadores_usuario on public.academia_audio_marcadores (user_id, audiolibro_id);

-- Ajustes de puntos del audio (si ya existen, se respetan).
insert into public.academia_config (clave, valor) values
  ('audio_puntos_por_minuto', '1'),   -- escuchar es más pasivo que ver: 1 pto/min por defecto
  ('audio_tramo_min', '10'),          -- se pagan los puntos cada 10 min escuchados
  ('audio_bono_pct', '30'),
  ('audio_bono_min', '20'),
  ('audio_bono_max', '300')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE APOYO
-- ---------------------------------------------------------------------
create or replace function public.academia_audio_asignado(p_user uuid, p_libro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from academia_audio_asignaciones a
    join academia_perfiles p on p.user_id = p_user
    where a.audiolibro_id = p_libro
      and (a.area    is null or lower(a.area) = lower(p.area))
      and (a.sede    is null or lower(a.sede) = lower(p.sede))
      and (a.user_id is null or a.user_id = p_user)
  );
$$;

-- ¿Puede escuchar este audiolibro? (admin todo; empleado: publicado y asignado)
create or replace function public.academia_puede_oir(p_libro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select academia_es_admin() or exists (
    select 1 from academia_audiolibros b
    where b.id = p_libro and b.publicado and academia_audio_asignado(auth.uid(), b.id)
  );
$$;

create or replace function public.academia_audio_fecha_limite(p_user uuid, p_libro uuid)
returns date language sql stable security definer set search_path = public as $$
  select min(a.fecha_limite) from academia_audio_asignaciones a
  join academia_perfiles p on p.user_id = p_user
  where a.audiolibro_id = p_libro and a.fecha_limite is not null
    and (a.area    is null or lower(a.area) = lower(p.area))
    and (a.sede    is null or lower(a.sede) = lower(p.sede))
    and (a.user_id is null or a.user_id = p_user);
$$;

-- Puntos de un tramo de N segundos de audio.
create or replace function public.academia_puntos_audio_tramo(p_seg int)
returns int language sql stable security definer set search_path = public as $$
  select greatest(round(p_seg / 60.0 * academia_cfgn('audio_puntos_por_minuto', 1)), 0)::int;
$$;

-- Bono por terminar el audiolibro: % de lo que suman sus tramos (con mínimo y máximo).
create or replace function public.academia_puntos_audio_bono(p_libro uuid)
returns int language sql stable security definer set search_path = public as $$
  select least(greatest(round(coalesce(duracion_seg, 0) / 60.0 * academia_cfgn('audio_puntos_por_minuto', 1)
                              * academia_cfgn('audio_bono_pct', 30) / 100.0),
                        academia_cfgn('audio_bono_min', 20)), academia_cfgn('audio_bono_max', 300))::int
  from academia_audiolibros where id = p_libro;
$$;

-- La racha ahora también cuenta los días en que escuchaste un tramo de audiolibro.
create or replace function public.academia_racha(p_user uuid, out actual int, out maxima int)
language sql stable security definer set search_path = public as $$
  with d as (
    select distinct (completado_en at time zone 'America/Cancun')::date as dia
    from academia_progreso where user_id = p_user and completado
    union
    select distinct (creado_en at time zone 'America/Cancun')::date
    from academia_puntos where user_id = p_user and motivo = 'audio'
  ), g as (
    select dia, dia - (row_number() over (order by dia))::int as grupo from d
  ), islas as (
    select max(dia) as fin, count(*)::int as n from g group by grupo
  )
  select
    coalesce((select n from islas where fin >= academia_hoy() - 1 order by fin desc limit 1), 0),
    coalesce((select max(n) from islas), 0);
$$;

-- ---------------------------------------------------------------------
-- 3. FUNCIONES QUE USA LA APP
-- ---------------------------------------------------------------------

-- Guarda el avance de escucha. Mismo candado que los videos: max_segundo solo
-- puede crecer al ritmo del reloj (hasta 2.5x) — adelantar no da puntos.
create or replace function public.academia_registrar_audio(p_libro uuid, p_segundo int, p_duracion int default null, p_dispositivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_dur int;
  v_prev academia_audio_progreso;
  v_permitido int;
  v_max int;
  v_max_antes int := 0;
  v_tramo int;
  v_n int;
  v_completo boolean := false;
  v_recien boolean := false;
  v_pts int := 0;
  v_lim date;
  v_nuevas jsonb := '[]'::jsonb;
begin
  if v_user is null or not exists (select 1 from academia_perfiles where user_id = v_user and activo) then
    raise exception 'Sin sesión válida';
  end if;
  if p_dispositivo is not null and exists (
    select 1 from academia_perfiles
    where user_id = v_user and rol = 'empleado'
      and dispositivo_activo is not null and dispositivo_activo <> p_dispositivo
  ) then
    raise exception 'SESION_REEMPLAZADA';
  end if;
  if not academia_puede_oir(p_libro) then raise exception 'Audiolibro no disponible'; end if;

  select duracion_seg into v_dur from academia_audiolibros where id = p_libro;
  if v_dur is null and p_duracion is not null and p_duracion > 0 then
    update academia_audiolibros set duracion_seg = p_duracion where id = p_libro;
    v_dur := p_duracion;
  end if;

  select * into v_prev from academia_audio_progreso where user_id = v_user and audiolibro_id = p_libro;
  if v_prev.user_id is null then
    v_max := least(greatest(p_segundo, 0), 20);
    insert into academia_audio_progreso (user_id, audiolibro_id, segundo_actual, max_segundo)
    values (v_user, p_libro, greatest(p_segundo, 0), v_max);
  else
    v_max_antes := v_prev.max_segundo;
    v_permitido := v_prev.max_segundo + (extract(epoch from (now() - v_prev.actualizado)) * 2.5)::int + 20;
    v_max := greatest(v_prev.max_segundo, least(greatest(p_segundo, 0), v_permitido));
    v_completo := v_prev.completado;
    update academia_audio_progreso
      set segundo_actual = greatest(p_segundo, 0), max_segundo = v_max, actualizado = now()
      where user_id = v_user and audiolibro_id = p_libro;
  end if;

  -- Puntos por tramos completos escuchados (cada uno se paga una sola vez).
  v_tramo := greatest(academia_cfgn('audio_tramo_min', 10)::int, 1) * 60;
  if v_max > v_max_antes then
    for v_n in (v_max_antes / v_tramo) + 1 .. (v_max / v_tramo) loop
      v_pts := v_pts + academia_dar_puntos(v_user, academia_puntos_audio_tramo(v_tramo), 'audio', p_libro::text || ':' || v_n);
    end loop;
  end if;

  -- Terminado al llegar al 90%: paga el pedazo final y el bono.
  if not v_completo and v_dur is not null and v_dur > 0 and v_max >= (v_dur * 0.9)::int then
    update academia_audio_progreso set completado = true, completado_en = now()
      where user_id = v_user and audiolibro_id = p_libro;
    v_recien := true;
    v_pts := v_pts + academia_dar_puntos(v_user, academia_puntos_audio_tramo(v_dur - (v_dur / v_tramo) * v_tramo), 'audio', p_libro::text || ':fin');
    v_pts := v_pts + academia_dar_puntos(v_user, academia_puntos_audio_bono(p_libro), 'audiolibro', p_libro::text);
    v_lim := academia_audio_fecha_limite(v_user, p_libro);
    if v_lim is not null and academia_hoy() <= v_lim then
      v_pts := v_pts + academia_dar_puntos(v_user,
        greatest(round(academia_puntos_audio_bono(p_libro) * academia_cfgn('bono_a_tiempo_pct', 15) / 100.0),
                 academia_cfgn('bono_a_tiempo_min', 10))::int, 'audio_a_tiempo', p_libro::text);
    end if;
  end if;
  if v_pts > 0 then v_nuevas := academia_evaluar_insignias(v_user); end if;

  return jsonb_build_object(
    'max_segundo', v_max,
    'completado', v_completo or v_recien,
    'recien_completado', v_recien,
    'puntos_ganados', v_pts,
    'insignias_nuevas', v_nuevas
  );
end $$;

-- Lista de audiolibros publicados (todos, para el catálogo) con mi avance.
create or replace function public.academia_mis_audiolibros()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'asignado')::boolean desc, x->>'orden_vencimiento', (x->>'orden')::int, x->>'titulo'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', b.id, 'titulo', b.titulo, 'autor', b.autor, 'descripcion', b.descripcion,
      'categoria', b.categoria, 'portada_url', b.portada_url, 'duracion_seg', b.duracion_seg,
      'capitulos', b.capitulos, 'orden', b.orden,
      'asignado', academia_audio_asignado(auth.uid(), b.id),
      'obligatorio', exists (select 1 from academia_audio_asignaciones a join academia_perfiles p on p.user_id = auth.uid()
                             where a.audiolibro_id = b.id and a.obligatorio
                               and (a.area is null or lower(a.area) = lower(p.area))
                               and (a.sede is null or lower(a.sede) = lower(p.sede))
                               and (a.user_id is null or a.user_id = auth.uid())),
      'fecha_limite', academia_audio_fecha_limite(auth.uid(), b.id),
      'orden_vencimiento', coalesce(academia_audio_fecha_limite(auth.uid(), b.id)::text, '9999'),
      'segundo_actual', coalesce(pr.segundo_actual, 0),
      'max_segundo', coalesce(pr.max_segundo, 0),
      'completado', coalesce(pr.completado, false),
      'ultima_actividad', pr.actualizado,
      'valor', (select coalesce(sum(academia_puntos_audio_tramo(least(greatest(academia_cfgn('audio_tramo_min', 10)::int, 1) * 60,
                                                                     coalesce(b.duracion_seg, 0) - s))), 0)
                from generate_series(0, greatest(coalesce(b.duracion_seg, 0) - 1, 0), greatest(academia_cfgn('audio_tramo_min', 10)::int, 1) * 60) s
                where coalesce(b.duracion_seg, 0) > 0) + coalesce(academia_puntos_audio_bono(b.id), 0)
    ) as x
    from academia_audiolibros b
    left join academia_audio_progreso pr on pr.audiolibro_id = b.id and pr.user_id = auth.uid()
    where b.publicado and auth.uid() is not null
  ) t;
$$;

-- Catálogo de cursos en video: todos los publicados, con candado si no está asignado.
create or replace function public.academia_catalogo_cursos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'titulo', c.titulo, 'descripcion', c.descripcion, 'categoria', c.categoria,
      'lecciones', (select count(*) from academia_lecciones where curso_id = c.id),
      'duracion_seg', (select coalesce(sum(duracion_seg), 0) from academia_lecciones where curso_id = c.id),
      'asignado', academia_curso_asignado(auth.uid(), c.id),
      'terminado', academia_curso_terminado(auth.uid(), c.id)
    ) order by c.orden, c.titulo), '[]'::jsonb)
  from academia_cursos c
  where c.publicado and auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------
-- 4. SEGURIDAD
-- ---------------------------------------------------------------------
alter table public.academia_audiolibros        enable row level security;
alter table public.academia_audio_asignaciones enable row level security;
alter table public.academia_audio_progreso     enable row level security;
alter table public.academia_audio_marcadores   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['audiolibros','audio_asignaciones','audio_progreso','audio_marcadores']
  loop
    execute format('drop policy if exists "admin_todo" on public.academia_%s', t);
    execute format('create policy "admin_todo" on public.academia_%s for all to authenticated
                    using (public.academia_es_admin()) with check (public.academia_es_admin())', t);
  end loop;
end $$;

-- El empleado lee su propio avance y maneja sus marcadores de lo que puede escuchar.
drop policy if exists "ver_mi_audio" on public.academia_audio_progreso;
create policy "ver_mi_audio" on public.academia_audio_progreso for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "mis_marcadores" on public.academia_audio_marcadores;
create policy "mis_marcadores" on public.academia_audio_marcadores for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.academia_puede_oir(audiolibro_id));

revoke all on public.academia_audiolibros, public.academia_audio_asignaciones,
              public.academia_audio_progreso, public.academia_audio_marcadores from anon;
grant select, insert, update, delete on public.academia_audiolibros, public.academia_audio_asignaciones,
              public.academia_audio_progreso, public.academia_audio_marcadores to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'academia_audio_fecha_limite(uuid,uuid)', 'academia_puntos_audio_tramo(int)', 'academia_racha(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'academia_audio_asignado(uuid,uuid)', 'academia_puede_oir(uuid)', 'academia_puntos_audio_bono(uuid)',
    'academia_registrar_audio(uuid,int,int,text)', 'academia_mis_audiolibros()', 'academia_catalogo_cursos()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
