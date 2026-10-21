// =====================================================================
//  AUDIOLIBROS (admin) · lista, agregar desde Bunny Storage, capítulos,
//  asignación y avisos por WhatsApp.
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, num, duracion, reloj, fechaCorta, aviso, modal, confirmar, formulario, nombreArea, nombreCategoria, opcionesCategoria, categorias, slug } from "./ui.js";
import { valorAudio } from "./puntos.js";
import { recargar, elegirAsignacion, avisarCurso } from "./admin.js";
import { portadaHTML } from "./audio.js";

const pesoMB = (b) => (b ? `${(b / 1048576).toFixed(b > 104857600 ? 0 : 1)} MB` : "");
// "02-el_arte-de-servir.m4b" → "El arte de servir"
function tituloDeArchivo(nombre) {
  const t = String(nombre).replace(/\.[a-z0-9]+$/i, "").replace(/^\d+[\s._-]*/, "").replace(/[._-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : nombre;
}
// "1:02:30" | "62:30" | "90" → segundos
function aSegundos(txt) {
  const p = String(txt || "").trim().split(":").map((x) => Number(x));
  if (!p.length || p.some((x) => !Number.isFinite(x) || x < 0)) return null;
  return p.reduce((a, x) => a * 60 + x, 0);
}

function guiaBunny(extra = "") {
  return `<div class="tarjeta pila guia-bunny" style="gap:10px">
    <b style="font-size:16px">${icono("audifonos", 18)} Preparar Bunny para audiolibros (una sola vez)</b>
    ${extra ? `<p class="error-form" style="margin:0">${esc(extra)}</p>` : ""}
    <ol class="pasos">
      <li><b>Supabase → SQL Editor:</b> corre el archivo <code>05_academia_audiolibros.sql</code>.</li>
      <li><b>Bunny → Storage → Add Storage Zone:</b> nombre <code>academia-audio</code>, tipo Standard, región la más cercana.</li>
      <li>En esa zona entra a <b>FTP &amp; API Access</b> y copia el <b>Password</b>.</li>
      <li><b>Bunny → CDN → Add Pull Zone:</b> origen tipo <i>Storage Zone</i> → <code>academia-audio</code>. Copia su hostname (ej. <code>academia-audio.b-cdn.net</code>).</li>
      <li>En la Pull Zone: <b>Security → Token Authentication</b> → actívalo y copia la <b>Url Token Authentication Key</b>.</li>
      <li><b>Supabase → Edge Functions → Secrets:</b> agrega <code>BUNNY_STORAGE_ZONE</code>, <code>BUNNY_STORAGE_KEY</code>, <code>BUNNY_AUDIO_HOST</code>, <code>BUNNY_AUDIO_TOKEN_KEY</code> (y <code>BUNNY_STORAGE_HOST</code> solo si tu región no es Falkenstein, ej. <code>ny.storage.bunnycdn.com</code>).</li>
      <li>Despliega la función <code>academia-audio</code>.</li>
      <li>Sube tus MP3/M4B a la Storage Zone (arrastrar y soltar). Usa nombres sin acentos ni espacios, ej. <code>liderazgo/lider-de-turno.m4b</code>.</li>
    </ol>
  </div>`;
}

// ---------------------------------------------------------------------
//  LISTA
// ---------------------------------------------------------------------
export async function pintarAudiolibrosAdmin(main, ctx) {
  let libros;
  try { libros = await datos.adminAudiolibros(); }
  catch (e) {
    if (e.codigo !== "SIN_TABLA") throw e;
    main.innerHTML = `<h1 class="titulo-pagina">Audiolibros</h1>${guiaBunny("Todavía no está creada la parte de audiolibros en Supabase (paso 1 de la guía).")}`;
    return;
  }
  const grupos = categorias().map((c) => ({ ...c, items: libros.filter((b) => (b.categoria || "general") === c.id) }))
    .concat([{ id: "_otras", nombre: "Otras", items: libros.filter((b) => !categorias().some((c) => c.id === (b.categoria || "general"))) }])
    .filter((g) => g.items.length);
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina">Audiolibros</h1>
      <div class="fila" style="flex-wrap:wrap">
        <button class="btn btn-sec" id="guia">${icono("q", 18)}Ayuda</button>
        <button class="btn btn-sec" id="agregar">${icono("plus", 18)}Elegir de Bunny</button>
        <button class="btn" id="subir">${icono("audifonos", 18)}Subir desde mi compu o cel</button>
      </div>
    </div>
    <p class="texto-tenue" style="margin:0">Elige uno o varios MP3/M4B (o una carpeta completa) y se suben solos a Bunny. Cada archivo se vuelve un audiolibro en borrador. Se asignan igual que los cursos y dan puntos por cada minuto escuchado.</p>
    ${grupos.length ? grupos.map((g) => `
      <div class="fila-entre"><h2>${esc(g.nombre)}</h2><span class="texto-tenue" style="font-size:12px">${g.items.length} audiolibro(s)</span></div>
      <div class="rejilla">${g.items.map((b) => `
        <a class="tarjeta-borde fila" href="#/admin/audio/${b.id}" style="gap:12px;text-decoration:none;color:inherit;align-items:center">
          ${portadaHTML(b, "chica")}
          <div style="flex:1;min-width:0"><div class="fila-entre" style="gap:8px;align-items:flex-start"><b>${esc(b.titulo)}</b>
            <span class="pildora ${b.publicado ? "pildora-ok" : ""}">${b.publicado ? "Publicado" : "Borrador"}</span></div>
            <span class="texto-tenue" style="font-size:12px">${b.autor ? esc(b.autor) + " · " : ""}${b.duracion_seg ? duracion(b.duracion_seg) : "duración pendiente"} · ${b.asignaciones ? `${b.asignaciones} asignación(es)` : "sin asignar"}</span></div>
        </a>`).join("")}</div>`).join("")
    : `<div class="vacio"><strong>Aún no hay audiolibros</strong>Dale <b>Agregar audiolibro</b> y elige el archivo que subiste a Bunny.</div>`}`;
  main.querySelector("#guia").onclick = () => modal(`${guiaBunny()}<button class="btn btn-bloque" data-cerrar>Entendido</button>`, { clase: "modal-ancho" });
  main.querySelector("#agregar").onclick = () => agregarAudiolibro(libros, ctx);
  main.querySelector("#subir").onclick = () => subirAudiolibros(libros);
}

// ---------------------------------------------------------------------
//  SUBIR DESDE LA COMPU O EL CEL (uno o varios archivos, o una carpeta)
// ---------------------------------------------------------------------
const EXT_AUDIO = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac)$/i;
const tamano = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
const nombreArchivo = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "audiolibro";
const movil = /iPhone|iPad|Android/i.test(navigator.userAgent);

async function subirAudiolibros(libros) {
  let lista = [];
  const p = modal(`
    <div class="fila-entre"><h2 class="modal-titulo">Subir audiolibros</h2><button class="btn-icono" data-cerrar aria-label="Cerrar">${icono("x")}</button></div>
    <p class="texto-tenue" style="margin:0">Cada archivo de audio se convierte en un audiolibro (en borrador). Si un libro está en un solo MP3 o M4B, perfecto.</p>
    <div class="fila" style="flex-wrap:wrap">
      <label class="btn">${icono("audifonos", 18)}Elegir archivos<input type="file" id="sa-archivos" multiple accept="audio/*,.mp3,.m4a,.m4b,.aac,.ogg,.opus,.wav,.flac" hidden></label>
      ${movil ? "" : `<label class="btn btn-sec">${icono("book", 18)}Elegir carpeta<input type="file" id="sa-carpeta" webkitdirectory multiple hidden></label>`}
    </div>
    <form class="form" id="sa-form" novalidate hidden>
      <div class="fila" style="flex-wrap:wrap;gap:12px;align-items:flex-start">
        <label class="campo" style="flex:1 1 180px"><span>Categoría</span><select name="categoria">${opcionesCategoria().map(([v, t]) => `<option value="${esc(v)}" ${v === "general" ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        <label class="campo" style="flex:1 1 180px"><span>Autor (opcional, para todos)</span><input name="autor" placeholder="Ej. John C. Maxwell"></label>
      </div>
      <span class="etiqueta">Títulos (puedes corregirlos)</span>
      <div class="lista-personas" id="sa-lista" style="max-height:40vh"></div>
      <p class="error-form" hidden></p>
      <div class="fila-botones">
        <button type="button" class="btn btn-sec" data-cerrar="">Cancelar</button>
        <button type="submit" class="btn" id="sa-ok">Subir</button>
      </div>
    </form>`, { clase: "modal-ancho" });
  const capa = modal.actual, form = capa.querySelector("#sa-form");
  const pintar = () => {
    form.hidden = !lista.length;
    capa.querySelector("#sa-lista").innerHTML = lista.map((x, i) => `
      <div class="fila-subida">
        ${icono("audifonos", 18)}
        <span style="flex:1;min-width:0"><input class="buscar-persona" data-titulo="${i}" value="${esc(x.titulo)}" aria-label="Título">
          <small>${esc(x.file.name)} · ${tamano(x.file.size)}</small></span>
        <button type="button" class="mini-btn" aria-label="Quitar" data-quitar="${i}">${icono("x", 16)}</button>
      </div>`).join("");
    capa.querySelector("#sa-ok").textContent = `Subir ${lista.length} audiolibro${lista.length === 1 ? "" : "s"}`;
    capa.querySelectorAll("[data-titulo]").forEach((inp) => (inp.oninput = () => { lista[Number(inp.dataset.titulo)].titulo = inp.value; }));
    capa.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => { lista.splice(Number(b.dataset.quitar), 1); pintar(); }));
  };
  const agregarArchivos = (files) => {
    const nuevos = [...files].filter((f) => EXT_AUDIO.test(f.name) && !(f.webkitRelativePath || f.name).split("/").some((q) => q.startsWith(".")))
      .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "es", { numeric: true }));
    if (!nuevos.length) return aviso("No encontré archivos de audio (MP3, M4A, M4B…)", "error");
    const ya = new Set(lista.map((x) => x.file.name + x.file.size));
    lista.push(...nuevos.filter((f) => !ya.has(f.name + f.size)).map((f) => ({ file: f, titulo: tituloDeArchivo(f.name) })));
    pintar();
  };
  capa.querySelector("#sa-archivos").onchange = (e) => { agregarArchivos(e.target.files); e.target.value = ""; };
  capa.querySelector("#sa-carpeta")?.addEventListener("change", (e) => { agregarArchivos(e.target.files); e.target.value = ""; });
  let pedido = null;
  form.onsubmit = (e) => {
    e.preventDefault();
    const err = form.querySelector(".error-form");
    if (lista.some((x) => !x.titulo.trim())) { err.textContent = "Todos necesitan título"; err.hidden = false; return; }
    pedido = { categoria: form.elements.categoria.value || "general", autor: form.elements.autor.value.trim() || null };
    capa.cerrar("ok");
  };
  await p;
  if (!pedido || !lista.length) return;
  await ejecutarSubidaAudio(lista, pedido, libros);
  recargar();
}

async function ejecutarSubidaAudio(lista, { categoria, autor }, libros) {
  const usadas = new Set(libros.map((b) => b.archivo));
  const items = lista.map((x, i) => {
    const ext = (x.file.name.match(EXT_AUDIO) || [".mp3"])[0].toLowerCase();
    let base = `${slug(categoria).replace(/_/g, "-")}/${nombreArchivo(x.titulo)}`, ruta = base + ext, n = 2;
    while (usadas.has(ruta)) ruta = `${base}-${n++}${ext}`;
    usadas.add(ruta);
    return { ...x, i, ruta, estado: "espera", subidos: 0 };
  });
  const total = items.reduce((a, x) => a + x.file.size, 0);
  modal(`
    <h2 class="modal-titulo">Subiendo audiolibros</h2>
    <p class="texto-tenue" style="margin:0">No cierres esta pantalla ni dejes que el equipo se duerma hasta que termine.</p>
    <div class="pila" style="gap:6px">
      <div class="fila-entre"><b id="su-estado">Preparando…</b><b id="su-pct" style="color:var(--oro)">0%</b></div>
      <div class="barra"><i id="su-barra" style="width:0%"></i></div>
      <span class="texto-tenue" id="su-bytes">0 de ${tamano(total)}</span>
    </div>
    <div class="lista-personas" style="max-height:40vh">${items.map((x) => `
      <div class="fila" id="su-${x.i}" style="padding:8px 10px;border-radius:10px;background:var(--tarjeta-2);gap:10px">
        <span class="su-ic" style="flex:none;color:var(--arena)">${icono("clock", 16)}</span>
        <span style="flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.titulo)}</span>
        <span class="su-pct texto-tenue" style="font-size:12px;min-width:48px;text-align:right">—</span></div>`).join("")}</div>
    <div class="fila-botones" id="su-botones"></div>`, { cerrable: false, clase: "modal-ancho" });
  const capa = modal.actual, $ = (q) => capa.querySelector(q);
  let activo = true, bloqueo = null;
  const antesDeSalir = (e) => { if (activo) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", antesDeSalir);
  try { bloqueo = await navigator.wakeLock?.request("screen"); } catch (_) { /* no soportado */ }
  const fila = (x) => {
    const el = capa.querySelector(`#su-${x.i}`); if (!el) return;
    const [ic, color] = { espera: ["clock", "var(--arena)"], subiendo: ["audifonos", "var(--oro)"], listo: ["check", "var(--verde)"], error: ["x", "var(--alerta-texto)"] }[x.estado];
    el.querySelector(".su-ic").innerHTML = icono(ic, 16); el.querySelector(".su-ic").style.color = color;
    el.querySelector(".su-pct").textContent = x.estado === "listo" ? "Listo" : x.estado === "error" ? "Error" : x.estado === "subiendo" ? Math.floor((x.subidos / (x.file.size || 1)) * 100) + "%" : "—";
  };
  const totalUI = () => {
    const sub = items.reduce((a, x) => a + (x.estado === "listo" ? x.file.size : x.subidos), 0);
    const pct = Math.min(100, Math.floor((sub / (total || 1)) * 100));
    $("#su-barra").style.width = pct + "%"; $("#su-pct").textContent = pct + "%";
    $("#su-bytes").textContent = `${tamano(sub)} de ${tamano(total)}`;
  };
  let ok = 0;
  const errores = [];
  for (const x of items) {
    x.estado = "subiendo"; fila(x);
    $("#su-estado").textContent = `Subiendo ${x.i + 1} de ${items.length}…`;
    try {
      const dur = await medirDuracion(URL.createObjectURL(x.file));
      await datos.subirAudio(x.file, x.ruta, (cargado) => { x.subidos = cargado; fila(x); totalUI(); });
      await datos.guardarAudiolibro({ titulo: x.titulo.trim(), autor, categoria, descripcion: null, portada_url: null, archivo: x.ruta, duracion_seg: dur, capitulos: [], publicado: false });
      x.estado = "listo"; ok++;
    } catch (e) {
      console.error(e); x.estado = "error"; errores.push(`${x.titulo}: ${e.message}`);
    }
    fila(x); totalUI();
  }
  activo = false; window.removeEventListener("beforeunload", antesDeSalir); bloqueo?.release?.();
  $("#su-estado").textContent = errores.length ? `Listo: ${ok} de ${items.length}` : "¡Todos subidos!";
  $("#su-botones").innerHTML = `${errores.length ? `<p class="error-form" style="margin:0;flex:1 1 100%">${errores.map(esc).join("<br>")}</p>` : ""}
    <button class="btn btn-bloque" data-cerrar>Ver audiolibros</button>`;
  if (!errores.length) aviso(`${ok} audiolibro${ok === 1 ? "" : "s"} en borrador. Ahora asígnalos y publícalos.`, "ok");
  await new Promise((r) => capa.querySelector("[data-cerrar]").addEventListener("click", r, { once: true }));
  capa.cerrar?.(true);
}

// Medir la duración real del archivo (lee solo el inicio del archivo).
function medirDuracion(url) {
  return new Promise((ok) => {
    const a = new Audio(); let listo = false;
    const fin = (v) => { if (listo) return; listo = true; a.removeAttribute("src"); try { a.load(); } catch (_) { /* nada */ } ok(v); };
    a.preload = "metadata";
    a.onloadedmetadata = () => fin(Number.isFinite(a.duration) ? Math.round(a.duration) : null);
    a.onerror = () => fin(null);
    setTimeout(() => fin(null), 20000);
    a.src = url;
  });
}

async function agregarAudiolibro(libros, ctx) {
  const usados = new Set(libros.map((b) => b.archivo));
  let carpeta = "", elegido = null;
  const p = modal(`
    <div class="fila-entre"><h2 class="modal-titulo">Elige el archivo</h2><button class="btn-icono" data-cerrar aria-label="Cerrar">${icono("x")}</button></div>
    <div id="ab-cuerpo"></div>`, { clase: "modal-ancho" });
  const capa = modal.actual, cuerpo = capa.querySelector("#ab-cuerpo");
  const abrir = async (c) => {
    carpeta = c;
    cuerpo.innerHTML = `<div class="cargando" style="min-height:140px"><div class="taza-carga"></div></div>`;
    try {
      const r = await datos.audiosBunny(c);
      const migas = ["", ...(c ? c.split("/") : [])];
      cuerpo.innerHTML = `
        <div class="migas">${migas.map((m, i) => `<button class="btn-texto" data-carpeta="${esc(migas.slice(1, i + 1).join("/"))}">${i === 0 ? "Storage" : esc(m)}</button>`).join(`<span class="texto-tenue">/</span>`)}</div>
        <div class="lista-personas" style="max-height:50vh">${r.items.length ? r.items.map((x) => x.carpeta
          ? `<button class="persona-check" data-carpeta="${esc(x.ruta)}">${icono("book", 20)}<span style="flex:1;text-align:left"><b>${esc(x.nombre)}</b><small>Carpeta</small></span>${icono("next", 18)}</button>`
          : `<button class="persona-check ${usados.has(x.ruta) ? "ya" : ""}" data-archivo="${esc(x.ruta)}" data-nombre="${esc(x.nombre)}" ${usados.has(x.ruta) ? "disabled" : ""}>
              ${icono("audifonos", 20)}<span style="flex:1;min-width:0;text-align:left"><b>${esc(x.nombre)}</b><small>${pesoMB(x.bytes)}${x.cambiado ? " · " + fechaCorta(String(x.cambiado).slice(0, 10)) : ""}</small></span>
              ${usados.has(x.ruta) ? `<span class="pildora">Ya agregado</span>` : icono("next", 18)}</button>`).join("")
          : `<p class="texto-tenue">No hay archivos de audio en esta carpeta.</p>`}</div>
        <small class="ayuda">¿No ves tu archivo? Súbelo primero a tu Storage Zone en Bunny (arrastrar y soltar) y vuelve a abrir esta ventana.</small>`;
      cuerpo.querySelectorAll("[data-carpeta]").forEach((b) => (b.onclick = () => abrir(b.dataset.carpeta)));
      cuerpo.querySelectorAll("[data-archivo]").forEach((b) => (b.onclick = () => { elegido = { ruta: b.dataset.archivo, nombre: b.dataset.nombre }; capa.cerrar("ok"); }));
    } catch (e) {
      cuerpo.innerHTML = `${guiaBunny(e.message)}
        <button class="btn btn-sec btn-bloque" id="diag">${icono("refresh", 18)}Revisar conexión con Bunny</button>
        <div id="diag-res"></div>`;
      cuerpo.querySelector("#diag").onclick = async () => {
        const caja = cuerpo.querySelector("#diag-res");
        caja.innerHTML = `<div class="cargando" style="min-height:60px"><div class="taza-carga"></div></div>`;
        try {
          const r = await datos.diagnosticoAudio();
          caja.innerHTML = `<div class="tarjeta pila" style="gap:6px"><b>Así ve la función tus secretos:</b>${Object.entries(r).map(([k, v]) =>
            `<div class="fila-entre" style="gap:10px;font-size:13px"><code>${esc(k)}</code><span style="color:${/falta/.test(v) ? "var(--alerta-texto)" : "var(--verde-texto)"};text-align:right;word-break:break-all">${esc(v)}</span></div>`).join("")}
            <small class="ayuda">La función sí responde. Si todo dice "ok", revisa que el Password y la región (hostname) sean los de esta Storage Zone.</small></div>`;
        } catch (err) {
          caja.innerHTML = `<p class="error-form">La función no responde: ${esc(err.message)}. Vuelve a desplegar <code>academia-audio</code> con el código nuevo.</p>`;
        }
      };
    }
  };
  abrir("");
  await p;
  if (!elegido) return;
  const v = await formulario("Datos del audiolibro", [
    { nombre: "titulo", etiqueta: "Título", valor: tituloDeArchivo(elegido.nombre), requerido: true },
    { nombre: "autor", etiqueta: "Autor (opcional)" },
    { nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: opcionesCategoria(), valor: "general" },
    { nombre: "descripcion", etiqueta: "¿De qué trata? (opcional)", tipo: "area" },
    { nombre: "portada_url", etiqueta: "Link de la portada (opcional)", placeholder: "https://…/portada.jpg", ayuda: "Si lo dejas vacío, se genera una portada con los colores de la Academia." },
  ], "Agregar");
  if (!v) return;
  aviso("Midiendo la duración…");
  let dur = null;
  try { const f = await datos.audioRuta(elegido.ruta); dur = await medirDuracion(f.url); } catch (_) { /* se mide al primer uso */ }
  try {
    const n = await datos.guardarAudiolibro({ ...v, autor: v.autor || null, descripcion: v.descripcion || null, portada_url: v.portada_url || null, archivo: elegido.ruta, duracion_seg: dur, capitulos: [], publicado: false });
    aviso(dur ? `Agregado · ${duracion(dur)}` : "Agregado (la duración se medirá al escucharlo)", "ok");
    ctx.ir(`/admin/audio/${n.id}/capitulos`);
  } catch (e) { aviso(e.message, "error"); }
}

// ---------------------------------------------------------------------
//  EDITOR
// ---------------------------------------------------------------------
export async function pintarEditorAudio(main, id, pestana = "capitulos", ctx) {
  const d = await datos.adminAudiolibro(id);
  if (!d.libro) throw new Error("Audiolibro no encontrado");
  const b = d.libro;
  const caps = [...(b.capitulos || [])].sort((x, y) => x.t - y.t);
  const v = valorAudio(b.duracion_seg, d.asignaciones.some((a) => a.fecha_limite));
  const nombrePerfil = (uid) => d.perfiles.find((p) => p.user_id === uid)?.nombre || "Persona";

  main.innerHTML = `
    <a href="#/admin/audiolibros" class="btn-texto" style="display:inline-flex;align-items:center;gap:4px;align-self:flex-start">${icono("back", 16)}Audiolibros</a>
    <div class="fila" style="gap:16px;align-items:flex-start;flex-wrap:wrap">
      ${portadaHTML(b, "media")}
      <div class="pila" style="gap:4px;flex:1 1 260px">
        <span class="etiqueta">${esc(nombreCategoria(b.categoria))} · ${b.publicado ? "Publicado" : "Borrador"}</span>
        <h1 class="titulo-pagina">${esc(b.titulo)}</h1>
        <span class="texto-tenue">${b.autor ? esc(b.autor) + " · " : ""}${b.duracion_seg ? duracion(b.duracion_seg) : "duración pendiente"} · ${caps.length} capítulos${b.duracion_seg ? ` · <b style="color:var(--oro)">vale hasta ${num(v.total)} pts</b>` : ""}</span>
        <span class="texto-tenue" style="font-size:12px">${icono("file", 12)} ${esc(b.archivo)}</span>
      </div>
    </div>
    <div class="fila" style="flex-wrap:wrap">
      <a class="btn btn-sec" href="#/admin/ver/audio/${b.id}">${icono("eye", 18)}Ver como empleado</a>
      <button class="btn btn-sec" id="editar">${icono("edit", 18)}Datos</button>
      <button class="btn ${b.publicado ? "btn-sec" : ""}" id="publicar">${b.publicado ? "Pasar a borrador" : "Publicar"}</button>
    </div>
    ${!b.publicado ? `<div class="tarjeta texto-tenue">En borrador: los empleados lo ven en la Biblioteca solo cuando lo publiques. Marca capítulos si quieres, asígnalo y dale <b>Publicar</b>.</div>` : ""}

    <div class="pestanas" role="tablist" style="max-width:520px">
      ${[["capitulos", "Capítulos", caps.length], ["asignacion", "Asignación", d.asignaciones.length]].map(([k, t, n]) =>
        `<button data-pestana="${k}" class="${pestana === k ? "activo" : ""}" aria-selected="${pestana === k}">${t} · ${n}</button>`).join("")}
    </div>

    <section class="panel" data-panel="capitulos" ${pestana === "capitulos" ? "" : "hidden"}>
      <div class="fila-entre" style="flex-wrap:wrap"><h2>Capítulos</h2>
        <div class="fila" style="flex-wrap:wrap"><button class="btn btn-sec btn-chico" id="cap-mano">${icono("plus", 16)}A mano</button>
        <button class="btn btn-chico" id="cap-aqui" disabled>${icono("marcador", 16)}Marcar aquí</button></div></div>
      <p class="texto-tenue" style="margin:0">Opcional. Pon play, ve al minuto donde empieza cada capítulo y dale <b>Marcar aquí</b>. El empleado podrá saltar entre capítulos y usar "dormir al terminar el capítulo".</p>
      <div class="audio-admin" id="audio-admin"><div class="cargando" style="min-height:54px"><div class="taza-carga"></div></div></div>
      <div class="pila" style="gap:6px">${caps.length ? caps.map((c, i) => `
        <div class="leccion-admin">
          <span class="num-cap">${i + 1}</span>
          <div class="nombre"><b style="font-weight:600">${esc(c.titulo)}</b><small>${reloj(c.t)}</small></div>
          <button class="mini-btn" aria-label="Escuchar desde aquí" data-oir="${c.t}">${icono("play", 16)}</button>
          <button class="mini-btn" aria-label="Editar" data-editar-c="${i}">${icono("edit", 18)}</button>
          <button class="mini-btn" aria-label="Quitar" data-borrar-c="${i}">${icono("trash", 18)}</button>
        </div>`).join("") : `<span class="texto-tenue">Sin capítulos: se escucha de corrido.</span>`}</div>
    </section>

    <section class="panel" data-panel="asignacion" ${pestana === "asignacion" ? "" : "hidden"}>
      <div class="fila-entre" style="flex-wrap:wrap"><h2>¿Quién lo escucha?</h2><div class="fila" style="flex-wrap:wrap">
        ${b.publicado && d.asignaciones.length ? `<button class="btn btn-sec btn-chico" id="avisar">${icono("bell", 16)}Avisar por WhatsApp</button>` : ""}
        <button class="btn btn-chico" id="asignar">${icono("plus", 16)}Asignar</button></div></div>
      ${d.asignaciones.length ? d.asignaciones.map((a) => `
        <div class="tarjeta fila-entre" style="padding:12px">
          <div><b style="font-size:14px">${a.user_id ? esc(nombrePerfil(a.user_id)) : a.area ? esc(nombreArea(a.area)) : "Todo el equipo"}${a.sede ? " · " + esc(a.sede) : ""}</b>
            <div class="texto-tenue" style="font-size:12px">${a.obligatorio ? "Obligatorio" : "Opcional"}${a.fecha_limite ? " · vence " + fechaCorta(a.fecha_limite) : ""}</div></div>
          <button class="mini-btn" aria-label="Quitar asignación" data-borrar-a="${a.id}">${icono("trash", 18)}</button>
        </div>`).join("") : `<p class="texto-tenue" style="margin:0">Aún no está asignado a nadie. Mientras tanto, el equipo lo ve con candado en la Biblioteca (si está publicado).</p>`}
      <div style="border-top:1px solid var(--linea);padding-top:14px;margin-top:6px">
        <button class="btn btn-peligro btn-chico" id="borrar">${icono("trash", 16)}Borrar audiolibro</button>
      </div>
    </section>`;

  const guardar = async (cambios, ok) => { try { await datos.guardarAudiolibro({ id: b.id, ...cambios }); if (ok) aviso(ok, "ok"); recargar(); } catch (e) { aviso(e.message, "error"); } };
  main.querySelectorAll("[data-pestana]").forEach((t) => (t.onclick = () => {
    const k = t.dataset.pestana;
    main.querySelectorAll("[data-pestana]").forEach((x) => { x.classList.toggle("activo", x === t); x.setAttribute("aria-selected", x === t); });
    main.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== k));
    history.replaceState(null, "", `${location.pathname}${location.search}#/admin/audio/${b.id}/${k}`);
  }));

  // Reproductor para marcar capítulos.
  let reproductor = null;
  datos.audioRuta(b.archivo).then((f) => {
    const caja = main.querySelector("#audio-admin"); if (!caja) return;
    caja.innerHTML = `<audio controls preload="metadata" src="${esc(f.url)}" style="width:100%"></audio>`;
    reproductor = caja.querySelector("audio");
    main.querySelector("#cap-aqui").disabled = false;
    reproductor.addEventListener("loadedmetadata", () => {
      const real = Math.round(reproductor.duration);
      if (Number.isFinite(real) && real > 0 && Math.abs(real - (b.duracion_seg || 0)) > 2) datos.guardarAudiolibro({ id: b.id, duracion_seg: real }).catch(() => {});
    }, { once: true });
  }).catch((e) => { const caja = main.querySelector("#audio-admin"); if (caja) caja.innerHTML = `<p class="error-form" style="margin:0">No se pudo cargar el audio: ${esc(e.message)}</p>`; });

  const pedirCapitulo = async (t, titulo = "", tituloModal = "Nuevo capítulo") => formulario(tituloModal, [
    { nombre: "tiempo", etiqueta: "Empieza en (h:mm:ss o mm:ss)", valor: reloj(t), requerido: true },
    { nombre: "titulo", etiqueta: "Nombre del capítulo", valor: titulo || `Capítulo ${caps.length + 1}`, requerido: true, autofocus: true },
  ], "Guardar");
  const guardarCaps = (lista, ok) => guardar({ capitulos: lista.sort((x, y) => x.t - y.t) }, ok);
  const agregar = async (t) => {
    const r = await pedirCapitulo(t); if (!r) return;
    const s = aSegundos(r.tiempo); if (s === null) return aviso("Escribe el tiempo como 1:02:30 o 62:30", "error");
    if (b.duracion_seg && s > b.duracion_seg) return aviso("Ese minuto es más largo que el audiolibro", "error");
    guardarCaps([...caps, { t: s, titulo: r.titulo }], "Capítulo agregado");
  };
  main.querySelector("#cap-aqui").onclick = () => { if (reproductor) { reproductor.pause(); agregar(Math.floor(reproductor.currentTime)); } };
  main.querySelector("#cap-mano").onclick = () => agregar(0);
  main.querySelectorAll("[data-oir]").forEach((x) => (x.onclick = () => { if (!reproductor) return; reproductor.currentTime = Number(x.dataset.oir); reproductor.play().catch(() => {}); }));
  main.querySelectorAll("[data-editar-c]").forEach((x) => (x.onclick = async () => {
    const i = Number(x.dataset.editarC), c = caps[i];
    const r = await pedirCapitulo(c.t, c.titulo, "Editar capítulo"); if (!r) return;
    const s = aSegundos(r.tiempo); if (s === null) return aviso("Escribe el tiempo como 1:02:30 o 62:30", "error");
    guardarCaps(caps.map((y, k) => (k === i ? { t: s, titulo: r.titulo } : y)), "Guardado");
  }));
  main.querySelectorAll("[data-borrar-c]").forEach((x) => (x.onclick = async () => {
    if (!(await confirmar("¿Quitar capítulo?", "Solo se quita la marca; el audio no cambia.", "Quitar"))) return;
    guardarCaps(caps.filter((_, k) => k !== Number(x.dataset.borrarC)));
  }));

  main.querySelector("#editar").onclick = async () => {
    const r = await formulario("Datos del audiolibro", [
      { nombre: "titulo", etiqueta: "Título", valor: b.titulo, requerido: true },
      { nombre: "autor", etiqueta: "Autor", valor: b.autor },
      { nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: opcionesCategoria(), valor: b.categoria },
      { nombre: "descripcion", etiqueta: "¿De qué trata?", tipo: "area", valor: b.descripcion },
      { nombre: "portada_url", etiqueta: "Link de la portada", valor: b.portada_url, placeholder: "https://…/portada.jpg" },
    ]);
    if (r) guardar({ ...r, autor: r.autor || null, descripcion: r.descripcion || null, portada_url: r.portada_url || null }, "Guardado");
  };
  main.querySelector("#publicar").onclick = async () => {
    if (b.publicado) return guardar({ publicado: false }, "Pasó a borrador");
    if (!d.asignaciones.length && !(await confirmar("Sin asignaciones", "Lo verán en la Biblioteca con candado, pero nadie podrá escucharlo hasta que lo asignes. ¿Publicar de todos modos?", "Publicar"))) return;
    try { await datos.guardarAudiolibro({ id: b.id, publicado: true }); } catch (e) { return aviso(e.message, "error"); }
    aviso("Audiolibro publicado", "ok");
    if (d.asignaciones.length) await avisarCurso({ ...b, publicado: true }, [], d.asignaciones, "publicado", "audio");
    recargar();
  };
  main.querySelector("#asignar").onclick = async () => {
    const r = await elegirAsignacion(b, d.asignaciones, "Asignar audiolibro");
    if (!r) return;
    const base = { audiolibro_id: b.id, obligatorio: r.obligatorio, fecha_limite: r.fecha_limite };
    const filas = r.modo === "personas" ? r.ids.map((uid) => ({ ...base, area: null, sede: null, user_id: uid })) : [{ ...base, area: r.area, sede: r.sede, user_id: null }];
    const creadas = [];
    try { for (const f of filas) creadas.push((await datos.agregarAudioAsignacion(f)) || f); }
    catch (e) { aviso(e.message, "error"); if (!creadas.length) return; }
    aviso(filas.length > 1 ? `Asignado a ${creadas.length} personas` : "Asignado", "ok");
    if (b.publicado) await avisarCurso(b, [], creadas.map((a, k) => (a && a.audiolibro_id ? a : filas[k])), "asignado", "audio");
    recargar();
  };
  main.querySelector("#avisar")?.addEventListener("click", () => avisarCurso(b, [], d.asignaciones, "manual", "audio"));
  main.querySelectorAll("[data-borrar-a]").forEach((x) => (x.onclick = async () => {
    if (!(await confirmar("¿Quitar asignación?", "Esas personas dejarán de poder escucharlo (su avance se conserva).", "Quitar"))) return;
    try { await datos.borrarAudioAsignacion(x.dataset.borrarA); recargar(); } catch (e) { aviso(e.message, "error"); }
  }));
  main.querySelector("#borrar").onclick = async () => {
    if (!(await confirmar("¿Borrar este audiolibro?", "Se borra también el avance y los marcadores de todos. El archivo en Bunny no se toca.", "Borrar"))) return;
    try { await datos.borrarAudiolibro(b.id); aviso("Audiolibro borrado", "ok"); ctx.ir("/admin/audiolibros"); } catch (e) { aviso(e.message, "error"); }
  };
}
