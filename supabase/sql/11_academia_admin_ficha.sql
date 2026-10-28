-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 11: ficha del empleado y "para reconocer"
--  - Ficha: de dónde salió cada punto, avance curso por curso y en
--    audiolibros, insignias, canjes e ideas.
--  - Para reconocer: a quién ya le alcanza un premio y quién tiene
--    diplomas listos (cursos terminados con certificado).
--  Solo lectura, solo para el admin. Requiere los pasos 1 a 10.
--  Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================

-- Texto legible de cada movimiento de puntos.
create or replace function public.academia_detalle_puntos(p_motivo text, p_ref text, p_nota text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(case
    when p_motivo = 'leccion' then (select l.titulo || ' · ' || c.titulo from academia_lecciones l
                                    join academia_cursos c on c.id = l.curso_id where l.id::text = p_ref)
    when p_motivo in ('curso', 'quiz_perfecto', 'a_tiempo') then (select titulo from academia_cursos where id::text = p_ref)
    when p_motivo = 'insignia' then (select nombre from academia_insignias where id = p_ref)
    when p_motivo = 'audio' then (select titulo from academia_audiolibros where id::text = split_part(p_ref, ':', 1))
                                 || case when split_part(p_ref, ':', 2) = 'fin' then ' · final'
                                         when split_part(p_ref, ':', 2) <> '' then ' · tramo ' || split_part(p_ref, ':', 2) else '' end
    when p_motivo in ('audiolibro', 'audio_a_tiempo') then (select titulo from academia_audiolibros where id::text = p_ref)
    when p_motivo = 'idea' then (select left(coalesce(nullif(texto, ''), 'Nota de voz / foto'), 90) from academia_ideas where id::text = p_ref)
  end, p_nota, nullif(p_ref, ''), '');
$$;

-- Fecha en que terminó un curso (última lección o quiz aprobado).
create or replace function public.academia_fecha_termino(p_user uuid, p_curso uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
    (select max(pr.completado_en) from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
      where l.curso_id = p_curso and pr.user_id = p_user and pr.completado),
    (select min(creado_en) from academia_quiz_intentos where user_id = p_user and curso_id = p_curso and aprobado));
$$;

-- ---------- Ficha completa de una persona ----------
create or replace function public.academia_admin_ficha(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p academia_perfiles; v_ganados int; v_gastados int; v_racha record; v_nivel text;
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  select * into p from academia_perfiles where user_id = p_user;
  if p.user_id is null then raise exception 'Empleado no encontrado'; end if;
  select coalesce(sum(puntos), 0) into v_ganados from academia_puntos where user_id = p_user and puntos > 0;
  select coalesce(sum(costo), 0) into v_gastados from academia_canjes where user_id = p_user and estado in ('pendiente','aprobado');
  select * into v_racha from academia_racha(p_user);
  select nombre into v_nivel from academia_niveles where puntos_min <= v_ganados order by puntos_min desc limit 1;

  return jsonb_build_object(
    'perfil', jsonb_build_object('user_id', p.user_id, 'nombre', p.nombre, 'usuario', p.usuario, 'area', p.area,
                                 'sede', p.sede, 'turno', p.turno, 'activo', p.activo, 'meta_premio', p.meta_premio),
    'ganados', v_ganados, 'disponibles', v_ganados - v_gastados, 'nivel', v_nivel,
    'racha_actual', v_racha.actual, 'racha_maxima', v_racha.maxima,
    'por_motivo', coalesce((select jsonb_agg(jsonb_build_object('motivo', motivo, 'puntos', s, 'veces', n) order by s desc)
                            from (select motivo, sum(puntos) s, count(*) n from academia_puntos where user_id = p_user group by motivo) m), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('puntos', puntos, 'motivo', motivo, 'creado_en', creado_en,
                              'detalle', academia_detalle_puntos(motivo, ref, nota)) order by creado_en desc)
                           from (select * from academia_puntos where user_id = p_user order by creado_en desc limit 400) h), '[]'::jsonb),
    'cursos', coalesce((select jsonb_agg(x order by (x->>'terminado')::boolean, x->>'titulo') from (
        select jsonb_build_object(
          'id', c.id, 'titulo', c.titulo, 'publicado', c.publicado, 'certificado', c.certificado,
          'asignado', academia_curso_asignado(p_user, c.id),
          'fecha_limite', academia_fecha_limite(p_user, c.id),
          'lecciones', (select count(*) from academia_lecciones where curso_id = c.id),
          'completadas', (select count(*) from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
                          where l.curso_id = c.id and pr.user_id = p_user and pr.completado),
          'duracion_seg', (select coalesce(sum(duracion_seg), 0) from academia_lecciones where curso_id = c.id),
          'terminado', academia_curso_terminado(p_user, c.id),
          'terminado_en', case when academia_curso_terminado(p_user, c.id) then academia_fecha_termino(p_user, c.id) end,
          'quiz_mejor', (select max(puntaje) from academia_quiz_intentos where user_id = p_user and curso_id = c.id),
          'ultima_actividad', (select max(pr.actualizado) from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
                               where l.curso_id = c.id and pr.user_id = p_user)
        ) as x
        from academia_cursos c
        where (c.publicado and academia_curso_asignado(p_user, c.id))
           or exists (select 1 from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
                      where l.curso_id = c.id and pr.user_id = p_user)
      ) t), '[]'::jsonb),
    'audiolibros', coalesce((select jsonb_agg(jsonb_build_object(
          'id', b.id, 'titulo', b.titulo, 'duracion_seg', b.duracion_seg,
          'asignado', academia_audio_asignado(p_user, b.id),
          'escuchado', coalesce(ap.max_segundo, 0), 'completado', coalesce(ap.completado, false),
          'completado_en', ap.completado_en, 'ultima_actividad', ap.actualizado) order by b.titulo)
        from academia_audiolibros b
        left join academia_audio_progreso ap on ap.audiolibro_id = b.id and ap.user_id = p_user
        where (b.publicado and academia_audio_asignado(p_user, b.id)) or ap.user_id is not null), '[]'::jsonb),
    'insignias', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'icono', i.icono,
                              'nivel', i.nivel, 'otorgada_en', u.otorgada_en) order by u.otorgada_en desc)
                           from academia_insignias_usuario u join academia_insignias i on i.id = u.insignia_id
                           where u.user_id = p_user), '[]'::jsonb),
    'canjes', coalesce((select jsonb_agg(jsonb_build_object('premio', pr.nombre, 'costo', k.costo, 'estado', k.estado,
                           'creado_en', k.creado_en) order by k.creado_en desc)
                        from academia_canjes k join academia_premios pr on pr.id = k.premio_id where k.user_id = p_user), '[]'::jsonb),
    'ideas', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from academia_ideas
                        where user_id = p_user group by estado) z), '{}'::jsonb)
  );
end $$;

-- ---------- Para reconocer: saldos y diplomas de todo el equipo ----------
create or replace function public.academia_admin_reconocer()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'nombre') from (
      select jsonb_build_object(
        'user_id', p.user_id, 'nombre', p.nombre, 'usuario', p.usuario, 'area', p.area, 'sede', p.sede,
        'meta_premio', p.meta_premio,
        'disponibles', (select coalesce(sum(puntos), 0) from academia_puntos where user_id = p.user_id and puntos > 0)
                     - (select coalesce(sum(costo), 0) from academia_canjes where user_id = p.user_id and estado in ('pendiente','aprobado')),
        'diplomas', coalesce((
          select jsonb_agg(jsonb_build_object('curso_id', c.id, 'titulo', c.titulo,
                   'terminado_en', academia_fecha_termino(p.user_id, c.id),
                   'duracion_seg', (select coalesce(sum(duracion_seg), 0) from academia_lecciones where curso_id = c.id),
                   'quiz_mejor', (select max(puntaje) from academia_quiz_intentos where user_id = p.user_id and curso_id = c.id))
                 order by academia_fecha_termino(p.user_id, c.id) desc)
          from academia_cursos c
          where c.certificado
            and exists (select 1 from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
                        where l.curso_id = c.id and pr.user_id = p.user_id and pr.completado)
            and academia_curso_terminado(p.user_id, c.id)), '[]'::jsonb)
      ) as x
      from academia_perfiles p where p.rol = 'empleado' and p.activo
    ) t), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array['academia_detalle_puntos(text,text,text)', 'academia_fecha_termino(uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['academia_admin_ficha(uuid)', 'academia_admin_reconocer()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
