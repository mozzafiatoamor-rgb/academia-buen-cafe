-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 2: protección de cuentas
--  - Una sesión a la vez (entrar en otro dispositivo cierra el anterior)
--  - Registro de dispositivos por empleado (alerta en el panel admin)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
--  Se puede volver a correr sin problema. No toca el Gestor ni otras apps.
-- =====================================================================

alter table public.academia_perfiles add column if not exists dispositivo_activo text;

create table if not exists public.academia_dispositivos (
  user_id         uuid not null references public.academia_perfiles(user_id) on delete cascade,
  dispositivo_id  text not null,
  nombre          text,                     -- ej. "iPhone · Safari"
  primer_ingreso  timestamptz not null default now(),
  ultimo_ingreso  timestamptz not null default now(),
  ingresos        int not null default 1,
  primary key (user_id, dispositivo_id)
);
create index if not exists academia_dispositivos_fecha_idx on public.academia_dispositivos(ultimo_ingreso);

alter table public.academia_dispositivos enable row level security;
drop policy if exists "admin_todo" on public.academia_dispositivos;
create policy "admin_todo" on public.academia_dispositivos for all to authenticated
  using (public.academia_es_admin()) with check (public.academia_es_admin());
revoke all on public.academia_dispositivos from anon;
grant select, insert, update, delete on public.academia_dispositivos to authenticated;

-- Al entrar: registra el dispositivo y lo marca como la sesión activa.
create or replace function public.academia_registrar_dispositivo(p_dispositivo text, p_nombre text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_n int;
begin
  if v_user is null or not exists (select 1 from academia_perfiles where user_id = v_user and activo) then
    raise exception 'Sin sesión válida';
  end if;
  if coalesce(length(p_dispositivo), 0) < 8 then raise exception 'Dispositivo inválido'; end if;
  insert into academia_dispositivos (user_id, dispositivo_id, nombre)
  values (v_user, p_dispositivo, left(p_nombre, 80))
  on conflict (user_id, dispositivo_id) do update
    set ultimo_ingreso = now(), ingresos = academia_dispositivos.ingresos + 1,
        nombre = coalesce(excluded.nombre, academia_dispositivos.nombre);
  update academia_perfiles set dispositivo_activo = p_dispositivo
    where user_id = v_user and rol = 'empleado';
  select count(*) into v_n from academia_dispositivos
    where user_id = v_user and ultimo_ingreso > now() - interval '30 days';
  return jsonb_build_object('dispositivos_30d', v_n);
end $$;

-- ¿Este dispositivo sigue siendo la sesión activa? (el admin nunca se bloquea)
create or replace function public.academia_verificar_dispositivo(p_dispositivo text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select rol = 'admin' or dispositivo_activo is null or dispositivo_activo = p_dispositivo
    from academia_perfiles where user_id = auth.uid()), false);
$$;

-- ADMIN: dispositivos de cada empleado (últimos 60 días).
create or replace function public.academia_admin_dispositivos()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id, 'nombre', p.nombre, 'usuario', p.usuario,
      'en_30_dias', (select count(*) from academia_dispositivos d where d.user_id = p.user_id and d.ultimo_ingreso > now() - interval '30 days'),
      'dispositivos', coalesce((select jsonb_agg(jsonb_build_object(
          'id', d.dispositivo_id, 'nombre', d.nombre, 'primer_ingreso', d.primer_ingreso,
          'ultimo_ingreso', d.ultimo_ingreso, 'ingresos', d.ingresos, 'activo', d.dispositivo_id = p.dispositivo_activo)
          order by d.ultimo_ingreso desc)
        from academia_dispositivos d where d.user_id = p.user_id and d.ultimo_ingreso > now() - interval '60 days'), '[]'::jsonb)
    ) order by p.nombre)
    from academia_perfiles p where p.rol = 'empleado'), '[]'::jsonb);
end $$;

-- ADMIN: borrar el historial de dispositivos de un empleado (ej. cambió de celular).
create or replace function public.academia_admin_olvidar_dispositivos(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  delete from academia_dispositivos where user_id = p_user
    and dispositivo_id is distinct from (select dispositivo_activo from academia_perfiles where user_id = p_user);
end $$;

-- Avance de video: ahora rechaza el avance de un dispositivo reemplazado.
drop function if exists public.academia_registrar_avance(uuid, int, int);
create or replace function public.academia_registrar_avance(p_leccion uuid, p_segundo int, p_duracion int default null, p_dispositivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_curso uuid;
  v_dur int;
  v_prev academia_progreso;
  v_permitido int;
  v_max int;
  v_completo boolean;
  v_recien boolean := false;
  v_pts int := 0;
  v_nuevas jsonb := '[]'::jsonb;
begin
  if v_user is null or not exists (select 1 from academia_perfiles where user_id = v_user and activo) then
    raise exception 'Sin sesión válida';
  end if;

  -- Una sesión a la vez: el avance de un dispositivo reemplazado ya no cuenta.
  if p_dispositivo is not null and exists (
    select 1 from academia_perfiles
    where user_id = v_user and rol = 'empleado'
      and dispositivo_activo is not null and dispositivo_activo <> p_dispositivo
  ) then
    raise exception 'SESION_REEMPLAZADA';
  end if;

  select curso_id, duracion_seg into v_curso, v_dur from academia_lecciones where id = p_leccion;
  if v_curso is null or not academia_puede_ver_curso(v_curso) then
    raise exception 'Lección no disponible';
  end if;

  -- Si la lección aún no tiene duración guardada, se toma la que reporta el reproductor.
  if v_dur is null and p_duracion is not null and p_duracion > 0 then
    update academia_lecciones set duracion_seg = p_duracion where id = p_leccion;
    v_dur := p_duracion;
  end if;

  select * into v_prev from academia_progreso where user_id = v_user and leccion_id = p_leccion;

  if v_prev.user_id is null then
    v_permitido := 20;
    v_max := least(greatest(p_segundo, 0), v_permitido);
    insert into academia_progreso (user_id, leccion_id, segundo_actual, max_segundo)
    values (v_user, p_leccion, greatest(p_segundo, 0), v_max);
    v_completo := false;
  else
    v_permitido := v_prev.max_segundo
                   + (extract(epoch from (now() - v_prev.actualizado)) * 2.5)::int + 20;
    v_max := greatest(v_prev.max_segundo, least(greatest(p_segundo, 0), v_permitido));
    v_completo := v_prev.completado;
    update academia_progreso
      set segundo_actual = greatest(p_segundo, 0), max_segundo = v_max, actualizado = now()
      where user_id = v_user and leccion_id = p_leccion;
  end if;

  -- Lección completada al ver el 90%.
  if not v_completo and v_dur is not null and v_dur > 0 and v_max >= (v_dur * 0.9)::int then
    update academia_progreso set completado = true, completado_en = now()
      where user_id = v_user and leccion_id = p_leccion;
    v_recien := true;
    v_pts := academia_dar_puntos(v_user, academia_cfg('puntos_leccion', 10), 'leccion', p_leccion::text);
    v_pts := v_pts + academia_cerrar_curso(v_user, v_curso);
    v_nuevas := academia_evaluar_insignias(v_user);
  end if;

  return jsonb_build_object(
    'completado', v_completo or v_recien,
    'recien_completado', v_recien,
    'max_segundo', v_max,
    'puntos_ganados', v_pts,
    'insignias_nuevas', v_nuevas,
    'curso_terminado', case when v_recien then academia_curso_terminado(v_user, v_curso) else null end
  );
end $$;

revoke all on function public.academia_registrar_avance(uuid,int,int,text) from public, anon;
grant execute on function public.academia_registrar_avance(uuid,int,int,text) to authenticated;
revoke all on function public.academia_registrar_dispositivo(text,text) from public, anon;
grant execute on function public.academia_registrar_dispositivo(text,text) to authenticated;
revoke all on function public.academia_verificar_dispositivo(text) from public, anon;
grant execute on function public.academia_verificar_dispositivo(text) to authenticated;
revoke all on function public.academia_admin_dispositivos() from public, anon;
grant execute on function public.academia_admin_dispositivos() to authenticated;
revoke all on function public.academia_admin_olvidar_dispositivos(uuid) from public, anon;
grant execute on function public.academia_admin_olvidar_dispositivos(uuid) to authenticated;
