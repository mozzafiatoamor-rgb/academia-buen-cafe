-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 7: portadas de cursos y audiolibros
--  - Bucket público "academia-portadas" (solo imágenes, máx. 2 MB).
--    Las portadas se ven sin iniciar sesión (como cualquier imagen de una web);
--    solo el admin puede subir, cambiar o borrar.
--  - El catálogo de cursos ahora incluye la portada.
--  Requiere el paso 5. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academia-portadas', 'academia-portadas', true, 2097152,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists "academia_portadas_admin" on storage.objects;
create policy "academia_portadas_admin" on storage.objects for all to authenticated
  using (bucket_id = 'academia-portadas' and public.academia_es_admin())
  with check (bucket_id = 'academia-portadas' and public.academia_es_admin());

create or replace function public.academia_catalogo_cursos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'titulo', c.titulo, 'descripcion', c.descripcion, 'categoria', c.categoria,
      'portada_url', c.portada_url,
      'lecciones', (select count(*) from academia_lecciones where curso_id = c.id),
      'duracion_seg', (select coalesce(sum(duracion_seg), 0) from academia_lecciones where curso_id = c.id),
      'asignado', academia_curso_asignado(auth.uid(), c.id),
      'terminado', academia_curso_terminado(auth.uid(), c.id)
    ) order by c.orden, c.titulo), '[]'::jsonb)
  from academia_cursos c
  where c.publicado and auth.uid() is not null;
$$;
