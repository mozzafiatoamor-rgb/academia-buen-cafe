// =====================================================================
//  MODO DEMO · imita a Supabase con datos de ejemplo en este dispositivo.
//  Sirve para probar la app sin tocar los datos reales.
//  Empleada demo: usuario "ana.barra", PIN 482913
//  Admin demo:    correo "admin@demo", clave "demo1234"
// =====================================================================
import { fijarCfgPuntos, puntosLeccion, puntosCurso, puntosQuiz, puntosATiempo } from "./puntos.js";
const LLAVE = "academia-demo-v1";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const ahora = () => new Date().toISOString();
const diaLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hoy = () => new Date().toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const hoyISOdemo = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// Audio de prueba generado en el navegador (acordes suaves), para el modo demo.
const audiosDemo = {};
function audioDemo(seg = 180) {
  if (audiosDemo[seg]) return audiosDemo[seg];
  const hz = 8000, n = seg * hz, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const txt = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF"); v.setUint32(4, 36 + n, true); txt(8, "WAVE"); txt(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, hz, true);
  v.setUint32(28, hz, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); txt(36, "data"); v.setUint32(40, n, true);
  const acordes = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  for (let i = 0; i < n; i++) {
    const t = i / hz, ac = acordes[Math.floor(t / 4) % 4], env = Math.min(1, (t % 4) * 2) * Math.max(0, 1 - (t % 4) / 4.2);
    const x = ac.reduce((a, f) => a + Math.sin(2 * Math.PI * f * t), 0) / 3;
    v.setUint8(44 + i, 128 + Math.round(x * env * 38));
  }
  return (audiosDemo[seg] = URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
}
const AUDIOS_BUNNY = {
  "": [{ nombre: "liderazgo", carpeta: true }, { nombre: "servicio", carpeta: true }],
  liderazgo: [{ nombre: "lider-de-turno.m4b", carpeta: false, bytes: 48e6 }, { nombre: "conversaciones-dificiles.mp3", carpeta: false, bytes: 31e6 }],
  servicio: [{ nombre: "el-arte-de-servir.m4b", carpeta: false, bytes: 52e6 }],
};
const durDemo = (ruta) => { const n = String(ruta).split("/").pop(); return /lider/.test(n) ? 240 : /conversa/.test(n) ? 150 : 180; };

const INSIGNIAS_BASE = [
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

const NIVELES_BASE = [
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
      { user_id: ana, usuario: "ana.barra", pin: "482913", nombre: "Ana P.", area: "barra", sede: "Mozzafiato", turno: "AM", rol: "empleado", activo: true, gestor_id: "mozza:1" },
      { user_id: luis, usuario: "luis.piso", pin: "551820", nombre: "Luis M.", area: "piso", sede: "Mozzafiato", turno: "PM", rol: "empleado", activo: true,
        avatar: { pelo: "copete", colorPelo: 0, vello: "candado", lentes: "sol", ropa: "sudadera", colorRopa: 5, fondo: "estrellas", colorFondo: 5, piel: 4, cabeza: "gorra-reves", colorGorro: 4 } },
      { user_id: karla, usuario: "karla.barra", pin: "730264", nombre: "Karla C.", area: "barra", sede: "Mozzafiato", turno: "AM", rol: "empleado", activo: true,
        avatar: { pelo: "largo", colorPelo: 6, ojos: "pestanas", boca: "dientes", extra: "aretes", fondo: "rayos", colorFondo: 2, piel: 2, marco: "oro" } },
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
      { user_id: karla, leccion_id: "l-5", segundo_actual: 90, max_segundo: 90, completado: true, completado_en: new Date(Date.now() - 3 * 864e5).toISOString(), actualizado: new Date(Date.now() - 3 * 864e5).toISOString() },
      { user_id: karla, leccion_id: "l-6", segundo_actual: 110, max_segundo: 110, completado: true, completado_en: new Date(Date.now() - 3 * 864e5 + 6e5).toISOString(), actualizado: new Date(Date.now() - 3 * 864e5 + 6e5).toISOString() },
    ],
    intentos: [],
    insignias_usuario: [{ user_id: ana, insignia_id: "primer_sorbo", otorgada_en: ahora(), vista: true }],
    puntos: [
      { user_id: ana, puntos: 10, motivo: "leccion", ref: "l-1", creado_en: ahora() },
      { user_id: ana, puntos: 10, motivo: "insignia", ref: "primer_sorbo", creado_en: ahora() },
      { user_id: karla, puntos: 640, motivo: "bono", ref: "demo", creado_en: ahora() },
      { user_id: karla, puntos: 10, motivo: "leccion", ref: "l-5", creado_en: new Date(Date.now() - 3 * 864e5).toISOString() },
      { user_id: karla, puntos: 10, motivo: "leccion", ref: "l-6", creado_en: new Date(Date.now() - 3 * 864e5 + 6e5).toISOString() },
      { user_id: karla, puntos: 30, motivo: "curso", ref: "c-higiene", creado_en: new Date(Date.now() - 3 * 864e5 + 6e5).toISOString() },
      { user_id: luis, puntos: 180, motivo: "bono", ref: "demo", creado_en: ahora() },
    ],
    premios: [
      { id: "p-1", nombre: "Bebida de la casa", descripcion: "Una bebida a tu elección", costo: 300, activo: true, destacado: true },
      { id: "p-5", nombre: "Postre doble", descripcion: "Solo por temporada", costo: 150, activo: true, disponible_hasta: (() => { const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })() },
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
  if (!db.insignias) db.insignias = JSON.parse(JSON.stringify(INSIGNIAS_BASE));
  if (!db.niveles) db.niveles = JSON.parse(JSON.stringify(NIVELES_BASE));
  if (!db.config) db.config = {};
  if (!db.audiolibros) {
    db.audiolibros = [
      { id: "a-servir", titulo: "El arte de servir", autor: "Equipo Mozzafiato", descripcion: "Cómo convertir cada mesa en una experiencia que la gente recuerda.", categoria: "piso",
        portada_url: null, archivo: "servicio/el-arte-de-servir.m4b", duracion_seg: 180, publicado: true, orden: 1,
        capitulos: [{ t: 0, titulo: "Introducción" }, { t: 60, titulo: "La primera impresión" }, { t: 120, titulo: "Cerrar con broche de oro" }] },
      { id: "a-lider", titulo: "Líder de turno", autor: "Equipo Mozzafiato", descripcion: "Organizar, motivar y resolver en plena hora pico.", categoria: "liderazgo",
        portada_url: null, archivo: "liderazgo/lider-de-turno.m4b", duracion_seg: 240, publicado: true, orden: 2, capitulos: [] },
    ];
    db.audio_asignaciones = [{ id: "aa-1", audiolibro_id: "a-servir", area: null, sede: null, user_id: null, obligatorio: false, fecha_limite: null }];
    db.audio_progreso = [];
    db.audio_marcadores = [];
  }
  fijarCfgPuntos(db.config);
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
    let p = darPuntos(u.user_id, puntosCurso(leccionesDe(cursoId)), "curso", cursoId);
    const lim = limite(u, cursoId);
    if (lim && hoy() <= lim) p += darPuntos(u.user_id, puntosATiempo(leccionesDe(cursoId)), "a_tiempo", cursoId);
    return p;
  };
  const evaluar = (u) => {
    const nuevas = [];
    const comp = db.progreso.filter((p) => p.user_id === u.user_id && p.completado);
    const cursosT = db.cursos.filter((c) => terminado(u.user_id, c.id)).length;
    for (const ins of db.insignias) {
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
      const niv = [...db.niveles].reverse().find((n) => n.puntos_min <= g);
      const sig = db.niveles.find((n) => n.puntos_min > g);
      const r = racha(u.user_id);
      const mias = db.insignias_usuario.filter((x) => x.user_id === u.user_id);
      return {
        usuario: u.usuario, nombre: u.nombre, area: u.area, sede: u.sede, rol: u.rol,
        puntos_ganados: g, puntos_disponibles: g - gastados(u.user_id),
        nivel: niv.nombre, nivel_orden: niv.orden, nivel_min: niv.puntos_min,
        siguiente_nivel: sig?.nombre || null, siguiente_min: sig?.puntos_min || null,
        racha_actual: r.actual, racha_maxima: r.maxima,
        insignias: mias.length, insignias_total: db.insignias.length,
        insignias_sin_ver: mias.filter((x) => !x.vista).map((x) => db.insignias.find((i) => i.id === x.insignia_id)),
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
        pts = darPuntos(u.user_id, puntosLeccion(l.duracion_seg), "leccion", leccionId) + cerrarCurso(u, l.curso_id);
        nuevas = evaluar(u);
      }
      guardar();
      return { completado: p.completado, recien_completado: recien, max_segundo: p.max_segundo, puntos_ganados: pts,
               insignias_nuevas: nuevas, curso_terminado: recien ? terminado(u.user_id, l.curso_id) : null };
    },
    // ---------- Avatar ----------
    async miAvatar() { const u = exigir(); return u.avatar ? deshacer(u.avatar) : null; },
    async guardarAvatar(avatar) { const u = exigir(); u.avatar = avatar; guardar(); },
    async miMeta() { const u = exigir(); return u.meta_premio || null; },
    async fijarMeta(id) { const u = exigir(); u.meta_premio = id || null; guardar(); },
    async avatares() { return Object.fromEntries(db.usuarios.filter((u) => u.avatar && u.activo).map((u) => [u.user_id, u.avatar])); },

    // ---------- Audiolibros y catálogo ----------
    async misAudiolibros() {
      await espera(); const u = exigir();
      const asig = (b) => db.audio_asignaciones.filter((a) => a.audiolibro_id === b.id
        && (!a.area || a.area === u.area) && (!a.sede || a.sede === u.sede) && (!a.user_id || a.user_id === u.user_id));
      return db.audiolibros.filter((b) => b.publicado).map((b) => {
        const as = asig(b), pr = db.audio_progreso.find((p) => p.user_id === u.user_id && p.audiolibro_id === b.id);
        const min = (b.duracion_seg || 0) / 60;
        return { ...deshacer(b), archivo: undefined, asignado: as.length > 0, obligatorio: as.some((a) => a.obligatorio),
          fecha_limite: as.map((a) => a.fecha_limite).filter(Boolean).sort()[0] || null,
          segundo_actual: pr?.segundo_actual || 0, max_segundo: pr?.max_segundo || 0, completado: !!pr?.completado,
          ultima_actividad: pr?.actualizado || null, valor: Math.round(min) + Math.min(300, Math.max(20, Math.round(min * 0.3))) };
      }).sort((a, b) => Number(b.asignado) - Number(a.asignado) || (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999") || a.orden - b.orden);
    },
    async catalogoCursos() {
      await espera(); const u = exigir();
      return db.cursos.filter((c) => c.publicado).map((c) => ({ id: c.id, titulo: c.titulo, descripcion: c.descripcion, categoria: c.categoria, portada_url: c.portada_url || null,
        lecciones: leccionesDe(c.id).length, duracion_seg: leccionesDe(c.id).reduce((a, l) => a + (l.duracion_seg || 0), 0),
        asignado: asignado(u, c.id), terminado: terminado(u.user_id, c.id) }));
    },
    async audio(libroId) {
      await espera(); const u = exigir();
      const b = db.audiolibros.find((x) => x.id === libroId);
      const ok = b && (esAdmin() || (b.publicado && db.audio_asignaciones.some((a) => a.audiolibro_id === b.id
        && (!a.area || a.area === u.area) && (!a.sede || a.sede === u.sede) && (!a.user_id || a.user_id === u.user_id))));
      if (!ok) throw new Error("Este audiolibro no está asignado a ti");
      const pistas = (b.archivos || []).length > 1 ? b.archivos.map((a) => ({ url: audioDemo(Math.max(2, Math.round(a.dur || 60))), dur: a.dur || 60, titulo: a.titulo })) : [];
      return { url: pistas[0]?.url || audioDemo(b.duracion_seg || durDemo(b.archivo)), pistas, titulo: b.titulo, duracion_seg: b.duracion_seg };
    },
    async registrarAudio(libroId, segundo, duracion) {
      const u = exigir();
      const b = db.audiolibros.find((x) => x.id === libroId);
      if (!b) throw new Error("Audiolibro no disponible");
      if (!b.duracion_seg && duracion) b.duracion_seg = Math.round(duracion);
      let p = db.audio_progreso.find((x) => x.user_id === u.user_id && x.audiolibro_id === libroId);
      if (!p) { p = { user_id: u.user_id, audiolibro_id: libroId, segundo_actual: 0, max_segundo: 0, completado: false, completado_en: null, actualizado: ahora() }; db.audio_progreso.push(p); }
      const antes = p.max_segundo, tramo = 60; // en demo, un tramo por minuto para probar rápido
      p.segundo_actual = Math.floor(segundo); p.max_segundo = Math.max(p.max_segundo, Math.floor(segundo)); p.actualizado = ahora();
      let pts = 0, recien = false;
      for (let n = Math.floor(antes / tramo) + 1; n <= Math.floor(p.max_segundo / tramo); n++) pts += darPuntos(u.user_id, 1, "audio", `${libroId}:${n}`);
      if (!p.completado && b.duracion_seg && p.max_segundo >= b.duracion_seg * 0.9) {
        p.completado = true; p.completado_en = ahora(); recien = true;
        pts += darPuntos(u.user_id, Math.min(300, Math.max(20, Math.round(b.duracion_seg / 60 * 0.3))), "audiolibro", libroId);
      }
      const nuevas = pts ? evaluar(u) : [];
      guardar();
      return { max_segundo: p.max_segundo, completado: p.completado, recien_completado: recien, puntos_ganados: pts, insignias_nuevas: nuevas };
    },
    async marcadores(libroId) { const u = exigir(); return deshacer(db.audio_marcadores.filter((m) => m.user_id === u.user_id && m.audiolibro_id === libroId).sort((a, b) => a.segundo - b.segundo)); },
    async agregarMarcador(libroId, segundo, nota) {
      const u = exigir(); const m = { id: uid(), user_id: u.user_id, audiolibro_id: libroId, segundo: Math.floor(segundo), nota: nota || null, creado_en: ahora() };
      db.audio_marcadores.push(m); guardar(); return deshacer(m);
    },
    async borrarMarcador(id) { const u = exigir(); db.audio_marcadores = db.audio_marcadores.filter((m) => !(m.id === id && m.user_id === u.user_id)); guardar(); },

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
      let pts = puntaje === 100 ? darPuntos(u.user_id, puntosQuiz(qs.length), "quiz_perfecto", cursoId) : 0;
      if (aprobado) pts += cerrarCurso(u, cursoId);
      const nuevas = evaluar(u); guardar();
      return { puntaje, aprobado, minimo: c.quiz_minimo, correctas: bien, total: qs.length, detalle, puntos_ganados: pts,
               insignias_nuevas: nuevas, curso_terminado: terminado(u.user_id, cursoId) };
    },
    async insignias() {
      await espera(); const u = exigir();
      return { catalogo: db.insignias, mias: db.insignias_usuario.filter((x) => x.user_id === u.user_id) };
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
      if (u.meta_premio === p.id) u.meta_premio = null;
      guardar(); return { disponibles: disp - p.costo };
    },
    async niveles() { return [...db.niveles].sort((a, b) => a.orden - b.orden); },
    async config() { return { ...db.config }; },
    async guardarConfig(obj) { exigirAdmin(); db.config = { ...db.config, ...obj }; fijarCfgPuntos(db.config); guardar(); },
    async guardarNiveles(lista) { exigirAdmin(); db.niveles = lista.map((n, i) => ({ orden: i + 1, nombre: n.nombre, puntos_min: Number(n.puntos_min) })); guardar(); },
    async guardarInsignia(ins) {
      exigirAdmin();
      const x = db.insignias.find((i) => i.id === ins.id);
      if (x) Object.assign(x, ins); else db.insignias.push({ activa: true, secreta: false, nivel: null, orden: 200, ...ins });
      guardar();
    },
    async adminValorCatalogo() {
      exigirAdmin();
      return db.cursos.filter((c) => c.publicado).map((c) => ({
        id: c.id, titulo: c.titulo, lecciones: leccionesDe(c.id).map((l) => ({ duracion_seg: l.duracion_seg })),
        preguntas: db.preguntas.filter((q) => q.curso_id === c.id).length,
        conFecha: db.asignaciones.some((a) => a.curso_id === c.id && a.fecha_limite),
      }));
    },
    async adminQuiz(cursoId) { exigirAdmin(); return deshacer(db.preguntas.filter((x) => x.curso_id === cursoId).sort((a, b) => a.orden - b.orden)); },
    async guardarPregunta(p) {
      exigirAdmin();
      if (p.id) { const x = db.preguntas.find((y) => y.id === p.id); Object.keys(p).forEach((k) => p[k] !== undefined && (x[k] = p[k])); guardar(); return x; }
      const n = { correcta: 0, ...p, id: uid() }; db.preguntas.push(n); guardar(); return n;
    },
    async borrarPregunta(id) { exigirAdmin(); db.preguntas = db.preguntas.filter((x) => x.id !== id); guardar(); },
    async adminMateriales(cursoId) { exigirAdmin(); return deshacer(db.materiales.filter((m) => m.curso_id === cursoId).sort((a, b) => (a.orden || 0) - (b.orden || 0))); },
    async subirMaterial(cursoId, archivo, titulo, orden = 0) {
      exigirAdmin(); await espera(400);
      const m = { id: uid(), curso_id: cursoId, titulo, ruta: URL.createObjectURL(archivo), tipo: (archivo.name.split(".").pop() || "pdf").toLowerCase(), peso_kb: Math.round(archivo.size / 1024), orden };
      db.materiales.push(m); guardar(); return m;
    },
    async agregarMaterialLink(cursoId, titulo, url, orden = 0) { exigirAdmin(); const m = { id: uid(), curso_id: cursoId, titulo, ruta: url, tipo: "link", orden }; db.materiales.push(m); guardar(); return m; },
    async actualizarMaterial(id, cambios) { exigirAdmin(); Object.assign(db.materiales.find((m) => m.id === id), cambios); guardar(); },
    async borrarMaterial(m) { exigirAdmin(); db.materiales = db.materiales.filter((x) => x.id !== m.id); guardar(); },
    async categorias() { return db.categorias || null; },
    async guardarCategorias(lista) { exigirAdmin(); db.categorias = lista; guardar(); },
    async crearInsignia(ins) { exigirAdmin(); if (!db.insignias.some((i) => i.id === ins.id)) db.insignias.push({ activa: true, secreta: false, nivel: null, ...ins }); },

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
    async adminFicha(userId) {
      await espera(); exigirAdmin();
      const u = db.usuarios.find((x) => x.user_id === userId); if (!u) throw new Error("Empleado no encontrado");
      const titCurso = (id) => db.cursos.find((c) => c.id === id)?.titulo;
      const titLibro = (id) => db.audiolibros.find((b) => b.id === id)?.titulo;
      const detalle = (p) => ({
        leccion: () => { const l = db.lecciones.find((x) => x.id === p.ref); return l ? `${l.titulo} · ${titCurso(l.curso_id)}` : null; },
        curso: () => titCurso(p.ref), quiz_perfecto: () => titCurso(p.ref), a_tiempo: () => titCurso(p.ref),
        insignia: () => db.insignias.find((i) => i.id === p.ref)?.nombre,
        audio: () => { const [b, t] = String(p.ref).split(":"); return titLibro(b) ? `${titLibro(b)}${t === "fin" ? " · final" : t ? " · tramo " + t : ""}` : null; },
        audiolibro: () => titLibro(p.ref), audio_a_tiempo: () => titLibro(p.ref),
        idea: () => (db.ideas || []).find((i) => i.id === p.ref)?.texto?.slice(0, 90) || "Nota de voz / foto",
      }[p.motivo]?.() || p.nota || p.ref || "");
      const mios = db.puntos.filter((p) => p.user_id === userId);
      const porMotivo = {};
      mios.forEach((p) => { porMotivo[p.motivo] = porMotivo[p.motivo] || { motivo: p.motivo, puntos: 0, veces: 0 }; porMotivo[p.motivo].puntos += p.puntos; porMotivo[p.motivo].veces++; });
      const fechaFin = (cid) => [...leccionesDe(cid).map((l) => prog(userId, l.id)?.completado_en), ...db.intentos.filter((i) => i.user_id === userId && i.curso_id === cid && i.aprobado).map((i) => i.creado_en)].filter(Boolean).sort().pop() || null;
      const conProg = (cid) => leccionesDe(cid).some((l) => prog(userId, l.id));
      const r = racha(userId), g = ganados(userId);
      const nivel = [...db.niveles].sort((a, b) => b.puntos_min - a.puntos_min).find((n) => n.puntos_min <= g)?.nombre;
      return deshacer({
        perfil: { user_id: u.user_id, nombre: u.nombre, usuario: u.usuario, area: u.area, sede: u.sede, turno: u.turno, activo: u.activo, meta_premio: u.meta_premio || null },
        ganados: g, disponibles: g - gastados(userId), nivel, racha_actual: r.actual, racha_maxima: r.maxima,
        por_motivo: Object.values(porMotivo).sort((a, b) => b.puntos - a.puntos),
        historial: [...mios].sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en))).map((p) => ({ puntos: p.puntos, motivo: p.motivo, creado_en: p.creado_en, detalle: detalle(p) })),
        cursos: db.cursos.filter((c) => (c.publicado && asignado(u, c.id)) || conProg(c.id)).map((c) => {
          const ls = leccionesDe(c.id), t = terminado(userId, c.id);
          return { id: c.id, titulo: c.titulo, publicado: c.publicado, certificado: c.certificado, asignado: asignado(u, c.id), fecha_limite: limite(u, c.id),
            lecciones: ls.length, completadas: ls.filter((l) => prog(userId, l.id)?.completado).length, duracion_seg: ls.reduce((a, l) => a + (l.duracion_seg || 0), 0),
            terminado: t, terminado_en: t ? fechaFin(c.id) : null,
            quiz_mejor: db.intentos.filter((i) => i.user_id === userId && i.curso_id === c.id).reduce((m, i) => Math.max(m, i.puntaje), 0) || null,
            ultima_actividad: ls.map((l) => prog(userId, l.id)?.actualizado).filter(Boolean).sort().pop() || null };
        }).sort((a, b) => Number(a.terminado) - Number(b.terminado) || a.titulo.localeCompare(b.titulo)),
        audiolibros: db.audiolibros.map((b) => {
          const ap = db.audio_progreso.find((p) => p.user_id === userId && p.audiolibro_id === b.id);
          const as = db.audio_asignaciones.some((a) => a.audiolibro_id === b.id && (!a.area || a.area === u.area) && (!a.sede || a.sede === u.sede) && (!a.user_id || a.user_id === u.user_id));
          return (b.publicado && as) || ap ? { id: b.id, titulo: b.titulo, duracion_seg: b.duracion_seg, asignado: as, escuchado: ap?.max_segundo || 0, completado: !!ap?.completado, completado_en: ap?.completado_en || null, ultima_actividad: ap?.actualizado || null } : null;
        }).filter(Boolean),
        insignias: db.insignias_usuario.filter((x) => x.user_id === userId).map((x) => { const i = db.insignias.find((y) => y.id === x.insignia_id) || {}; return { id: i.id, nombre: i.nombre, icono: i.icono, nivel: i.nivel, otorgada_en: x.otorgada_en }; }),
        canjes: db.canjes.filter((k) => k.user_id === userId).map((k) => ({ premio: db.premios.find((p) => p.id === k.premio_id)?.nombre || "Premio", costo: k.costo, estado: k.estado, creado_en: k.creado_en })),
        ideas: (db.ideas || []).filter((i) => i.user_id === userId).reduce((o, i) => ({ ...o, [i.estado]: (o[i.estado] || 0) + 1 }), {}),
      });
    },
    async ajustarInsignias(insignia, aplicar) {
      await espera(); exigirAdmin();
      const deIns = (ref, id) => ref === id || (ref.startsWith(id + "_") && /^\d{4}-\d{2}$/.test(ref.slice(id.length + 1)));
      const grupos = {};
      for (const p of db.puntos.filter((x) => x.motivo === "insignia")) {
        const i = db.insignias.find((y) => (!insignia || y.id === insignia) && deIns(p.ref, y.id));
        if (!i || p.puntos === i.puntos) continue;
        const k = p.user_id + "|" + i.id, u = db.usuarios.find((x) => x.user_id === p.user_id);
        grupos[k] = grupos[k] || { user_id: p.user_id, nombre: u?.nombre, insignia: i.id, nombre_insignia: i.nombre, veces: 0, antes: 0, ahora: 0, disponibles: ganados(p.user_id) - gastados(p.user_id) };
        grupos[k].veces++; grupos[k].antes += p.puntos; grupos[k].ahora += i.puntos;
        if (aplicar) { p.nota = `Valor actualizado (antes ${p.puntos})`; p.puntos = i.puntos; }
      }
      if (aplicar) guardar();
      return Object.values(grupos);
    },
    async adminReconocer() {
      await espera(); exigirAdmin();
      return db.usuarios.filter((u) => u.rol === "empleado" && u.activo).map((u) => ({
        user_id: u.user_id, nombre: u.nombre, usuario: u.usuario, area: u.area, sede: u.sede, meta_premio: u.meta_premio || null,
        disponibles: ganados(u.user_id) - gastados(u.user_id),
        sin_propuesta: db.cursos.filter((c) => terminado(u.user_id, c.id) && !(db.ideas || []).some((i) => i.user_id === u.user_id && i.curso_id === c.id))
          .map((c) => ({ curso_id: c.id, titulo: c.titulo, terminado_en: leccionesDe(c.id).map((l) => prog(u.user_id, l.id)?.completado_en).filter(Boolean).sort().pop() || null })),
        diplomas: db.cursos.filter((c) => c.certificado && terminado(u.user_id, c.id)).map((c) => {
          const ls = leccionesDe(c.id);
          const fin = [...ls.map((l) => prog(u.user_id, l.id)?.completado_en), ...db.intentos.filter((i) => i.user_id === u.user_id && i.curso_id === c.id && i.aprobado).map((i) => i.creado_en)].filter(Boolean).sort().pop();
          return { curso_id: c.id, titulo: c.titulo, terminado_en: fin || null, duracion_seg: ls.reduce((a, l) => a + (l.duracion_seg || 0), 0),
            quiz_mejor: db.intentos.filter((i) => i.user_id === u.user_id && i.curso_id === c.id).reduce((m, i) => Math.max(m, i.puntaje), 0) || null };
        }),
      })).sort((a, b) => a.nombre.localeCompare(b.nombre));
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
    async activarDispositivo() {
      const u = exigir(); const id = localStorage.getItem("academia-dispositivo") || "demo";
      db.dispositivos = db.dispositivos || [];
      const d = db.dispositivos.find((x) => x.user_id === u.user_id && x.id === id);
      if (d) { d.ultimo_ingreso = ahora(); d.ingresos++; } else db.dispositivos.push({ user_id: u.user_id, id, nombre: "Este dispositivo", primer_ingreso: ahora(), ultimo_ingreso: ahora(), ingresos: 1 });
      u.dispositivo_activo = id; guardar();
    },
    async verificarDispositivo() { const u = yo(); return !u || u.rol === "admin" || !u.dispositivo_activo || u.dispositivo_activo === (localStorage.getItem("academia-dispositivo") || "demo"); },
    async adminDispositivos() {
      exigirAdmin(); const ds = db.dispositivos || [];
      const extra = { "u-karla": [["k1", "Android · Chrome"], ["k2", "iPhone · Safari"], ["k3", "Windows · Edge"]] };
      return db.usuarios.filter((u) => u.rol === "empleado").map((u) => {
        const lista = ds.filter((d) => d.user_id === u.user_id).map((d) => ({ ...d, activo: d.id === u.dispositivo_activo }))
          .concat((extra[u.user_id] || []).map(([id, nombre], i) => ({ id, nombre, primer_ingreso: ahora(), ultimo_ingreso: ahora(), ingresos: 3 - i, activo: i === 0 })));
        return { user_id: u.user_id, nombre: u.nombre, usuario: u.usuario, en_30_dias: lista.length, dispositivos: lista };
      });
    },
    async olvidarDispositivos(userId) { exigirAdmin(); db.dispositivos = (db.dispositivos || []).filter((d) => d.user_id !== userId); guardar(); },
    async adminPerfiles() {
      exigirAdmin();
      return db.usuarios.filter((u) => u.rol === "empleado").map(({ user_id, nombre, usuario, gestor_id, activo, area, sede }) => ({ user_id, nombre, usuario, gestor_id, activo, area, sede }));
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
      const ins = db.insignias.find((i) => i.id === insignia);
      if (!db.insignias_usuario.some((x) => x.user_id === userId && x.insignia_id === insignia)) {
        db.insignias_usuario.push({ user_id: userId, insignia_id: insignia, otorgada_en: ahora(), vista: false });
      }
      darPuntos(userId, ins.puntos, "insignia", insignia + "_" + hoy().slice(0, 7)); guardar();
    },
    async bunnyColecciones() { await espera(); return [{ id: "c1", nombre: "Barismo nivel 1 (demo)", videos: 4 }]; },
    async bunnyVideos() { await espera(); return VIDEOS_BUNNY; },
    async subtitulosVideos(ids) {
      await espera(); exigirAdmin();
      const subs = db.subtitulos || {};
      return Object.fromEntries(ids.map((id) => [id, subs[id] ? ["es"] : []]));
    },
    async subirSubtitulo(videoId, contenido) {
      await espera(); exigirAdmin();
      if (!String(contenido).includes("-->")) throw new Error("Ese archivo no parece de subtítulos (.srt o .vtt)");
      db.subtitulos = { ...(db.subtitulos || {}), [videoId]: true }; guardar();
    },
    async borrarSubtitulo(videoId) {
      await espera(); exigirAdmin();
      if (db.subtitulos) delete db.subtitulos[videoId];
      guardar();
    },
    async gestorEmpleados() {
      await espera();
      const l = [
        ["mozza:1", "Ana P.", "barra", "AM", "Mozzafiato", "529830000001", true],
        ["mozza:2", "Yuliana", "piso", "AM", "Mozzafiato", "529830000002", true],
        ["mozza:3", "Pedro Chan", "cocina", "PM", "Mozzafiato", null, true],
        ["mozza:4", "Rosa May", "piso", "PM", "Mozzafiato", "529830000004", false],
        ["casaregina:1", "Lucía Pech", "casa_regina", "AM", "Casa Regina", "529830000005", true],
      ];
      const lista = l.map(([gestor_id, nombre, area, turno, sede, whatsapp, activo]) => ({ gestor_id, nombre, area, turno, sede, whatsapp, activo, encargado: false, salio: activo ? null : "2026-10-12" }));
      lista.push({ gestor_id: "mozza:5", nombre: "Diego Canul", area: "barra", turno: "PM", sede: "Mozzafiato", whatsapp: null, activo: false, entra: "2026-11-02", encargado: false });
      lista.actualizado = new Date(Date.now() - 36e5).toISOString();
      lista.semana = hoyISOdemo();
      return lista;
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

    // ---------- Audiolibros (admin) ----------
    async adminAudiolibros() {
      await espera(); exigirAdmin();
      return deshacer(db.audiolibros.map((b) => ({ ...b, asignaciones: db.audio_asignaciones.filter((a) => a.audiolibro_id === b.id).length })));
    },
    async adminAudiolibro(id) {
      await espera(); exigirAdmin();
      return deshacer({ libro: db.audiolibros.find((b) => b.id === id), asignaciones: db.audio_asignaciones.filter((a) => a.audiolibro_id === id),
        perfiles: db.usuarios.filter((u) => u.rol === "empleado").map(({ user_id, nombre, usuario }) => ({ user_id, nombre, usuario })) });
    },
    async guardarAudiolibro(b) {
      exigirAdmin();
      if (b.id) { const x = db.audiolibros.find((y) => y.id === b.id); Object.assign(x, b); guardar(); return deshacer(x); }
      const n = { capitulos: [], publicado: false, orden: db.audiolibros.length + 1, categoria: "general", ...b, id: uid() };
      db.audiolibros.push(n); guardar(); return deshacer(n);
    },
    async borrarAudiolibro(id) {
      exigirAdmin();
      db.audiolibros = db.audiolibros.filter((b) => b.id !== id);
      db.audio_asignaciones = db.audio_asignaciones.filter((a) => a.audiolibro_id !== id);
      db.audio_progreso = db.audio_progreso.filter((p) => p.audiolibro_id !== id); guardar();
    },
    async agregarAudioAsignacion(a) { exigirAdmin(); const n = { ...a, id: uid() }; db.audio_asignaciones.push(n); guardar(); return n; },
    async borrarAudioAsignacion(id) { exigirAdmin(); db.audio_asignaciones = db.audio_asignaciones.filter((a) => a.id !== id); guardar(); },
    async audiosBunny(carpeta = "") {
      await espera(); exigirAdmin();
      return { carpeta, items: (AUDIOS_BUNNY[carpeta] || []).map((x) => ({ ...x, ruta: (carpeta ? carpeta + "/" : "") + x.nombre })) };
    },
    // ---------- Mi libreta e ideas (demo: todo en este navegador) ----------
    async misNotas() { await espera(); const u = exigir(); return deshacer((db.notas || []).filter((n) => n.user_id === u.user_id).sort((a, b) => b.creado_en.localeCompare(a.creado_en))); },
    async guardarNota(n) {
      await espera(); const u = exigir(); db.notas = db.notas || [];
      const i = db.notas.findIndex((x) => x.id === n.id);
      const fila = { creado_en: ahora(), ...(i >= 0 ? db.notas[i] : {}), ...n, id: n.id || uid(), user_id: u.user_id, actualizado_en: ahora() };
      if (i >= 0) db.notas[i] = fila; else db.notas.push(fila);
      guardar(); return deshacer(fila);
    },
    async borrarNota(nota) {
      await espera(); const u = exigir();
      const usados = new Set((db.ideas || []).filter((i) => i.user_id === u.user_id).flatMap((i) => [i.audio_path, i.foto_path]));
      for (const r of [nota.audio_path, nota.foto_path]) if (r && !usados.has(r) && db.archivos_libreta) delete db.archivos_libreta[r];
      db.notas = (db.notas || []).filter((x) => !(x.id === nota.id && x.user_id === u.user_id)); guardar();
    },
    async quitarArchivoNota(ruta) {
      const u = exigir();
      if (!(db.ideas || []).some((i) => i.user_id === u.user_id && (i.audio_path === ruta || i.foto_path === ruta)) && db.archivos_libreta) { delete db.archivos_libreta[ruta]; guardar(); }
    },
    async subirArchivoNota(blob, nombre) {
      await espera(); const u = exigir();
      const datosUrl = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
      const ruta = `${u.user_id}/${nombre}`;
      db.archivos_libreta = { ...(db.archivos_libreta || {}), [ruta]: datosUrl }; guardar();
      return ruta;
    },
    async urlsArchivosNota(rutas) { return Object.fromEntries(rutas.filter((r) => r && db.archivos_libreta?.[r]).map((r) => [r, db.archivos_libreta[r]])); },
    async bajarArchivoNota(ruta) { const d = db.archivos_libreta?.[ruta]; if (!d) throw new Error("Archivo no encontrado"); return (await fetch(d)).blob(); },
    async misIdeas() { await espera(); const u = exigir(); return deshacer((db.ideas || []).filter((i) => i.user_id === u.user_id).sort((a, b) => b.creado_en.localeCompare(a.creado_en))); },
    async proponerIdea(notaId) {
      await espera(); const u = exigir(); db.ideas = db.ideas || [];
      const n = (db.notas || []).find((x) => x.id === notaId && x.user_id === u.user_id);
      if (!n) throw new Error("Nota no encontrada");
      if (!n.texto?.trim() && !n.audio_path && !n.foto_path) throw new Error("La nota está vacía");
      const copia = { texto: n.texto, audio_path: n.audio_path, audio_seg: n.audio_seg, foto_path: n.foto_path, curso_id: n.curso_id, leccion_id: n.leccion_id, segundo: n.segundo, referencia: n.referencia };
      const ya = db.ideas.find((i) => i.nota_id === n.id);
      if (ya) { if (ya.estado !== "nueva") throw new Error("Esa idea ya la está revisando Gustavo"); Object.assign(ya, copia, { actualizado_en: ahora() }); guardar(); return { id: ya.id }; }
      const idea = { id: uid(), user_id: u.user_id, nota_id: n.id, ...copia, estado: "nueva", respuesta: null, puntos: 0, creado_en: ahora(), actualizado_en: ahora() };
      db.ideas.push(idea); guardar(); return { id: idea.id };
    },
    async retirarIdea(id) { const u = exigir(); db.ideas = (db.ideas || []).filter((i) => !(i.id === id && i.user_id === u.user_id && i.estado === "nueva")); guardar(); },
    async marcarRespaldo() { const u = exigir(); u.libreta_respaldo_en = ahora(); guardar(); return u.libreta_respaldo_en; },
    async adminIdeas() { await espera(); exigirAdmin(); return deshacer((db.ideas || []).sort((a, b) => b.creado_en.localeCompare(a.creado_en))); },
    async responderIdea(id, estado, respuesta, puntos) {
      await espera(); exigirAdmin();
      const i = (db.ideas || []).find((x) => x.id === id); if (!i) throw new Error("Idea no encontrada");
      let dados = 0;
      if (estado === "implementada" && puntos > 0 && !db.puntos.some((p) => p.user_id === i.user_id && p.motivo === "idea" && p.ref === id)) {
        dados = Math.min(puntos, 1000); darPuntos(i.user_id, dados, "idea", id);
      }
      Object.assign(i, { estado, respuesta: (respuesta || "").trim() || null, puntos: (i.puntos || 0) + dados, actualizado_en: ahora() });
      guardar(); return { puntos_dados: dados };
    },
    async libretasResumen() {
      await espera(); exigirAdmin();
      const peso = (uidU) => Object.entries(db.archivos_libreta || {}).filter(([r]) => r.startsWith(uidU + "/"));
      return db.usuarios.filter((u) => u.rol !== "admin" && ((db.notas || []).some((n) => n.user_id === u.user_id) || peso(u.user_id).length)).map((u) => {
        const notas = (db.notas || []).filter((n) => n.user_id === u.user_id);
        return { user_id: u.user_id, nombre: u.nombre, activo: u.activo, notas: notas.length,
          ultima_nota: notas.map((n) => n.actualizado_en).sort().pop() || null,
          ideas: (db.ideas || []).filter((i) => i.user_id === u.user_id).length,
          archivos: peso(u.user_id).length, bytes: peso(u.user_id).reduce((a, [, d]) => a + Math.round(d.length * 0.75), 0),
          respaldo_en: u.libreta_respaldo_en || null };
      });
    },
    async borrarLibreta(userId, { soloTerminados = false, borrarTexto = false } = {}) {
      await espera(); exigirAdmin();
      const abiertas = new Set((db.ideas || []).filter((i) => i.user_id === userId && ["nueva", "probando"].includes(i.estado)).flatMap((i) => [i.audio_path, i.foto_path]));
      const terminado = (c) => !soloTerminados || (c && db.puntos.some((p) => p.user_id === userId && p.motivo === "curso" && p.ref === c));
      const rutas = new Set();
      for (const n of (db.notas || []).filter((n) => n.user_id === userId && terminado(n.curso_id))) for (const r of [n.audio_path, n.foto_path]) if (r && !abiertas.has(r)) rutas.add(r);
      for (const i of (db.ideas || []).filter((i) => i.user_id === userId && ["implementada", "descartada"].includes(i.estado) && terminado(i.curso_id))) for (const r of [i.audio_path, i.foto_path]) if (r && !abiertas.has(r)) rutas.add(r);
      for (const r of rutas) delete db.archivos_libreta?.[r];
      for (const x of [...(db.notas || []), ...(db.ideas || [])]) {
        if (x.user_id !== userId) continue;
        if (rutas.has(x.audio_path)) { x.audio_path = null; x.audio_seg = null; }
        if (rutas.has(x.foto_path)) x.foto_path = null;
      }
      let borradas = 0;
      if (borrarTexto) {
        const antes = (db.notas || []).length;
        db.notas = (db.notas || []).filter((n) => !(n.user_id === userId && !n.audio_path && !n.foto_path && terminado(n.curso_id)
          && !(db.ideas || []).some((i) => i.nota_id === n.id && ["nueva", "probando"].includes(i.estado))));
        borradas = antes - db.notas.length;
      }
      guardar(); return { archivos: rutas.size, notas: borradas };
    },
    async subirPortada(blob) {
      exigirAdmin();
      return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
    },
    async probarAudio(ruta) { await espera(300); return { ruta, storage: 206, cdn_sin_firma: 403, firmas: { sha256: 206 }, funciona: "sha256" }; },
    async diagnosticoAudio() { return { BUNNY_STORAGE_ZONE: "demo", BUNNY_STORAGE_KEY: "ok (demo)", BUNNY_STORAGE_HOST: "storage.bunnycdn.com (por defecto)", BUNNY_AUDIO_HOST: "demo.b-cdn.net", BUNNY_AUDIO_TOKEN_KEY: "ok (demo)" }; },
    async subirAudio(archivo, ruta, alProgreso = () => {}) {
      exigirAdmin();
      const total = archivo.size || 1;
      for (let i = 1; i <= 10; i++) { await espera(120); alProgreso((total * i) / 10, total); }
      const partes = ruta.split("/"), nombre = partes.pop(), carpeta = partes.join("/");
      (AUDIOS_BUNNY[carpeta] ||= []).push({ nombre, carpeta: false, bytes: archivo.size });
      if (carpeta && !AUDIOS_BUNNY[""].some((x) => x.nombre === carpeta)) AUDIOS_BUNNY[""].push({ nombre: carpeta, carpeta: true });
      return { ruta };
    },
    async audioRuta(ruta) { await espera(); exigirAdmin(); return { url: audioDemo(durDemo(ruta)) }; },
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
    async catalogoInsignias() { return db.insignias; },
    reiniciarDemo() { db = semilla(); guardar(); },
  };
  return api;
}
