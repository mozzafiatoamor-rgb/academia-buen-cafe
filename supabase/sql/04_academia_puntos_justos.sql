-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 4: puntos justos según la duración
--  - Los puntos de cada lección, del curso, del quiz y del bono "a tiempo"
--    se calculan según la duración real de los videos (configurable).
--  - Insignias manuales "repetibles" (ej. "Mejor servicio del mes").
--  Requiere haber corrido antes los pasos 1 y 2.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
--  Se puede volver a correr. Los puntos ya ganados no cambian.
-- =====================================================================

alter table public.academia_perfiles add column if not exists dispositivo_activo text;

-- Ajustes nuevos (si ya existen, se respetan).
insert into public.academia_config (clave, valor) values
  ('puntos_por_duracion', '1'),       -- 1 = según duración, 0 = puntos fijos
  ('puntos_por_minuto', '2'),
  ('puntos_leccion_min', '5'),
  ('puntos_leccion_max', '40'),
  ('bono_curso_pct', '30'),
  ('bono_curso_min', '20'),
  ('bono_curso_max', '300'),
  ('puntos_quiz_por_pregunta', '5'),
  ('puntos_quiz_min', '15'),
  ('puntos_quiz_max', '60'),
  ('bono_a_tiempo_pct', '15'),
  ('bono_a_tiempo_min', '10')
on conflict (clave) do nothing;

create or replace function public.academia_cfgn(p_clave text, p_defecto numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (valor #>> '{}')::numeric from academia_config where clave = p_clave), p_defecto);
$$;

-- Puntos de una lección: 2 por minuto (entre 5 y 40), o fijo si no hay duración.
create or replace function public.academia_puntos_leccion(p_leccion uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when academia_cfgn('puntos_por_duracion', 1) = 1 and coalesce(l.duracion_seg, 0) > 0 then
      least(greatest(round(l.duracion_seg / 60.0 * academia_cfgn('puntos_por_minuto', 2)),
                     academia_cfgn('puntos_leccion_min', 5)), academia_cfgn('puntos_leccion_max', 40))::int
    else academia_cfgn('puntos_leccion', 10)::int end
  from academia_lecciones l where l.id = p_leccion;
$$;

-- Bono por terminar el curso: % de lo que suman sus lecciones (con mínimo y máximo).
create or replace function public.academia_puntos_curso(p_curso uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when academia_cfgn('puntos_por_duracion', 1) = 1 then
      least(greatest(round(coalesce((select sum(academia_puntos_leccion(id)) from academia_lecciones where curso_id = p_curso), 0)
                           * academia_cfgn('bono_curso_pct', 30) / 100.0),
                     academia_cfgn('bono_curso_min', 20)), academia_cfgn('bono_curso_max', 300))::int
    else academia_cfgn('puntos_curso', 50)::int end;
$$;

-- Quiz perfecto: puntos por pregunta (con mínimo y máximo).
create or replace function public.academia_puntos_quiz(p_curso uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when academia_cfgn('puntos_por_duracion', 1) = 1 then
      least(greatest((select count(*) from academia_quiz_preguntas where curso_id = p_curso) * academia_cfgn('puntos_quiz_por_pregunta', 5),
                     academia_cfgn('puntos_quiz_min', 15)), academia_cfgn('puntos_quiz_max', 60))::int
    else academia_cfgn('puntos_quiz_perfecto', 30)::int end;
$$;

-- Bono por terminar antes de la fecha límite: % del bono del curso.
create or replace function public.academia_puntos_a_tiempo(p_curso uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when academia_cfgn('puntos_por_duracion', 1) = 1 then
      greatest(round(academia_puntos_curso(p_curso) * academia_cfgn('bono_a_tiempo_pct', 15) / 100.0),
               academia_cfgn('bono_a_tiempo_min', 10))::int
    else academia_cfgn('puntos_a_tiempo', 20)::int end;
$$;

create or replace function public.academia_cerrar_curso(p_user uuid, p_curso uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_pts int := 0; v_lim date;
begin
  if not academia_curso_terminado(p_user, p_curso) then return 0; end if;
  v_pts := academia_dar_puntos(p_user, academia_puntos_curso(p_curso), 'curso', p_curso::text);
  v_lim := academia_fecha_limite(p_user, p_curso);
  if v_lim is not null and academia_hoy() <= v_lim then
    v_pts := v_pts + academia_dar_puntos(p_user, academia_puntos_a_tiempo(p_curso), 'a_tiempo', p_curso::text);
  end if;
  return v_pts;
end $$;

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
    v_pts := academia_dar_puntos(v_user, academia_puntos_leccion(p_leccion), 'leccion', p_leccion::text);
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

create or replace function public.academia_enviar_quiz(p_curso uuid, p_respuestas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_total int;
  v_bien int;
  v_puntaje int;
  v_min int;
  v_aprobado boolean;
  v_pts int := 0;
  v_detalle jsonb;
  v_nuevas jsonb;
begin
  if v_user is null or not academia_puede_ver_curso(p_curso) then
    raise exception 'Curso no disponible';
  end if;
  if exists (
    select 1 from academia_lecciones l
    left join academia_progreso pr on pr.leccion_id = l.id and pr.user_id = v_user
    where l.curso_id = p_curso and coalesce(pr.completado, false) = false
  ) then
    raise exception 'Termina todas las lecciones antes del quiz';
  end if;

  select count(*),
         count(*) filter (where (p_respuestas ->> q.id::text)::int = k.correcta),
         jsonb_object_agg(q.id::text, (p_respuestas ->> q.id::text)::int is not distinct from k.correcta)
    into v_total, v_bien, v_detalle
  from academia_quiz_preguntas q
  join academia_quiz_claves k on k.pregunta_id = q.id
  where q.curso_id = p_curso;

  if v_total = 0 then raise exception 'Este curso no tiene quiz'; end if;

  v_puntaje := round(100.0 * v_bien / v_total);
  select quiz_minimo into v_min from academia_cursos where id = p_curso;
  v_aprobado := v_puntaje >= v_min;

  insert into academia_quiz_intentos (user_id, curso_id, puntaje, aprobado, respuestas)
  values (v_user, p_curso, v_puntaje, v_aprobado, p_respuestas);

  if v_puntaje = 100 then
    v_pts := academia_dar_puntos(v_user, academia_puntos_quiz(p_curso), 'quiz_perfecto', p_curso::text);
  end if;
  if v_aprobado then
    v_pts := v_pts + academia_cerrar_curso(v_user, p_curso);
  end if;
  v_nuevas := academia_evaluar_insignias(v_user);

  return jsonb_build_object(
    'puntaje', v_puntaje, 'aprobado', v_aprobado, 'minimo', v_min,
    'correctas', v_bien, 'total', v_total, 'detalle', v_detalle,
    'puntos_ganados', v_pts, 'insignias_nuevas', v_nuevas,
    'curso_terminado', academia_curso_terminado(v_user, p_curso));
end $$;

create or replace function public.academia_otorgar_insignia(p_user uuid, p_insignia text)
returns void language plpgsql security definer set search_path = public as $$
declare v_pts int; v_rep boolean;
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  select puntos, coalesce((regla->>'repetible')::boolean, false) or id = 'empleado_del_mes'
    into v_pts, v_rep from academia_insignias where id = p_insignia;
  if v_pts is null then raise exception 'Insignia no existe'; end if;
  insert into academia_insignias_usuario (user_id, insignia_id, otorgada_por)
  values (p_user, p_insignia, auth.uid()) on conflict do nothing;
  -- Las insignias "repetibles" (ej. del mes) dan puntos una vez por mes.
  perform academia_dar_puntos(p_user, v_pts, 'insignia',
    p_insignia || case when v_rep then '_' || to_char(academia_hoy(), 'YYYY-MM') else '' end);
end $$;

-- Permisos: las funciones de cálculo son internas.
do $$
declare f text;
begin
  foreach f in array array['academia_cfgn(text,numeric)', 'academia_puntos_leccion(uuid)', 'academia_puntos_curso(uuid)',
                           'academia_puntos_quiz(uuid)', 'academia_puntos_a_tiempo(uuid)', 'academia_cerrar_curso(uuid,uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['academia_registrar_avance(uuid,int,int,text)', 'academia_enviar_quiz(uuid,jsonb)', 'academia_otorgar_insignia(uuid,text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
