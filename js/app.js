// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · App del empleado + enrutador
// =====================================================================
import { datos, MODO, enviarAvance, vaciarCola, pendientesCola } from "./datos.js";
import { icono, esc, num, duracion, reloj, fechaCorta, hoyISO, haceCuanto, iniciales, saludo, aviso, modal, confirmar, nombreArea } from "./ui.js";
import { vistaAdmin } from "./admin.js";

const app = document.getElementById("app");
const LOGO = "img/logo.png";
export const estado = { perfil: null, limpieza: null };

// ---------------------------------------------------------------------
//  Enrutador por hash:  #/inicio, #/curso/ID, #/leccion/CURSO/LECCION ...
// ---------------------------------------------------------------------
export function ir(ruta) { if (location.hash !== "#" + ruta) location.hash = ruta; else enrutar(); }

async function enrutar() {
  if (estado.limpieza) { try { await estado.limpieza(); } catch (_) { /* nada */ } estado.limpieza = null; }
  const partes = (location.hash.replace(/^#\/?/, "") || "inicio").split("/");
  const [ruta, a, b] = partes;

  if (!estado.perfil) {
    if (await datos.haySesion()) {
      try { estado.perfil = await datos.resumen(); }
      catch (e) { await datos.salir(); return pintarLogin(e.message); }
    } else return pintarLogin();
  }

  const esAdmin = estado.perfil.rol === "admin";
  if (esAdmin && ruta !== "admin") return ir("/admin");
  if (!esAdmin && ruta === "admin") return ir("/inicio");
  window.scrollTo(0, 0);

  estado.preview = esAdmin && ruta === "admin" && a === "ver";
  try {
    if (estado.preview) {
      if (b === "leccion") return await pintarLeccion(partes[3], partes[4]);
      return await pintarCurso(partes[3]);
    }
    switch (ruta) {
      case "admin": return await vistaAdmin(app, partes.slice(1), { ir, salir });
      case "curso": return await pintarCurso(a);
      case "leccion": return await pintarLeccion(a, b);
      case "quiz": return await pintarQuiz(a);
      case "insignias": return await pintarInsignias();
      case "ranking": return await pintarRanking();
      case "premios": return await pintarPremios();
      default: return await pintarInicio();
    }
  } catch (e) {
    console.error(e);
    pintarError(e);
  }
}

window.addEventListener("hashchange", enrutar);
window.addEventListener("online", async () => {
  actualizarBandaRed();
  const r = await vaciarCola();
  if (r.length) aviso("Avance sincronizado", "ok");
});
window.addEventListener("offline", actualizarBandaRed);

function actualizarBandaRed() {
  let b = document.getElementById("banda-red");
  if (!navigator.onLine) {
    if (!b) { b = document.createElement("div"); b.id = "banda-red"; b.className = "banda-red"; document.body.prepend(b); }
    b.textContent = "Sin conexión · tu avance se guarda y se envía al volver la señal";
  } else if (b) b.remove();
}

// ---------------------------------------------------------------------
//  Utilidades de pintado
// ---------------------------------------------------------------------
function cargando() { app.innerHTML = `<div class="cargando"><div class="taza-carga" aria-label="Cargando"></div></div>`; }

function conNav(html, activa) {
  const item = (ruta, ic, txt) => `<a href="#/${ruta}" class="${activa === ruta ? "activo" : ""}" ${activa === ruta ? 'aria-current="page"' : ""}>${icono(ic)}${txt}</a>`;
  app.className = "con-nav";
  app.innerHTML = `${bandaDemo()}${html}
    <nav class="nav" aria-label="Secciones">
      ${item("inicio", "home", "Inicio")}${item("insignias", "medal", "Insignias")}${item("ranking", "trophy", "Ranking")}${item("premios", "gift", "Premios")}
    </nav>`;
}
function sinNav(html) { app.className = ""; app.innerHTML = bandaDemo() + html; }
const base = () => (estado.preview ? "/admin/ver" : "");
const bandaVista = () => `<div class="banda-demo">VISTA PREVIA COMO EMPLEADO · tu avance no se guarda</div>`;
const bandaDemo = () => (MODO === "demo" ? `<div class="banda-demo">MODO DEMO · datos de ejemplo</div>` : "");

function pintarError(e) {
  sinNav(`<main class="vista vista-completa">
    <div class="vacio"><strong>Algo no cargó</strong>${esc(e.message || e)}</div>
    <button class="btn" id="reintentar">${icono("refresh", 18)}Reintentar</button>
    <button class="btn btn-sec" id="a-inicio">Ir al inicio</button></main>`);
  app.querySelector("#reintentar").onclick = enrutar;
  app.querySelector("#a-inicio").onclick = () => ir("/inicio");
}

const ICONO_NIVEL = ["coffee", "coffee", "coffee", "coffee", "crown"];
function claseMedalla(ins, tengo) {
  if (!tengo) return ins.secreta ? "medalla-secreta" : "medalla-bloq";
  if (ins.nivel === "oro") return "medalla-oro";
  if (ins.nivel === "plata") return "medalla-plata";
  if (ins.nivel === "bronce") return "medalla-bronce";
  return ins.categoria === "excelencia" || ins.categoria === "especial" ? "medalla-oro" : "medalla-cobre";
}

// Muestra las insignias recién ganadas, una por una, con animación.
export async function celebrar(insignias, puntos) {
  for (const ins of insignias || []) {
    await modal(`
      <div class="desbloqueo pila" style="align-items:center">
        <div class="etiqueta" style="color:var(--oro)">${ins.secreta ? "Insignia secreta desbloqueada" : "Insignia desbloqueada"}</div>
        <div class="destellos"><div class="medalla ${claseMedalla(ins, true)}">${icono(ins.icono, 48)}</div></div>
        <h2 class="modal-titulo">${esc(ins.nombre)}</h2>
        <p class="modal-texto">${esc(ins.descripcion || "")}</p>
        ${ins.puntos ? `<b style="color:var(--oro);font-size:17px">+${num(ins.puntos)} pts</b>` : ""}
        <button class="btn btn-bloque" data-cerrar autofocus>Seguir aprendiendo</button>
      </div>`, { clase: "desbloqueo" });
  }
  if (insignias?.length) { try { await datos.marcarInsigniasVistas(); } catch (_) { /* luego */ } }
  else if (puntos) aviso(`+${num(puntos)} pts`, "ok");
}

// ---------------------------------------------------------------------
//  LOGIN · usuario + PIN de 6 dígitos (o correo para el admin)
// ---------------------------------------------------------------------
function pintarLogin(errorInicial = "") {
  let modoAdmin = false;
  let pin = "";
  const recordado = (() => { try { return localStorage.getItem("academia-usuario") || ""; } catch { return ""; } })();

  const pintar = () => {
    sinNav(`
    <main class="login">
      <img class="login-logo" src="${LOGO}" alt="Mozzafiato · El placer del buen café">
      <div class="pila" style="align-items:center;gap:4px">
        <h1 class="login-titulo">Academia del Buen Café</h1>
        <p class="texto-tenue" style="margin:0">${modoAdmin ? "Acceso de administrador" : "Entra con tu usuario y tu PIN"}</p>
      </div>
      ${modoAdmin ? `
        <form id="form-admin" class="pila" style="width:100%;gap:12px">
          <label class="campo">Correo<input name="correo" type="email" autocomplete="username" required></label>
          <label class="campo">Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
          <p class="error-texto" id="error">${esc(errorInicial)}</p>
          <button class="btn btn-bloque" type="submit">Entrar</button>
        </form>` : `
        <label class="campo">Usuario
          <input id="usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(recordado)}" placeholder="ana.barra">
        </label>
        <div class="puntos-pin" id="puntos" aria-label="PIN de 6 dígitos">${"<i></i>".repeat(6)}</div>
        <input id="pin-oculto" class="oculto" inputmode="numeric" maxlength="6" aria-label="PIN" autocomplete="current-password">
        <p class="error-texto" id="error" role="alert">${esc(errorInicial)}</p>
        <div class="teclado">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join("")}
          <button type="button" class="tecla-txt" data-borrar>Borrar</button>
          <button type="button" data-n="0">0</button>
          <button type="button" class="tecla-txt" data-limpiar>Limpiar</button>
        </div>`}
      <button class="btn-texto" id="cambiar-modo" style="margin-top:auto">${modoAdmin ? "Soy empleado" : "Soy administrador"}</button>
      ${MODO === "demo" ? `<p class="texto-tenue" style="text-align:center">Demo: usuario <b>ana.barra</b> · PIN <b>482913</b><br>Admin: <b>admin@demo</b> · <b>demo1234</b></p>` : ""}
    </main>`);
    app.querySelector("#cambiar-modo").onclick = () => { modoAdmin = !modoAdmin; errorInicial = ""; pin = ""; pintar(); };
    if (modoAdmin) {
      app.querySelector("#form-admin").onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const btn = f.querySelector("button");
        btn.disabled = true; btn.textContent = "Entrando…";
        try {
          estado.perfil = await datos.entrarAdmin(f.correo.value, f.clave.value);
          if (estado.perfil.rol !== "admin") { await datos.salir(); estado.perfil = null; throw new Error("Esta cuenta no es de administrador"); }
          ir("/admin");
        } catch (err) {
          app.querySelector("#error").textContent = err.message;
          btn.disabled = false; btn.textContent = "Entrar";
        }
      };
      return;
    }
    const puntos = app.querySelector("#puntos");
    const errorEl = app.querySelector("#error");
    const usuarioEl = app.querySelector("#usuario");
    const pinOculto = app.querySelector("#pin-oculto");
    const refrescar = () => puntos.querySelectorAll("i").forEach((el, i) => el.classList.toggle("lleno", i < pin.length));
    const enviar = async () => {
      const usuario = usuarioEl.value.trim().toLowerCase();
      if (!usuario) { errorEl.textContent = "Escribe tu usuario"; pin = ""; refrescar(); usuarioEl.focus(); return; }
      errorEl.textContent = "Entrando…";
      try {
        estado.perfil = await datos.entrar(usuario, pin);
        try { localStorage.setItem("academia-usuario", usuario); } catch (_) { /* nada */ }
        ir("/inicio");
      } catch (err) {
        errorEl.textContent = err.message;
        puntos.classList.add("error");
        setTimeout(() => puntos.classList.remove("error"), 400);
        pin = ""; refrescar();
      }
    };
    const teclear = (d) => {
      if (pin.length >= 6) return;
      pin += d; errorEl.textContent = ""; refrescar();
      if (pin.length === 6) setTimeout(enviar, 150);
    };
    app.querySelector(".teclado").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.n) teclear(b.dataset.n);
      else if ("borrar" in b.dataset) { pin = pin.slice(0, -1); refrescar(); }
      else if ("limpiar" in b.dataset) { pin = ""; refrescar(); }
    };
    // Teclado físico (laptop)
    const teclaFisica = (e) => {
      if (document.activeElement === usuarioEl) { if (e.key === "Enter") pinOculto.focus(); return; }
      if (/^\d$/.test(e.key)) teclear(e.key);
      else if (e.key === "Backspace") { pin = pin.slice(0, -1); refrescar(); }
    };
    document.addEventListener("keydown", teclaFisica);
    estado.limpieza = () => document.removeEventListener("keydown", teclaFisica);
    if (!recordado) usuarioEl.focus();
  };
  pintar();
}

async function salir() {
  await datos.salir();
  estado.perfil = null;
  app.className = "";
  location.hash = "/entrar";
  pintarLogin();
}

// ---------------------------------------------------------------------
//  INICIO
// ---------------------------------------------------------------------
async function pintarInicio() {
  cargando();
  vaciarCola().catch(() => {});
  const [r, cursos] = await Promise.all([datos.resumen(), datos.misCursos()]);
  estado.perfil = r;
  const avancePct = r.siguiente_min ? Math.round(((r.puntos_ganados - r.nivel_min) / (r.siguiente_min - r.nivel_min)) * 100) : 100;
  const enCurso = cursos.filter((c) => !c.terminado && c.continuar)
    .sort((a, b) => String(b.ultima_actividad || "").localeCompare(String(a.ultima_actividad || "")))[0];
  const { catalogo, mias } = await datos.insignias().catch(() => ({ catalogo: [], mias: [] }));
  const recientes = [...mias].sort((a, b) => String(b.otorgada_en).localeCompare(String(a.otorgada_en))).slice(0, 3)
    .map((m) => catalogo.find((c) => c.id === m.insignia_id)).filter(Boolean);
  const nombreCorto = String(r.nombre || "").split(" ")[0];

  conNav(`
  <main class="vista">
    <header class="saludo">
      <div>
        <div class="texto-tenue">${saludo()},</div>
        <h1>${esc(nombreCorto)}</h1>
      </div>
      <button class="btn-icono avatar yo" id="perfil" aria-label="Mi perfil" style="width:48px;height:48px">${esc(iniciales(r.nombre))}</button>
    </header>

    <section class="tarjeta pila" style="gap:12px">
      <div class="fila-entre">
        <div class="fila">
          <div class="nivel-icono">${icono(ICONO_NIVEL[(r.nivel_orden || 1) - 1] || "coffee")}</div>
          <div><div class="etiqueta">Tu nivel</div><b style="font-size:16px">${esc(r.nivel)}</b></div>
        </div>
        <span class="pildora pildora-oro" title="Días seguidos aprendiendo">${icono("flame", 16)}${r.racha_actual} ${r.racha_actual === 1 ? "día" : "días"}</span>
      </div>
      <div class="barra"><i style="width:${Math.min(100, Math.max(3, avancePct))}%"></i></div>
      <div class="fila-entre texto-tenue" style="font-size:12px">
        <span>${num(r.puntos_ganados)} pts</span>
        <span>${r.siguiente_nivel ? `${num(r.siguiente_min - r.puntos_ganados)} para ${esc(r.siguiente_nivel)}` : "Nivel máximo"}</span>
      </div>
    </section>

    ${enCurso ? `
    <section class="pila">
      <div class="etiqueta">Continúa donde te quedaste</div>
      <button class="continuar" data-ir="/leccion/${enCurso.id}/${enCurso.continuar.leccion_id}">
        <div class="continuar-arte">
          <span class="etiqueta">${esc(enCurso.titulo)}</span>
          <span class="boton-play">${icono("play", 24)}</span>
          <div class="barra"><i style="width:${enCurso.continuar.duracion_seg ? Math.round((enCurso.continuar.segundo / enCurso.continuar.duracion_seg) * 100) : 0}%"></i></div>
        </div>
        <div class="continuar-pie">
          <div>
            <b style="font-size:16px;display:block">${esc(enCurso.continuar.titulo)}</b>
            <span class="texto-tenue" style="font-size:12px">Lección ${enCurso.completadas + 1} de ${enCurso.lecciones}${enCurso.continuar.duracion_seg ? ` · quedan ${duracion(enCurso.continuar.duracion_seg - enCurso.continuar.segundo)}` : ""}</span>
          </div>
          <b style="color:var(--cobre)">Seguir</b>
        </div>
      </button>
    </section>` : ""}

    <section class="pila">
      <div class="etiqueta">Asignados a ti</div>
      ${cursos.length ? cursos.map(tarjetaCurso).join("") : `<div class="vacio"><strong>Aún no tienes cursos</strong>Cuando Gustavo te asigne uno, aparecerá aquí.</div>`}
    </section>

    <section class="pila">
      <div class="fila-entre">
        <div class="etiqueta">Insignias recientes</div>
        <a class="btn-texto" href="#/insignias" style="display:inline-flex;align-items:center">Ver todas</a>
      </div>
      ${recientes.length ? `<div class="mini-insignias">${recientes.map((i) => `
        <div class="mini-insignia"><div class="medalla chica ${claseMedalla(i, true)}">${icono(i.icono)}</div>${esc(i.nombre)}</div>`).join("")}</div>`
        : `<div class="vacio">Termina tu primera lección para ganar <b>Primer sorbo</b>.</div>`}
    </section>
  </main>`, "inicio");

  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
  app.querySelector("#perfil").onclick = () => abrirPerfil(r);
  if (r.insignias_sin_ver?.length) celebrar(r.insignias_sin_ver);
}

function tarjetaCurso(c) {
  const pct = c.lecciones ? Math.round((c.completadas / c.lecciones) * 100) : 0;
  const vencido = c.fecha_limite && c.fecha_limite < hoyISO() && !c.terminado;
  const pildora = c.terminado ? `<span class="pildora pildora-ok">Completado</span>`
    : vencido ? `<span class="pildora pildora-alerta">Venció ${fechaCorta(c.fecha_limite)}</span>`
    : c.fecha_limite ? `<span class="pildora ${diasHasta(c.fecha_limite) <= 5 ? "pildora-alerta" : ""}">Vence ${fechaCorta(c.fecha_limite)}</span>` : "";
  return `
  <button class="tarjeta-borde pila" data-ir="/curso/${c.id}" style="gap:10px">
    <div class="fila-entre" style="align-items:flex-start">
      <div><b style="font-size:15px">${esc(c.titulo)}</b>
        <div class="texto-tenue" style="font-size:12px">${c.lecciones} lecciones · ${duracion(c.duracion_seg)}${c.obligatorio ? " · obligatorio" : ""}</div></div>
      ${pildora}
    </div>
    <div class="fila"><div class="barra fina ${c.terminado ? "ok" : ""}" style="flex:1"><i style="width:${pct}%"></i></div>
      <b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct}%</b></div>
  </button>`;
}
const diasHasta = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(hoyISO() + "T12:00:00")) / 864e5);

function abrirPerfil(r) {
  modal(`
    <div class="fila"><div class="avatar yo" style="width:56px;height:56px;font-size:18px">${esc(iniciales(r.nombre))}</div>
      <div><h2 class="modal-titulo" style="font-size:24px">${esc(r.nombre)}</h2>
      <div class="texto-tenue">@${esc(r.usuario)} · ${esc(nombreArea(r.area))}${r.sede ? " · " + esc(r.sede) : ""}</div></div></div>
    <div class="info-chips">
      <div><b>${num(r.puntos_ganados)}</b><small>puntos ganados</small></div>
      <div><b>${r.insignias}/${r.insignias_total}</b><small>insignias</small></div>
      <div><b>${r.racha_maxima}</b><small>mejor racha</small></div>
    </div>
    ${pendientesCola() ? `<p class="texto-tenue">${pendientesCola()} avance(s) esperando señal para enviarse.</p>` : ""}
    <button class="btn btn-peligro btn-bloque" data-cerrar="salir">${icono("logout", 18)}Cerrar sesión</button>
    <button class="btn btn-sec btn-bloque" data-cerrar>Cerrar</button>
  `).then((v) => { if (v === "salir") salir(); });
}

// ---------------------------------------------------------------------
//  CURSO · capítulos, lecciones, materiales y quiz
// ---------------------------------------------------------------------
export function armarCapitulos(modulos, lecciones) {
  const caps = modulos.map((m) => ({ ...m, lecciones: lecciones.filter((l) => l.modulo_id === m.id).sort((a, b) => a.orden - b.orden) }));
  const sueltas = lecciones.filter((l) => !l.modulo_id || !modulos.some((m) => m.id === l.modulo_id));
  if (sueltas.length) caps.push({ id: null, titulo: modulos.length ? "Otras lecciones" : "Lecciones", lecciones: sueltas.sort((a, b) => a.orden - b.orden) });
  return caps.filter((c) => c.lecciones.length);
}

async function pintarCurso(id) {
  cargando();
  const B = base(), vp = !!estado.preview;
  const d = await datos.curso(id);
  const hechas = new Set(d.progreso.filter((p) => p.completado).map((p) => p.leccion_id));
  const caps = armarCapitulos(d.modulos, d.lecciones);
  const orden = caps.flatMap((c) => c.lecciones);
  const siguiente = orden.find((l) => !hechas.has(l.id));
  const total = orden.length, listas = orden.filter((l) => hechas.has(l.id)).length;
  const pct = total ? Math.round((listas / total) * 100) : 0;
  const todasListas = total > 0 && listas === total;
  const aprobado = d.intentos.some((i) => i.aprobado);
  const mejor = d.intentos.reduce((m, i) => Math.max(m, i.puntaje), 0);
  const terminado = todasListas && (!d.curso.quiz_obligatorio || aprobado);
  const durTotal = orden.reduce((a, l) => a + (l.duracion_seg || 0), 0);

  let n = 0;
  sinNav(`${vp ? bandaVista() : ""}
  <main class="vista vista-completa">
    <header class="curso-cabeza">
      <button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button>
      <div class="etiqueta" style="color:var(--oro)">${esc(nombreArea(d.curso.categoria))}${d.curso.quiz_obligatorio ? " · con quiz" : ""}</div>
      <h1>${esc(d.curso.titulo)}</h1>
      ${d.curso.descripcion ? `<p style="margin:0;color:var(--crema-2)">${esc(d.curso.descripcion)}</p>` : ""}
      <div class="texto-tenue" style="color:var(--crema-2)">${caps.length} ${caps.length === 1 ? "capítulo" : "capítulos"} · ${total} lecciones · ${duracion(durTotal)}</div>
      <div class="fila"><div class="barra" style="flex:1;background:var(--tarjeta)"><i style="width:${pct}%"></i></div><b style="color:var(--oro)">${pct}%</b></div>
      ${siguiente ? `<button class="btn" data-ir="${B}/leccion/${id}/${siguiente.id}">${icono("play", 18)}${listas ? "Continuar" : "Empezar curso"}</button>` : ""}
    </header>

    ${terminado ? `<div class="tarjeta fila" style="border:1px solid var(--verde)">${icono("trophy", 28)}<div><b>¡Curso completado!</b><div class="texto-tenue">Buen trabajo. Tus puntos ya están en tu cuenta.</div></div></div>` : ""}

    ${caps.map((c, ci) => `
      <section class="pila" style="gap:8px">
        <div class="capitulo-titulo"><h2>Capítulo ${ci + 1} · ${esc(c.titulo)}</h2>
          <span class="texto-tenue">${c.lecciones.filter((l) => hechas.has(l.id)).length} de ${c.lecciones.length}</span></div>
        ${c.lecciones.map((l) => {
          n++;
          const hecho = hechas.has(l.id), ahora = siguiente?.id === l.id, bloq = !vp && !hecho && !ahora;
          return `<button class="leccion ${ahora ? "actual" : ""} ${bloq ? "bloq" : ""}" ${bloq ? 'aria-disabled="true"' : `data-ir="${B}/leccion/${id}/${l.id}"`}>
            <span class="leccion-estado ${hecho ? "hecho" : ahora ? "ahora" : "pend"}">${icono(hecho ? "check" : ahora || vp ? "play" : "lock", hecho ? 16 : 14)}</span>
            <span style="flex:1;min-width:0"><b>${n}. ${esc(l.titulo)}</b><small>${l.duracion_seg ? duracion(l.duracion_seg) : "video"}</small></span>
          </button>`;
        }).join("")}
      </section>`).join("")}
    ${!caps.length ? `<div class="vacio"><strong>Este curso aún no tiene lecciones</strong>Pronto se agregarán.</div>` : ""}

    ${d.materiales.length ? `
      <section class="pila" style="gap:8px">
        <div class="etiqueta">Materiales</div>
        ${d.materiales.map((m) => `<button class="material" data-material="${m.id}">${icono("file", 22, 'style="color:var(--oro)"')}
          <span style="flex:1"><b style="display:block;font-size:14px">${esc(m.titulo)}</b><small class="texto-tenue">${esc((m.tipo || "pdf").toUpperCase())}${m.peso_kb ? " · " + (m.peso_kb >= 1024 ? (m.peso_kb / 1024).toFixed(1) + " MB" : m.peso_kb + " KB") : ""}</small></span></button>`).join("")}
      </section>` : ""}

    ${d.preguntas.length ? `
      <section class="tarjeta-borde pila" style="border-style:${todasListas ? "solid" : "dashed"}">
        <div class="fila-entre"><b style="font-size:15px">Quiz final</b>${aprobado ? `<span class="pildora pildora-ok">Aprobado · ${mejor}%</span>` : mejor ? `<span class="pildora">Mejor: ${mejor}%</span>` : ""}</div>
        <span class="texto-tenue">${d.preguntas.length} preguntas · aprueba con ${d.curso.quiz_minimo}%${d.curso.quiz_obligatorio ? " · necesario para terminar el curso" : ""}</span>
        ${todasListas ? `<button class="btn ${aprobado ? "btn-sec" : ""}" data-ir="/quiz/${id}">${aprobado ? "Repetir quiz" : mejor ? "Intentar de nuevo" : "Hacer el quiz"}</button>`
          : `<span class="texto-tenue">${icono("lock", 14)} Se abre al terminar todas las lecciones</span>`}
      </section>` : ""}
  </main>`);

  app.querySelector("#volver").onclick = () => ir(vp ? `/admin/curso/${id}` : "/inicio");
  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
  app.querySelectorAll(".leccion.bloq").forEach((b) => (b.onclick = () => aviso("Termina la lección anterior para desbloquear esta")));
  app.querySelectorAll("[data-material]").forEach((b) => (b.onclick = async () => {
    const m = d.materiales.find((x) => x.id === b.dataset.material);
    const ventana = window.open("about:blank", "_blank");
    try { const url = await datos.urlMaterial(m); if (ventana) ventana.location = url; else location.href = url; }
    catch (e) { if (ventana) ventana.close(); aviso(e.message, "error"); }
  }));
}

// ---------------------------------------------------------------------
//  LECCIÓN · reproductor Bunny con guardado de avance
// ---------------------------------------------------------------------
async function pintarLeccion(cursoId, leccionId) {
  cargando();
  const B = base(), vp = !!estado.preview;
  const [d, v] = await Promise.all([datos.curso(cursoId), datos.video(leccionId).catch((e) => ({ error: e.message }))]);
  const caps = armarCapitulos(d.modulos, d.lecciones);
  const orden = caps.flatMap((c) => c.lecciones);
  const idx = orden.findIndex((l) => l.id === leccionId);
  const leccion = orden[idx];
  if (!leccion) throw new Error("Lección no encontrada");
  const cap = caps.find((c) => c.lecciones.some((l) => l.id === leccionId));
  const prog = d.progreso.find((p) => p.leccion_id === leccionId);
  let completado = vp || !!prog?.completado;
  const siguiente = orden[idx + 1];

  sinNav(`${vp ? bandaVista() : ""}
  <main class="vista vista-completa vista-video">
    <div class="barra-sup">
      <button class="btn-icono" id="volver" aria-label="Volver al curso">${icono("back")}</button>
      <span class="texto-tenue">${esc(d.curso.titulo)} · Lección ${idx + 1} de ${orden.length}</span>
    </div>
    <div class="reproductor" id="reproductor">
      ${v.error ? `<div class="reproductor-msg">${icono("video", 36)}<b>${esc(v.error)}</b><button class="btn btn-chico" id="reintentar">Reintentar</button></div>`
        : v.demo ? `<div class="reproductor-msg"><div class="etiqueta">Reproductor de prueba (modo demo)</div>
            <button class="boton-play" id="sim-play" aria-label="Reproducir">${icono("play", 24)}</button>
            <div class="sim"><input type="range" id="sim-barra" min="0" max="${leccion.duracion_seg || 100}" value="${v.segundo_inicio || 0}" aria-label="Posición">
            <span id="sim-tiempo">${reloj(v.segundo_inicio)} / ${reloj(leccion.duracion_seg)}</span></div></div>`
        : `<iframe id="video" src="${esc(v.embed_url)}" loading="eager" referrerpolicy="strict-origin-when-cross-origin"
             allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(leccion.titulo)}"></iframe>`}
    </div>
    <div class="pila" style="gap:4px">
      <h1 class="titulo-pagina" style="font-size:30px">${esc(leccion.titulo)}</h1>
      <span class="texto-tenue">${cap ? esc(cap.titulo) : ""}${leccion.duracion_seg ? " · " + duracion(leccion.duracion_seg) : ""}</span>
    </div>
    <div class="tarjeta fila" id="estado-leccion">${estadoLeccionHTML(completado)}</div>
    <div class="fila-botones" style="justify-content:stretch">
      ${idx > 0 ? `<button class="btn btn-sec" data-ir="${B}/leccion/${cursoId}/${orden[idx - 1].id}">${icono("back", 18)}Anterior</button>` : ""}
      ${siguiente ? `<button class="btn" id="btn-siguiente" ${completado ? "" : "disabled"} data-sig="${B}/leccion/${cursoId}/${siguiente.id}">Siguiente ${icono("next", 18)}</button>`
        : `<button class="btn" id="btn-siguiente" ${completado ? "" : "disabled"} data-sig="${B}/curso/${cursoId}">Terminar ${icono("check", 18)}</button>`}
    </div>
    <button class="btn btn-sec" data-ir="${B}/curso/${cursoId}">Ver temario</button>
  </main>`);

  app.querySelector("#volver").onclick = () => ir(`${B}/curso/${cursoId}`);
  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
  const btnSig = app.querySelector("#btn-siguiente");
  btnSig.onclick = () => ir(btnSig.dataset.sig);
  app.querySelector("#reintentar")?.addEventListener("click", enrutar);
  if (v.error) return;

  // ---- Seguimiento de avance ----
  let ultimoSeg = v.segundo_inicio || 0, ultimaDur = leccion.duracion_seg || 0, ultimoEnvio = 0, enviando = false, ultimoEnviado = -1;
  const reportar = async (forzar = false) => {
    if (vp || enviando) return;
    if (!forzar && Date.now() - ultimoEnvio < 10000) return;
    if (Math.floor(ultimoSeg) === ultimoEnviado && !forzar) return;
    enviando = true; ultimoEnvio = Date.now(); ultimoEnviado = Math.floor(ultimoSeg);
    try {
      const r = await enviarAvance(leccionId, ultimoSeg, ultimaDur);
      if (r?.recien_completado) {
        completado = true;
        const est = document.getElementById("estado-leccion");
        if (est) est.innerHTML = estadoLeccionHTML(true);
        const b = document.getElementById("btn-siguiente");
        if (b) b.disabled = false;
        aviso(`Lección completada · +${num(r.puntos_ganados)} pts`, "ok");
        await celebrar(r.insignias_nuevas);
        if (r.curso_terminado) aviso("¡Terminaste el curso!", "ok");
      }
    } catch (e) { console.warn(e); }
    finally { enviando = false; }
  };
  const alOcultar = () => { if (document.visibilityState === "hidden") reportar(true); };
  document.addEventListener("visibilitychange", alOcultar);

  if (v.demo) {
    const barra = app.querySelector("#sim-barra"), tiempo = app.querySelector("#sim-tiempo"), play = app.querySelector("#sim-play");
    let timer = null;
    const mover = (s) => { ultimoSeg = Math.min(s, ultimaDur); barra.value = ultimoSeg; tiempo.textContent = `${reloj(ultimoSeg)} / ${reloj(ultimaDur)}`; };
    play.onclick = () => {
      if (timer) { clearInterval(timer); timer = null; play.innerHTML = icono("play", 24); reportar(true); return; }
      play.innerHTML = icono("x", 24);
      timer = setInterval(() => { mover(ultimoSeg + 5); reportar(); if (ultimoSeg >= ultimaDur) { clearInterval(timer); timer = null; play.innerHTML = icono("play", 24); reportar(true); } }, 500);
    };
    barra.oninput = () => mover(Number(barra.value));
    barra.onchange = () => reportar(true);
    estado.limpieza = async () => { clearInterval(timer); document.removeEventListener("visibilitychange", alOcultar); await reportar(true); };
    return;
  }

  // Bunny player.js
  const iframe = app.querySelector("#video");
  let player = null;
  try {
    player = new window.playerjs.Player(iframe);
    player.on("ready", () => {
      if (v.segundo_inicio > 5) player.setCurrentTime(v.segundo_inicio);
      player.on("timeupdate", (t) => { ultimoSeg = t.seconds; if (t.duration) ultimaDur = t.duration; reportar(); });
      player.on("pause", () => reportar(true));
      player.on("ended", () => { ultimoSeg = ultimaDur; reportar(true); });
    });
  } catch (e) { console.warn("player.js no disponible", e); }
  estado.limpieza = async () => { document.removeEventListener("visibilitychange", alOcultar); await reportar(true); };
}

function estadoLeccionHTML(completado) {
  return completado
    ? `<span class="leccion-estado hecho">${icono("check", 16)}</span><div><b>Lección completada</b><div class="texto-tenue">Puedes volver a verla cuando quieras.</div></div>`
    : `<span class="leccion-estado pend">${icono("clock", 16)}</span><div><b>Mírala completa para avanzar</b><div class="texto-tenue">Tu avance se guarda solo. Si se corta la señal, retomas en el mismo minuto.</div></div>`;
}

// ---------------------------------------------------------------------
//  QUIZ
// ---------------------------------------------------------------------
async function pintarQuiz(cursoId) {
  cargando();
  const d = await datos.curso(cursoId);
  const preguntas = d.preguntas;
  sinNav(`
  <main class="vista vista-completa">
    <div class="fila"><button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button><span class="texto-tenue">${esc(d.curso.titulo)}</span></div>
    <h1 class="titulo-pagina">Quiz final</h1>
    <p class="texto-tenue" style="margin:0">${preguntas.length} preguntas · apruebas con ${d.curso.quiz_minimo}%</p>
    <form id="quiz" class="pila" style="gap:22px">
      ${preguntas.map((q, i) => `
        <fieldset class="pregunta" style="border:0;padding:0;margin:0" data-q="${q.id}">
          <legend style="font-weight:700;font-size:16px;margin-bottom:10px">${i + 1}. ${esc(q.pregunta)}</legend>
          ${(q.opciones || []).map((o, j) => `<label class="opcion"><input type="radio" name="${q.id}" value="${j}"><span>${esc(o)}</span></label>`).join("")}
        </fieldset>`).join("")}
      <p class="error-texto" id="error-quiz"></p>
      <button class="btn btn-bloque" type="submit">Enviar respuestas</button>
    </form>
  </main>`);
  app.querySelector("#volver").onclick = () => ir(`/curso/${cursoId}`);
  const form = app.querySelector("#quiz");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const resp = {};
    for (const q of preguntas) { const s = form.querySelector(`input[name="${q.id}"]:checked`); if (s) resp[q.id] = Number(s.value); }
    const err = app.querySelector("#error-quiz");
    if (Object.keys(resp).length < preguntas.length) { err.textContent = `Te faltan ${preguntas.length - Object.keys(resp).length} preguntas por contestar`; return; }
    err.textContent = "";
    const btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Calificando…";
    try {
      const r = await datos.enviarQuiz(cursoId, resp);
      form.querySelectorAll("fieldset").forEach((fs) => {
        const ok = r.detalle?.[fs.dataset.q];
        const sel = fs.querySelector("input:checked")?.closest(".opcion");
        if (sel) sel.classList.add(ok ? "bien" : "mal");
        fs.querySelectorAll("input").forEach((i) => (i.disabled = true));
      });
      btn.remove();
      await modal(`
        <div class="pila" style="align-items:center;text-align:center">
          <div class="medalla ${r.aprobado ? "medalla-oro" : "medalla-bloq"}" style="width:88px;height:88px">${icono(r.aprobado ? "trophy" : "refresh", 40)}</div>
          <h2 class="modal-titulo">${r.aprobado ? "¡Aprobaste!" : "Casi lo logras"}</h2>
          <b style="font-size:40px;color:var(--oro)">${r.puntaje}%</b>
          <p class="modal-texto">${r.correctas} de ${r.total} correctas · mínimo ${r.minimo}%</p>
          ${r.puntos_ganados ? `<b style="color:var(--oro)">+${num(r.puntos_ganados)} pts</b>` : ""}
          <button class="btn btn-bloque" data-cerrar>${r.aprobado ? "Ver mi curso" : "Revisar"}</button>
        </div>`);
      await celebrar(r.insignias_nuevas);
      if (r.aprobado) {
        ir(`/curso/${cursoId}`);
      } else {
        form.insertAdjacentHTML("beforeend", `<p class="texto-tenue">Las respuestas en rojo están mal. Repasa las lecciones y vuelve a intentarlo.</p><button type="button" class="btn btn-bloque" id="otra-vez">Intentar de nuevo</button>`);
        form.querySelector("#otra-vez").onclick = () => enrutar();
      }
    } catch (e2) { err.textContent = e2.message; btn.disabled = false; btn.textContent = "Enviar respuestas"; }
  };
}

// ---------------------------------------------------------------------
//  INSIGNIAS · vitrina y camino del tueste
// ---------------------------------------------------------------------
async function pintarInsignias() {
  cargando();
  const [{ catalogo, mias }, r, niveles] = await Promise.all([datos.insignias(), datos.resumen(), datos.niveles()]);
  const tengo = new Set(mias.map((m) => m.insignia_id));
  const ordenadas = [...catalogo].sort((a, b) => (tengo.has(b.id) - tengo.has(a.id)) || a.orden - b.orden);
  const avancePct = r.siguiente_min ? Math.round(((r.puntos_ganados - r.nivel_min) / (r.siguiente_min - r.nivel_min)) * 100) : 100;
  conNav(`
  <main class="vista">
    <h1 class="titulo-pagina">Tu vitrina</h1>
    <section class="tarjeta pila" style="gap:12px">
      <div class="etiqueta">Camino del tueste</div>
      <div class="camino">${niveles.map((n) => `<div class="${n.orden < r.nivel_orden ? "pasado" : n.orden === r.nivel_orden ? "actual" : ""}"><i></i>${esc(n.nombre)}</div>`).join("")}</div>
      <div class="barra fina"><i style="width:${Math.min(100, Math.max(3, avancePct))}%"></i></div>
      <span class="texto-tenue">${num(r.puntos_ganados)} pts · ${tengo.size} de ${catalogo.length} insignias${r.siguiente_nivel ? ` · ${num(r.siguiente_min - r.puntos_ganados)} pts para ${esc(r.siguiente_nivel)}` : ""}</span>
    </section>
    <div class="vitrina">
      ${ordenadas.map((i) => {
        const t = tengo.has(i.id), oculta = i.secreta && !t;
        return `<div class="vitrina-item" ${t ? "" : 'style="opacity:.85"'}>
          <div class="medalla ${claseMedalla(i, t)}">${icono(oculta ? "q" : t ? i.icono : "lock", 24)}</div>
          <b>${oculta ? "Secreta" : esc(i.nombre)}</b>
          <small>${oculta ? "Sigue aprendiendo para descubrirla" : esc(i.descripcion)}</small>
          ${!oculta && i.puntos ? `<small style="color:var(--oro)">+${num(i.puntos)} pts</small>` : ""}
        </div>`;
      }).join("")}
    </div>
  </main>`, "insignias");
}

// ---------------------------------------------------------------------
//  RANKING
// ---------------------------------------------------------------------
async function pintarRanking(periodo = "semana") {
  cargando();
  const filas = await datos.ranking(periodo);
  const [p1, p2, p3] = filas;
  const lugar = (f, n, clase, alto) => f ? `
    <div class="podio-lugar ${clase}">
      ${n === 1 ? `<span style="color:var(--oro)">${icono("crown", 24)}</span>` : ""}
      <div class="avatar ${f.soy_yo ? "yo" : ""}">${esc(iniciales(f.nombre))}</div>
      <b style="font-size:13px">${esc(f.nombre)}${f.soy_yo ? " (tú)" : ""}</b>
      <div class="podio-base" style="height:${alto}px;${n === 1 ? "background:var(--linea)" : ""}"><b style="${n === 1 ? "color:var(--oro)" : ""}">${f.posicion}</b><small>${num(f.puntos)} pts</small></div>
    </div>` : `<div class="podio-lugar"></div>`;
  conNav(`
  <main class="vista">
    <h1 class="titulo-pagina">Ranking</h1>
    <div class="pestanas" role="tablist">
      ${[["semana", "Semana"], ["mes", "Mes"], ["total", "Total"]].map(([v, t]) => `<button role="tab" aria-selected="${v === periodo}" class="${v === periodo ? "activo" : ""}" data-p="${v}">${t}</button>`).join("")}
    </div>
    ${filas.length && filas[0].puntos > 0 ? `
      <div class="podio">${lugar(p2, 2, "", 72)}${lugar(p1, 1, "primero", 100)}${lugar(p3, 3, "", 56)}</div>
      <div class="pila" style="gap:8px">
        ${filas.slice(3).map((f) => `<div class="fila-rank ${f.soy_yo ? "yo" : ""}"><span class="pos">${f.posicion}</span>
          <div class="avatar ${f.soy_yo ? "yo" : ""}" style="width:34px;height:34px;font-size:12px">${esc(iniciales(f.nombre))}</div>
          <div style="flex:1"><b style="font-size:14px">${esc(f.nombre)}${f.soy_yo ? " (tú)" : ""}</b><div class="texto-tenue" style="font-size:12px">${esc(nombreArea(f.area))}</div></div>
          <b style="color:var(--oro)">${num(f.puntos)}</b></div>`).join("")}
      </div>` : `<div class="vacio"><strong>Nadie ha sumado puntos ${periodo === "semana" ? "esta semana" : periodo === "mes" ? "este mes" : "todavía"}</strong>Termina una lección y sé el primero.</div>`}
  </main>`, "ranking");
  app.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => pintarRanking(b.dataset.p)));
}

// ---------------------------------------------------------------------
//  PREMIOS
// ---------------------------------------------------------------------
async function pintarPremios() {
  cargando();
  const [{ premios, canjes }, r] = await Promise.all([datos.premios(), datos.resumen()]);
  const disp = r.puntos_disponibles;
  const nombrePremio = (id) => premios.find((p) => p.id === id)?.nombre || "Premio";
  conNav(`
  <main class="vista">
    <h1 class="titulo-pagina">Premios</h1>
    <section class="saldo"><div><div style="font-size:12px;font-weight:700;letter-spacing:1px">PUNTOS DISPONIBLES</div><b>${num(disp)}</b></div>${icono("gift", 40)}</section>
    <section class="pila">
      <div class="etiqueta">Catálogo</div>
      ${premios.length ? premios.map((p) => {
        const alcanza = disp >= p.costo;
        const pendiente = canjes.some((c) => c.premio_id === p.id && c.estado === "pendiente");
        return `<div class="tarjeta-borde fila-entre">
          <div><b style="font-size:15px">${esc(p.nombre)}</b><div class="texto-tenue">${num(p.costo)} pts${p.descripcion ? " · " + esc(p.descripcion) : ""}</div></div>
          ${pendiente ? `<span class="pildora pildora-ok">Solicitado</span>`
            : alcanza ? `<button class="btn btn-chico" data-canjear="${p.id}">Canjear</button>`
            : `<span class="pildora">Te faltan ${num(p.costo - disp)}</span>`}
        </div>`;
      }).join("") : `<div class="vacio">Pronto habrá premios para canjear.</div>`}
    </section>
    ${canjes.length ? `<section class="pila"><div class="etiqueta">Mis canjes</div>
      ${canjes.slice(0, 10).map((c) => `<div class="fila-entre tarjeta" style="padding:12px 14px"><div><b style="font-size:14px">${esc(nombrePremio(c.premio_id))}</b><div class="texto-tenue" style="font-size:12px">${num(c.costo)} pts · ${haceCuanto(c.creado_en)}</div></div>
        <span class="pildora ${c.estado === "aprobado" ? "pildora-ok" : c.estado === "rechazado" ? "pildora-alerta" : ""}">${c.estado === "pendiente" ? "En revisión" : c.estado === "aprobado" ? "Aprobado" : "Rechazado"}</span></div>`).join("")}
    </section>` : ""}
    <p class="texto-tenue">Al canjear, Gustavo recibe tu solicitud y la aprueba desde su panel. Si la rechaza, tus puntos regresan.</p>
  </main>`, "premios");
  app.querySelectorAll("[data-canjear]").forEach((b) => (b.onclick = async () => {
    const p = premios.find((x) => x.id === b.dataset.canjear);
    if (!(await confirmar("¿Canjear premio?", `${p.nombre} por ${num(p.costo)} puntos.`, "Canjear"))) return;
    try { await datos.solicitarCanje(p.id); aviso("Solicitud enviada", "ok"); pintarPremios(); }
    catch (e) { aviso(e.message, "error"); }
  }));
}

// ---------------------------------------------------------------------
actualizarBandaRed();
enrutar();
