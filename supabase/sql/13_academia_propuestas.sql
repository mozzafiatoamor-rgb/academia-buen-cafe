-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 13: propuestas pendientes
--  "Para reconocer" ahora también muestra quién terminó un curso y
--  todavía no envía su propuesta por escrito.
--  Requiere los pasos 1 a 12. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================
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
            and academia_curso_terminado(p.user_id, c.id)), '[]'::jsonb),
        -- Cursos terminados sin ninguna propuesta (idea) enviada.
        'sin_propuesta', coalesce((
          select jsonb_agg(jsonb_build_object('curso_id', c.id, 'titulo', c.titulo,
                   'terminado_en', academia_fecha_termino(p.user_id, c.id))
                 order by academia_fecha_termino(p.user_id, c.id) desc)
          from academia_cursos c
          where exists (select 1 from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
                        where l.curso_id = c.id and pr.user_id = p.user_id and pr.completado)
            and academia_curso_terminado(p.user_id, c.id)
            and not exists (select 1 from academia_ideas i where i.user_id = p.user_id and i.curso_id = c.id)), '[]'::jsonb)
      ) as x
      from academia_perfiles p where p.rol = 'empleado' and p.activo
    ) t), '[]'::jsonb);
end $$;

revoke all on function public.academia_admin_reconocer() from public, anon;
grant execute on function public.academia_admin_reconocer() to authenticated;
