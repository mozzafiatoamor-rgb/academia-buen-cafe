// =====================================================================
//  CAPA DE DATOS · mismas funciones en modo "nube" (Supabase) y "demo".
//  La interfaz solo habla con este archivo; nunca con Supabase directo.
// =====================================================================
import { crearDemo } from "./demo.js";

const CFG = window.ACADEMIA_CONFIG;
const paramModo = new URLSearchParams(location.search).get("modo");
export const MODO = paramModo === "demo" || !CFG.SUPABASE_URL || !window.supabase ? "demo" : CFG.MODO;

const correoDe = (usuario) => `${String(usuario).trim().toLowerCase()}@${CFG.DOMINIO_USUARIOS}`;

// ---------- Errores legibles ----------
function traducir(msg = "") {
  const m = String(msg);
  if (/Invalid login credentials/i.test(m)) return "Usuario o PIN incorrecto";
  if (/banned|User is banned/i.test(m)) return "Tu cuenta está desactivada. Habla con Gustavo.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera unos minutos.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión. Revisa tu internet.";
  if (/JWT|session/i.test(m)) return "Tu sesión expiró. Vuelve a entrar.";
  return m.replace(/^.*?ERROR:\s*/i, "");
}
export class ErrorAcademia extends Error {
  constructor(msg, red = false) { super(traducir(msg)); this.red = red; }
}
const esDeRed = (e) => /Failed to fetch|NetworkError|network|Load failed/i.test(String(e?.message || e));

// =====================================================================
//  MODO NUBE
// =====================================================================
function crearNube() {
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "academia-auth" },
  });

  async function rpc(fn, args = {}) {
    let r;
    try { r = await sb.rpc(fn, args); } catch (e) { throw new ErrorAcademia(e.message, esDeRed(e)); }
    if (r.error) throw new ErrorAcademia(r.error.message, esDeRed(r.error));
    return r.data;
  }
  async function q(promesa) {
    let r;
    try { r = await promesa; } catch (e) { throw new ErrorAcademia(e.message, esDeRed(e)); }
    if (r.error) throw new ErrorAcademia(r.error.message, esDeRed(r.error));
    return r.data;
  }
  async function funcion(nombre, body) {
    let r;
    try { r = await sb.functions.invoke(nombre, { body }); } catch (e) { throw new ErrorAcademia(e.message, true); }
    if (r.error) {
      let msg = r.error.message;
      try { const j = await r.error.context.json(); msg = j.error || msg; } catch (_) { /* sin cuerpo */ }
      throw new ErrorAcademia(msg, /Failed to send|fetch/i.test(msg));
    }
    return r.data;
  }

  return {
    // ---------- Sesión ----------
    async entrar(usuario, pin) {
      const { error } = await sb.auth.signInWithPassword({ email: correoDe(usuario), password: pin });
      if (error) throw new ErrorAcademia(error.message, esDeRed(error));
      return this.resumen();
    },
    async entrarAdmin(correo, clave) {
      const { error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
      if (error) throw new ErrorAcademia(error.message, esDeRed(error));
      return this.resumen();
    },
    async salir() { await sb.auth.signOut(); },
    async haySesion() {
      const { data } = await sb.auth.getSession();
      return !!data?.session;
    },

    // ---------- Empleado ----------
    resumen: () => rpc("academia_mi_resumen"),
    misCursos: () => rpc("academia_mis_cursos"),
    marcarInsigniasVistas: () => rpc("academia_marcar_insignias_vistas"),
    ranking: (periodo) => rpc("academia_ranking", { p_periodo: periodo }),
    solicitarCanje: (premioId) => rpc("academia_solicitar_canje", { p_premio: premioId }),
    registrarAvance: (leccionId, segundo, duracion) =>
      rpc("academia_registrar_avance", { p_leccion: leccionId, p_segundo: Math.floor(segundo), p_duracion: duracion ? Math.round(duracion) : null }),
    enviarQuiz: (cursoId, respuestas) => rpc("academia_enviar_quiz", { p_curso: cursoId, p_respuestas: respuestas }),
    video: (leccionId) => funcion("academia-video", { leccion_id: leccionId }),

    async curso(id) {
      const [curso, modulos, lecciones, materiales, preguntas] = await Promise.all([
        q(sb.from("academia_cursos").select("*").eq("id", id).maybeSingle()),
        q(sb.from("academia_modulos").select("*").eq("curso_id", id).order("orden")),
        q(sb.from("academia_lecciones").select("*").eq("curso_id", id).order("orden")),
        q(sb.from("academia_materiales").select("*").eq("curso_id", id).order("orden")),
        q(sb.from("academia_quiz_preguntas").select("id, pregunta, opciones, orden").eq("curso_id", id).order("orden")),
      ]);
      if (!curso) throw new ErrorAcademia("Curso no disponible");
      const ids = lecciones.map((l) => l.id);
      const [progreso, intentos] = await Promise.all([
        ids.length ? q(sb.from("academia_progreso").select("*").in("leccion_id", ids)) : [],
        q(sb.from("academia_quiz_intentos").select("puntaje, aprobado, creado_en").eq("curso_id", id).order("creado_en", { ascending: false })),
      ]);
      return { curso, modulos, lecciones, materiales, preguntas, progreso, intentos };
    },

    async urlMaterial(m) {
      if (/^https?:\/\//.test(m.ruta)) return m.ruta;
      const r = await sb.storage.from("academia-materiales").createSignedUrl(m.ruta, 3600);
      if (r.error) throw new ErrorAcademia(r.error.message);
      return r.data.signedUrl;
    },

    async insignias() {
      const [catalogo, mias] = await Promise.all([
        q(sb.from("academia_insignias").select("*").order("orden")),
        q(sb.from("academia_insignias_usuario").select("insignia_id, otorgada_en")),
      ]);
      return { catalogo, mias };
    },

    async premios() {
      const [premios, canjes] = await Promise.all([
        q(sb.from("academia_premios").select("*").eq("activo", true).order("costo")),
        q(sb.from("academia_canjes").select("*").order("creado_en", { ascending: false })),
      ]);
      return { premios, canjes };
    },

    async niveles() { return q(sb.from("academia_niveles").select("*").order("orden")); },
    async categorias() {
      const r = await q(sb.from("academia_config").select("valor").eq("clave", "categorias").maybeSingle());
      return Array.isArray(r?.valor) ? r.valor : null;
    },
    guardarCategorias: (lista) => q(sb.from("academia_config").upsert({ clave: "categorias", valor: lista })),
    crearInsignia: (ins) => q(sb.from("academia_insignias").upsert(ins, { onConflict: "id", ignoreDuplicates: true })),

    // ---------- Admin ----------
    adminAvance: () => rpc("academia_admin_avance"),
    adminPerfiles: () => q(sb.from("academia_perfiles").select("user_id, nombre, usuario, gestor_id, activo").eq("rol", "empleado")),
    otorgarInsignia: (userId, insignia) => rpc("academia_otorgar_insignia", { p_user: userId, p_insignia: insignia }),
    crearEmpleado: (d) => funcion("academia-admin", { accion: "crear_empleado", ...d }),
    importarEmpleados: (lista) => funcion("academia-admin", { accion: "importar_empleados", empleados: lista }),
    cambiarPin: (userId, pin) => funcion("academia-admin", { accion: "cambiar_pin", user_id: userId, pin: pin || undefined }),
    actualizarEmpleado: (userId, cambios) => funcion("academia-admin", { accion: "actualizar_empleado", user_id: userId, ...cambios }),
    bunnyColecciones: () => funcion("academia-admin", { accion: "listar_colecciones" }),
    bunnyVideos: (coleccion) => funcion("academia-admin", { accion: "listar_videos", coleccion: coleccion || undefined }),
    // Lee a los empleados del Gestor de Descansos (misma cuenta de Supabase, solo lectura).
    async gestorEmpleados() {
      const { data: s } = await sb.auth.getSession();
      const owner = s?.session?.user?.id;
      if (!owner) throw new ErrorAcademia("Tu sesión expiró. Vuelve a entrar.");
      const filas = await q(sb.from("descansos_kv").select("k, v").eq("owner", owner).like("k", "desc.v1.%employees"));
      filas.push(...await q(sb.from("descansos_kv").select("k, v").eq("owner", owner).eq("k", "desc.v1.sedes")));
      return leerGestor(filas);
    },
    crearColeccion: (nombre) => funcion("academia-admin", { accion: "crear_coleccion", nombre }),
    prepararSubida: (titulo, coleccion, videoId) =>
      funcion("academia-admin", { accion: "preparar_subida", titulo, coleccion, video_id: videoId || undefined }),

    async adminCursos() {
      const [cursos, lecciones, asign] = await Promise.all([
        q(sb.from("academia_cursos").select("*").order("orden").order("creado_en")),
        q(sb.from("academia_lecciones").select("curso_id, duracion_seg")),
        q(sb.from("academia_asignaciones").select("curso_id")),
      ]);
      return cursos.map((c) => {
        const ls = lecciones.filter((l) => l.curso_id === c.id);
        return { ...c, lecciones: ls.length, duracion_seg: ls.reduce((a, l) => a + (l.duracion_seg || 0), 0),
                 asignaciones: asign.filter((a) => a.curso_id === c.id).length };
      });
    },
    async adminCurso(id) {
      const [curso, modulos, lecciones, asignaciones, perfiles] = await Promise.all([
        q(sb.from("academia_cursos").select("*").eq("id", id).maybeSingle()),
        q(sb.from("academia_modulos").select("*").eq("curso_id", id).order("orden")),
        q(sb.from("academia_lecciones").select("*").eq("curso_id", id).order("orden")),
        q(sb.from("academia_asignaciones").select("*").eq("curso_id", id)),
        q(sb.from("academia_perfiles").select("user_id, nombre, usuario").eq("rol", "empleado").order("nombre")),
      ]);
      return { curso, modulos, lecciones, asignaciones, perfiles };
    },
    async guardarCurso(c) {
      const { id, ...resto } = c;
      if (id) return q(sb.from("academia_cursos").update(resto).eq("id", id).select().single());
      return q(sb.from("academia_cursos").insert(resto).select().single());
    },
    borrarCurso: (id) => q(sb.from("academia_cursos").delete().eq("id", id)),
    async guardarModulo(m) {
      const { id, ...resto } = m;
      if (id) return q(sb.from("academia_modulos").update(resto).eq("id", id).select().single());
      return q(sb.from("academia_modulos").insert(resto).select().single());
    },
    borrarModulo: (id) => q(sb.from("academia_modulos").delete().eq("id", id)),
    agregarLecciones: (filas) => q(sb.from("academia_lecciones").insert(filas).select()),
    actualizarLeccion: (id, cambios) => q(sb.from("academia_lecciones").update(cambios).eq("id", id)),
    borrarLeccion: (id) => q(sb.from("academia_lecciones").delete().eq("id", id)),
    agregarAsignacion: (a) => q(sb.from("academia_asignaciones").insert(a).select().single()),
    borrarAsignacion: (id) => q(sb.from("academia_asignaciones").delete().eq("id", id)),

    async adminPremios() {
      const [premios, canjes, perfiles] = await Promise.all([
        q(sb.from("academia_premios").select("*").order("costo")),
        q(sb.from("academia_canjes").select("*").order("creado_en", { ascending: false }).limit(100)),
        q(sb.from("academia_perfiles").select("user_id, nombre")),
      ]);
      const nombre = Object.fromEntries(perfiles.map((p) => [p.user_id, p.nombre]));
      return { premios, canjes: canjes.map((c) => ({ ...c, nombre: nombre[c.user_id] || "—" })) };
    },
    async guardarPremio(p) {
      const { id, ...resto } = p;
      if (id) return q(sb.from("academia_premios").update(resto).eq("id", id));
      return q(sb.from("academia_premios").insert(resto));
    },
    resolverCanje: (id, estado) =>
      q(sb.from("academia_canjes").update({ estado, resuelto_en: new Date().toISOString() }).eq("id", id).eq("estado", "pendiente")),
    async catalogoInsignias() { return q(sb.from("academia_insignias").select("*").order("orden")); },
  };
}

// ---------------------------------------------------------------------
//  Traduce los datos del Gestor de Descansos a una lista de empleados.
//  Sede "mozza" → desc.v1.employees ; otras sedes → desc.v1.<id>.employees
// ---------------------------------------------------------------------
export function leerGestor(filas) {
  const kv = Object.fromEntries((filas || []).map((f) => [f.k, f.v]));
  const sedes = Array.isArray(kv["desc.v1.sedes"]) && kv["desc.v1.sedes"].length ? kv["desc.v1.sedes"]
    : [{ id: "mozza", name: "Mozzafiato" }, { id: "casaregina", name: "Casa Regina" }];
  const lunes = (() => {
    const d = new Date(); const dia = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dia);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const activo = (e) => {
    const st = Array.isArray(e.stints) && e.stints.length ? e.stints : [{ start: e.start || null, end: e.end || null }];
    return st.some((s) => (!s.start || lunes >= s.start) && (!s.end || lunes < s.end));
  };
  const lista = [];
  for (const s of sedes) {
    const clave = s.id === "mozza" ? "desc.v1.employees" : `desc.v1.${s.id}.employees`;
    const emps = Array.isArray(kv[clave]) ? kv[clave] : [];
    for (const e of emps) {
      if (!e || !e.name) continue;
      lista.push({
        gestor_id: `${s.id}:${e.id}`,
        nombre: String(e.name).trim(),
        area: ["piso", "barra", "cocina"].includes(e.area) ? e.area : (s.id === "mozza" ? "piso" : "casa_regina"),
        turno: e.shift === "AM" || e.shift === "PM" ? e.shift : null,
        sede: s.name || (s.id === "mozza" ? "Mozzafiato" : s.id),
        whatsapp: e.wa ? String(e.wa).replace(/\D/g, "") : null,
        encargado: !!e.mgr,
        activo: activo(e),
      });
    }
  }
  return lista;
}

export const datos = MODO === "nube" ? crearNube() : crearDemo();

// =====================================================================
//  COLA SIN CONEXIÓN para el avance de videos.
//  Si se va la señal, el avance se guarda aquí y se envía al volver.
// =====================================================================
const COLA = "academia-cola-avance";
const leerCola = () => { try { return JSON.parse(localStorage.getItem(COLA) || "[]"); } catch { return []; } };
const guardarCola = (c) => { try { localStorage.setItem(COLA, JSON.stringify(c)); } catch { /* sin espacio */ } };

export async function enviarAvance(leccionId, segundo, duracion) {
  try {
    return await datos.registrarAvance(leccionId, segundo, duracion);
  } catch (e) {
    if (e.red) {
      const cola = leerCola().filter((x) => x.l !== leccionId);
      cola.push({ l: leccionId, s: segundo, d: duracion });
      guardarCola(cola);
      return { encolado: true };
    }
    throw e;
  }
}

export async function vaciarCola() {
  const cola = leerCola();
  if (!cola.length || !navigator.onLine) return [];
  const resultados = [];
  const quedan = [];
  for (const x of cola) {
    try { resultados.push(await datos.registrarAvance(x.l, x.s, x.d)); }
    catch (e) { if (e.red) quedan.push(x); }
  }
  guardarCola(quedan);
  return resultados;
}
export const pendientesCola = () => leerCola().length;
