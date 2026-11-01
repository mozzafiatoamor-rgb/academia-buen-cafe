-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 14: nombre completo para diplomas
--  - Cada persona tiene su "nombre para mostrar" (el de siempre) y su
--    "nombre completo" para los diplomas.
--  - El empleado los cambia desde su perfil; el admin también puede.
--  Requiere los pasos 1 a 13. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================
alter table public.academia_perfiles add column if not exists nombre_completo text;
alter table public.academia_perfiles drop constraint if exists academia_nombre_completo_largo;
alter table public.academia_perfiles add constraint academia_nombre_completo_largo
  check (nombre_completo is null or length(nombre_completo) <= 120);

-- Mis nombres (empleado).
create or replace function public.academia_mis_nombres()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nombre', nombre, 'nombre_completo', nombre_completo)
  from academia_perfiles where user_id = auth.uid();
$$;

-- Guardar nombres. p_user vacío = yo; otra persona = solo admin.
-- p_nombre vacío = no cambia el nombre para mostrar.
create or replace function public.academia_guardar_nombres(p_nombre text, p_nombre_completo text, p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := coalesce(p_user, auth.uid()); v_nombre text := btrim(coalesce(p_nombre, '')); v_completo text := nullif(btrim(coalesce(p_nombre_completo, '')), '');
begin
  if not academia_activo() then raise exception 'Sin sesión válida'; end if;
  if v_user <> auth.uid() and not academia_es_admin() then raise exception 'Solo administrador'; end if;
  if v_nombre <> '' and (length(v_nombre) < 2 or length(v_nombre) > 40) then raise exception 'El nombre para mostrar debe tener entre 2 y 40 letras'; end if;
  if v_completo is not null and length(v_completo) > 120 then raise exception 'El nombre completo es demasiado largo'; end if;
  update academia_perfiles
     set nombre = case when v_nombre <> '' then v_nombre else nombre end,
         nombre_completo = v_completo
   where user_id = v_user;
end $$;

-- Admin: nombres completos de todo el equipo { user_id: "Nombre Completo" }.
create or replace function public.academia_nombres_completos()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  return coalesce((select jsonb_object_agg(user_id, nombre_completo) from academia_perfiles where nombre_completo is not null), '{}'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array['academia_mis_nombres()', 'academia_guardar_nombres(text,text,uuid)', 'academia_nombres_completos()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
