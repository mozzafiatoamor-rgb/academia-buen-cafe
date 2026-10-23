-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 8: avatares
--  Cada empleado arma su personaje (pelo, ojos, ropa, gorros, marcos…).
--  Se guarda solo la "receta" del avatar (un JSON chiquito), no imágenes.
--  Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================
alter table public.academia_perfiles add column if not exists avatar jsonb;

-- El empleado guarda su propio avatar.
create or replace function public.academia_guardar_avatar(p_avatar jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from academia_perfiles where user_id = auth.uid() and activo) then
    raise exception 'Sin sesión válida';
  end if;
  if p_avatar is not null and (jsonb_typeof(p_avatar) <> 'object' or length(p_avatar::text) > 2000) then
    raise exception 'Avatar inválido';
  end if;
  update academia_perfiles set avatar = p_avatar where user_id = auth.uid();
end $$;

-- Avatares del equipo (para el ranking): { "user_id": {…}, … }
create or replace function public.academia_avatares()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(user_id, avatar), '{}'::jsonb)
  from academia_perfiles
  where activo and avatar is not null and auth.uid() is not null;
$$;

revoke all on function public.academia_guardar_avatar(jsonb) from public, anon;
grant execute on function public.academia_guardar_avatar(jsonb) to authenticated;
revoke all on function public.academia_avatares() from public, anon;
grant execute on function public.academia_avatares() to authenticated;
