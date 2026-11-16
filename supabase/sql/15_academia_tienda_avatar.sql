-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 15: Tienda del avatar
--  Piezas divertidas para el avatar que se compran con pocos puntos.
--  - Cada compra se guarda como un canje ya aprobado de un premio interno
--    ("Tienda del avatar"): así descuenta de los puntos disponibles igual
--    que los premios, sin tocar el nivel ni el ranking.
--  - Los precios viven aquí (el celular no los puede cambiar).
--  Requiere los pasos 1 a 14. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================

alter table public.academia_premios add column if not exists interno boolean not null default false;

-- Premio interno (no se ve en la lista de premios).
insert into public.academia_premios (id, nombre, descripcion, costo, activo, orden, interno)
values ('a0a0a0a0-0000-4000-8000-000000000001', 'Tienda del avatar', 'Compras de piezas para el avatar', 1, false, 999, true)
on conflict (id) do update set interno = true, activo = false;

create table if not exists public.academia_tienda_piezas (
  id         text primary key,            -- "categoria:opcion", igual que en la app
  nombre     text not null,
  categoria  text not null,
  costo      int not null check (costo > 0),
  activo     boolean not null default true,
  orden      int not null default 0
);

insert into public.academia_tienda_piezas (id, nombre, categoria, costo, orden) values
  ('lentes:nerd',      'Lentes nerd',        'lentes',  20, 1),
  ('vello:bigotazo',   'Bigotazo',           'vello',   20, 2),
  ('detalle:gato',     'Bigotes de gato',    'detalle', 20, 3),
  ('cabeza:fiesta',    'Gorro de fiesta',    'cabeza',  25, 4),
  ('boca:chicle',      'Bomba de chicle',    'boca',    25, 5),
  ('extra:dona',       'Dona',               'extra',   25, 6),
  ('lentes:3d',        'Lentes 3D',          'lentes',  30, 7),
  ('cabeza:antenas',   'Antenas de alien',   'cabeza',  30, 8),
  ('extra:globo',      'Globo',              'extra',   30, 9),
  ('fondo:corazones',  'Corazones',          'fondo',   30, 10),
  ('lentes:monoculo',  'Monóculo',           'lentes',  35, 11),
  ('cabeza:copa',      'Sombrero de copa',   'cabeza',  40, 12),
  ('fondo:playa',      'Playa',              'fondo',   40, 13),
  ('cabeza:mago',      'Sombrero de mago',   'cabeza',  50, 14),
  ('marco:neon',       'Marco neón',         'marco',   50, 15),
  ('cabeza:vikingo',   'Casco vikingo',      'cabeza',  60, 16)
on conflict (id) do update set nombre = excluded.nombre, categoria = excluded.categoria, orden = excluded.orden;

create table if not exists public.academia_avatar_compras (
  user_id    uuid not null references public.academia_perfiles(user_id) on delete cascade,
  pieza_id   text not null references public.academia_tienda_piezas(id),
  costo      int not null,
  canje_id   uuid references public.academia_canjes(id) on delete set null,
  creado_en  timestamptz not null default now(),
  primary key (user_id, pieza_id)
);

alter table public.academia_tienda_piezas enable row level security;
alter table public.academia_avatar_compras enable row level security;
drop policy if exists "academia_tienda_ver" on public.academia_tienda_piezas;
create policy "academia_tienda_ver" on public.academia_tienda_piezas for select to authenticated using (true);
drop policy if exists "academia_tienda_admin" on public.academia_tienda_piezas;
create policy "academia_tienda_admin" on public.academia_tienda_piezas for all to authenticated
  using (public.academia_es_admin()) with check (public.academia_es_admin());
drop policy if exists "academia_compras_ver" on public.academia_avatar_compras;
create policy "academia_compras_ver" on public.academia_avatar_compras for select to authenticated
  using (user_id = auth.uid() or public.academia_es_admin());
revoke all on public.academia_tienda_piezas, public.academia_avatar_compras from anon;
grant select on public.academia_tienda_piezas, public.academia_avatar_compras to authenticated;

-- Catálogo + lo que ya tengo + mis puntos disponibles.
create or replace function public.academia_tienda()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if not academia_activo() then raise exception 'Sin sesión válida'; end if;
  return jsonb_build_object(
    'piezas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'categoria', categoria, 'costo', costo) order by orden, costo)
                        from academia_tienda_piezas where activo), '[]'::jsonb),
    'mias', coalesce((select jsonb_agg(pieza_id) from academia_avatar_compras where user_id = v_user), '[]'::jsonb),
    'disponibles', (select coalesce(sum(puntos), 0) from academia_puntos where user_id = v_user and puntos > 0)
                 - (select coalesce(sum(costo), 0) from academia_canjes where user_id = v_user and estado in ('pendiente','aprobado'))
  );
end $$;

-- Comprar una pieza (se descuenta de los puntos disponibles al instante).
create or replace function public.academia_comprar_pieza(p_pieza text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_costo int; v_disp int; v_canje uuid;
begin
  if not academia_activo() then raise exception 'Sin sesión válida'; end if;
  select costo into v_costo from academia_tienda_piezas where id = p_pieza and activo;
  if v_costo is null then raise exception 'Esa pieza no está en la tienda'; end if;
  perform pg_advisory_xact_lock(hashtext('academia_canje_' || v_user::text));
  if exists (select 1 from academia_avatar_compras where user_id = v_user and pieza_id = p_pieza) then
    raise exception 'Ya tienes esa pieza';
  end if;
  select (select coalesce(sum(puntos), 0) from academia_puntos where user_id = v_user and puntos > 0)
       - (select coalesce(sum(costo), 0) from academia_canjes where user_id = v_user and estado in ('pendiente','aprobado'))
    into v_disp;
  if v_disp < v_costo then raise exception 'Te faltan % puntos', v_costo - v_disp; end if;
  insert into academia_canjes (user_id, premio_id, costo, estado, nota, resuelto_en)
  values (v_user, 'a0a0a0a0-0000-4000-8000-000000000001', v_costo, 'aprobado', 'tienda:' || p_pieza, now())
  returning id into v_canje;
  insert into academia_avatar_compras (user_id, pieza_id, costo, canje_id) values (v_user, p_pieza, v_costo, v_canje);
  return jsonb_build_object('disponibles', v_disp - v_costo, 'costo', v_costo);
end $$;

revoke all on function public.academia_tienda() from public, anon;
grant execute on function public.academia_tienda() to authenticated;
revoke all on function public.academia_comprar_pieza(text) from public, anon;
grant execute on function public.academia_comprar_pieza(text) to authenticated;
