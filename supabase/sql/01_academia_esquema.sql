-- =====================================================================
--  ACADEMIA DEL BUEN CAFÉ · Esquema de base de datos (Supabase)
--  Paso 1 de la construcción.
--
--  Cómo usarlo:
--    1. Supabase → tu proyecto → SQL Editor → New query
--    2. Pega TODO este archivo y presiona "Run".
--    3. Al final, corre por separado el bloque "HAZTE ADMIN" (abajo del todo)
--       cambiando el correo por el que usas para entrar a Supabase/Gestor.
--
--  Seguro para tus otras apps: todo lleva el prefijo "academia_" y no toca
--  ninguna tabla del Gestor de Descansos ni de la App de Producción.
--  Se puede volver a correr sin duplicar nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Perfil de cada persona que usa la Academia (empleados y admin).
-- Se liga a una cuenta de Supabase Auth (usuario + PIN).
create table if not exists public.academia_perfiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  usuario     text not null unique,              -- ej. "ana.piso"
  nombre      text not null,
  area        text,                              -- piso | barra | cocina | ...
  sede        text,                              -- Mozzafiato | Casa Regina
  turno       text,                              -- AM | PM
  rol         text not null default 'empleado' check (rol in ('empleado','admin')),
  activo      boolean not null default true,
  gestor_id   text,                              -- id del empleado en el Gestor
  creado_en   timestamptz not null default now()
);

-- Ajustes de puntos (los puedes cambiar sin tocar código).
create table if not exists public.academia_config (
  clave  text primary key,
  valor  jsonb not null
);

-- Niveles por puntos (camino del tueste).
create table if not exists public.academia_niveles (
  orden       int primary key,
  nombre      text not null,
  puntos_min  int not null
);

-- Cursos.
create table if not exists public.academia_cursos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descripcion       text,
  categoria         text,                        -- barra | piso | cocina | general | casa_regina
  portada_url       text,
  quiz_obligatorio  boolean not null default false,
  quiz_minimo       int not null default 80,     -- % para aprobar
  certificado       boolean not null default true,
  publicado         boolean not null default false,
  orden             int not null default 0,
  creado_en         timestamptz not null default now()
);

create table if not exists public.academia_modulos (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid not null references public.academia_cursos(id) on delete cascade,
  titulo    text not null,
  orden     int not null default 0
);

create table if not exists public.academia_lecciones (
  id              uuid primary key default gen_random_uuid(),
  curso_id        uuid not null references public.academia_cursos(id) on delete cascade,
  modulo_id       uuid references public.academia_modulos(id) on delete set null,
  titulo          text not null,
  bunny_video_id  text,                          -- GUID del video en Bunny Stream
  duracion_seg    int,
  orden           int not null default 0
);

-- PDFs, recetas, fichas técnicas.
create table if not exists public.academia_materiales (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references public.academia_cursos(id) on delete cascade,
  leccion_id  uuid references public.academia_lecciones(id) on delete cascade,
  titulo      text not null,
  ruta        text not null,                     -- ruta en Storage o URL externa
  tipo        text default 'pdf',
  peso_kb     int,
  orden       int not null default 0
);

-- A quién se asigna cada curso. Un campo vacío = "todos".
-- Ej: area='barra'  → todos los de barra.  user_id=X → solo esa persona.
create table if not exists public.academia_asignaciones (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.academia_cursos(id) on delete cascade,
  area          text,
  sede          text,
  user_id       uuid references public.academia_perfiles(user_id) on delete cascade,
  obligatorio   boolean not null default false,
  fecha_limite  date
);

-- Avance por lección.
create table if not exists public.academia_progreso (
  user_id        uuid not null references public.academia_perfiles(user_id) on delete cascade,
  leccion_id     uuid not null references public.academia_lecciones(id) on delete cascade,
  segundo_actual int not null default 0,         -- para "continuar donde te quedaste"
  max_segundo    int not null default 0,         -- lo más lejos que llegó viendo
  completado     boolean not null default false,
  completado_en  timestamptz,
  actualizado    timestamptz not null default now(),
  primary key (user_id, leccion_id)
);

-- Quiz: preguntas (visibles) y claves (solo admin, para que nadie haga trampa).
create table if not exists public.academia_quiz_preguntas (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid not null references public.academia_cursos(id) on delete cascade,
  pregunta  text not null,
  opciones  jsonb not null,                      -- ["opción A","opción B",...]
  orden     int not null default 0
);

create table if not exists public.academia_quiz_claves (
  pregunta_id  uuid primary key references public.academia_quiz_preguntas(id) on delete cascade,
  correcta     int not null                      -- índice de la opción correcta (0,1,2...)
);

create table if not exists public.academia_quiz_intentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.academia_perfiles(user_id) on delete cascade,
  curso_id    uuid not null references public.academia_cursos(id) on delete cascade,
  puntaje     int not null,                      -- 0-100
  aprobado    boolean not null,
  respuestas  jsonb,
  creado_en   timestamptz not null default now()
);

-- Catálogo de insignias. "regla" dice cómo se gana (la evalúa la base).
create table if not exists public.academia_insignias (
  id           text primary key,                 -- ej. "primer_sorbo"
  nombre       text not null,
  descripcion  text,
  categoria    text,                             -- progreso | constancia | excelencia | ...
  icono        text,                             -- nombre del ícono en la app
  nivel        text,                             -- bronce | plata | oro | null
  secreta      boolean not null default false,
  puntos       int not null default 0,
  regla        jsonb not null,
  activa       boolean not null default true,
  orden        int not null default 0
);

create table if not exists public.academia_insignias_usuario (
  user_id       uuid not null references public.academia_perfiles(user_id) on delete cascade,
  insignia_id   text not null references public.academia_insignias(id) on delete cascade,
  otorgada_en   timestamptz not null default now(),
  otorgada_por  uuid,                            -- null = automática
  vista         boolean not null default false,  -- para la animación de "desbloqueada"
  primary key (user_id, insignia_id)
);

-- Libro de puntos: cada punto ganado queda registrado con su motivo.
-- (motivo, ref) único por persona = nunca se cobran dos veces los mismos puntos.
create table if not exists public.academia_puntos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.academia_perfiles(user_id) on delete cascade,
  puntos     int not null,
  motivo     text not null,                      -- leccion | curso | quiz_perfecto | a_tiempo | insignia | bono
  ref        text not null default '',
  nota       text,
  creado_en  timestamptz not null default now(),
  unique (user_id, motivo, ref)
);

-- Premios canjeables (los configuras tú) y solicitudes de canje.
create table if not exists public.academia_premios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text,
  costo        int not null check (costo > 0),
  activo       boolean not null default true,
  orden        int not null default 0
);

create table if not exists public.academia_canjes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.academia_perfiles(user_id) on delete cascade,
  premio_id    uuid not null references public.academia_premios(id),
  costo        int not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  nota         text,
  creado_en    timestamptz not null default now(),
  resuelto_en  timestamptz
);

-- Índices para que todo cargue rápido.
create index if not exists academia_lecciones_curso_idx  on public.academia_lecciones(curso_id, orden);
create index if not exists academia_modulos_curso_idx    on public.academia_modulos(curso_id, orden);
create index if not exists academia_materiales_curso_idx on public.academia_materiales(curso_id);
create index if not exists academia_asig_curso_idx       on public.academia_asignaciones(curso_id);
create index if not exists academia_progreso_user_idx    on public.academia_progreso(user_id, completado_en);
create index if not exists academia_puntos_user_idx      on public.academia_puntos(user_id, creado_en);
create index if not exists academia_puntos_fecha_idx     on public.academia_puntos(creado_en);
create index if not exists academia_intentos_user_idx    on public.academia_quiz_intentos(user_id, curso_id);
create index if not exists academia_canjes_estado_idx    on public.academia_canjes(estado, creado_en);
create index if not exists academia_preguntas_curso_idx  on public.academia_quiz_preguntas(curso_id, orden);


-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE APOYO
-- ---------------------------------------------------------------------

-- ¿El usuario actual es admin?
create or replace function public.academia_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from academia_perfiles
                 where user_id = auth.uid() and rol = 'admin' and activo);
$$;

-- Lee un ajuste numérico de academia_config.
create or replace function public.academia_cfg(p_clave text, p_defecto int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (valor #>> '{}')::int from academia_config where clave = p_clave), p_defecto);
$$;

-- ¿El curso está asignado a esta persona?
create or replace function public.academia_curso_asignado(p_user uuid, p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from academia_asignaciones a
    join academia_perfiles p on p.user_id = p_user
    where a.curso_id = p_curso
      and (a.area    is null or lower(a.area) = lower(p.area))
      and (a.sede    is null or lower(a.sede) = lower(p.sede))
      and (a.user_id is null or a.user_id = p_user)
  );
$$;

-- ¿El usuario actual puede ver este curso? (admin ve todo; empleado: publicado y asignado)
create or replace function public.academia_puede_ver_curso(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select academia_es_admin() or exists (
    select 1 from academia_cursos c
    where c.id = p_curso and c.publicado and academia_curso_asignado(auth.uid(), c.id)
  );
$$;

-- Fecha límite que aplica a una persona en un curso (la más cercana).
create or replace function public.academia_fecha_limite(p_user uuid, p_curso uuid)
returns date language sql stable security definer set search_path = public as $$
  select min(a.fecha_limite) from academia_asignaciones a
  join academia_perfiles p on p.user_id = p_user
  where a.curso_id = p_curso
    and (a.area    is null or lower(a.area) = lower(p.area))
    and (a.sede    is null or lower(a.sede) = lower(p.sede))
    and (a.user_id is null or a.user_id = p_user);
$$;

-- Fecha "de hoy" en hora de Quintana Roo.
create or replace function public.academia_hoy()
returns date language sql stable as $$
  select (now() at time zone 'America/Cancun')::date;
$$;

-- Racha: días seguidos con al menos una lección terminada.
-- actual = racha viva (termina hoy o ayer); maxima = la mejor histórica.
create or replace function public.academia_racha(p_user uuid, out actual int, out maxima int)
language sql stable security definer set search_path = public as $$
  with d as (
    select distinct (completado_en at time zone 'America/Cancun')::date as dia
    from academia_progreso where user_id = p_user and completado
  ), g as (
    select dia, dia - (row_number() over (order by dia))::int as grupo from d
  ), islas as (
    select max(dia) as fin, count(*)::int as n from g group by grupo
  )
  select
    coalesce((select n from islas where fin >= academia_hoy() - 1 order by fin desc limit 1), 0),
    coalesce((select max(n) from islas), 0);
$$;

-- ¿Terminó el curso? (todas las lecciones + quiz aprobado si es obligatorio)
create or replace function public.academia_curso_terminado(p_user uuid, p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from academia_lecciones where curso_id = p_curso)
    and not exists (
      select 1 from academia_lecciones l
      left join academia_progreso pr on pr.leccion_id = l.id and pr.user_id = p_user
      where l.curso_id = p_curso and coalesce(pr.completado, false) = false
    )
    and (
      not (select quiz_obligatorio from academia_cursos where id = p_curso)
      or exists (select 1 from academia_quiz_intentos
                 where user_id = p_user and curso_id = p_curso and aprobado)
    );
$$;

-- Da puntos una sola vez por (motivo, ref). Devuelve los puntos dados (0 si ya existían).
create or replace function public.academia_dar_puntos(p_user uuid, p_puntos int, p_motivo text, p_ref text, p_nota text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if coalesce(p_puntos, 0) = 0 then return 0; end if;
  insert into academia_puntos (user_id, puntos, motivo, ref, nota)
  values (p_user, p_puntos, p_motivo, coalesce(p_ref, ''), p_nota)
  on conflict (user_id, motivo, ref) do nothing;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then p_puntos else 0 end;
end $$;

-- Si el curso quedó terminado, da los puntos del curso y el bono por puntualidad.
create or replace function public.academia_cerrar_curso(p_user uuid, p_curso uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_pts int := 0; v_lim date;
begin
  if not academia_curso_terminado(p_user, p_curso) then return 0; end if;
  v_pts := academia_dar_puntos(p_user, academia_cfg('puntos_curso', 50), 'curso', p_curso::text);
  v_lim := academia_fecha_limite(p_user, p_curso);
  if v_lim is not null and academia_hoy() <= v_lim then
    v_pts := v_pts + academia_dar_puntos(p_user, academia_cfg('puntos_a_tiempo', 20), 'a_tiempo', p_curso::text);
  end if;
  return v_pts;
end $$;

-- Revisa todas las insignias automáticas y otorga las que ya se ganaron.
-- Devuelve la lista de insignias nuevas (para mostrar la animación).
create or replace function public.academia_evaluar_insignias(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ins record;
  v_ok boolean;
  v_n int;
  v_nuevas jsonb := '[]'::jsonb;
  v_lecciones int;
  v_cursos int;
  v_racha_max int;
begin
  select count(*) into v_lecciones from academia_progreso where user_id = p_user and completado;
  select count(*) into v_cursos from academia_cursos c
    where exists (select 1 from academia_lecciones where curso_id = c.id)
      and academia_curso_terminado(p_user, c.id);
  select maxima into v_racha_max from academia_racha(p_user);

  for ins in
    select * from academia_insignias i
    where i.activa
      and (i.regla->>'tipo') <> 'manual'
      and not exists (select 1 from academia_insignias_usuario u
                      where u.user_id = p_user and u.insignia_id = i.id)
  loop
    v_n := coalesce((ins.regla->>'n')::int, 1);
    v_ok := case ins.regla->>'tipo'
      when 'lecciones' then v_lecciones >= v_n
      when 'cursos'    then v_cursos >= v_n
      when 'racha'     then v_racha_max >= v_n
      when 'quiz_perfecto' then exists (
        select 1 from academia_quiz_intentos where user_id = p_user and puntaje = 100)
      when 'a_la_primera' then exists (
        select 1 from academia_quiz_intentos q
        where q.user_id = p_user and q.aprobado
          and q.creado_en = (select min(creado_en) from academia_quiz_intentos
                             where user_id = p_user and curso_id = q.curso_id))
      when 'a_tiempo' then exists (
        select 1 from academia_puntos where user_id = p_user and motivo = 'a_tiempo')
      when 'maraton' then exists (
        select 1 from academia_progreso where user_id = p_user and completado
        group by (completado_en at time zone 'America/Cancun')::date
        having count(*) >= v_n)
      when 'madrugador' then exists (
        select 1 from academia_progreso where user_id = p_user and completado
          and extract(hour from completado_en at time zone 'America/Cancun') < coalesce((ins.regla->>'hora')::int, 8))
      when 'noctambulo' then exists (
        select 1 from academia_progreso where user_id = p_user and completado
          and extract(hour from completado_en at time zone 'America/Cancun') >= coalesce((ins.regla->>'hora')::int, 22))
      when 'categoria' then
        exists (select 1 from academia_cursos c
                where c.publicado and lower(c.categoria) = lower(ins.regla->>'categoria'))
        and not exists (
          select 1 from academia_cursos c
          where c.publicado and lower(c.categoria) = lower(ins.regla->>'categoria')
            and not academia_curso_terminado(p_user, c.id))
      when 'asignados' then
        exists (select 1 from academia_cursos c
                where c.publicado and academia_curso_asignado(p_user, c.id))
        and not exists (
          select 1 from academia_cursos c
          where c.publicado and academia_curso_asignado(p_user, c.id)
            and not academia_curso_terminado(p_user, c.id))
      else false
    end;

    if v_ok then
      insert into academia_insignias_usuario (user_id, insignia_id) values (p_user, ins.id)
      on conflict do nothing;
      perform academia_dar_puntos(p_user, ins.puntos, 'insignia', ins.id);
      v_nuevas := v_nuevas || jsonb_build_object(
        'id', ins.id, 'nombre', ins.nombre, 'descripcion', ins.descripcion,
        'icono', ins.icono, 'nivel', ins.nivel, 'secreta', ins.secreta, 'puntos', ins.puntos);
    end if;
  end loop;

  return v_nuevas;
end $$;


-- ---------------------------------------------------------------------
-- 3. FUNCIONES QUE LLAMA LA APP (una sola llamada = carga rápida)
-- ---------------------------------------------------------------------

-- Guarda el avance de un video. La app la llama cada ~10 segundos.
-- Protección anti-adelantar: el avance solo puede crecer al ritmo real
-- de reproducción (permite velocidad 2x).
create or replace function public.academia_registrar_avance(p_leccion uuid, p_segundo int, p_duracion int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_curso uuid;
  v_dur int;
  v_prev academia_progreso;
  v_permitido int;
  v_max int;
  v_completo boolean;
  v_recien boolean := false;
  v_pts int := 0;
  v_nuevas jsonb := '[]'::jsonb;
begin
  if v_user is null or not exists (select 1 from academia_perfiles where user_id = v_user and activo) then
    raise exception 'Sin sesión válida';
  end if;

  select curso_id, duracion_seg into v_curso, v_dur from academia_lecciones where id = p_leccion;
  if v_curso is null or not academia_puede_ver_curso(v_curso) then
    raise exception 'Lección no disponible';
  end if;

  -- Si la lección aún no tiene duración guardada, se toma la que reporta el reproductor.
  if v_dur is null and p_duracion is not null and p_duracion > 0 then
    update academia_lecciones set duracion_seg = p_duracion where id = p_leccion;
    v_dur := p_duracion;
  end if;

  select * into v_prev from academia_progreso where user_id = v_user and leccion_id = p_leccion;

  if v_prev.user_id is null then
    v_permitido := 20;
    v_max := least(greatest(p_segundo, 0), v_permitido);
    insert into academia_progreso (user_id, leccion_id, segundo_actual, max_segundo)
    values (v_user, p_leccion, greatest(p_segundo, 0), v_max);
    v_completo := false;
  else
    v_permitido := v_prev.max_segundo
                   + (extract(epoch from (now() - v_prev.actualizado)) * 2.5)::int + 20;
    v_max := greatest(v_prev.max_segundo, least(greatest(p_segundo, 0), v_permitido));
    v_completo := v_prev.completado;
    update academia_progreso
      set segundo_actual = greatest(p_segundo, 0), max_segundo = v_max, actualizado = now()
      where user_id = v_user and leccion_id = p_leccion;
  end if;

  -- Lección completada al ver el 90%.
  if not v_completo and v_dur is not null and v_dur > 0 and v_max >= (v_dur * 0.9)::int then
    update academia_progreso set completado = true, completado_en = now()
      where user_id = v_user and leccion_id = p_leccion;
    v_recien := true;
    v_pts := academia_dar_puntos(v_user, academia_cfg('puntos_leccion', 10), 'leccion', p_leccion::text);
    v_pts := v_pts + academia_cerrar_curso(v_user, v_curso);
    v_nuevas := academia_evaluar_insignias(v_user);
  end if;

  return jsonb_build_object(
    'completado', v_completo or v_recien,
    'recien_completado', v_recien,
    'max_segundo', v_max,
    'puntos_ganados', v_pts,
    'insignias_nuevas', v_nuevas,
    'curso_terminado', case when v_recien then academia_curso_terminado(v_user, v_curso) else null end
  );
end $$;

-- Califica el quiz en la base (las respuestas correctas nunca llegan al celular).
-- p_respuestas = {"<id_pregunta>": índice_elegido, ...}
create or replace function public.academia_enviar_quiz(p_curso uuid, p_respuestas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_total int;
  v_bien int;
  v_puntaje int;
  v_min int;
  v_aprobado boolean;
  v_pts int := 0;
  v_detalle jsonb;
  v_nuevas jsonb;
begin
  if v_user is null or not academia_puede_ver_curso(p_curso) then
    raise exception 'Curso no disponible';
  end if;
  if exists (
    select 1 from academia_lecciones l
    left join academia_progreso pr on pr.leccion_id = l.id and pr.user_id = v_user
    where l.curso_id = p_curso and coalesce(pr.completado, false) = false
  ) then
    raise exception 'Termina todas las lecciones antes del quiz';
  end if;

  select count(*),
         count(*) filter (where (p_respuestas ->> q.id::text)::int = k.correcta),
         jsonb_object_agg(q.id::text, (p_respuestas ->> q.id::text)::int is not distinct from k.correcta)
    into v_total, v_bien, v_detalle
  from academia_quiz_preguntas q
  join academia_quiz_claves k on k.pregunta_id = q.id
  where q.curso_id = p_curso;

  if v_total = 0 then raise exception 'Este curso no tiene quiz'; end if;

  v_puntaje := round(100.0 * v_bien / v_total);
  select quiz_minimo into v_min from academia_cursos where id = p_curso;
  v_aprobado := v_puntaje >= v_min;

  insert into academia_quiz_intentos (user_id, curso_id, puntaje, aprobado, respuestas)
  values (v_user, p_curso, v_puntaje, v_aprobado, p_respuestas);

  if v_puntaje = 100 then
    v_pts := academia_dar_puntos(v_user, academia_cfg('puntos_quiz_perfecto', 30), 'quiz_perfecto', p_curso::text);
  end if;
  if v_aprobado then
    v_pts := v_pts + academia_cerrar_curso(v_user, p_curso);
  end if;
  v_nuevas := academia_evaluar_insignias(v_user);

  return jsonb_build_object(
    'puntaje', v_puntaje, 'aprobado', v_aprobado, 'minimo', v_min,
    'correctas', v_bien, 'total', v_total, 'detalle', v_detalle,
    'puntos_ganados', v_pts, 'insignias_nuevas', v_nuevas,
    'curso_terminado', academia_curso_terminado(v_user, p_curso));
end $$;

-- Resumen para la pantalla de inicio: puntos, nivel, racha, insignias.
create or replace function public.academia_mi_resumen()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ganados int; v_gastados int;
  v_nivel record; v_sig record;
  v_racha record;
  v_perfil academia_perfiles;
begin
  select * into v_perfil from academia_perfiles where user_id = v_user;
  if v_perfil.user_id is null then raise exception 'Sin perfil'; end if;

  select coalesce(sum(puntos), 0) into v_ganados from academia_puntos where user_id = v_user and puntos > 0;
  select coalesce(sum(costo), 0) into v_gastados from academia_canjes
    where user_id = v_user and estado in ('pendiente', 'aprobado');
  select * into v_nivel from academia_niveles where puntos_min <= v_ganados order by puntos_min desc limit 1;
  select * into v_sig   from academia_niveles where puntos_min >  v_ganados order by puntos_min asc  limit 1;
  select * into v_racha from academia_racha(v_user);

  return jsonb_build_object(
    'usuario', v_perfil.usuario, 'nombre', v_perfil.nombre, 'area', v_perfil.area,
    'sede', v_perfil.sede, 'rol', v_perfil.rol,
    'puntos_ganados', v_ganados,
    'puntos_disponibles', v_ganados - v_gastados,
    'nivel', v_nivel.nombre, 'nivel_orden', v_nivel.orden, 'nivel_min', v_nivel.puntos_min,
    'siguiente_nivel', v_sig.nombre, 'siguiente_min', v_sig.puntos_min,
    'racha_actual', v_racha.actual, 'racha_maxima', v_racha.maxima,
    'insignias', (select count(*) from academia_insignias_usuario where user_id = v_user),
    'insignias_total', (select count(*) from academia_insignias where activa),
    'insignias_sin_ver', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'descripcion', i.descripcion,
                                          'icono', i.icono, 'nivel', i.nivel, 'puntos', i.puntos))
      from academia_insignias_usuario u join academia_insignias i on i.id = u.insignia_id
      where u.user_id = v_user and not u.vista), '[]'::jsonb)
  );
end $$;

-- Marca como vistas las insignias (después de mostrar la animación).
create or replace function public.academia_marcar_insignias_vistas()
returns void language sql security definer set search_path = public as $$
  update academia_insignias_usuario set vista = true where user_id = auth.uid() and not vista;
$$;

-- Mis cursos con avance, fecha límite y la lección para "continuar".
create or replace function public.academia_mis_cursos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'orden_vencimiento', (x->>'orden')::int), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', c.id, 'titulo', c.titulo, 'descripcion', c.descripcion, 'categoria', c.categoria,
      'portada_url', c.portada_url, 'quiz_obligatorio', c.quiz_obligatorio,
      'certificado', c.certificado, 'orden', c.orden,
      'obligatorio', exists (select 1 from academia_asignaciones a
                             where a.curso_id = c.id and a.obligatorio
                               and academia_curso_asignado(auth.uid(), c.id)),
      'fecha_limite', academia_fecha_limite(auth.uid(), c.id),
      'orden_vencimiento', coalesce(academia_fecha_limite(auth.uid(), c.id)::text, '9999'),
      'lecciones', (select count(*) from academia_lecciones where curso_id = c.id),
      'completadas', (select count(*) from academia_progreso pr join academia_lecciones l on l.id = pr.leccion_id
                      where l.curso_id = c.id and pr.user_id = auth.uid() and pr.completado),
      'duracion_seg', (select coalesce(sum(duracion_seg), 0) from academia_lecciones where curso_id = c.id),
      'terminado', academia_curso_terminado(auth.uid(), c.id),
      'ultima_actividad', (select max(pr.actualizado) from academia_progreso pr
                           join academia_lecciones l on l.id = pr.leccion_id
                           where l.curso_id = c.id and pr.user_id = auth.uid()),
      'continuar', (
        select jsonb_build_object('leccion_id', l.id, 'titulo', l.titulo,
                                  'segundo', coalesce(pr.segundo_actual, 0), 'duracion_seg', l.duracion_seg)
        from academia_lecciones l
        left join academia_modulos m on m.id = l.modulo_id
        left join academia_progreso pr on pr.leccion_id = l.id and pr.user_id = auth.uid()
        where l.curso_id = c.id and coalesce(pr.completado, false) = false
        order by coalesce(m.orden, 0), l.orden limit 1)
    ) as x
    from academia_cursos c
    where c.publicado and academia_curso_asignado(auth.uid(), c.id)
  ) t;
$$;

-- Ranking por periodo: 'semana' | 'mes' | 'total'
create or replace function public.academia_ranking(p_periodo text default 'total')
returns table (posicion bigint, user_id uuid, nombre text, area text, sede text, puntos bigint, soy_yo boolean)
language sql stable security definer set search_path = public as $$
  with desde as (
    select case p_periodo
      when 'semana' then date_trunc('week',  now() at time zone 'America/Cancun') at time zone 'America/Cancun'
      when 'mes'    then date_trunc('month', now() at time zone 'America/Cancun') at time zone 'America/Cancun'
      else '-infinity'::timestamptz end as t
  ), tot as (
    select p.user_id, p.nombre, p.area, p.sede,
           coalesce(sum(pt.puntos) filter (where pt.puntos > 0 and pt.creado_en >= (select t from desde)), 0) as puntos
    from academia_perfiles p
    left join academia_puntos pt on pt.user_id = p.user_id
    where p.activo and p.rol = 'empleado'
    group by p.user_id, p.nombre, p.area, p.sede
  )
  select rank() over (order by puntos desc), user_id, nombre, area, sede, puntos, user_id = auth.uid()
  from tot
  where auth.uid() is not null
  order by puntos desc, nombre;
$$;

-- Solicitar un canje de premio (valida que alcancen los puntos).
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
  select costo into v_costo from academia_premios where id = p_premio and activo;
  if v_costo is null then raise exception 'Premio no disponible'; end if;

  -- Evita dos canjes simultáneos de la misma persona.
  perform pg_advisory_xact_lock(hashtext('academia_canje_' || v_user::text));

  select (select coalesce(sum(puntos), 0) from academia_puntos where user_id = v_user and puntos > 0)
       - (select coalesce(sum(costo), 0) from academia_canjes where user_id = v_user and estado in ('pendiente','aprobado'))
    into v_disp;
  if v_disp < v_costo then
    raise exception 'Te faltan % puntos', v_costo - v_disp;
  end if;

  insert into academia_canjes (user_id, premio_id, costo) values (v_user, p_premio, v_costo)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'disponibles', v_disp - v_costo);
end $$;

-- ADMIN: avance de todo el equipo en una sola llamada.
create or replace function public.academia_admin_avance()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'nombre') from (
      select jsonb_build_object(
        'user_id', p.user_id, 'usuario', p.usuario, 'nombre', p.nombre, 'area', p.area,
        'sede', p.sede, 'turno', p.turno, 'activo', p.activo,
        'puntos', (select coalesce(sum(puntos), 0) from academia_puntos where user_id = p.user_id and puntos > 0),
        'lecciones_asignadas', (select count(*) from academia_lecciones l join academia_cursos c on c.id = l.curso_id
                                where c.publicado and academia_curso_asignado(p.user_id, c.id)),
        'lecciones_completadas', (select count(*) from academia_progreso pr
                                  join academia_lecciones l on l.id = pr.leccion_id
                                  join academia_cursos c on c.id = l.curso_id
                                  where pr.user_id = p.user_id and pr.completado and c.publicado
                                    and academia_curso_asignado(p.user_id, c.id)),
        'cursos_atrasados', (select count(*) from academia_cursos c
                             where c.publicado and academia_curso_asignado(p.user_id, c.id)
                               and academia_fecha_limite(p.user_id, c.id) < academia_hoy()
                               and not academia_curso_terminado(p.user_id, c.id)),
        'ultima_actividad', (select max(actualizado) from academia_progreso where user_id = p.user_id)
      ) as x
      from academia_perfiles p where p.rol = 'empleado'
    ) t), '[]'::jsonb);
end $$;

-- ADMIN: otorgar una insignia a mano (ej. "Empleado del mes").
create or replace function public.academia_otorgar_insignia(p_user uuid, p_insignia text)
returns void language plpgsql security definer set search_path = public as $$
declare v_pts int;
begin
  if not academia_es_admin() then raise exception 'Solo administrador'; end if;
  select puntos into v_pts from academia_insignias where id = p_insignia;
  if v_pts is null then raise exception 'Insignia no existe'; end if;
  insert into academia_insignias_usuario (user_id, insignia_id, otorgada_por)
  values (p_user, p_insignia, auth.uid()) on conflict do nothing;
  perform academia_dar_puntos(p_user, v_pts, 'insignia',
    p_insignia || case when p_insignia = 'empleado_del_mes' then '_' || to_char(academia_hoy(), 'YYYY-MM') else '' end);
end $$;


-- ---------------------------------------------------------------------
-- 4. SEGURIDAD (RLS): cada empleado ve solo lo suyo; tú ves todo.
-- ---------------------------------------------------------------------

alter table public.academia_perfiles          enable row level security;
alter table public.academia_config            enable row level security;
alter table public.academia_niveles           enable row level security;
alter table public.academia_cursos            enable row level security;
alter table public.academia_modulos           enable row level security;
alter table public.academia_lecciones         enable row level security;
alter table public.academia_materiales        enable row level security;
alter table public.academia_asignaciones      enable row level security;
alter table public.academia_progreso          enable row level security;
alter table public.academia_quiz_preguntas    enable row level security;
alter table public.academia_quiz_claves       enable row level security;
alter table public.academia_quiz_intentos     enable row level security;
alter table public.academia_insignias         enable row level security;
alter table public.academia_insignias_usuario enable row level security;
alter table public.academia_puntos            enable row level security;
alter table public.academia_premios           enable row level security;
alter table public.academia_canjes            enable row level security;

do $$
declare t text;
begin
  -- El admin puede todo en todas las tablas.
  foreach t in array array['perfiles','config','niveles','cursos','modulos','lecciones','materiales',
    'asignaciones','progreso','quiz_preguntas','quiz_claves','quiz_intentos','insignias',
    'insignias_usuario','puntos','premios','canjes']
  loop
    execute format('drop policy if exists "admin_todo" on public.academia_%s', t);
    execute format('create policy "admin_todo" on public.academia_%s for all to authenticated
                    using (public.academia_es_admin()) with check (public.academia_es_admin())', t);
  end loop;
end $$;

-- Empleado: lectura de lo propio o de lo que tiene asignado.
drop policy if exists "ver_mi_perfil" on public.academia_perfiles;
create policy "ver_mi_perfil" on public.academia_perfiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "leer_catalogos" on public.academia_niveles;
create policy "leer_catalogos" on public.academia_niveles for select to authenticated using (true);

drop policy if exists "leer_config" on public.academia_config;
create policy "leer_config" on public.academia_config for select to authenticated using (true);

drop policy if exists "ver_cursos_asignados" on public.academia_cursos;
create policy "ver_cursos_asignados" on public.academia_cursos for select to authenticated
  using (public.academia_puede_ver_curso(id));

drop policy if exists "ver_modulos" on public.academia_modulos;
create policy "ver_modulos" on public.academia_modulos for select to authenticated
  using (public.academia_puede_ver_curso(curso_id));

drop policy if exists "ver_lecciones" on public.academia_lecciones;
create policy "ver_lecciones" on public.academia_lecciones for select to authenticated
  using (public.academia_puede_ver_curso(curso_id));

drop policy if exists "ver_materiales" on public.academia_materiales;
create policy "ver_materiales" on public.academia_materiales for select to authenticated
  using (public.academia_puede_ver_curso(curso_id));

drop policy if exists "ver_mis_asignaciones" on public.academia_asignaciones;
create policy "ver_mis_asignaciones" on public.academia_asignaciones for select to authenticated
  using (public.academia_curso_asignado(auth.uid(), curso_id));

drop policy if exists "ver_mi_progreso" on public.academia_progreso;
create policy "ver_mi_progreso" on public.academia_progreso for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ver_preguntas" on public.academia_quiz_preguntas;
create policy "ver_preguntas" on public.academia_quiz_preguntas for select to authenticated
  using (public.academia_puede_ver_curso(curso_id));
-- academia_quiz_claves: SIN política para empleados (nunca ven la respuesta correcta).

drop policy if exists "ver_mis_intentos" on public.academia_quiz_intentos;
create policy "ver_mis_intentos" on public.academia_quiz_intentos for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ver_insignias" on public.academia_insignias;
create policy "ver_insignias" on public.academia_insignias for select to authenticated
  using (activa);

drop policy if exists "ver_mis_insignias" on public.academia_insignias_usuario;
create policy "ver_mis_insignias" on public.academia_insignias_usuario for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ver_mis_puntos" on public.academia_puntos;
create policy "ver_mis_puntos" on public.academia_puntos for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ver_premios" on public.academia_premios;
create policy "ver_premios" on public.academia_premios for select to authenticated
  using (activo);

drop policy if exists "ver_mis_canjes" on public.academia_canjes;
create policy "ver_mis_canjes" on public.academia_canjes for select to authenticated
  using (user_id = auth.uid());

-- Los empleados NO escriben directo en ninguna tabla: todo pasa por las
-- funciones de arriba (avance, quiz, canje), así nadie se regala puntos.

-- Permisos de acceso (solo usuarios con sesión; nada para visitantes anónimos).
-- Solo toca las tablas academia_*; las de tus otras apps quedan igual.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'academia\_%'
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Las funciones internas no se llaman desde la app; solo las de la sección 3.
do $$
declare f text;
begin
  foreach f in array array[
    'academia_dar_puntos(uuid,int,text,text,text)',
    'academia_cerrar_curso(uuid,uuid)',
    'academia_evaluar_insignias(uuid)',
    'academia_racha(uuid)',
    'academia_curso_terminado(uuid,uuid)',
    'academia_fecha_limite(uuid,uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Las de la app: solo con sesión.
do $$
declare f text;
begin
  foreach f in array array[
    'academia_es_admin()', 'academia_cfg(text,int)', 'academia_puede_ver_curso(uuid)', 'academia_hoy()',
    'academia_curso_asignado(uuid,uuid)',
    'academia_registrar_avance(uuid,int,int)', 'academia_enviar_quiz(uuid,jsonb)',
    'academia_mi_resumen()', 'academia_marcar_insignias_vistas()', 'academia_mis_cursos()',
    'academia_ranking(text)', 'academia_solicitar_canje(uuid)',
    'academia_admin_avance()', 'academia_otorgar_insignia(uuid,text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 5. ALMACENAMIENTO DE MATERIALES (PDFs, recetas) — privado
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academia-materiales', 'academia-materiales', false, 20971520,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists "academia_materiales_leer" on storage.objects;
create policy "academia_materiales_leer" on storage.objects for select to authenticated
  using (bucket_id = 'academia-materiales'
         and (public.academia_es_admin() or exists (
               select 1 from public.academia_materiales m
               where m.ruta = storage.objects.name and public.academia_puede_ver_curso(m.curso_id))));

drop policy if exists "academia_materiales_admin" on storage.objects;
create policy "academia_materiales_admin" on storage.objects for all to authenticated
  using (bucket_id = 'academia-materiales' and public.academia_es_admin())
  with check (bucket_id = 'academia-materiales' and public.academia_es_admin());


-- ---------------------------------------------------------------------
-- 6. DATOS INICIALES (ajustes, niveles, insignias, premios de ejemplo)
-- ---------------------------------------------------------------------

insert into public.academia_config (clave, valor) values
  ('puntos_leccion', '10'),
  ('puntos_curso', '50'),
  ('puntos_quiz_perfecto', '30'),
  ('puntos_a_tiempo', '20')
on conflict (clave) do nothing;

insert into public.academia_niveles (orden, nombre, puntos_min) values
  (1, 'Grano verde',        0),
  (2, 'Tueste claro',     300),
  (3, 'Tueste medio',     800),
  (4, 'Tueste oscuro',   2000),
  (5, 'Maestro tostador', 4000)
on conflict (orden) do nothing;

insert into public.academia_insignias (id, nombre, descripcion, categoria, icono, nivel, secreta, puntos, regla, orden) values
  -- Progreso
  ('primer_sorbo',        'Primer sorbo',        'Terminaste tu primera lección',              'progreso',     'cup',     null,     false, 10,  '{"tipo":"lecciones","n":1}', 10),
  ('primera_taza',        'Primera taza',        'Terminaste tu primer curso',                 'progreso',     'cup',     null,     false, 25,  '{"tipo":"cursos","n":1}', 20),
  ('cafetera_llena',      'Cafetera llena',      'Terminaste 5 cursos',                        'progreso',     'coffee',  null,     false, 100, '{"tipo":"cursos","n":5}', 30),
  ('barra_completa',      'Barra completa',      'Terminaste todos tus cursos asignados',      'progreso',     'trophy',  null,     false, 150, '{"tipo":"asignados"}', 40),
  -- Constancia
  ('ritual_bronce',       'Ritual diario · bronce', 'Racha de 3 días aprendiendo',             'constancia',   'flame',   'bronce', false, 15,  '{"tipo":"racha","n":3}', 50),
  ('ritual_plata',        'Ritual diario · plata',  'Racha de 7 días aprendiendo',             'constancia',   'flame',   'plata',  false, 40,  '{"tipo":"racha","n":7}', 51),
  ('ritual_oro',          'Ritual diario · oro',    'Racha de 30 días aprendiendo',            'constancia',   'flame',   'oro',    false, 200, '{"tipo":"racha","n":30}', 52),
  -- Excelencia
  ('extraccion_perfecta', 'Extracción perfecta', 'Sacaste 100 en un quiz',                     'excelencia',   'star',    null,     false, 30,  '{"tipo":"quiz_perfecto"}', 60),
  ('a_la_primera',        'A la primera',        'Aprobaste un quiz en tu primer intento',     'excelencia',   'target',  null,     false, 20,  '{"tipo":"a_la_primera"}', 61),
  -- Puntualidad
  ('a_tiempo',            'A tiempo',            'Terminaste un curso antes de la fecha límite','puntualidad', 'clock',   null,     false, 20,  '{"tipo":"a_tiempo"}', 70),
  -- Especialidad (al terminar todos los cursos de esa categoría)
  ('barista_certificado', 'Barista certificado', 'Completaste la ruta de barra',               'especialidad', 'coffee',  null,     false, 150, '{"tipo":"categoria","categoria":"barra"}', 80),
  ('anfitrion_piso',      'Anfitrión de piso',   'Completaste la ruta de servicio en piso',    'especialidad', 'tray',    null,     false, 150, '{"tipo":"categoria","categoria":"piso"}', 81),
  ('maestro_cocina',      'Maestro de cocina',   'Completaste la ruta de cocina',              'especialidad', 'chef',    null,     false, 150, '{"tipo":"categoria","categoria":"cocina"}', 82),
  ('hospitalidad_regina', 'Hospitalidad Casa Regina', 'Completaste la ruta de Casa Regina',    'especialidad', 'bed',     null,     false, 150, '{"tipo":"categoria","categoria":"casa_regina"}', 83),
  -- Secretas
  ('maraton',             'Maratón',             'Terminaste 3 lecciones en un día',           'secreta',      'bolt',    null,     true,  40,  '{"tipo":"maraton","n":3}', 90),
  ('madrugador',          'Madrugador',          'Terminaste una lección antes de las 8 am',   'secreta',      'sunrise', null,     true,  15,  '{"tipo":"madrugador","hora":8}', 91),
  ('noctambulo',          'Noctámbulo',          'Terminaste una lección después de las 10 pm','secreta',      'moon',    null,     true,  15,  '{"tipo":"noctambulo","hora":22}', 92),
  -- Especial del admin
  ('empleado_del_mes',    'Empleado del mes',    'Reconocimiento especial de Gustavo',         'especial',     'crown',   null,     false, 300, '{"tipo":"manual"}', 100)
on conflict (id) do nothing;

-- Premios de ejemplo (cámbialos desde el panel admin).
insert into public.academia_premios (nombre, descripcion, costo, orden)
select * from (values
  ('Bebida de la casa',      'Una bebida a tu elección', 300, 1),
  ('Comida gratis en turno', 'Un platillo del menú',     500, 2),
  ('Día libre extra',        'A coordinar con Gustavo',  2000, 3),
  ('Bono en nómina',         'Monto definido por admin', 3000, 4)
) v(nombre, descripcion, costo, orden)
where not exists (select 1 from public.academia_premios);


-- =====================================================================
--  HAZTE ADMIN  (córrelo aparte, UNA vez, con tu correo de Supabase)
-- =====================================================================
-- insert into public.academia_perfiles (user_id, usuario, nombre, rol)
-- select id, 'gustavo', 'Gustavo', 'admin' from auth.users where email = 'TU_CORREO_AQUI'
-- on conflict (user_id) do update set rol = 'admin', activo = true;
