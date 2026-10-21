// =====================================================================
//  AUDIOLIBROS (empleado) · reproductor y biblioteca/catálogo
//  - Reproductor con velocidad, pantalla apagada (Media Session),
//    temporizador para dormir, capítulos, marcadores y "¿Sigues escuchando?".
//  - Biblioteca: todos los títulos publicados (videos y audio); los que no
//    tienes asignados aparecen con candado.
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, num, duracion, reloj, fechaCorta, hoyISO, aviso, modal, confirmar, formulario, nombreCategoria } from "./ui.js";
import { confeti, momento } from "./fiesta.js";

const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SIGUES_MIN = () => { try { return Number(localStorage.getItem("academia-sigues-audio-min")) || 30; } catch (_) { return 30; } };
const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* nada */ } };

export const esNuevoAudio = (b) => b.asignado && !b.completado && !b.ultima_actividad && !b.max_segundo;
export const pctAudio = (b) => (b.completado ? 100 : b.duracion_seg ? Math.min(100, Math.round(((b.max_segundo || 0) / b.duracion_seg) * 100)) : 0);

// Portada: la imagen del libro o una generada con sus iniciales.
export function portadaHTML(b, tam = "normal") {
  if (b.portada_url) return `<div class="portada portada-${tam}"><img src="${esc(b.portada_url)}" alt="" loading="lazy"></div>`;
  let h = 0;
  for (const ch of b.titulo || "") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<div class="portada portada-${tam} portada-gen" style="--tono:${20 + (h % 30)}">
    <span class="portada-icono">${icono("audifonos", tam === "grande" ? 40 : 20)}</span>
    ${tam === "grande" ? `<b>${esc(b.titulo)}</b>${b.autor ? `<small>${esc(b.autor)}</small>` : ""}` : ""}
  </div>`;
}

export function tarjetaAudio(b, ruta) {
  const pct = pctAudio(b);
  const vencido = b.fecha_limite && b.fecha_limite < hoyISO() && !b.completado;
  const pildora = b.completado ? `<span class="pildora pildora-ok">Terminado</span>`
    : vencido ? `<span class="pildora pildora-alerta">Venció ${fechaCorta(b.fecha_limite)}</span>`
    : b.fecha_limite ? `<span class="pildora">Vence ${fechaCorta(b.fecha_limite)}</span>` : "";
  return `
  <button class="tarjeta-borde fila tarjeta-audio" data-ir="${ruta}" style="gap:12px;align-items:stretch">
    ${portadaHTML(b, "chica")}
    <div class="pila" style="gap:8px;flex:1;min-width:0">
      <div class="fila-entre" style="align-items:flex-start;gap:8px">
        <div style="min-width:0"><b style="font-size:15px">${esNuevoAudio(b) ? `<span class="etiqueta-nuevo">Nuevo</span>` : ""}${esc(b.titulo)}</b>
          <div class="texto-tenue" style="font-size:12px">${icono("audifonos", 12)} Audiolibro${b.autor ? " · " + esc(b.autor) : ""}${b.duracion_seg ? " · " + duracion(b.duracion_seg) : ""}</div></div>
        ${pildora}
      </div>
      <div class="fila"><div class="barra fina ${b.completado ? "ok" : ""}" style="flex:1"><i style="width:${pct}%"></i></div>
        <b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct}%</b></div>
    </div>
  </button>`;
}

// ---------------------------------------------------------------------
//  BIBLIOTECA · catálogo completo con candados
// ---------------------------------------------------------------------
export async function pintarBiblioteca(ctx) {
  ctx.cargando();
  const [cat, mios, audios] = await Promise.all([
    datos.catalogoCursos().catch(() => null),
    datos.misCursos().catch(() => []),
    datos.misAudiolibros().catch(() => []),
  ]);
  const cursos = (cat || mios.map((c) => ({ ...c, asignado: true }))).map((c) => {
    const mio = mios.find((m) => m.id === c.id);
    return { tipo: "curso", ...c, pct: mio && mio.lecciones ? Math.round((mio.completadas / mio.lecciones) * 100) : 0, terminado: mio?.terminado || c.terminado };
  });
  const libros = audios.map((b) => ({ tipo: "audio", ...b, pct: pctAudio(b), terminado: b.completado }));
  const todos = [...cursos, ...libros];
  let filtroTipo = "", filtroCat = "", texto = "";
  const cats = [...new Set(todos.map((x) => x.categoria || "general"))];

  ctx.conNav(`
  <main class="vista">
    <header class="pila" style="gap:4px">
      <h1 class="titulo-pagina">Biblioteca</h1>
      <span class="texto-tenue">Todo lo que tiene la Academia. Lo que tienes asignado lo puedes abrir; lo demás, pídelo a Gustavo.</span>
    </header>
    <div class="pestanas" id="bib-tipo" role="tablist">
      <button class="activo" data-t="">Todo · ${todos.length}</button>
      <button data-t="curso">${icono("video", 16)} Videos · ${cursos.length}</button>
      <button data-t="audio">${icono("audifonos", 16)} Audio · ${libros.length}</button>
    </div>
    <input class="buscar-persona" type="search" id="bib-buscar" placeholder="Buscar un título…" aria-label="Buscar en la biblioteca">
    ${cats.length > 1 ? `<div class="chips" id="bib-cat"><button class="chip activo" data-c="">Todas</button>${cats.map((c) => `<button class="chip" data-c="${esc(c)}">${esc(nombreCategoria(c))}</button>`).join("")}</div>` : ""}
    <div class="pila" id="bib-lista"></div>
  </main>`, "biblioteca");

  const itemHTML = (x) => {
    const bloq = !x.asignado;
    const meta = x.tipo === "curso"
      ? `${icono("video", 12)} Curso · ${x.lecciones} lecciones${x.duracion_seg ? " · " + duracion(x.duracion_seg) : ""}`
      : `${icono("audifonos", 12)} Audiolibro${x.autor ? " · " + esc(x.autor) : ""}${x.duracion_seg ? " · " + duracion(x.duracion_seg) : ""}`;
    const estadoX = bloq ? `<span class="pildora pildora-bloq">${icono("lock", 12)} No asignado</span>`
      : x.terminado ? `<span class="pildora pildora-ok">${x.tipo === "curso" ? "Completado" : "Terminado"}</span>`
      : `<span class="pildora pildora-oro">${x.pct}%</span>`;
    return `<button class="item-bib ${bloq ? "bloqueado" : ""}" data-tipo="${x.tipo}" data-id="${x.id}">
      ${x.tipo === "audio" ? portadaHTML(x, "chica") : `<div class="portada portada-chica portada-video"><span class="portada-icono">${icono("video", 20)}</span></div>`}
      <div style="flex:1;min-width:0;text-align:left"><b>${esc(x.titulo)}</b><small>${meta}</small>
        <small class="item-cat">${esc(nombreCategoria(x.categoria))}</small></div>
      ${estadoX}
    </button>`;
  };
  const pintar = () => {
    const lista = todos.filter((x) => (!filtroTipo || x.tipo === filtroTipo) && (!filtroCat || (x.categoria || "general") === filtroCat)
      && (!texto || `${x.titulo} ${x.autor || ""}`.toLowerCase().includes(texto)))
      .sort((a, b) => Number(b.asignado) - Number(a.asignado) || a.titulo.localeCompare(b.titulo));
    const caja = ctx.app.querySelector("#bib-lista");
    caja.innerHTML = lista.length ? lista.map(itemHTML).join("") : `<div class="vacio"><strong>Nada por aquí</strong>Prueba con otra búsqueda o categoría.</div>`;
  };
  ctx.app.querySelector("#bib-tipo").onclick = (e) => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    filtroTipo = b.dataset.t;
    ctx.app.querySelectorAll("#bib-tipo button").forEach((x) => x.classList.toggle("activo", x === b));
    pintar();
  };
  ctx.app.querySelector("#bib-buscar").oninput = (e) => { texto = e.target.value.trim().toLowerCase(); pintar(); };
  const chips = ctx.app.querySelector("#bib-cat");
  if (chips) chips.onclick = (e) => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    filtroCat = b.dataset.c;
    chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("activo", x === b));
    pintar();
  };
  ctx.app.querySelector("#bib-lista").onclick = async (e) => {
    const b = e.target.closest(".item-bib"); if (!b) return;
    const x = todos.find((y) => y.id === b.dataset.id && y.tipo === b.dataset.tipo);
    if (x.asignado) return ctx.ir(x.tipo === "curso" ? `/curso/${x.id}` : `/audio/${x.id}`);
    await modal(`
      <div class="pila" style="align-items:center;text-align:center;gap:10px">
        ${x.tipo === "audio" ? portadaHTML(x, "media") : `<div class="portada portada-media portada-video"><span class="portada-icono">${icono("video", 30)}</span></div>`}
        <div class="etiqueta">${x.tipo === "curso" ? "Curso en video" : "Audiolibro"} · ${esc(nombreCategoria(x.categoria))}</div>
        <h2 class="modal-titulo">${esc(x.titulo)}</h2>
        ${x.descripcion ? `<p class="modal-texto">${esc(x.descripcion)}</p>` : ""}
        <p class="texto-tenue" style="margin:0">${icono("lock", 14)} Todavía no está asignado a ti. Si te interesa, pídeselo a Gustavo y te lo abre.</p>
        <button class="btn btn-bloque" data-cerrar>Entendido</button>
      </div>`);
  };
  pintar();
}

// ---------------------------------------------------------------------
//  REPRODUCTOR
// ---------------------------------------------------------------------
export async function pintarAudiolibro(ctx, id) {
  ctx.cargando();
  const vp = !!ctx.estado.preview;
  const lista = vp ? await datos.adminAudiolibros() : await datos.misAudiolibros();
  const b = lista.find((x) => x.id === id);
  if (!b) throw new Error("Audiolibro no encontrado");
  if (!vp && !b.asignado) { aviso("Ese audiolibro no está asignado a ti", "error"); return ctx.ir("/biblioteca"); }
  const [fuente, marcas] = await Promise.all([
    datos.audio(id).catch((e) => ({ error: e.message })),
    vp ? Promise.resolve([]) : datos.marcadores(id).catch(() => []),
  ]);
  const caps = [...(b.capitulos || [])].filter((c) => Number.isFinite(Number(c.t))).sort((a, b2) => a.t - b2.t);
  let marcadores = marcas || [];
  let completado = vp || !!b.completado;
  const volverA = vp ? "/admin/audio/" + id : "/inicio";

  ctx.sinNav(`${vp ? `<div class="banda-demo">VISTA PREVIA COMO EMPLEADO · tu avance no se guarda</div>` : ""}
  <main class="vista vista-completa vista-audio" id="vista-audio">
    <div class="barra-sup">
      <button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button>
      <span class="texto-tenue">Audiolibro${b.categoria ? " · " + esc(nombreCategoria(b.categoria)) : ""}</span>
    </div>
    <div class="audio-cabeza">
      ${portadaHTML(b, "grande")}
      <div class="pila" style="gap:2px;text-align:center;align-items:center">
        <h1 class="titulo-pagina" style="font-size:26px">${esc(b.titulo)}</h1>
        ${b.autor ? `<span class="texto-tenue">${esc(b.autor)}</span>` : ""}
        <span class="etiqueta" id="cap-actual" style="margin-top:6px">${caps.length ? (caps[0].t <= 0 ? esc(caps[0].titulo) : "Inicio") : ""}</span>
      </div>
    </div>
    ${fuente.error ? `<div class="tarjeta reproductor-msg" style="position:static">${icono("audifonos", 32)}<b>${esc(fuente.error)}</b><button class="btn btn-chico" id="reintentar">Reintentar</button></div>` : `
    <section class="reproductor-audio">
      <input type="range" id="a-barra" min="0" max="${b.duracion_seg || 1}" value="0" step="1" aria-label="Posición">
      <div class="fila-entre texto-tenue" style="font-size:12px"><span id="a-tiempo">0:00</span><span id="a-resta">${b.duracion_seg ? "-" + reloj(b.duracion_seg) : ""}</span></div>
      <div class="controles-audio">
        <button class="btn-icono grande" id="a-atras" aria-label="Retroceder 15 segundos">${icono("atras15", 30)}</button>
        <button class="boton-play grande" id="a-play" aria-label="Reproducir">${icono("play", 30)}</button>
        <button class="btn-icono grande" id="a-adelante" aria-label="Adelantar 30 segundos">${icono("adelante30", 30)}</button>
      </div>
      <div class="chips-audio">
        <button class="chip" id="a-vel" aria-label="Velocidad">1x</button>
        <button class="chip" id="a-dormir" aria-label="Temporizador para dormir">${icono("moon", 14)} <span>Dormir</span></button>
        <button class="chip" id="a-marcar" ${vp ? "disabled" : ""}>${icono("marcador", 14)} Marcador</button>
      </div>
    </section>`}
    <div class="tarjeta fila" id="estado-audio">${estadoHTML(b, !vp && completado)}</div>
    ${caps.length || !vp ? `
    <div class="pestanas" id="a-pestanas" role="tablist">
      ${caps.length ? `<button class="activo" data-p="caps">Capítulos · ${caps.length}</button>` : ""}
      ${vp ? "" : `<button class="${caps.length ? "" : "activo"}" data-p="marcas">Marcadores · <span id="n-marcas">${marcadores.length}</span></button>`}
    </div>
    <div id="a-panel-caps" class="pila" style="gap:6px" ${caps.length ? "" : "hidden"}>
      ${caps.map((c, i) => `<button class="fila-cap" data-ir-seg="${c.t}" data-cap="${i}"><span class="num-cap">${i + 1}</span><span style="flex:1;text-align:left">${esc(c.titulo)}</span><span class="texto-tenue">${reloj(c.t)}</span></button>`).join("")}
    </div>
    <div id="a-panel-marcas" class="pila" style="gap:6px" ${caps.length ? "hidden" : ""}></div>` : ""}
  </main>`);

  ctx.app.querySelector("#volver").onclick = () => ctx.ir(volverA);
  ctx.app.querySelector("#reintentar")?.addEventListener("click", () => pintarAudiolibro(ctx, id));
  if (fuente.error) return;

  // ---- Elementos ----
  const $ = (s) => ctx.app.querySelector(s);
  const audio = crearLista(fuente, b.duracion_seg || 0);
  let dur = Math.round(audio.duration) || b.duracion_seg || 0;
  let vel = Number(leer("academia-audio-vel", "1")) || 1;
  const inicio = b.completado && b.duracion_seg && (b.segundo_actual || 0) >= b.duracion_seg - 15 ? 0 : (b.segundo_actual || 0);
  let arrastrando = false;

  const pintarTiempo = () => {
    const t = audio.currentTime || 0;
    if (!arrastrando) $("#a-barra").value = Math.floor(t);
    $("#a-tiempo").textContent = reloj(t);
    $("#a-resta").textContent = dur ? "-" + reloj(Math.max(0, dur - t)) : "";
    if (caps.length) {
      let i = -1; for (let k = 0; k < caps.length; k++) if (t >= caps[k].t) i = k;
      $("#cap-actual").textContent = i >= 0 ? caps[i].titulo : "Inicio";
      ctx.app.querySelectorAll(".fila-cap").forEach((el) => el.classList.toggle("activo", Number(el.dataset.cap) === i));
    }
  };
  const iconoPlay = () => { $("#a-play").innerHTML = icono(audio.paused ? "play" : "pausa", 30); $("#a-play").setAttribute("aria-label", audio.paused ? "Reproducir" : "Pausar"); };
  const ponerVel = (v) => { vel = v; audio.playbackRate = v; audio.defaultPlaybackRate = v; $("#a-vel").textContent = `${String(v).replace(".", ".")}x`; guardarLS("academia-audio-vel", String(v)); };
  ponerVel(vel);

  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) { dur = Math.round(audio.duration); $("#a-barra").max = dur; }
    if (inicio > 3 && inicio < dur - 3) audio.currentTime = inicio;
    audio.playbackRate = vel;
    pintarTiempo();
  }, { once: true });
  audio.addEventListener("timeupdate", () => { pintarTiempo(); revisarDormir(); posicionSesion(); reportar(); });
  audio.addEventListener("play", () => { iconoPlay(); vig.reiniciar(); });
  audio.addEventListener("pause", () => { iconoPlay(); reportar(true); });
  audio.addEventListener("ended", () => { iconoPlay(); reportar(true); });

  // Link vencido (más de 6 h en pausa): pide uno nuevo y sigue donde iba.
  let reintentos = 0;
  audio.addEventListener("error", async () => {
    if (reintentos++ > 2) return aviso("No se pudo cargar el audio. Revisa tu conexión.", "error");
    const t = audio.currentTime, seguia = !audio.paused;
    try { const f = await datos.audio(id); audio.renovar(f, t, seguia); } catch (_) { /* sin red */ }
  });

  // ---- Controles ----
  const tocar = () => vig.interaccion();
  $("#vista-audio").addEventListener("pointerdown", tocar);
  $("#a-play").onclick = () => (audio.paused ? audio.play().catch((e) => aviso(e.message, "error")) : audio.pause());
  $("#a-atras").onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 15); };
  $("#a-adelante").onclick = () => { audio.currentTime = Math.min(dur || audio.duration || 0, audio.currentTime + 30); };
  const barra = $("#a-barra");
  barra.oninput = () => { arrastrando = true; $("#a-tiempo").textContent = reloj(Number(barra.value)); };
  barra.onchange = () => { arrastrando = false; audio.currentTime = Number(barra.value); };
  $("#a-vel").onclick = () => ponerVel(VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length] || 1);
  ctx.app.querySelectorAll("[data-ir-seg]").forEach((el) => (el.onclick = () => { audio.currentTime = Number(el.dataset.irSeg); if (audio.paused) audio.play().catch(() => {}); }));

  // ---- Temporizador para dormir ----
  let dormir = null; // { hasta: ms } | { finCap: índice }
  let relojDormir = null;
  const chipDormir = () => {
    const s = $("#a-dormir span");
    if (!dormir) { s.textContent = "Dormir"; $("#a-dormir").classList.remove("activo"); return; }
    $("#a-dormir").classList.add("activo");
    s.textContent = dormir.finCap !== undefined ? "Fin del capítulo" : reloj(Math.max(0, (dormir.hasta - Date.now()) / 1000));
  };
  const apagarSuave = () => {
    let v = 1;
    const paso = setInterval(() => {
      v -= 0.1; audio.volume = Math.max(0, v);
      if (v <= 0) { clearInterval(paso); audio.pause(); audio.volume = 1; }
    }, 400);
    dormir = null; clearInterval(relojDormir); chipDormir();
  };
  function revisarDormir() {
    if (dormir?.finCap === undefined || !caps.length) return;
    const sig = caps[dormir.finCap + 1];
    if (sig && audio.currentTime >= sig.t - 0.5) apagarSuave();
  }
  $("#a-dormir").onclick = async () => {
    const capActual = (() => { let i = 0; for (let k = 0; k < caps.length; k++) if (audio.currentTime >= caps[k].t) i = k; return i; })();
    const op = await modal(`
      <h2 class="modal-titulo">Temporizador para dormir</h2>
      <p class="texto-tenue" style="margin:0">El audio baja poco a poco y se pausa solo.</p>
      <div class="pila" style="gap:8px">
        ${[15, 30, 45, 60].map((m) => `<button class="btn btn-sec btn-bloque" data-cerrar="${m}">${m} minutos</button>`).join("")}
        ${caps.length && caps[capActual + 1] ? `<button class="btn btn-sec btn-bloque" data-cerrar="cap">Al terminar este capítulo</button>` : ""}
        ${dormir ? `<button class="btn btn-peligro btn-bloque" data-cerrar="no">Quitar temporizador</button>` : ""}
        <button class="btn-texto" data-cerrar>Cancelar</button>
      </div>`);
    if (!op || op === true) return;
    clearInterval(relojDormir);
    if (op === "no") dormir = null;
    else if (op === "cap") dormir = { finCap: capActual };
    else {
      dormir = { hasta: Date.now() + Number(op) * 60000 };
      relojDormir = setInterval(() => { if (dormir && Date.now() >= dormir.hasta) apagarSuave(); else chipDormir(); }, 1000);
    }
    chipDormir();
    if (dormir && audio.paused) audio.play().catch(() => {});
  };

  // ---- Marcadores ----
  const pintarMarcas = () => {
    const caja = $("#a-panel-marcas"); if (!caja) return;
    const n = $("#n-marcas"); if (n) n.textContent = marcadores.length;
    caja.innerHTML = marcadores.length ? marcadores.map((m) => `
      <div class="fila-cap marca">
        <button class="btn-texto" data-saltar="${m.segundo}" style="min-height:0;padding:0;font-variant-numeric:tabular-nums">${reloj(m.segundo)}</button>
        <span style="flex:1;min-width:0;text-align:left">${m.nota ? esc(m.nota) : `<span class="texto-tenue">Sin nota</span>`}</span>
        <button class="mini-btn" aria-label="Borrar marcador" data-borrar-m="${m.id}">${icono("trash", 16)}</button>
      </div>`).join("") : `<p class="texto-tenue" style="margin:4px 0">Toca <b>Marcador</b> para guardar un momento importante y volver a él cuando quieras.</p>`;
    caja.querySelectorAll("[data-saltar]").forEach((el) => (el.onclick = () => { audio.currentTime = Number(el.dataset.saltar); if (audio.paused) audio.play().catch(() => {}); }));
    caja.querySelectorAll("[data-borrar-m]").forEach((el) => (el.onclick = async () => {
      if (!(await confirmar("¿Borrar marcador?", "Se quita de tu lista.", "Borrar"))) return;
      try { await datos.borrarMarcador(el.dataset.borrarM); marcadores = marcadores.filter((m) => m.id !== el.dataset.borrarM); pintarMarcas(); }
      catch (e) { aviso(e.message, "error"); }
    }));
  };
  pintarMarcas();
  $("#a-marcar")?.addEventListener("click", async () => {
    const t = Math.floor(audio.currentTime || 0);
    const v = await formulario(`Marcador en ${reloj(t)}`, [{ nombre: "nota", etiqueta: "Nota (opcional)", tipo: "area", placeholder: "¿Qué quieres recordar de esta parte?" }], "Guardar");
    if (!v) return;
    try {
      const m = await datos.agregarMarcador(id, t, v.nota);
      marcadores = [...marcadores, m].sort((a, b2) => a.segundo - b2.segundo);
      pintarMarcas(); aviso("Marcador guardado", "ok");
      const tab = ctx.app.querySelector('[data-p="marcas"]'); if (tab) tab.click();
    } catch (e) { aviso(e.message, "error"); }
  });
  $("#a-pestanas")?.addEventListener("click", (e) => {
    const t = e.target.closest("[data-p]"); if (!t) return;
    ctx.app.querySelectorAll("#a-pestanas button").forEach((x) => x.classList.toggle("activo", x === t));
    $("#a-panel-caps").hidden = t.dataset.p !== "caps";
    $("#a-panel-marcas").hidden = t.dataset.p !== "marcas";
  });

  // ---- Pantalla bloqueada / otra app (Media Session) ----
  const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
  let ultimaPos = 0;
  function posicionSesion() {
    if (!ms?.setPositionState || !dur || Date.now() - ultimaPos < 4000) return;
    ultimaPos = Date.now();
    try { ms.setPositionState({ duration: dur, playbackRate: vel, position: Math.min(dur, audio.currentTime || 0) }); } catch (_) { /* nada */ }
  }
  if (ms) {
    try {
      ms.metadata = new MediaMetadata({
        title: b.titulo, artist: b.autor || "Academia del Buen Café", album: "Academia del Buen Café",
        artwork: [{ src: b.portada_url || new URL("img/icon-512.png", location.href).href, sizes: "512x512" }],
      });
      const accion = (n, fn) => { try { ms.setActionHandler(n, fn); } catch (_) { /* no soportado */ } };
      accion("play", () => { vig.interaccion(); audio.play().catch(() => {}); });
      accion("pause", () => { vig.interaccion(); audio.pause(); });
      accion("seekbackward", (d) => { vig.interaccion(); audio.currentTime = Math.max(0, audio.currentTime - (d?.seekOffset || 15)); });
      accion("seekforward", (d) => { vig.interaccion(); audio.currentTime = Math.min(dur, audio.currentTime + (d?.seekOffset || 30)); });
      accion("seekto", (d) => { vig.interaccion(); if (d?.seekTime !== undefined) audio.currentTime = d.seekTime; });
    } catch (_) { /* navegador sin Media Session */ }
  }

  // ---- "¿Sigues escuchando?" ----
  const vig = crearVigilanteAudio({
    activo: !vp,
    minutos: SIGUES_MIN(),
    sonando: () => !audio.paused,
    pausar: () => audio.pause(),
    reanudar: () => audio.play().catch(() => {}),
  });

  // ---- Avance y puntos ----
  let ultimoEnvio = 0, enviando = false, ultimoEnviado = -1;
  async function reportar(forzar = false) {
    if (vp || enviando) return;
    const seg = Math.floor(audio.currentTime || 0);
    if (!forzar && Date.now() - ultimoEnvio < 15000) return;
    if (seg === ultimoEnviado) return;
    enviando = true; ultimoEnvio = Date.now(); ultimoEnviado = seg;
    try {
      const r = await datos.registrarAudio(id, seg, dur);
      if (r?.recien_completado) {
        completado = true;
        const est = document.getElementById("estado-audio");
        if (est) est.innerHTML = estadoHTML({ ...b, duracion_seg: dur }, true);
        confeti({ cantidad: 220, duracion: 3000 });
        await modal(`
          <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
            <div class="etiqueta" style="color:var(--oro)">¡Audiolibro terminado!</div>
            <div class="destellos"><div class="medalla medalla-oro">${icono("audifonos", 46)}</div></div>
            <h2 class="modal-titulo">${esc(b.titulo)}</h2>
            <p class="modal-texto">Lo escuchaste de principio a fin. Ahora lo importante: llévalo a tu día a día.</p>
            ${r.puntos_ganados ? `<b style="color:var(--oro);font-size:18px">+${num(r.puntos_ganados)} pts</b>` : ""}
            <button class="btn btn-bloque" data-cerrar>Seguir</button>
          </div>`, { clase: "desbloqueo" });
      } else if (r?.puntos_ganados > 0) {
        momento({ icono: "audifonos", titulo: `+${num(r.puntos_ganados)} pts`, texto: "Sigue escuchando, vas muy bien.", tono: "oro", duracion: 2600 });
      }
      if (r?.insignias_nuevas?.length || r?.recien_completado) { await ctx.celebrar(r.insignias_nuevas); await ctx.revisarNivelYRacha(); }
    } catch (e) {
      console.warn(e);
      if (e.codigo === "SESION_REEMPLAZADA") { enviando = false; audio.pause(); return ctx.expulsar(); }
    } finally { enviando = false; }
  }
  const alOcultar = () => { if (document.visibilityState === "hidden") reportar(true); };
  document.addEventListener("visibilitychange", alOcultar);
  window.addEventListener("pagehide", alOcultar);

  ctx.estado.limpieza = async () => {
    vig.detener(); clearInterval(relojDormir);
    document.removeEventListener("visibilitychange", alOcultar);
    window.removeEventListener("pagehide", alOcultar);
    audio.pause();
    await reportar(true);
    audio.liberar();
    if (ms) { try { ["play", "pause", "seekbackward", "seekforward", "seekto"].forEach((n) => ms.setActionHandler(n, null)); ms.metadata = null; } catch (_) { /* nada */ } }
  };
}

// Reproduce un audiolibro de uno o varios archivos como si fuera uno solo:
// el tiempo, la barra y los capítulos son del libro completo.
function crearLista(fuente, durBase) {
  const el = new Audio();
  el.preload = "metadata";
  let pistas = (fuente.pistas && fuente.pistas.length ? fuente.pistas : [{ url: fuente.url, dur: durBase }]).map((p) => ({ ...p }));
  const multi = pistas.length > 1;
  const calcular = () => { let acc = 0; pistas.forEach((p) => { p.inicio = acc; acc += Number(p.dur) || 0; }); };
  calcular();
  let i = 0, buscando = null, rate = 1;
  const oyentes = {};
  const emitir = (tipo) => (oyentes[tipo] || []).slice().forEach((o) => { o.fn(); if (o.once) oyentes[tipo] = oyentes[tipo].filter((x) => x !== o); });
  const cargar = (k, t = 0, seguir = false) => { i = k; buscando = { t, seguir }; el.src = pistas[k].url; el.playbackRate = rate; };
  const indice = (t) => { for (let k = pistas.length - 1; k >= 0; k--) if (t >= pistas[k].inicio) return k; return 0; };

  el.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(el.duration) && el.duration > 0 && Math.abs(el.duration - (Number(pistas[i].dur) || 0)) > 1) { pistas[i].dur = el.duration; calcular(); }
    if (buscando) {
      const { t, seguir } = buscando; buscando = null;
      if (t > 0) el.currentTime = Math.min(t, Math.max(0, el.duration - 0.5));
      el.playbackRate = rate;
      if (seguir) el.play().catch(() => {});
    }
    emitir("loadedmetadata");
  });
  el.addEventListener("ended", () => { if (i < pistas.length - 1) cargar(i + 1, 0, true); else emitir("ended"); });
  el.addEventListener("pause", () => { if (buscando || (el.ended && i < pistas.length - 1)) return; emitir("pause"); });
  ["timeupdate", "play", "error"].forEach((t) => el.addEventListener(t, () => emitir(t)));
  cargar(0, 0, false);

  return {
    multi,
    get duration() { return pistas.reduce((a, p) => a + (Number(p.dur) || 0), 0) || el.duration || 0; },
    get currentTime() { return pistas[i].inicio + (buscando ? buscando.t : el.currentTime || 0); },
    set currentTime(t) {
      t = Math.max(0, Number(t) || 0);
      const k = indice(t), local = t - pistas[k].inicio;
      if (k === i && !buscando) el.currentTime = local;
      else cargar(k, local, buscando ? buscando.seguir : !el.paused);
    },
    get paused() { return buscando ? !buscando.seguir : el.paused; },
    play() { if (buscando) { buscando.seguir = true; return Promise.resolve(); } return el.play(); },
    pause() { if (buscando) buscando.seguir = false; el.pause(); },
    get playbackRate() { return rate; },
    set playbackRate(v) { rate = v; el.playbackRate = v; },
    set defaultPlaybackRate(v) { el.defaultPlaybackRate = v; },
    get volume() { return el.volume; },
    set volume(v) { el.volume = v; },
    addEventListener(tipo, fn, opciones) { (oyentes[tipo] ||= []).push({ fn, once: !!opciones?.once }); },
    // Links nuevos (el anterior caducó): sigue en el mismo segundo.
    renovar(f, t, seguir) {
      const nuevas = f.pistas && f.pistas.length ? f.pistas : [{ url: f.url }];
      pistas.forEach((p, k) => { if (nuevas[k]) p.url = nuevas[k].url; });
      const k = indice(t); cargar(k, t - pistas[k].inicio, seguir);
    },
    liberar() { el.pause(); el.removeAttribute("src"); try { el.load(); } catch (_) { /* nada */ } },
  };
}

function estadoHTML(b, completado) {
  return completado
    ? `<span class="leccion-estado hecho">${icono("check", 16)}</span><div><b>Audiolibro terminado</b><div class="texto-tenue">Puedes volver a escucharlo cuando quieras.</div></div>`
    : `<span class="leccion-estado pend">${icono("audifonos", 16)}</span><div><b>${b.valor ? `Vale hasta <span style="color:var(--oro)">${num(b.valor)} pts</span>` : "Escúchalo completo"}</b><div class="texto-tenue">Ganas puntos por cada minuto escuchado. Funciona con la pantalla apagada y retomas donde te quedaste.</div></div>`;
}

// Cada N minutos sin tocar nada: suena un aviso suave, se pausa y pregunta.
function crearVigilanteAudio({ activo, minutos, sonando, pausar, reanudar }) {
  let ultima = Date.now(), abierto = null, vivo = true;
  const limite = minutos * 60000;
  const campana = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
      [[660, 0], [880, 0.28]].forEach(([f, d]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f; o.type = "sine"; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, ac.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + d + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.6);
        o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.65);
      });
      setTimeout(() => ac.close(), 1500);
    } catch (_) { /* sin audio */ }
  };
  const preguntar = () => {
    pausar(); campana();
    if ("vibrate" in navigator) try { navigator.vibrate([120, 80, 120]); } catch (_) { /* nada */ }
    const p = modal(`
      <div class="pila" style="align-items:center;text-align:center">
        <div class="medalla medalla-cobre" style="width:72px;height:72px">${icono("audifonos", 34)}</div>
        <h2 class="modal-titulo">¿Sigues escuchando?</h2>
        <p class="modal-texto">Pausamos el audiolibro para que no avance sin ti. Mientras esté en pausa no se suman puntos.</p>
      </div>
      <button class="btn btn-bloque" data-cerrar="si">Sí, continuar</button>`, { cerrable: false });
    abierto = modal.actual;
    p.then(() => { abierto = null; ultima = Date.now(); if (vivo) reanudar(); });
  };
  const reloj30 = setInterval(() => {
    if (!activo || !vivo || abierto) return;
    if (!sonando()) return;
    if (Date.now() - ultima >= limite) preguntar();
  }, 5000);
  return {
    interaccion() { ultima = Date.now(); if (abierto) { const c = abierto; abierto = null; c.cerrar("si"); } },
    reiniciar() { if (!abierto && Date.now() - ultima > limite) ultima = Date.now(); },
    detener() { vivo = false; clearInterval(reloj30); },
  };
}
