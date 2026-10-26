-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 10: "Mi libreta" y "Ideas del equipo"
--  - Notas de cada empleado (texto, nota de voz y foto), ligadas al
--    minuto exacto del video.
--  - Ideas que el empleado te propone desde una nota; tú les cambias el
--    estado (nueva → la vamos a probar → implementada / descartada) y
--    puedes dar puntos de bono (una sola vez por idea).
--  - Bucket privado "academia-libreta" para audios y fotos: cada quien
--    solo ve lo suyo; tú (admin) ves todo y puedes borrar para liberar espacio.
--  Requiere los pasos 1 a 9. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================

-- ---------- Archivos (privado, máx. 3 MB por archivo) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academia-libreta', 'academia-libreta', false, 3145728,
        array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac','audio/x-m4a',
              'image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 3145728,
  allowed_mime_types = array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac','audio/x-m4a',
                             'image/webp','image/jpeg','image/png'];

-- ¿El usuario actual es un empleado (o admin) activo?
create or replace function public.academia_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from academia_perfiles where user_id = auth.uid() and activo);
$$;

drop policy if exists "academia_libreta_propia" on storage.objects;
create policy "academia_libreta_propia" on storage.objects for all to authenticated
  using (bucket_id = 'academia-libreta' and (storage.foldername(name))[1] = auth.uid()::text and public.academia_activo())
  with check (bucket_id = 'academia-libreta' and (storage.foldername(name))[1] = auth.uid()::text and public.academia_activo());

drop policy if exists "academia_libreta_admin" on storage.objects;
create policy "academia_libreta_admin" on storage.objects for all to authenticated
  using (bucket_id = 'academia-libreta' and public.academia_es_admin())
  with check (bucket_id = 'academia-libreta' and public.academia_es_admin());

-- ---------- Notas ----------
create table if not exists public.academia_notas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.academia_perfiles(user_id) on delete cascade,
  curso_id        uuid references public.academia_cursos(id) on delete set null,
  leccion_id      uuid references public.academia_lecciones(id) on delete set null,
  segundo         int check (segundo is null or segundo >= 0),
  referencia      text check (referencia is null or length(referencia) <= 300),  -- "Curso · Lección"
  texto           text not null default '' check (length(texto) <= 4000),
  audio_path      text,
  audio_seg       int,
  foto_path       text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists academia_notas_user on public.academia_notas (user_id, creado_en desc);

alter table public.academia_notas enable row level security;
drop policy if exists "academia_notas_propias" on public.academia_notas;
create policy "academia_notas_propias" on public.academia_notas for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid() and public.academia_activo()
    and (audio_path is null or audio_path like auth.uid()::text || '/%')
    and (foto_path is null or foto_path like auth.uid()::text || '/%')
  );
drop policy if exists "academia_notas_admin" on public.academia_notas;
create policy "academia_notas_admin" on public.academia_notas for all to authenticated
  using (public.academia_es_admin()) with check (public.academia_es_admin());

-- ---------- Ideas ----------
create table if not exists public.academia_ideas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.academia_perfiles(user_id) on delete cascade,
  nota_id         uuid unique references public.academia_notas(id) on delete set null,
  curso_id        uuid references public.academia_cursos(id) on delete set null,
  leccion_id      uuid references public.academia_lecciones(id) on delete set null,
  segundo         int,
  referencia      text,
  texto           text not null default '' check (length(texto) <= 4000),
  audio_path      text,
  audio_seg       int,
  foto_path       text,
  estado          text not null default 'nueva' check (estado in ('nueva','probando','implementada','descartada')),
  respuesta       text check (respuesta is null or length(respuesta) <= 2000),
  puntos          int not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists academia_ideas_estado on public.academia_ideas (estado, creado_en desc);

alter table public.academia_ideas enable row level security;
drop policy if exists "academia_ideas_ver_propias" on public.academia_ideas;
create policy "academia_ideas_ver_propias" on public.academia_ideas for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "academia_ideas_retirar" on public.academia_ideas;
create policy "academia_ideas_retirar" on public.academia_ideas for delete to authenticated
  using (user_id = auth.uid() and estado = 'nueva');
drop policy if exists "academia_ideas_admin" on public.academia_ideas;
create policy "academia_ideas_admin" on public.academia_ideas for all to authenticated
  using (public.academia_es_admin()) with check (public.academia_es_admin());

alter table public.academia_perfiles add column if not exists libreta_respaldo_en timestamptz;

insert into public.academia_config (clave, valor) values ('puntos_idea', '50') on conflict (clave) do nothing;

-- El empleado propone una de sus notas como idea (si ya la propuso y sigue
-- "nueva", se actualiza con lo último de la nota).
create or replace function public.academia_proponer_idea(p_nota uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n academia_notas; v_id uuid; v_estado text;
begin
  if not academia_activo() then raise exception 'Sin sesión válida'; end if;
  select * into n from academia_notas where id = p_nota and user_id = auth.uid();
  if n.id is null then raise exception 'Nota no encontrada'; end if;
  if btrim(n.texto) = '' and n.audio_path is null and n.foto_path is null then
    raise exception 'La nota está vacía';
  end if;
  select id, estado into v_id, v_estado from academia_ideas where nota_id = n.id;
  if v_id is not null then
    if v_estado <> 'nueva' then raise exception 'Esa idea ya la está revisando Gustavo'; end if;
    update academia_ideas set texto = n.texto, audio_path = n.audio_path, audio_seg = n.audio_seg,
      foto_path = n.foto_path, referencia = n.referencia, segundo = n.segundo, actualizado_en = now() where id = v_id;
  else
    insert into academia_ideas (user_id, nota_id, curso_id, leccion_id, segundo, referencia, texto, audio_path, audio_seg, foto_path)
    values (n.user_id, n.id, n.curso_id, n.leccion_id, n.segundo, n.referencia, n.texto, n.audio_path, n.audio_seg, n.foto_path)
    returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- El admin responde: cambia estado, deja comentario y (si se implementa) da puntos una sola vez.
create or replace function public.academia_responder_idea(p_id uuid, p_estado text, p_respuesta text, p_puntos int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i academia_ideas; v_pts int := 0;
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  if p_estado not in ('nueva','probando','implementada','descartada') then raise exception 'Estado inválido'; end if;
  select * into i from academia_ideas where id = p_id;
  if i.id is null then raise exception 'Idea no encontrada'; end if;
  if p_estado = 'implementada' and coalesce(p_puntos, 0) > 0 then
    v_pts := academia_dar_puntos(i.user_id, least(p_puntos, 1000), 'idea', i.id::text, 'Idea implementada');
  end if;
  update academia_ideas set estado = p_estado, respuesta = nullif(btrim(coalesce(p_respuesta, '')), ''),
    puntos = puntos + v_pts, actualizado_en = now()
  where id = p_id;
  return jsonb_build_object('puntos_dados', v_pts);
end $$;

-- El empleado marca que ya descargó su respaldo.
create or replace function public.academia_marcar_respaldo()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v timestamptz := now();
begin
  if not academia_activo() then raise exception 'Sin sesión válida'; end if;
  update academia_perfiles set libreta_respaldo_en = v where user_id = auth.uid();
  return v;
end $$;

-- Admin: cuánto ocupa la libreta de cada quien y si ya descargó su respaldo.
create or replace function public.academia_libretas_resumen()
returns jsonb language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'nombre') from (
      select jsonb_build_object(
        'user_id', p.user_id, 'nombre', p.nombre, 'activo', p.activo,
        'notas', (select count(*) from academia_notas n where n.user_id = p.user_id),
        'ultima_nota', (select max(actualizado_en) from academia_notas n where n.user_id = p.user_id),
        'ideas', (select count(*) from academia_ideas i where i.user_id = p.user_id),
        'archivos', (select count(*) from storage.objects o
                      where o.bucket_id = 'academia-libreta' and (storage.foldername(o.name))[1] = p.user_id::text),
        'bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o
                   where o.bucket_id = 'academia-libreta' and (storage.foldername(o.name))[1] = p.user_id::text),
        'respaldo_en', p.libreta_respaldo_en
      ) as x
      from academia_perfiles p
      where p.rol = 'empleado'
        and (exists (select 1 from academia_notas n where n.user_id = p.user_id)
             or exists (select 1 from storage.objects o where o.bucket_id = 'academia-libreta'
                        and (storage.foldername(o.name))[1] = p.user_id::text))
    ) t), '[]'::jsonb);
end $$;

-- Admin: archivos que se pueden borrar de la nube de una persona.
-- No toca los de ideas que siguen abiertas (nueva / probando).
-- p_solo_terminados = solo notas de cursos que esa persona ya terminó.
create or replace function public.academia_libreta_archivos(p_user uuid, p_solo_terminados boolean)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare v text[];
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  with candidatas as (
    select n.audio_path as ruta, n.curso_id from academia_notas n where n.user_id = p_user and n.audio_path is not null
    union all
    select n.foto_path, n.curso_id from academia_notas n where n.user_id = p_user and n.foto_path is not null
    union all
    select i.audio_path, i.curso_id from academia_ideas i where i.user_id = p_user and i.audio_path is not null and i.estado in ('implementada','descartada')
    union all
    select i.foto_path, i.curso_id from academia_ideas i where i.user_id = p_user and i.foto_path is not null and i.estado in ('implementada','descartada')
  ), abiertas as (
    select audio_path as ruta from academia_ideas where user_id = p_user and estado in ('nueva','probando') and audio_path is not null
    union select foto_path from academia_ideas where user_id = p_user and estado in ('nueva','probando') and foto_path is not null
  )
  select coalesce(array_agg(distinct c.ruta), '{}') into v
  from candidatas c
  where c.ruta not in (select ruta from abiertas)
    and (not p_solo_terminados or (c.curso_id is not null and academia_curso_terminado(p_user, c.curso_id)));
  return v;
end $$;

-- Admin: después de borrar los archivos, limpia las referencias y (opcional) el texto.
create or replace function public.academia_libreta_limpiar(p_user uuid, p_rutas text[], p_borrar_texto boolean, p_solo_terminados boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_notas int := 0;
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  update academia_notas set audio_path = null, audio_seg = null where user_id = p_user and audio_path = any(p_rutas);
  update academia_notas set foto_path = null where user_id = p_user and foto_path = any(p_rutas);
  update academia_ideas set audio_path = null, audio_seg = null where user_id = p_user and audio_path = any(p_rutas);
  update academia_ideas set foto_path = null where user_id = p_user and foto_path = any(p_rutas);
  if p_borrar_texto then
    delete from academia_notas n
    where n.user_id = p_user
      and n.audio_path is null and n.foto_path is null
      and not exists (select 1 from academia_ideas i where i.nota_id = n.id and i.estado in ('nueva','probando'))
      and (not p_solo_terminados or (n.curso_id is not null and academia_curso_terminado(p_user, n.curso_id)));
    get diagnostics v_notas = row_count;
  end if;
  return jsonb_build_object('notas_borradas', v_notas);
end $$;

revoke all on public.academia_notas, public.academia_ideas from anon;
grant select, insert, update, delete on public.academia_notas, public.academia_ideas to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'academia_activo()', 'academia_proponer_idea(uuid)', 'academia_responder_idea(uuid,text,text,int)',
    'academia_marcar_respaldo()', 'academia_libretas_resumen()', 'academia_libreta_archivos(uuid,boolean)',
    'academia_libreta_limpiar(uuid,text[],boolean,boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
