// =====================================================================
//  MODO DEMO · imita a Supabase con datos de ejemplo en este dispositivo.
//  Sirve para probar la app sin tocar los datos reales.
//  Empleada demo: usuario "ana.barra", PIN 482913
//  Admin demo:    correo "admin@demo", clave "demo1234"
// =====================================================================
const LLAVE = "academia-demo-v1";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const ahora = () => new Date().toISOString();
const diaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hoy = () => new Date().toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const INSIGNIAS = [
  ["primer_sorbo", "Primer sorbo", "Terminaste tu primera lección", "progreso", "cup", null, false, 10, { tipo: "lecciones", n: 1 }],
  ["primera_taza", "Primera taza", "Terminaste tu primer curso", "progreso", "cup", null, false, 25, { tipo: "cursos", n: 1 }],
  ["cafetera_llena", "Cafetera llena", "Terminaste 5 cursos", "progreso", "coffee", null, false, 100, { tipo: "cursos", n: 5 }],
  ["barra_completa", "Barra completa", "Terminaste todos tus cursos asignados", "progreso", "trophy", null, false, 150, { tipo: "asignados" }],
  ["ritual_bronce", "Ritual diario · bronce", "Racha de 3 días aprendiendo", "constancia", "flame", "bronce", false, 15, { tipo: "racha", n: 3 }],
  ["ritual_plata", "Ritual diario · plata", "Racha de 7 días aprendiendo", "constancia", "flame", "plata", false, 40, { tipo: "racha", n: 7 }],
  ["ritual_oro", "Ritual diario · oro", "Racha de 30 días aprendiendo", "constancia", "flame", "oro", false, 200, { tipo: "racha", n: 30 }],
  ["extraccion_perfecta", "Extracción perfecta", "Sacaste 100 en un quiz", "excelencia", "star", null, false, 30, { tipo: "quiz_perfecto" }],
  ["a_la_primera", "A la primera", "Aprobaste un quiz en tu primer intento", "excelencia", "target", null, false, 20, { tipo: "a_la_primera" }],
  ["a_tiempo", "A tiempo", "Terminaste un curso antes de la fecha límite", "puntualidad", "clock", null, false, 20, { tipo: "a_tiempo" }],
  ["barista_certificado", "Barista certificado", "Completaste la ruta de barra", "especialidad", "coffee", null, false, 150, { tipo: "categoria", categoria: "barra" }],
  ["anfitrion_piso", "Anfitrión de piso", "Completaste la ruta de servicio en piso", "especialidad", "tray", null, false, 150, { tipo: "categoria", categoria: "piso" }],
  ["maestro_cocina", "Maestro de cocina", "Completaste la ruta de cocina", "especialidad", "chef", null, false, 150, { tipo: "categoria", categoria: "cocina" }],
  ["hospitalidad_regina", "Hospitalidad Casa Regina", "Completaste la ruta de Casa Regina", "especialidad", "bed", null, false, 150, { tipo: "categoria", categoria: "casa_regina" }],
  ["maraton", "Maratón", "Terminaste 3 lecciones en un día", "secreta", "bolt", null, true, 40, { tipo: "maraton", n: 3 }],
  ["madrugador", "Madrugador", "Terminaste una lección antes de las 8 am", "secreta", "sunrise", null, true, 15, { tipo: "madrugador", hora: 8 }],
  ["noctambulo", "Noctámbulo", "Terminaste una lección después de las 10 pm", "secreta", "moon", null, true, 15, { tipo: "noctambulo", hora: 22 }],
  ["empleado_del_mes", "Empleado del mes", "Reconocimiento especial de Gustavo", "especial", "crown", null, false, 300, { tipo: "manual" }],
].map(([id, nombre, descripcion, categoria, icono, nivel, secreta, puntos, regla], i) =>
  ({ id, nombre, descripcion, categoria, icono, nivel, secreta, puntos, regla, activa: true, orden: i }));

const NIVELES = [
  { orden: 1, nombre: "Grano verde", puntos_min: 0 },
  { orden: 2, nombre: "Tueste claro", puntos_min: 300 },
  { orden: 3, nombre: "Tueste medio", puntos_min: 800 },
  { orden: 4, nombre: "Tueste oscuro", puntos_min: 2000 },
  { orden: 5, nombre: "Maestro tostador", puntos_min: 4000 },
];

const VIDEOS_BUNNY = [
  { id: "demo-v1", titulo: "01 Bienvenida a Mozzafiato", duracion_seg: 95, coleccion: "c1", listo: true },
  { id: "demo-v2", titulo: "02 El grano y el tueste", duracion_seg: 120, coleccion: "c1", listo: true },
  { id: "demo-v3", titulo: "03 Calibrar el molino", duracion_seg: 140, coleccion: "c1", listo: true },
  { id: "demo-v4", titulo: "04 Extracción del espresso", duracion_seg: 160, coleccion: "c1", listo: true },
];

function semilla() {
  const ana = "u-ana", luis = "u-luis", karla = "u-karla", admin = "u-admin";
  const c1 = "c-barismo", c2 = "c-higiene";
  const m1 = "m-1", m2 = "m-2";
  const L = (id, curso, modulo, titulo, dur, orden, video) => ({ id, curso_id: curso, modulo_id: modulo, titulo, duracion_seg: dur, orden, bunny_video_id: video });
  return {
    usuarios: [
      { user_id: ana, usuario: "ana.barra", pin: "482913", nombre: "Ana P.", area: "barra", sede: "Mozzafiato", turno: "AM", rol: "empleado", activo: true },
      { user_id: luis, usuario: "luis.piso", pin: "551820", nombre: "Luis M.", area: "piso", sede: "Mozzafiato", turno: "PM", rol: "empleado", activo: true },
      { user_id: karla, usuario: "karla.barra", pin: "730264", nombre: "Karla C.", area: "barra", sede: "Mozzafiato", turno: "AM", rol: "empleado", activo: true },
      { user_id: admin, usuario: "admin@demo", pin: "demo1234", nombre: "Gustavo", rol: "admin", activo: true },
    ],
    cursos: [
      { id: c1, titulo: "Barismo nivel 1", descripcion: "Del grano a la taza: molienda, extracción y leche.", categoria: "barra", quiz_obligatorio: true, quiz_minimo: 80, certificado: true, publicado: true, orden: 1 },
      { id: c2, titulo: "Higiene y manejo de alimentos", descripcion: "Lo básico que todo el equipo debe dominar.", categoria: "general", quiz_obligatorio: false, quiz_minimo: 80, certificado: true, publicado: true, orden: 2 },
    ],
    modulos: [
      { id: m1, curso_id: c1, titulo: "El grano y el café", orden: 1 },
      { id: m2, curso_id: c1, titulo: "Molienda y extracción", orden: 2 },
      { id: "m-3", curso_id: c2, titulo: "Fundamentos", orden: 1 },
    ],
    lecciones: [
      L("l-1", c1, m1, "Bienvenida a Mozzafiato", 95, 1, "demo-v1"),
      L("l-2", c1, m1, "El grano y el tueste", 120, 2, "demo-v2"),
      L("l-3", c1, m2, "Calibrar el molino", 140, 1, "demo-v3"),
      L("l-4", c1, m2, "Extracción del espresso", 160, 2, "demo-v4"),
      L("l-5", c2, "m-3", "Lavado de manos y estaciones", 90, 1, "demo-v1"),
      L("l-6", c2, "m-3", "Temperaturas seguras", 110, 2, "demo-v2"),
    ],
    materiales: [
      { id: "mat-1", curso_id: c1, titulo: "Recetario de bebidas calientes", ruta: "https://example.com/recetario.pdf", tipo: "pdf", peso_kb: 2100 },
    ],
    preguntas: [
      { id: "q-1", curso_id: c1, pregunta: "¿Cuánto debe durar una extracción de espresso?", opciones: ["10 a 15 s", "25 a 30 s", "45 a 60 s"], orden: 1, correcta: 1 },
      { id: "q-2", curso_id: c1, pregunta: "Si el espresso sale muy rápido, la molienda está…", opciones: ["Muy gruesa", "Muy fina", "Perfecta"], orden: 2, correcta: 0 },
      { id: "q-3", curso_id: c1, pregunta: "¿A qué temperatura se texturiza la leche?", opciones: ["40 °C", "60 a 65 °C", "90 °C"], orden: 3, correcta: 1 },
    ],
    asignaciones: [
      { id: "a-1", curso_id: c1, area: "barra", sede: null, user_id: null, obligatorio: true, fecha_limite: enDias(12) },
      { id: "a-2", curso_id: c2, area: null, sede: null, user_id: null, obligatorio: true, fecha_limite: enDias(25) },
    ],
    progreso: [
      { user_id: ana, leccion_id: "l-1", segundo_actual: 95, max_segundo: 95, completado: true, completado_en: new Date(Date.now() - 2 * 864e5).toISOString(), actualizado: ahora() },
      { user_id: ana, leccion_id: "l-2", segundo_actual: 50, max_segundo: 50, completado: false, completado_en: null, actualizado: ahora() },
    ],
    intentos: [],
    insignias_usuario: [{ user_id: ana, insignia_id: "primer_sorbo", otorgada_en: ahora(), vista: true }],
    puntos: [
      { user_id: ana, puntos: 10, motivo: "leccion", ref: "l-1", creado_en: ahora() },
      { user_id: ana, puntos: 10, motivo: "insignia", ref: "primer_sorbo", creado_en: ahora() },
      { user_id: karla, puntos: 640, motivo: "bono", ref: "demo", creado_en: ahora() },
      { user_id: luis, puntos: 180, motivo: "bono", ref: "demo", creado_en: ahora() },
    ],
    premios: [
      { id: "p-1", nombre: "Bebida de la casa", descripcion: "Una bebida a tu elección", costo: 300, activo: true },
      { id: "p-2", nombre: "Comida gratis en turno", descripcion: "Un platillo del menú", costo: 500, activo: true },
      { id: "p-3", nombre: "Día libre extra", descripcion: "A coordinar con Gustavo", costo: 2000, activo: true },
      { id: "p-4", nombre: "Bono en nómina", descripcion: "Monto definido por admin", costo: 3000, activo: true },
    ],
    canjes: [],
    sesion: null,
  };
}

export function crearDemo() {
  let db;
  try { db = JSON.parse(localStorage.getItem(LLAVE)) || semilla(); } catch { db = semilla(); }
  const guardar = () => { try { localStorage.setItem(LLAVE, JSON.stringify(db)); } catch { /* sin espacio */ } };
  guardar();

  const yo = () => db.usuarios.find((u) => u.user_id === db.sesion);
  const exigir = () => { const u = yo(); if (!u) throw new Error("Tu sesión expiró. Vuelve a entrar."); return u; };
  const esAdmin = () => yo()?.rol === "admin";
  const exigirAdmin = () => { if (!esAdmin()) throw new Error("Solo administrador"); };

  const asignado = (u, cursoId) => db.asignaciones.some((a) => a.curso_id === cursoId
    && (!a.area || a.area === u.area) && (!a.sede || a.sede === u.sede) && (!a.user_id || a.user_id === u.user_id));
  const limite = (u, cursoId) => db.asignaciones.filter((a) => a.curso_id === cursoId
    && (!a.area || a.area === u.area) && (!a.sede || a.sede === u.sede) && (!a.user_id || a.user_id === u.user_id))
    .map((a) => a.fecha_limite).filter(Boolean).sort()[0] || null;
  const puedeVer = (cursoId) => esAdmin() || (db.cursos.find((c) => c.id === cursoId)?.publicado && asignado(yo(), cursoId));
  const prog = (userId, leccionId) => db.progreso.find((p) => p.user_id === userId && p.leccion_id === leccionId);
  const leccionesDe = (cursoId) => db.lecciones.filter((l) => l.curso_id === cursoId);
  const terminado = (userId, cursoId) => {
    const ls = leccionesDe(cursoId);
    if (!ls.length || ls.some((l) => !prog(userId, l.id)?.completado)) return false;
    const c = db.cursos.find((x) => x.id === cursoId);
    return !c.quiz_obligatorio || db.intentos.some((i) => i.user_id === userId && i.curso_id === cursoId && i.aprobado);
  };
  const darPuntos = (userId, puntos, motivo, ref) => {
    if (!puntos || db.puntos.some((p) => p.user_id === userId && p.motivo === motivo && p.ref === ref)) return 0;
    db.puntos.push({ user_id: userId, puntos, motivo, ref, creado_en: ahora() });
    return puntos;
  };
  const ganados = (userId) => db.puntos.filter((p) => p.user_id === userId && p.puntos > 0).reduce((a, p) => a + p.puntos, 0);
  const gastados = (userId) => db.canjes.filter((c) => c.user_id === userId && c.estado !== "rechazado").reduce((a, c) => a + c.costo, 0);
  const racha = (userId) => {
    const dias = [...new Set(db.progreso.filter((p) => p.user_id === userId && p.completado).map((p) => diaLocal(p.completado_en)))]
      .map((s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); }).sort((a, b) => a - b);
    let max = 0, run = 0, prev = null, finRun = null;
    for (const t of dias) { run = prev !== null && t - prev === 864e5 ? run + 1 : 1; prev = t; finRun = t; max = Math.max(max, run); }
    const h = new Date(); const hoy0 = new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime();
    return { actual: finRun !== null && hoy0 - finRun <= 864e5 ? run : 0, maxima: max };
  };
  const cerrarCurso = (u, cursoId) => {
    if (!terminado(u.user_id, cursoId)) return 0;
    let p = darPuntos(u.user_id, 50, "curso", cursoId);
    const lim = limite(u, cursoId);
    if (lim && hoy() <= lim) p += darPuntos(u.user_id, 20, "a_tiempo", cursoId);
    return p;
  };
  const evaluar = (u) => {
    const nuevas = [];
    const comp = db.progreso.filter((p) => p.user_id === u.user_id && p.completado);
    const cursosT = db.cursos.filter((c) => terminado(u.user_id, c.id)).length;
    for (const ins of INSIGNIAS) {
      if (ins.regla.tipo === "manual" || db.insignias_usuario.some((x) => x.user_id === u.user_id && x.insignia_id === ins.id)) continue;
      const r = ins.regla, n = r.n || 1;
      const porDia = {}; comp.forEach((p) => { const d = diaLocal(p.completado_en); porDia[d] = (porDia[d] || 0) + 1; });
      const pubCat = db.cursos.filter((c) => c.publicado && c.categoria === r.categoria);
      const pubAsig = db.cursos.filter((c) => c.publicado && asignado(u, c.id));
      const ok = {
        lecciones: comp.length >= n, cursos: cursosT >= n, racha: racha(u.user_id).maxima >= n,
        quiz_perfecto: db.intentos.some((i) => i.user_id === u.user_id && i.puntaje === 100),
        a_la_primera: db.cursos.some((c) => { const its = db.intentos.filter((i) => i.user_id === u.user_id && i.curso_id === c.id); return its[0]?.aprobado; }),
        a_tiempo: db.puntos.some((p) => p.user_id === u.user_id && p.motivo === "a_tiempo"),
        maraton: Object.values(porDia).some((v) => v >= n),
        madrugador: comp.some((p) => new Date(p.completado_en).getHours() < (r.hora || 8)),
        noctambulo: comp.some((p) => new Date(p.completado_en).getHours() >= (r.hora || 22)),
        categoria: pubCat.length > 0 && pubCat.every((c) => terminado(u.user_id, c.id)),
        asignados: pubAsig.length > 0 && pubAsig.every((c) => terminado(u.user_id, c.id)),
      }[r.tipo];
      if (ok) {
        db.insignias_usuario.push({ user_id: u.user_id, insignia_id: ins.id, otorgada_en: ahora(), vista: false });
        darPuntos(u.user_id, ins.puntos, "insignia", ins.id);
        nuevas.push(ins);
      }
    }
    return nuevas;
  };
  const deshacer = (x) => JSON.parse(JSON.stringify(x));

  const api = {
    // ---------- Sesión ----------
    async entrar(usuario, pin) {
      await espera(300);
      const u = db.usuarios.find((x) => x.usuario === String(usuario).trim().toLowerCase() && x.pin === pin && x.rol === "empleado");
      if (!u) throw new Error("Usuario o PIN incorrecto");
      if (!u.activo) throw new Error("Tu cuenta está desactivada. Habla con Gustavo.");
      db.sesion = u.user_id; guardar();
      return api.resumen();
    },
    async entrarAdmin(correo, clave) {
      await espera(300);
      const u = db.usuarios.find((x) => x.usuario === correo.trim().toLowerCase() && x.pin === clave && x.rol === "admin");
      if (!u) throw new Error("Usuario o PIN incorrecto");
      db.sesion = u.user_id; guardar();
      return api.resumen();
    },
    async salir() { db.sesion = null; guardar(); },
    async haySesion() { return !!yo(); },

    // ---------- Empleado ----------
    async resumen() {
      await espera(); const u = exigir();
      const g = ganados(u.user_id);
      const niv = [...NIVELES].reverse().find((n) => n.puntos_min <= g);
      const sig = NIVELES.find((n) => n.puntos_min > g);
      const r = racha(u.user_id);
      const mias = db.insignias_usuario.filter((x) => x.user_id === u.user_id);
      return {
        usuario: u.usuario, nombre: u.nombre, area: u.area, sede: u.sede, rol: u.rol,
        puntos_ganados: g, puntos_disponibles: g - gastados(u.user_id),
        nivel: niv.nombre, nivel_orden: niv.orden, nivel_min: niv.puntos_min,
        siguiente_nivel: sig?.nombre || null, siguiente_min: sig?.puntos_min || null,
        racha_actual: r.actual, racha_maxima: r.maxima,
        insignias: mias.length, insignias_total: INSIGNIAS.length,
        insignias_sin_ver: mias.filter((x) => !x.vista).map((x) => INSIGNIAS.find((i) => i.id === x.insignia_id)),
      };
    },
    async marcarInsigniasVistas() { const u = exigir(); db.insignias_usuario.forEach((x) => { if (x.user_id === u.user_id) x.vista = true; }); guardar(); },
    async misCursos() {
      await espera(); const u = exigir();
      return db.cursos.filter((c) => c.publicado && asignado(u, c.id)).map((c) => {
        const ls = leccionesDe(c.id).sort((a, b) => {
          const ma = db.modulos.find((m) => m.id === a.modulo_id)?.orden || 0, mb = db.modulos.find((m) => m.id === b.modulo_id)?.orden || 0;
          return ma - mb || a.orden - b.orden;
        });
        const sig = ls.find((l) => !prog(u.user_id, l.id)?.completado);
        const ult = ls.map((l) => prog(u.user_id, l.id)?.actualizado).filter(Boolean).sort().pop() || null;
        return {
          ...c, fecha_limite: limite(u, c.id),
          obligatorio: db.asignaciones.some((a) => a.curso_id === c.id && a.obligatorio),
          lecciones: ls.length, completadas: ls.filter((l) => prog(u.user_id, l.id)?.completado).length,
          duracion_seg: ls.reduce((a, l) => a + (l.duracion_seg || 0), 0),
          terminado: terminado(u.user_id, c.id), ultima_actividad: ult,
          continuar: sig ? { leccion_id: sig.id, titulo: sig.titulo, segundo: prog(u.user_id, sig.id)?.segundo_actual || 0, duracion_seg: sig.duracion_seg } : null,
        };
      }).sort((a, b) => (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999"));
    },
    async curso(id) {
      await espera(); const u = exigir();
      if (!puedeVer(id)) throw new Error("Curso no disponible");
      return deshacer({
        curso: db.cursos.find((c) => c.id === id),
        modulos: db.modulos.filter((m) => m.curso_id === id).sort((a, b) => a.orden - b.orden),
        lecciones: leccionesDe(id).sort((a, b) => a.orden - b.orden),
        materiales: db.materiales.filter((m) => m.curso_id === id),
        preguntas: db.preguntas.filter((q) => q.curso_id === id).map(({ correcta, ...q }) => q),
        progreso: db.progreso.filter((p) => p.user_id === u.user_id),
        intentos: db.intentos.filter((i) => i.user_id === u.user_id && i.curso_id === id).reverse(),
      });
    },
    async urlMaterial(m) { return m.ruta; },
    async video(leccionId) {
      await espera(); const u = exigir();
      const l = db.lecciones.find((x) => x.id === leccionId);
      if (!l || !puedeVer(l.curso_id)) throw new Error("Lección no disponible");
      const p = prog(u.user_id, leccionId);
      return { embed_url: null, demo: true, titulo: l.titulo, duracion_seg: l.duracion_seg, segundo_inicio: p?.completado ? 0 : p?.segundo_actual || 0 };
    },
    async registrarAvance(leccionId, segundo, duracion) {
      const u = exigir();
      const l = db.lecciones.find((x) => x.id === leccionId);
      if (!l || !puedeVer(l.curso_id)) throw new Error("Lección no disponible");
      if (!l.duracion_seg && duracion) l.duracion_seg = Math.round(duracion);
      let p = prog(u.user_id, leccionId);
      if (!p) { p = { user_id: u.user_id, leccion_id: leccionId, segundo_actual: 0, max_segundo: 0, completado: false, completado_en: null }; db.progreso.push(p); }
      p.segundo_actual = Math.floor(segundo); p.max_segundo = Math.max(p.max_segundo, Math.floor(segundo)); p.actualizado = ahora();
      let recien = false, pts = 0, nuevas = [];
      if (!p.completado && l.duracion_seg && p.max_segundo >= l.duracion_seg * 0.9) {
        p.completado = true; p.completado_en = ahora(); recien = true;
        pts = darPuntos(u.user_id, 10, "leccion", leccionId) + cerrarCurso(u, l.curso_id);
        nuevas = evaluar(u);
      }
      guardar();
      return { completado: p.completado, recien_completado: recien, max_segundo: p.max_segundo, puntos_ganados: pts,
               insignias_nuevas: nuevas, curso_terminado: recien ? terminado(u.user_id, l.curso_id) : null };
    },
    async enviarQuiz(cursoId, respuestas) {
      await espera(300); const u = exigir();
      if (leccionesDe(cursoId).some((l) => !prog(u.user_id, l.id)?.completado)) throw new Error("Termina todas las lecciones antes del quiz");
      const qs = db.preguntas.filter((q) => q.curso_id === cursoId);
      const detalle = {}; let bien = 0;
      qs.forEach((q) => { const ok = Number(respuestas[q.id]) === q.correcta; detalle[q.id] = ok; if (ok) bien++; });
      const puntaje = Math.round((100 * bien) / qs.length);
      const c = db.cursos.find((x) => x.id === cursoId);
      const aprobado = puntaje >= c.quiz_minimo;
      db.intentos.push({ user_id: u.user_id, curso_id: cursoId, puntaje, aprobado, creado_en: ahora() });
      let pts = puntaje === 100 ? darPuntos(u.user_id, 30, "quiz_perfecto", cursoId) : 0;
      if (aprobado) pts += cerrarCurso(u, cursoId);
      const nuevas = evaluar(u); guardar();
      return { puntaje, aprobado, minimo: c.quiz_minimo, correctas: bien, total: qs.length, detalle, puntos_ganados: pts,
               insignias_nuevas: nuevas, curso_terminado: terminado(u.user_id, cursoId) };
    },
    async insignias() {
      await espera(); const u = exigir();
      return { catalogo: INSIGNIAS, mias: db.insignias_usuario.filter((x) => x.user_id === u.user_id) };
    },
    async ranking(periodo) {
      await espera(); const u = exigir();
      const desde = periodo === "semana" ? Date.now() - 7 * 864e5 : periodo === "mes" ? Date.now() - 30 * 864e5 : 0;
      const filas = db.usuarios.filter((x) => x.rol === "empleado" && x.activo).map((x) => ({
        user_id: x.user_id, nombre: x.nombre, area: x.area, sede: x.sede,
        puntos: db.puntos.filter((p) => p.user_id === x.user_id && p.puntos > 0 && new Date(p.creado_en).getTime() >= desde).reduce((a, p) => a + p.puntos, 0),
        soy_yo: x.user_id === u.user_id,
      })).sort((a, b) => b.puntos - a.puntos);
      filas.forEach((f, i) => { f.posicion = i > 0 && filas[i - 1].puntos === f.puntos ? filas[i - 1].posicion : i + 1; });
      return filas;
    },
    async premios() {
      await espera(); const u = exigir();
      return { premios: db.premios.filter((p) => p.activo).sort((a, b) => a.costo - b.costo), canjes: db.canjes.filter((c) => c.user_id === u.user_id).reverse() };
    },
    async solicitarCanje(premioId) {
      await espera(); const u = exigir();
      const p = db.premios.find((x) => x.id === premioId && x.activo);
      if (!p) throw new Error("Premio no disponible");
      const disp = ganados(u.user_id) - gastados(u.user_id);
      if (disp < p.costo) throw new Error(`Te faltan ${p.costo - disp} puntos`);
      db.canjes.push({ id: uid(), user_id: u.user_id, premio_id: p.id, costo: p.costo, estado: "pendiente", creado_en: ahora() });
      guardar(); return { disponibles: disp - p.costo };
    },
    async niveles() { return NIVELES; },
    async categorias() { return db.categorias || null; },
    async guardarCategorias(lista) { exigirAdmin(); db.categorias = lista; guardar(); },
    async crearInsignia(ins) { exigirAdmin(); if (!INSIGNIAS.some((i) => i.id === ins.id)) INSIGNIAS.push({ activa: true, secreta: false, nivel: null, ...ins }); },

    // ---------- Admin ----------
    async adminAvance() {
      await espera(); exigirAdmin();
      return db.usuarios.filter((u) => u.rol === "empleado").map((u) => {
        const cursos = db.cursos.filter((c) => c.publicado && asignado(u, c.id));
        const ls = cursos.flatMap((c) => leccionesDe(c.id));
        return {
          user_id: u.user_id, usuario: u.usuario, nombre: u.nombre, area: u.area, sede: u.sede, turno: u.turno, activo: u.activo,
          puntos: ganados(u.user_id), lecciones_asignadas: ls.length,
          lecciones_completadas: ls.filter((l) => prog(u.user_id, l.id)?.completado).length,
          cursos_atrasados: cursos.filter((c) => limite(u, c.id) && limite(u, c.id) < hoy() && !terminado(u.user_id, c.id)).length,
          ultima_actividad: db.progreso.filter((p) => p.user_id === u.user_id).map((p) => p.actualizado).sort().pop() || null,
        };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    async crearEmpleado(d) {
      await espera(); exigirAdmin();
      const usuario = String(d.usuario || "").toLowerCase().trim().replace(/\s+/g, ".");
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(usuario)) throw new Error("Usuario inválido (3-30 letras, números, punto o guion)");
      if (db.usuarios.some((u) => u.usuario === usuario)) throw new Error("Ese usuario ya existe");
      const pin = d.pin || String(Math.floor(100000 + Math.random() * 899999));
      const u = { user_id: uid(), usuario, pin, nombre: d.nombre, area: d.area, sede: d.sede, turno: d.turno, gestor_id: d.gestor_id || null, rol: "empleado", activo: true };
      db.usuarios.push(u); guardar();
      return { ok: true, usuario, nombre: d.nombre, pin, user_id: u.user_id };
    },
    async importarEmpleados(lista) {
      const resultados = [];
      for (const e of lista) { try { resultados.push(await api.crearEmpleado(e)); } catch (err) { resultados.push({ ok: false, usuario: e.usuario, error: err.message }); } }
      return { creados: resultados.filter((r) => r.ok).length, con_error: resultados.filter((r) => !r.ok).length, resultados };
    },
    async adminPerfiles() {
      exigirAdmin();
      return db.usuarios.filter((u) => u.rol === "empleado").map(({ user_id, nombre, usuario, gestor_id, activo }) => ({ user_id, nombre, usuario, gestor_id, activo }));
    },
    async cambiarPin(userId, pin) {
      await espera(); exigirAdmin();
      const u = db.usuarios.find((x) => x.user_id === userId);
      u.pin = pin || String(Math.floor(100000 + Math.random() * 899999)); guardar();
      return { ok: true, pin: u.pin };
    },
    async actualizarEmpleado(userId, cambios) {
      await espera(); exigirAdmin();
      Object.assign(db.usuarios.find((x) => x.user_id === userId), cambios); guardar();
      return { ok: true };
    },
    async otorgarInsignia(userId, insignia) {
      exigirAdmin();
      const ins = INSIGNIAS.find((i) => i.id === insignia);
      if (!db.insignias_usuario.some((x) => x.user_id === userId && x.insignia_id === insignia)) {
        db.insignias_usuario.push({ user_id: userId, insignia_id: insignia, otorgada_en: ahora(), vista: false });
      }
      darPuntos(userId, ins.puntos, "insignia", insignia + "_" + hoy().slice(0, 7)); guardar();
    },
    async bunnyColecciones() { await espera(); return [{ id: "c1", nombre: "Barismo nivel 1 (demo)", videos: 4 }]; },
    async bunnyVideos() { await espera(); return VIDEOS_BUNNY; },
    async gestorEmpleados() {
      await espera();
      const l = [
        ["mozza:1", "Ana P.", "barra", "AM", "Mozzafiato", "529830000001", true],
        ["mozza:2", "Yuliana", "piso", "AM", "Mozzafiato", "529830000002", true],
        ["mozza:3", "Pedro Chan", "cocina", "PM", "Mozzafiato", null, true],
        ["mozza:4", "Rosa May", "piso", "PM", "Mozzafiato", "529830000004", false],
        ["casaregina:1", "Lucía Pech", "casa_regina", "AM", "Casa Regina", "529830000005", true],
      ];
      return l.map(([gestor_id, nombre, area, turno, sede, whatsapp, activo]) => ({ gestor_id, nombre, area, turno, sede, whatsapp, activo, encargado: false }));
    },
    async crearColeccion(nombre) { await espera(); return { id: "col-" + uid(), nombre }; },
    async prepararSubida(titulo, coleccion, videoId) {
      await espera(80);
      const id = videoId || "demo-" + uid();
      if (!videoId) VIDEOS_BUNNY.push({ id, titulo, duracion_seg: 60 + Math.floor(Math.random() * 300), coleccion, listo: true });
      return { video_id: id, library_id: "demo", expira: 0, firma: "demo", demo: true };
    },
    async adminCursos() {
      await espera(); exigirAdmin();
      return db.cursos.map((c) => ({ ...c, lecciones: leccionesDe(c.id).length,
        duracion_seg: leccionesDe(c.id).reduce((a, l) => a + (l.duracion_seg || 0), 0),
        asignaciones: db.asignaciones.filter((a) => a.curso_id === c.id).length }));
    },
    async adminCurso(id) {
      await espera(); exigirAdmin();
      return deshacer({
        curso: db.cursos.find((c) => c.id === id),
        modulos: db.modulos.filter((m) => m.curso_id === id).sort((a, b) => a.orden - b.orden),
        lecciones: leccionesDe(id).sort((a, b) => a.orden - b.orden),
        asignaciones: db.asignaciones.filter((a) => a.curso_id === id),
        perfiles: db.usuarios.filter((u) => u.rol === "empleado").map(({ user_id, nombre, usuario }) => ({ user_id, nombre, usuario })),
      });
    },
    async guardarCurso(c) {
      exigirAdmin();
      if (c.id) { Object.assign(db.cursos.find((x) => x.id === c.id), c); guardar(); return db.cursos.find((x) => x.id === c.id); }
      const nuevo = { quiz_obligatorio: false, quiz_minimo: 80, certificado: true, publicado: false, orden: db.cursos.length + 1, ...c, id: uid() };
      db.cursos.push(nuevo); guardar(); return nuevo;
    },
    async borrarCurso(id) {
      exigirAdmin();
      const ls = leccionesDe(id).map((l) => l.id);
      db.cursos = db.cursos.filter((c) => c.id !== id); db.modulos = db.modulos.filter((m) => m.curso_id !== id);
      db.lecciones = db.lecciones.filter((l) => l.curso_id !== id); db.asignaciones = db.asignaciones.filter((a) => a.curso_id !== id);
      db.progreso = db.progreso.filter((p) => !ls.includes(p.leccion_id)); guardar();
    },
    async guardarModulo(m) {
      exigirAdmin();
      if (m.id) { Object.assign(db.modulos.find((x) => x.id === m.id), m); guardar(); return m; }
      const nuevo = { ...m, id: uid() }; db.modulos.push(nuevo); guardar(); return nuevo;
    },
    async borrarModulo(id) {
      exigirAdmin(); db.modulos = db.modulos.filter((m) => m.id !== id);
      db.lecciones.forEach((l) => { if (l.modulo_id === id) l.modulo_id = null; }); guardar();
    },
    async agregarLecciones(filas) {
      exigirAdmin(); const nuevas = filas.map((f) => ({ ...f, id: uid() })); db.lecciones.push(...nuevas); guardar(); return nuevas;
    },
    async actualizarLeccion(id, cambios) { exigirAdmin(); Object.assign(db.lecciones.find((l) => l.id === id), cambios); guardar(); },
    async borrarLeccion(id) { exigirAdmin(); db.lecciones = db.lecciones.filter((l) => l.id !== id); db.progreso = db.progreso.filter((p) => p.leccion_id !== id); guardar(); },
    async agregarAsignacion(a) { exigirAdmin(); const n = { ...a, id: uid() }; db.asignaciones.push(n); guardar(); return n; },
    async borrarAsignacion(id) { exigirAdmin(); db.asignaciones = db.asignaciones.filter((a) => a.id !== id); guardar(); },
    async adminPremios() {
      await espera(); exigirAdmin();
      return { premios: [...db.premios].sort((a, b) => a.costo - b.costo),
               canjes: [...db.canjes].reverse().map((c) => ({ ...c, nombre: db.usuarios.find((u) => u.user_id === c.user_id)?.nombre || "—" })) };
    },
    async guardarPremio(p) {
      exigirAdmin();
      if (p.id) Object.assign(db.premios.find((x) => x.id === p.id), p); else db.premios.push({ activo: true, ...p, id: uid() });
      guardar();
    },
    async resolverCanje(id, estado) {
      exigirAdmin(); const c = db.canjes.find((x) => x.id === id);
      if (c && c.estado === "pendiente") { c.estado = estado; c.resuelto_en = ahora(); } guardar();
    },
    async catalogoInsignias() { return INSIGNIAS; },
    reiniciarDemo() { db = semilla(); guardar(); },
  };
  return api;
}
