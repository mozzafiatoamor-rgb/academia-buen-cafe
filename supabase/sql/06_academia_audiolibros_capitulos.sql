-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Paso 6: audiolibros en varios archivos
--  Un audiolibro puede ser un solo archivo (MP3/M4B) o una carpeta con un
--  archivo por capítulo. Aquí se guarda la lista de archivos en orden:
--    [{ "ruta": "liderazgo/mi-libro/01-intro.mp3", "dur": 312, "titulo": "Intro" }, ...]
--  Requiere el paso 5. Se puede volver a correr.
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- =====================================================================
alter table public.academia_audiolibros
  add column if not exists archivos jsonb not null default '[]'::jsonb;
