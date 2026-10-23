// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · App del empleado + enrutador
// =====================================================================
import { datos, MODO, enviarAvance, vaciarCola, pendientesCola } from "./datos.js";
import { icono, esc, num, duracion, reloj, fechaCorta, hoyISO, haceCuanto, iniciales, saludo, aviso, modal, confirmar, marcaTitulo, nombreArea, nombreCategoria, fijarCategorias } from "./ui.js";
import { vistaAdmin } from "./admin.js";
import { mostrarCertificado, folio } from "./certificado.js";
import { abrirVisor } from "./visor.js";
import { confeti, momento, subidaDeNivel, fraseLeccion, hitoCurso, fraseInicio, animarBarras } from "./fiesta.js";
import { fijarCfgPuntos, valorCurso, puntosLeccion } from "./puntos.js";
import { pintarAudiolibro, pintarBiblioteca, tarjetaAudio, esNuevoAudio } from "./audio.js";
import { avatarOIniciales, avatarSVG, avatarCuerpoSVG } from "./avatar.js";
import { pintarEditorAvatar, invitarAvatar } from "./avatar-editor.js";

const app = document.getElementById("app");
const LOGO = "img/logo.png";
const ISOTIPO = "img/isotipo.webp";
const marcaSup = () => `<div class="marca-sup marca-usuario"><img src="${ISOTIPO}" alt="Mozzafiato">${marcaTitulo("chica", "div")}</div>`;
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

  if (!estado.catCargadas) {
    try { fijarCategorias(await datos.categorias()); } catch (_) { /* usa las de base */ }
    try { fijarCfgPuntos(await datos.config()); } catch (_) { /* usa los de base */ }
    estado.catCargadas = true;
  }
  const esAdmin = estado.perfil.rol === "admin";
  if (!esAdmin && !(await vigilarSesion())) return;
  if (esAdmin && ruta !== "admin") return ir("/admin");
  if (!esAdmin && ruta === "admin") return ir("/inicio");
  window.scrollTo(0, 0);

  estado.preview = esAdmin && ruta === "admin" && a === "ver";
  try {
    if (estado.preview) {
      if (b === "leccion") return await pintarLeccion(partes[3], partes[4]);
      if (b === "audio") return await pintarAudiolibro(ctxAudio(), partes[3]);
      return await pintarCurso(partes[3]);
    }
    switch (ruta) {
      case "admin": return await vistaAdmin(app, partes.slice(1), { ir, salir });
      case "curso": return await pintarCurso(a);
      case "leccion": return await pintarLeccion(a, b);
      case "quiz": return await pintarQuiz(a);
      case "audio": return await pintarAudiolibro(ctxAudio(), a);
      case "biblioteca": return await pintarBiblioteca(ctxAudio());
      case "avatar": return await pintarEditorAvatar(ctxAudio());
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
  html = html.replace('<main class="vista">', `<main class="vista">${marcaSup()}`);
  app.innerHTML = `${bandaDemo()}${html}
    <nav class="nav" aria-label="Secciones">
      ${item("inicio", "home", "Inicio")}${item("biblioteca", "biblioteca", "Biblioteca")}${item("insignias", "medal", "Insignias")}${item("ranking", "trophy", "Ranking")}${item("premios", "gift", "Premios")}
    </nav>`;
}
function sinNav(html) { app.className = ""; app.innerHTML = bandaDemo() + html; }
// Lo que necesita el módulo de audiolibros de esta pantalla principal.
const ctxAudio = () => ({ app, estado, conNav, sinNav, ir, cargando, expulsar, celebrar, revisarNivelYRacha, base });
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
    confeti({ cantidad: 110 });
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

// Celebra cada avance: lección, hito del curso, curso terminado, insignias, racha y nivel.
async function celebrarAvance({ puntos, insignias, cursoTerminado, pctAntes, pctDespues, curso, cursoId }) {
  if (cursoTerminado) {
    confeti({ cantidad: 240, duracion: 3200 });
    const r = await modal(`
      <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
        <div class="etiqueta" style="color:var(--oro)">¡Curso completado!</div>
        <div class="destellos"><div class="medalla medalla-oro">${icono("trophy", 48)}</div></div>
        <h2 class="modal-titulo">${esc(curso.titulo)}</h2>
        <p class="modal-texto">Lo terminaste de principio a fin. Eso habla de tu compromiso con el equipo y con cada cliente.</p>
        ${puntos ? `<b style="color:var(--oro);font-size:18px">+${num(puntos)} pts</b>` : ""}
        ${curso.certificado ? `<button class="btn btn-bloque" data-cerrar="cert">${icono("medal", 18)}Ver mi certificado</button>` : ""}
        <button class="btn ${curso.certificado ? "btn-sec" : ""} btn-bloque" data-cerrar>Seguir</button>
      </div>`, { clase: "desbloqueo" });
    if (r === "cert") { try { sessionStorage.setItem("academia-abrir-cert", cursoId); } catch (_) { /* nada */ } ir(`/curso/${cursoId}`); }
  } else {
    const hito = hitoCurso(pctAntes, pctDespues, curso.titulo);
    if (hito) { confeti({ cantidad: 90 }); momento({ ...hito, puntos, tono: "oro" }); }
    else momento({ icono: "check", titulo: "Lección completada", texto: fraseLeccion(), puntos, tono: "verde" });
  }
  await celebrar(insignias);
  await revisarNivelYRacha();
}

async function revisarNivelYRacha() {
  const antes = estado.perfil;
  let nuevo = null;
  try { nuevo = await datos.resumen(); } catch (_) { return; }
  if (antes && nuevo.racha_actual >= 2 && nuevo.racha_actual > (antes.racha_actual || 0)) {
    momento({ icono: "flame", titulo: `¡Racha de ${nuevo.racha_actual} días!`, texto: "Vuelve mañana para mantenerla encendida.", tono: "oro", duracion: 3800 });
  }
  if (antes && nuevo.nivel_orden > (antes.nivel_orden || 1)) {
    await subidaDeNivel(nuevo.nivel, nuevo.siguiente_nivel, (nuevo.siguiente_min || 0) - nuevo.puntos_ganados);
    momento({ icono: "user", titulo: "¡Nuevas piezas para tu avatar!", texto: "Entra a tu perfil → Editar mi avatar para estrenarlas.", tono: "oro", duracion: 4200 });
  }
  estado.perfil = { ...antes, ...nuevo };
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
      <img class="login-isotipo" src="${ISOTIPO}" alt="Mozzafiato · El placer del buen café">
      <div class="pila" style="align-items:center;gap:4px">
        ${marcaTitulo("grande")}
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
        await datos.activarDispositivo?.().catch((e) => console.warn("dispositivo", e));
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

// ---------------------------------------------------------------------
//  Una sesión a la vez: si la cuenta se abrió en otro dispositivo, aquí se cierra.
// ---------------------------------------------------------------------
let ultimaVerificacion = 0;
// Devuelve false (y saca al usuario) si su cuenta se abrió en otro dispositivo.
async function vigilarSesion(forzar = false) {
  if (!datos.verificarDispositivo || !estado.perfil || estado.perfil.rol === "admin") return true;
  if (!forzar && Date.now() - ultimaVerificacion < 30000) return true;
  ultimaVerificacion = Date.now();
  let ok = true;
  try { ok = await datos.verificarDispositivo(); } catch (_) { ok = true; /* sin señal: se revisa luego */ }
  if (!ok) { await expulsar(); return false; }
  return true;
}
setInterval(() => vigilarSesion(true), 120000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") vigilarSesion(true); });

export async function expulsar() {
  if (!estado.perfil) return;
  if (estado.limpieza) { const l = estado.limpieza; estado.limpieza = null; try { await l(); } catch (_) { /* nada */ } }
  document.querySelectorAll(".modal-capa").forEach((m) => m.remove());
  await datos.salir();
  estado.perfil = null;
  app.className = "";
  history.replaceState(null, "", location.pathname + location.search + "#/entrar");
  pintarLogin("Tu cuenta se abrió en otro dispositivo. Si no fuiste tú, avisa a Gustavo para cambiar tu PIN.");
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
  const [r, cursos, audiosTodos, miAv] = await Promise.all([datos.resumen(), datos.misCursos(), datos.misAudiolibros().catch(() => []), datos.miAvatar().catch(() => null)]);
  estado.miAvatar = miAv;
  const audios = audiosTodos.filter((x) => x.asignado);
  estado.perfil = r;
  const avancePct = r.siguiente_min ? Math.round(((r.puntos_ganados - r.nivel_min) / (r.siguiente_min - r.nivel_min)) * 100) : 100;
  const enCurso = cursos.filter((c) => !c.terminado && c.continuar)
    .sort((a, b) => String(b.ultima_actividad || "").localeCompare(String(a.ultima_actividad || "")))[0];
  const { catalogo, mias } = await datos.insignias().catch(() => ({ catalogo: [], mias: [] }));
  const recientes = [...mias].sort((a, b) => String(b.otorgada_en).localeCompare(String(a.otorgada_en))).slice(0, 3)
    .map((m) => catalogo.find((c) => c.id === m.insignia_id)).filter(Boolean);
  const nombreCorto = String(r.nombre || "").split(" ")[0];
  const cats = [...new Set(cursos.map((c) => c.categoria || "general"))];

  conNav(`
  <main class="vista">
    <header class="saludo">
      <div>
        <div class="texto-tenue">${saludo()},</div>
        <h1>${esc(nombreCorto)}</h1>
      </div>
      <button class="btn-icono boton-avatar ${miAv ? "con-avatar" : "avatar yo"}" id="perfil" aria-label="Mi perfil" style="width:52px;height:52px">${miAv ? avatarSVG(miAv, 52, "", { animado: true }) : esc(iniciales(r.nombre))}</button>
    </header>
    <p class="frase-inicio">${icono("coffee", 16)}<span>${esc(fraseInicio(r, cursos))}</span></p>

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
        <div class="continuar-arte" ${enCurso.portada_url ? `style="background-image:linear-gradient(180deg, rgba(20,15,13,.35), rgba(20,15,13,.75)), url('${esc(enCurso.portada_url)}');background-size:cover;background-position:center"` : ""}>
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
      ${cats.length > 1 ? `<div class="chips" id="filtro-cat" role="group" aria-label="Filtrar por categoría">
        <button class="chip activo" data-cat="">Todos</button>${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(nombreCategoria(c))}</button>`).join("")}</div>` : ""}
      <div class="pila" id="lista-cursos">${cursos.length ? cursos.map(tarjetaCurso).join("") : `<div class="vacio"><strong>Aún no tienes cursos</strong>Cuando Gustavo te asigne uno, aparecerá aquí.</div>`}</div>
    </section>

    ${audios.length ? `
    <section class="pila">
      <div class="fila-entre"><div class="etiqueta">Tus audiolibros</div><a class="btn-texto" href="#/biblioteca" style="display:inline-flex;align-items:center">Biblioteca</a></div>
      <div class="pila" id="lista-audios">${audios.map((x) => tarjetaAudio(x, `/audio/${x.id}`)).join("")}</div>
    </section>` : ""}

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
  animarBarras(app);
  const filtro = app.querySelector("#filtro-cat");
  if (filtro) filtro.onclick = (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    filtro.querySelectorAll(".chip").forEach((c) => c.classList.toggle("activo", c === b));
    const lista = cursos.filter((c) => !b.dataset.cat || (c.categoria || "general") === b.dataset.cat);
    const caja = app.querySelector("#lista-cursos");
    caja.innerHTML = lista.map(tarjetaCurso).join("");
    caja.querySelectorAll("[data-ir]").forEach((x) => (x.onclick = () => ir(x.dataset.ir)));
  };
  const llaveBienvenida = `academia-bienvenida-${r.usuario}`;
  let vista = true;
  try { vista = localStorage.getItem(llaveBienvenida) === "1"; } catch (_) { /* sin almacenamiento */ }
  if (!vista) {
    await mostrarBienvenida(r);
    try { localStorage.setItem(llaveBienvenida, "1"); localStorage.setItem(`academia-novedad-audio-${r.usuario}`, "1"); } catch (_) { /* nada */ }
  }
  if (vista) await novedadAudiolibros(r);
  await anunciarNuevos(r, cursos, audios);
  await invitarAvatar(ctxAudio(), r);
  if (r.insignias_sin_ver?.length) celebrar(r.insignias_sin_ver);
}

// Aviso único para quien ya conocía la Academia: llegaron los audiolibros.
async function novedadAudiolibros(r) {
  const llave = `academia-novedad-audio-${r.usuario}`;
  try { if (localStorage.getItem(llave)) return; localStorage.setItem(llave, "1"); } catch (_) { return; }
  confeti({ cantidad: 80, duracion: 2200, origenY: 0.25 });
  const v = await modal(`
    <div class="anuncio-nuevo">
      <div class="anuncio-icono">${icono("audifonos", 34)}</div>
      <div class="etiqueta" style="text-align:center;color:var(--oro)">Novedad en tu Academia</div>
      <h2 class="modal-titulo" style="text-align:center">¡Llegaron los audiolibros!</h2>
      <p class="texto-tenue" style="text-align:center;margin:0">Ahora también puedes aprender escuchando: en el camino, en el gimnasio o antes de dormir.</p>
      <div class="pila" style="gap:10px">
        <div class="fila" style="gap:12px;align-items:flex-start"><span style="flex:none;width:22px;color:var(--oro);display:flex;justify-content:center">${icono("moon", 20)}</span><span style="font-size:14px">Suenan con la pantalla apagada y tienen temporizador para dormir.</span></div>
        <div class="fila" style="gap:12px;align-items:flex-start"><span style="flex:none;width:22px;color:var(--oro);display:flex;justify-content:center">${icono("bolt", 20)}</span><span style="font-size:14px">Elige la velocidad y salta entre capítulos.</span></div>
        <div class="fila" style="gap:12px;align-items:flex-start"><span style="flex:none;width:22px;color:var(--oro);display:flex;justify-content:center">${icono("marcador", 20)}</span><span style="font-size:14px">Guarda marcadores con tus notas.</span></div>
        <div class="fila" style="gap:12px;align-items:flex-start"><span style="flex:none;width:22px;color:var(--oro);display:flex;justify-content:center">${icono("star", 20)}</span><span style="font-size:14px">Suman puntos por cada minuto que escuches.</span></div>
        <div class="fila" style="gap:12px;align-items:flex-start"><span style="flex:none;width:22px;color:var(--oro);display:flex;justify-content:center">${icono("biblioteca", 20)}</span><span style="font-size:14px">En la nueva pestaña <b>Biblioteca</b> ves todo lo que tiene la Academia.</span></div>
      </div>
      <button class="btn btn-bloque" data-cerrar="bib">${icono("biblioteca", 18)}Ver la Biblioteca</button>
      <button class="btn-texto" data-cerrar style="align-self:center">Después</button>
    </div>`);
  if (v === "bib") ir("/biblioteca");
}

// Un curso es "nuevo" mientras no hayas visto ni un segundo de él.
const esNuevo = (c) => !c.terminado && !c.ultima_actividad && !c.completadas;

// Tarjeta de bienvenida a los cursos recién asignados (una sola vez por curso).
async function anunciarNuevos(r, cursosVideo, audios = []) {
  const llave = `academia-anunciados-${r.usuario}`;
  let vistos = [];
  try { vistos = JSON.parse(localStorage.getItem(llave) || "[]"); } catch (_) { /* sin almacenamiento */ }
  const cursos = [
    ...cursosVideo.filter(esNuevo).map((c) => ({ ...c, _llave: c.id, _ruta: `/curso/${c.id}`, _meta: `${esc(nombreCategoria(c.categoria))} · ${c.lecciones} lecciones · ${duracion(c.duracion_seg)}` })),
    ...audios.filter(esNuevoAudio).map((b) => ({ ...b, _llave: "a:" + b.id, _ruta: `/audio/${b.id}`, _meta: `Audiolibro${b.autor ? " · " + esc(b.autor) : ""}${b.duracion_seg ? " · " + duracion(b.duracion_seg) : ""}` })),
  ];
  const nuevos = cursos.filter((c) => !vistos.includes(c._llave));
  if (!nuevos.length) return;
  try { localStorage.setItem(llave, JSON.stringify([...new Set([...vistos, ...nuevos.map((c) => c._llave)])].slice(-200))); } catch (_) { /* nada */ }
  const uno = nuevos.length === 1;
  confeti({ cantidad: 70, duracion: 2200, origenY: 0.25 });
  const v = await modal(`
    <div class="anuncio-nuevo">
      <div class="anuncio-icono">${icono("sparkles", 34)}</div>
      <h2 class="modal-titulo" style="text-align:center">${uno ? (nuevos[0]._ruta.startsWith("/audio") ? "¡Tienes un audiolibro nuevo!" : "¡Tienes un curso nuevo!") : `¡Tienes ${nuevos.length} títulos nuevos!`}</h2>
      <p class="texto-tenue" style="text-align:center;margin:0">${uno ? "Ya está listo para ti." : "Ya están listos para ti."} Cada video o minuto que escuches suma puntos para tu nivel y tus premios.</p>
      <div class="pila" style="gap:8px;margin-top:4px">${nuevos.slice(0, 4).map((c) => `
        <button class="anuncio-curso" data-cerrar="${c._ruta}">
          <div style="flex:1;min-width:0;text-align:left"><b>${esc(c.titulo)}</b>
            <small>${c._meta}${c.fecha_limite ? ` · vence ${fechaCorta(c.fecha_limite)}` : ""}</small></div>
          ${icono("next", 18)}
        </button>`).join("")}</div>
      <button class="btn btn-bloque" data-cerrar="${nuevos[0]._ruta}">${icono("play", 18)}Empezar ${uno ? "ahora" : "el primero"}</button>
      <button class="btn-texto" data-cerrar style="align-self:center">Lo veo después</button>
    </div>`);
  if (v && typeof v === "string") ir(v);
}

function tarjetaCurso(c) {
  const pct = c.lecciones ? Math.round((c.completadas / c.lecciones) * 100) : 0;
  const vencido = c.fecha_limite && c.fecha_limite < hoyISO() && !c.terminado;
  const pildora = c.terminado ? `<span class="pildora pildora-ok">Completado</span>`
    : vencido ? `<span class="pildora pildora-alerta">Venció ${fechaCorta(c.fecha_limite)}</span>`
    : c.fecha_limite ? `<span class="pildora ${diasHasta(c.fecha_limite) <= 5 ? "pildora-alerta" : ""}">Vence ${fechaCorta(c.fecha_limite)}</span>` : "";
  return `
  <button class="tarjeta-borde pila" data-ir="/curso/${c.id}" style="gap:10px">
    ${c.portada_url ? `<img class="portada-tarjeta" src="${esc(c.portada_url)}" alt="" loading="lazy">` : ""}
    <div class="fila-entre" style="align-items:flex-start">
      <div><b style="font-size:15px">${esNuevo(c) ? `<span class="etiqueta-nuevo">Nuevo</span>` : ""}${esc(c.titulo)}</b>
        <div class="texto-tenue" style="font-size:12px">${esc(nombreCategoria(c.categoria))} · ${c.lecciones} lecciones · ${duracion(c.duracion_seg)}${c.obligatorio ? " · obligatorio" : ""}</div></div>
      ${pildora}
    </div>
    <div class="fila"><div class="barra fina ${c.terminado ? "ok" : ""}" style="flex:1"><i style="width:${pct}%"></i></div>
      <b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct}%</b></div>
  </button>`;
}
const diasHasta = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(hoyISO() + "T12:00:00")) / 864e5);

function abrirPerfil(r) {
  modal(`
    ${estado.miAvatar ? `<button class="avatar-cuerpo-modal" id="perfil-cuerpo" aria-label="Tu avatar">${avatarCuerpoSVG(estado.miAvatar, 220, { animado: true })}</button>` : ""}
    <div class="fila">${estado.miAvatar ? "" : `<div class="avatar yo" style="width:56px;height:56px;font-size:18px">${esc(iniciales(r.nombre))}</div>`}
      <div><h2 class="modal-titulo" style="font-size:24px">${esc(r.nombre)}</h2>
      <div class="texto-tenue">@${esc(r.usuario)} · ${esc(nombreArea(r.area))}${r.sede ? " · " + esc(r.sede) : ""}</div></div></div>
    <div class="info-chips">
      <div><b>${num(r.puntos_ganados)}</b><small>puntos ganados</small></div>
      <div><b>${r.insignias}/${r.insignias_total}</b><small>insignias</small></div>
      <div><b>${r.racha_maxima}</b><small>mejor racha</small></div>
    </div>
    ${pendientesCola() ? `<p class="texto-tenue">${pendientesCola()} avance(s) esperando señal para enviarse.</p>` : ""}
    <button class="btn btn-bloque" data-cerrar="avatar">${icono("user", 18)}${estado.miAvatar ? "Editar mi avatar" : "Crear mi avatar"}</button>
    <button class="btn btn-sec btn-bloque" data-cerrar="bienvenida">${icono("book", 18)}Cómo funciona la Academia</button>
    <button class="btn btn-peligro btn-bloque" data-cerrar="salir">${icono("logout", 18)}Cerrar sesión</button>
    <button class="btn btn-sec btn-bloque" data-cerrar>Cerrar</button>
  `).then((v) => { if (v === "salir") salir(); if (v === "bienvenida") mostrarBienvenida(r); if (v === "avatar") ir("/avatar"); });
  const cuerpo = modal.actual?.querySelector("#perfil-cuerpo svg");
  if (cuerpo) {
    setTimeout(() => cuerpo.classList.add("av-saluda"), 350);
    modal.actual.querySelector("#perfil-cuerpo").onclick = () => { cuerpo.classList.remove("av-saluda"); void cuerpo.getBoundingClientRect(); cuerpo.classList.add("av-saluda"); };
  }
}

// ---------------------------------------------------------------------
//  BIENVENIDA · qué es la Academia, cómo funciona y qué ganan
// ---------------------------------------------------------------------
function mostrarBienvenida(r) {
  const nombre = esc(String(r.nombre || "").split(" ")[0] || "");
  const punto = (ic, titulo, texto) => `
    <div class="fila" style="align-items:flex-start;gap:12px">
      <span class="medalla chica medalla-cobre" style="width:38px;height:38px;flex:none">${icono(ic, 18)}</span>
      <div><b style="display:block;font-size:15px">${titulo}</b><span class="texto-tenue" style="font-size:13.5px;color:var(--crema-2)">${texto}</span></div>
    </div>`;
  const pasos = [
    {
      icono: "coffee", titulo: `Bienvenido a tu Academia${nombre ? ", " + nombre : ""}`,
      cuerpo: `<p class="modal-texto" style="font-size:16px;line-height:1.55">En Mozzafiato creemos que el buen café empieza con buenas manos. Las tuyas.</p>
        <p class="modal-texto" style="line-height:1.55">Por eso creamos la <b>Academia del Buen Café</b>: un lugar para aprender a tu ritmo, crecer junto con el equipo y que se note en cada taza, en cada plato y en cada mesa que atendemos.</p>`,
    },
    {
      icono: "play", titulo: "Así funciona",
      cuerpo: `<div class="pila" style="gap:14px">
        ${punto("book", "Tus cursos te esperan en Inicio", "Cada curso tiene capítulos con videos cortos, pensados para verlos en tus ratos libres.")}
        ${punto("biblioteca", "Explora la Biblioteca", "Ahí está todo lo que tiene la Academia, en video y en audio. Lo que tienes asignado lo abres; lo demás, pídeselo a Gustavo.")}
        ${punto("video", "Aprende cuando y donde quieras", "En tu celular, la tablet o la compu. Tu avance se guarda solo, aunque se vaya la señal.")}
        ${punto("lock", "Paso a paso", "Las lecciones se abren en orden: terminas una y se desbloquea la siguiente.")}
        ${punto("target", "Demuestra lo que aprendiste", "Algunos cursos cierran con un quiz corto. Si no sale a la primera, lo vuelves a intentar.")}
      </div>`,
    },
    {
      icono: "audifonos", titulo: "Audiolibros: aprende mientras vas",
      cuerpo: `<div class="pila" style="gap:14px">
        ${punto("audifonos", "Escucha libros completos", "Liderazgo, servicio, cocina y más. Ideales para el camino, el gimnasio o antes de dormir.")}
        ${punto("moon", "Con la pantalla apagada", "Siguen sonando aunque bloquees el celular o uses otra app. Hay temporizador para dormir.")}
        ${punto("bolt", "A tu velocidad", "Escucha más lento o hasta al doble de rápido, y salta entre capítulos.")}
        ${punto("marcador", "Guarda lo importante", "Pon marcadores con notas para volver a las ideas que más te gustaron.")}
        ${punto("star", "También suman puntos", "Ganas por cada minuto que escuches, más un bono al terminar el libro.")}
      </div>`,
    },
    {
      icono: "star", titulo: "¿Para qué hacemos esto?",
      cuerpo: `<div class="pila" style="gap:14px">
        ${punto("users", "Para ser un gran equipo", "Que en cualquier turno, con cualquiera de nosotros, el cliente reciba la misma calidad.")}
        ${punto("chef", "Para que crezcas tú", "Lo que aprendas aquí te sirve en Mozzafiato y en cualquier lugar al que te lleve la vida.")}
        ${punto("eye", "Para que tu esfuerzo se vea", "Cada curso que terminas queda registrado y cuenta. Aquí el que le echa ganas, se nota.")}
      </div>`,
    },
    {
      icono: "gift", titulo: "Lo que ganas",
      cuerpo: `<div class="pila" style="gap:14px">
        ${punto("coffee", "Puntos", "Por cada lección, cada curso terminado, cada quiz perfecto, cada minuto de audiolibro y por entregar a tiempo.")}
        ${punto("medal", "Insignias", "Llénalas en tu vitrina. Algunas son secretas… a ver quién las descubre primero.")}
        ${punto("flame", "Niveles", "Empiezas como Grano verde y puedes llegar a Maestro tostador.")}
        ${punto("gift", "Premios reales", "Canjea tus puntos por los premios del catálogo: comida, días libres y más.")}
        ${punto("trophy", "Ranking", "Cada semana, mes y en total. ¿Quién lleva la delantera?")}
      </div>`,
    },
    {
      icono: "key", titulo: "Las reglas del juego",
      cuerpo: `<div class="pila" style="gap:14px">
        ${punto("key", "Tu PIN es solo tuyo", "No lo compartas. Si alguien entra con tu cuenta en otro celular, la tuya se cierra y ese avance no cuenta.")}
        ${punto("eye", "De vez en cuando: “¿Sigues ahí?”", "Te lo preguntaremos mientras ves un video o escuchas un audiolibro, para que cada minuto cuente de verdad. Adelantar no suma puntos.")}
        ${punto("heart", "Lo importante es aprender", "No se trata de terminar rápido, sino de que lo apliques en tu día a día.")}
      </div>
      <p class="modal-texto serif" style="font-size:19px;text-align:center;margin-top:6px">Gracias por ser parte de Mozzafiato.<br>¡Vamos por ese primer curso o audiolibro!</p>
      <p class="texto-tenue" style="text-align:center;margin:0">— Gustavo y el equipo Mozzafiato</p>`,
    },
  ];
  return new Promise((resolver) => {
    let i = 0;
    modal(`<div id="bv"></div>`, { cerrable: false, clase: "modal-ancho" }).then(() => resolver());
    const capa = modal.actual;
    const pintar = () => {
      const p = pasos[i], ultimo = i === pasos.length - 1;
      capa.querySelector("#bv").innerHTML = `
        <div class="pila" style="gap:16px">
          <div class="fila-entre">
            <div class="fila" style="gap:6px" aria-label="Paso ${i + 1} de ${pasos.length}">${pasos.map((_, k) => `<i style="display:block;height:6px;border-radius:3px;width:${k === i ? 22 : 6}px;background:${k <= i ? "var(--cobre)" : "var(--linea)"};transition:width .3s"></i>`).join("")}</div>
            ${ultimo ? "" : `<button class="btn-texto" id="bv-saltar">Saltar</button>`}
          </div>
          ${i === 0 ? `<img src="${ISOTIPO}" alt="Mozzafiato" style="width:110px;align-self:center;margin:4px 0">` : `<div class="medalla medalla-cobre" style="width:64px;height:64px;align-self:center">${icono(p.icono, 30)}</div>`}
          <h2 class="modal-titulo" style="text-align:center">${p.titulo}</h2>
          ${p.cuerpo}
          <div class="fila-botones">
            ${i > 0 ? `<button class="btn btn-sec" id="bv-atras">${icono("back", 18)}Atrás</button>` : ""}
            <button class="btn" id="bv-sig">${ultimo ? "¡Empezar!" : "Siguiente"} ${ultimo ? "" : icono("next", 18)}</button>
          </div>
        </div>`;
      capa.querySelector("#bv-sig").onclick = () => { if (ultimo) capa.cerrar(true); else { i++; pintar(); } };
      capa.querySelector("#bv-atras")?.addEventListener("click", () => { i--; pintar(); });
      capa.querySelector("#bv-saltar")?.addEventListener("click", () => { i = pasos.length - 1; pintar(); });
      capa.querySelector(".modal").scrollTop = 0;
    };
    pintar();
  });
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
  const valor = valorCurso({ lecciones: orden, preguntas: d.preguntas.length });

  let n = 0;
  sinNav(`${vp ? bandaVista() : ""}
  <main class="vista vista-completa">
    <header class="curso-cabeza">
      <div class="fila-iso"><button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button><img class="cabeza-iso" src="${ISOTIPO}" alt="Mozzafiato"><span style="width:44px"></span></div>
      ${d.curso.portada_url ? `<img class="portada-curso" src="${esc(d.curso.portada_url)}" alt="">` : ""}
      <div class="etiqueta" style="color:var(--oro)">${esc(nombreCategoria(d.curso.categoria))}${d.curso.quiz_obligatorio ? " · con quiz" : ""}</div>
      <h1>${esc(d.curso.titulo)}</h1>
      ${d.curso.descripcion ? `<p style="margin:0;color:var(--crema-2)">${esc(d.curso.descripcion)}</p>` : ""}
      <div class="texto-tenue" style="color:var(--crema-2)">${caps.length} ${caps.length === 1 ? "capítulo" : "capítulos"} · ${total} lecciones · ${duracion(durTotal)}</div>
      ${total ? `<div class="fila" style="gap:8px;flex-wrap:wrap"><span class="pildora pildora-oro">${icono("star", 14)}Vale hasta ${num(valor.total)} pts</span>${valor.bono ? `<span class="texto-tenue" style="color:var(--crema-2);font-size:12px">incluye ${num(valor.bono)} de bono al terminar${valor.quiz ? ` y ${num(valor.quiz)} por quiz perfecto` : ""}</span>` : ""}</div>` : ""}
      <div class="fila"><div class="barra" style="flex:1;background:var(--tarjeta)"><i style="width:${pct}%"></i></div><b style="color:var(--oro)">${pct}%</b></div>
      ${siguiente ? `<button class="btn" data-ir="${B}/leccion/${id}/${siguiente.id}">${icono("play", 18)}${listas ? "Continuar" : "Empezar curso"}</button>` : ""}
    </header>

    ${terminado ? `<div class="tarjeta fila" style="border:1px solid var(--verde)">${icono("trophy", 28)}<div><b>¡Curso completado!</b><div class="texto-tenue">Buen trabajo. Tus puntos ya están en tu cuenta.</div></div></div>` : ""}
    ${d.curso.certificado && (terminado || vp) ? `<button class="tarjeta-borde fila" id="ver-cert" style="border-color:var(--oro);gap:14px;display:flex;align-items:center">
        <span class="medalla medalla-oro chica" style="flex:none">${icono("medal", 22)}</span>
        <span style="flex:1"><b style="font-size:15px;display:block">${vp ? "Ver ejemplo del certificado" : "Tu certificado está listo"}</b><span class="texto-tenue">Descárgalo o compártelo con tu logo de Mozzafiato.</span></span>
        ${icono("next", 18)}</button>` : ""}

    ${caps.map((c, ci) => `
      <section class="pila" style="gap:8px">
        <div class="capitulo-titulo"><h2>Capítulo ${ci + 1} · ${esc(c.titulo)}</h2>
          <span class="texto-tenue">${c.lecciones.filter((l) => hechas.has(l.id)).length} de ${c.lecciones.length}</span></div>
        ${c.lecciones.map((l) => {
          n++;
          const hecho = hechas.has(l.id), ahora = siguiente?.id === l.id, bloq = !vp && !hecho && !ahora;
          return `<button class="leccion ${ahora ? "actual" : ""} ${bloq ? "bloq" : ""}" ${bloq ? 'aria-disabled="true"' : `data-ir="${B}/leccion/${id}/${l.id}"`}>
            <span class="leccion-estado ${hecho ? "hecho" : ahora ? "ahora" : "pend"}">${icono(hecho ? "check" : ahora || vp ? "play" : "lock", hecho ? 16 : 14)}</span>
            <span style="flex:1;min-width:0"><b>${n}. ${esc(l.titulo)}</b><small>${l.duracion_seg ? duracion(l.duracion_seg) : "video"}${hecho ? "" : ` · +${puntosLeccion(l.duracion_seg)} pts`}</small></span>
          </button>`;
        }).join("")}
      </section>`).join("")}
    ${!caps.length ? `<div class="vacio"><strong>Este curso aún no tiene lecciones</strong>Pronto se agregarán.</div>` : ""}

    ${d.materiales.length ? `
      <section class="pila" style="gap:8px">
        <div class="etiqueta">Materiales</div>
        ${d.materiales.map((m) => `<button class="material" data-material="${m.id}">${icono("file", 22, 'style="color:var(--oro)"')}
          <span style="flex:1"><b style="display:block;font-size:14px">${esc(m.titulo)}</b><small class="texto-tenue">${esc((m.tipo || "pdf").toUpperCase())}${m.tipo !== "link" ? (m.descargable ? " · descargable" : " · solo lectura") : ""}${m.peso_kb ? " · " + (m.peso_kb >= 1024 ? (m.peso_kb / 1024).toFixed(1) + " MB" : m.peso_kb + " KB") : ""}</small></span></button>`).join("")}
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
  app.querySelector("#ver-cert")?.addEventListener("click", () => {
    const fechas = [...d.progreso.filter((p) => p.completado && orden.some((l) => l.id === p.leccion_id)).map((p) => p.completado_en),
      ...d.intentos.filter((t) => t.aprobado).map((t) => t.creado_en)].filter(Boolean).sort();
    const cuando = fechas.length ? new Date(fechas[fechas.length - 1]) : new Date();
    mostrarCertificado({
      nombre: vp ? "Nombre del colaborador" : estado.perfil.nombre,
      curso: d.curso.titulo,
      fecha: cuando.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
      segundos: durTotal,
      puntaje: mejor || null,
      codigo: folio(vp ? "ejemplo" : estado.perfil.usuario, d.curso.id),
    });
  animarBarras(app);
  try {
    if (sessionStorage.getItem("academia-abrir-cert") === id) {
      sessionStorage.removeItem("academia-abrir-cert");
      setTimeout(() => app.querySelector("#ver-cert")?.click(), 400);
    }
  } catch (_) { /* nada */ }
  });
  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
  app.querySelectorAll(".leccion.bloq").forEach((b) => (b.onclick = () => aviso("Termina la lección anterior para desbloquear esta")));
  app.querySelectorAll("[data-material]").forEach((b) => (b.onclick = async () => {
    const m = d.materiales.find((x) => x.id === b.dataset.material);
    const esLink = m.tipo === "link" || /^https?:\/\//.test(m.ruta) && !/supabase\.co|^blob:/.test(m.ruta);
    if (esLink || m.descargable) {
      // Links externos y materiales con descarga permitida
      if (m.descargable && !esLink) {
        const r = await modal(`<h2 class="modal-titulo" style="font-size:22px">${esc(m.titulo)}</h2>
          <div class="fila-botones"><button class="btn btn-sec" data-cerrar="ver">${icono("eye", 18)}Ver</button><button class="btn" data-cerrar="bajar">${icono("file", 18)}Descargar</button></div>`);
        if (!r) return;
        if (r === "ver") return abrirMaterial(m);
        try { const url = await datos.urlMaterial(m, { descargar: true }); const a = document.createElement("a"); a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); }
        catch (e) { aviso(e.message, "error"); }
        return;
      }
      const ventana = window.open("about:blank", "_blank");
      try { const url = await datos.urlMaterial(m); if (ventana) ventana.location = url; else location.href = url; }
      catch (e) { if (ventana) ventana.close(); aviso(e.message, "error"); }
      return;
    }
    abrirMaterial(m);
  }));
  async function abrirMaterial(m) {
    try {
      const url = await datos.urlMaterial(m);
      const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
      abrirVisor({ titulo: m.titulo, url, tipo: (m.tipo || "pdf") === "pdf" ? "pdf" : "imagen",
        marca: `${estado.perfil?.nombre || ""} · @${estado.perfil?.usuario || ""} · ${hoy}` });
    } catch (e) { aviso(e.message, "error"); }
  }
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
  let hechasAlEntrar = d.progreso.filter((p) => p.completado && orden.some((l) => l.id === p.leccion_id)).length;
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
        const total = orden.length, antes = hechasAlEntrar;
        hechasAlEntrar++;
        await celebrarAvance({
          puntos: r.puntos_ganados, insignias: r.insignias_nuevas, cursoTerminado: r.curso_terminado,
          pctAntes: (antes / total) * 100, pctDespues: ((antes + 1) / total) * 100,
          curso: d.curso, cursoId,
        });
      }
    } catch (e) {
      console.warn(e);
      if (e.codigo === "SESION_REEMPLAZADA") { enviando = false; return expulsar(); }
    }
    finally { enviando = false; }
  };
  let pausarVideo = () => {};
  const alOcultar = () => { if (document.visibilityState === "hidden") { pausarVideo(); reportar(true); } };
  document.addEventListener("visibilitychange", alOcultar);

  if (v.demo) {
    const barra = app.querySelector("#sim-barra"), tiempo = app.querySelector("#sim-tiempo"), play = app.querySelector("#sim-play");
    let timer = null;
    const mover = (s) => { ultimoSeg = Math.min(s, ultimaDur); barra.value = ultimoSeg; tiempo.textContent = `${reloj(ultimoSeg)} / ${reloj(ultimaDur)}`; };
    const parar = () => { if (timer) { clearInterval(timer); timer = null; play.innerHTML = icono("play", 24); reportar(true); } };
    const arrancar = () => {
      if (timer) return;
      play.innerHTML = icono("x", 24);
      timer = setInterval(() => { mover(ultimoSeg + 5); vig.avanzar(5); reportar(); if (ultimoSeg >= ultimaDur) parar(); }, 500);
    };
    const vig = crearVigilante({ pausar: parar, reanudar: arrancar, min: 40, max: 70, activo: !vp });
    pausarVideo = parar;
    play.onclick = () => (timer ? parar() : arrancar());
    barra.oninput = () => mover(Number(barra.value));
    barra.onchange = () => reportar(true);
    estado.limpieza = async () => { clearInterval(timer); vig.detener(); document.removeEventListener("visibilitychange", alOcultar); await reportar(true); };
    return;
  }

  // Bunny player.js
  const iframe = app.querySelector("#video");
  let player = null;
  const vig = crearVigilante({ pausar: () => player?.pause(), reanudar: () => player?.play(), min: 240, max: 420, activo: !vp });
  pausarVideo = () => player?.pause();
  try {
    player = new window.playerjs.Player(iframe);
    player.on("ready", () => {
      if (v.segundo_inicio > 5) player.setCurrentTime(v.segundo_inicio);
      let previo = null;
      player.on("timeupdate", (t) => {
        if (previo !== null) { const d = t.seconds - previo; if (d > 0 && d < 5) vig.avanzar(d); }
        previo = t.seconds;
        ultimoSeg = t.seconds; if (t.duration) ultimaDur = t.duration; reportar();
      });
      player.on("pause", () => reportar(true));
      player.on("ended", () => { ultimoSeg = ultimaDur; reportar(true); });
    });
  } catch (e) { console.warn("player.js no disponible", e); }
  estado.limpieza = async () => { vig.detener(); document.removeEventListener("visibilitychange", alOcultar); await reportar(true); };
}

// "¿Sigues ahí?": cada cierto tiempo de reproducción pausa y pide confirmar.
function crearVigilante({ pausar, reanudar, min = 240, max = 420, activo = true }) {
  const siguiente = () => min + Math.random() * (max - min);
  let acumulado = 0, meta = siguiente(), abierto = false, vivo = true, reloj60 = null;
  const preguntar = () => {
    abierto = true;
    pausar();
    let quedan = 60;
    const posicion = ["flex-start", "center", "flex-end"][Math.floor(Math.random() * 3)];
    modal(`
      <div class="pila" style="align-items:center;text-align:center">
        <div class="medalla medalla-cobre" style="width:72px;height:72px">${icono("eye", 34)}</div>
        <h2 class="modal-titulo">¿Sigues ahí?</h2>
        <p class="modal-texto" id="sa-texto">Toca el botón para seguir viendo. <span id="sa-seg">60</span> s</p>
      </div>
      <div class="fila" style="justify-content:${posicion}"><button class="btn" data-cerrar="si" style="min-width:180px">Sí, continuar</button></div>`, { cerrable: false })
      .then(() => {
        clearInterval(reloj60); abierto = false; acumulado = 0; meta = siguiente();
        if (vivo) reanudar();
      });
    reloj60 = setInterval(() => {
      quedan--;
      const el = document.getElementById("sa-seg");
      if (el) el.textContent = Math.max(0, quedan);
      if (quedan <= 0) {
        clearInterval(reloj60);
        const t = document.getElementById("sa-texto");
        if (t) t.textContent = "El video sigue en pausa. Toca el botón cuando estés listo.";
      }
    }, 1000);
  };
  return {
    avanzar(seg) {
      if (!activo || abierto || !vivo) return;
      acumulado += seg;
      if (acumulado >= meta) preguntar();
    },
    detener() { vivo = false; clearInterval(reloj60); },
  };
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
    <div class="fila-iso"><button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button><img class="cabeza-iso" src="${ISOTIPO}" alt="Mozzafiato"><span style="width:44px"></span></div>
    <span class="texto-tenue">${esc(d.curso.titulo)}</span>
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
      if (r.aprobado) confeti({ cantidad: r.puntaje === 100 ? 220 : 140 });
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
      await revisarNivelYRacha();
      if (r.aprobado) {
        if (r.curso_terminado && d.curso.certificado) { try { sessionStorage.setItem("academia-abrir-cert", cursoId); } catch (_) { /* nada */ } }
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
  const [{ catalogo: todas, mias }, r, niveles] = await Promise.all([datos.insignias(), datos.resumen(), datos.niveles()]);
  const catalogo = todas.filter((i) => i.activa !== false);
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
  const [filas, avs] = await Promise.all([datos.ranking(periodo), datos.avatares()]);
  const [p1, p2, p3] = filas;
  const lugar = (f, n, clase, alto) => f ? `
    <div class="podio-lugar ${clase}">
      ${n === 1 ? `<span style="color:var(--oro)">${icono("crown", 24)}</span>` : ""}
      ${avs[f.user_id] ? `<span class="avatar avatar-svg">${avatarSVG(avs[f.user_id], n === 1 ? 64 : 54)}</span>` : `<div class="avatar ${f.soy_yo ? "yo" : ""}">${esc(iniciales(f.nombre))}</div>`}
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
          ${avs[f.user_id] ? `<span class="avatar avatar-svg" style="width:38px;height:38px">${avatarSVG(avs[f.user_id], 38)}</span>` : `<div class="avatar ${f.soy_yo ? "yo" : ""}" style="width:34px;height:34px;font-size:12px">${esc(iniciales(f.nombre))}</div>`}
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
