-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 3: materiales de solo lectura
--  Cada material puede ser "solo lectura" (por defecto) o "descargable".
--  Cómo usarlo: Supabase → SQL Editor → New query → pega → Run.
--  Se puede volver a correr sin problema.
-- =====================================================================
alter table public.academia_materiales
  add column if not exists descargable boolean not null default false;
