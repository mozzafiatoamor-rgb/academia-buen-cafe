-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 12: aplicar el nuevo valor de una
--  insignia a quienes ya la tienen.
--  Los puntos se guardan con el valor que tenía la insignia el día que
--  se ganó. Con esto, el admin puede (si quiere) actualizarlos al valor
--  de hoy: primero ve una vista previa y luego decide.
--  Requiere los pasos 1 a 11. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================

-- ¿Este registro de puntos es de esta insignia? (incluye las repetibles: id_AAAA-MM)
create or replace function public.academia_ref_de_insignia(p_ref text, p_id text)
returns boolean language sql immutable as $$
  select p_ref = p_id
      or (left(p_ref, length(p_id) + 1) = p_id || '_' and substr(p_ref, length(p_id) + 2) ~ '^\d{4}-\d{2}$');
$$;

-- Vista previa (p_aplicar = false) o aplicar (true). p_insignia null = todas.
create or replace function public.academia_admin_ajustar_insignias(p_insignia text, p_aplicar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  with filas as (
    select pt.id, pt.user_id, pt.puntos as antes, i.puntos as ahora, i.id as insignia, i.nombre as nombre_insignia
    from academia_puntos pt
    join academia_insignias i on pt.motivo = 'insignia' and academia_ref_de_insignia(pt.ref, i.id)
    where (p_insignia is null or i.id = p_insignia) and pt.puntos <> i.puntos
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', g.user_id, 'nombre', p.nombre, 'insignia', g.insignia, 'nombre_insignia', g.nombre_insignia,
      'veces', g.veces, 'antes', g.antes, 'ahora', g.ahora,
      'disponibles', (select coalesce(sum(puntos), 0) from academia_puntos where user_id = g.user_id and puntos > 0)
                   - (select coalesce(sum(costo), 0) from academia_canjes where user_id = g.user_id and estado in ('pendiente','aprobado'))
    ) order by p.nombre, g.nombre_insignia), '[]'::jsonb) into v
  from (select user_id, insignia, nombre_insignia, count(*) veces, sum(antes) antes, sum(ahora) ahora
        from filas group by user_id, insignia, nombre_insignia) g
  join academia_perfiles p on p.user_id = g.user_id;

  if p_aplicar then
    update academia_puntos pt set puntos = i.puntos,
      nota = 'Valor actualizado el ' || to_char(academia_hoy(), 'DD/MM/YYYY') || ' (antes ' || pt.puntos || ')'
    from academia_insignias i
    where pt.motivo = 'insignia' and academia_ref_de_insignia(pt.ref, i.id)
      and (p_insignia is null or i.id = p_insignia) and pt.puntos <> i.puntos;
  end if;
  return v;
end $$;

-- La ficha del empleado ahora reconoce también las insignias repetibles (id_AAAA-MM).
create or replace function public.academia_detalle_puntos(p_motivo text, p_ref text, p_nota text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(case
    when p_motivo = 'leccion' then (select l.titulo || ' · ' || c.titulo from academia_lecciones l
                                    join academia_cursos c on c.id = l.curso_id where l.id::text = p_ref)
    when p_motivo in ('curso', 'quiz_perfecto', 'a_tiempo') then (select titulo from academia_cursos where id::text = p_ref)
    when p_motivo = 'insignia' then (select nombre || case when p_ref <> id then ' · ' || substr(p_ref, length(id) + 2) else '' end
                                     from academia_insignias where academia_ref_de_insignia(p_ref, id) limit 1)
                                    || coalesce(' · ' || p_nota, '')
    when p_motivo = 'audio' then (select titulo from academia_audiolibros where id::text = split_part(p_ref, ':', 1))
                                 || case when split_part(p_ref, ':', 2) = 'fin' then ' · final'
                                         when split_part(p_ref, ':', 2) <> '' then ' · tramo ' || split_part(p_ref, ':', 2) else '' end
    when p_motivo in ('audiolibro', 'audio_a_tiempo') then (select titulo from academia_audiolibros where id::text = p_ref)
    when p_motivo = 'idea' then (select left(coalesce(nullif(texto, ''), 'Nota de voz / foto'), 90) from academia_ideas where id::text = p_ref)
  end, p_nota, nullif(p_ref, ''), '');
$$;

revoke all on function public.academia_detalle_puntos(text,text,text) from public, anon, authenticated;
revoke all on function public.academia_admin_ajustar_insignias(text,boolean) from public, anon;
grant execute on function public.academia_admin_ajustar_insignias(text,boolean) to authenticated;
