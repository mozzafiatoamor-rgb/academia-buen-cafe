-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 9: premios que motivan
--  - Foto de cada premio, premios destacados y por tiempo limitado.
--  - "Mi meta": cada empleado elige el premio por el que va.
--  Requiere el paso 7 (portadas). Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================
alter table public.academia_premios add column if not exists imagen_url text;
alter table public.academia_premios add column if not exists destacado boolean not null default false;
alter table public.academia_premios add column if not exists disponible_hasta date;   -- vacío = siempre

alter table public.academia_perfiles add column if not exists meta_premio uuid
  references public.academia_premios(id) on delete set null;

-- El empleado elige (o quita) su meta.
create or replace function public.academia_fijar_meta(p_premio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from academia_perfiles where user_id = auth.uid() and activo) then
    raise exception 'Sin sesión válida';
  end if;
  if p_premio is not null and not exists (select 1 from academia_premios where id = p_premio and activo) then
    raise exception 'Premio no disponible';
  end if;
  update academia_perfiles set meta_premio = p_premio where user_id = auth.uid();
end $$;

-- Canjear: ahora también respeta la fecha límite del premio.
create or replace function public.academia_solicitar_canje(p_premio uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_costo int; v_disp int;
  v_id uuid;
begin
  if v_user is null or not exists (select 1 from academia_perfiles where user_id = v_user and activo) then
    raise exception 'Sin sesión válida';
  end if;
  select costo into v_costo from academia_premios
    where id = p_premio and activo and (disponible_hasta is null or disponible_hasta >= academia_hoy());
  if v_costo is null then raise exception 'Premio no disponible'; end if;

  perform pg_advisory_xact_lock(hashtext('academia_canje_' || v_user::text));

  select (select coalesce(sum(puntos), 0) from academia_puntos where user_id = v_user and puntos > 0)
       - (select coalesce(sum(costo), 0) from academia_canjes where user_id = v_user and estado in ('pendiente','aprobado'))
    into v_disp;
  if v_disp < v_costo then
    raise exception 'Te faltan % puntos', v_costo - v_disp;
  end if;

  insert into academia_canjes (user_id, premio_id, costo) values (v_user, p_premio, v_costo)
  returning id into v_id;
  -- Si era su meta, se libera para que elija la siguiente.
  update academia_perfiles set meta_premio = null where user_id = v_user and meta_premio = p_premio;
  return jsonb_build_object('id', v_id, 'disponibles', v_disp - v_costo);
end $$;

revoke all on function public.academia_fijar_meta(uuid) from public, anon;
grant execute on function public.academia_fijar_meta(uuid) to authenticated;
revoke all on function public.academia_solicitar_canje(uuid) from public, anon;
grant execute on function public.academia_solicitar_canje(uuid) to authenticated;
