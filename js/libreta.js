// =====================================================================
//  MI LIBRETA · apuntes del empleado (texto, nota de voz y foto) ligados
//  al minuto del video, y sus ideas propuestas a Gustavo.
//  - Si no hay señal, el apunte se guarda en el celular y se sube solo
//    cuando vuelve el internet.
//  - "Descargar respaldo" arma un .zip con todo (se abre sin internet).
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, aviso, modal, confirmar, reloj, fechaCorta } from "./ui.js";
import { crearZip } from "./zip.js";
import { confeti, momento } from "./fiesta.js";

const MAX_VOZ = 60; // segundos por nota de voz
export const ESTADOS_IDEA = {
  nueva: { txt: "Enviada a Gustavo", ic: "send", clase: "" },
  probando: { txt: "¡La vamos a probar!", ic: "flame", clase: "probando" },
  implementada: { txt: "¡Implementada!", ic: "trophy", clase: "implementada" },
  descartada: { txt: "No por ahora", ic: "x", clase: "descartada" },
};
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const errorBonito = (e) => (/academia_notas|academia_ideas|academia-libreta|relation .* does not exist|Bucket not found|PGRST205|schema cache/i.test(e?.message || "")
  ? "Falta correr el paso 10 de SQL (libreta) en Supabase" : e?.message || "Algo salió mal");

// ---------------------------------------------------------------------
//  Cola en el celular (IndexedDB) para cuando no hay señal
// ---------------------------------------------------------------------
const BD = "academia-libreta", ALMACEN = "cola";
function abrirBD() {
  return new Promise((ok, falla) => {
    if (!window.indexedDB) return falla(new Error("Sin almacenamiento"));
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falla(r.error);
  });
}
async function colaTx(modo, fn) {
  const db = await abrirBD();
  return new Promise((ok, falla) => {
    const tx = db.transaction(ALMACEN, modo);
    const r = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => ok(r?.result);
    tx.onerror = () => falla(tx.error);
  });
}
const colaPoner = (item) => colaTx("readwrite", (s) => s.put(item));
const colaQuitar = (id) => colaTx("readwrite", (s) => s.delete(id));
async function colaDe(usuario) {
  try { return ((await colaTx("readonly", (s) => s.getAll())) || []).filter((x) => x.usuario === usuario); } catch (_) { return []; }
}

async function enviarItem(item) {
  const n = { ...item.nota };
  if (item.audio) {
    n.audio_path = await datos.subirArchivoNota(item.audio.blob, `${n.id}-voz-${item.audio.t}.${item.audio.ext}`);
    n.audio_seg = item.audio.seg;
  }
  if (item.foto) n.foto_path = await datos.subirArchivoNota(item.foto.blob, `${n.id}-foto-${item.foto.t}.${item.foto.ext}`);
  const guardada = await datos.guardarNota(n);
  for (const r of item.quitar || []) await datos.quitarArchivoNota(r).catch(() => {});
  if (item.proponer) await datos.proponerIdea(n.id);
  return guardada;
}

async function guardarConCola(item) {
  try { return { nota: await enviarItem(item) }; }
  catch (e) {
    if (e.red || !navigator.onLine || /Failed to fetch|Load failed|network/i.test(e.message)) {
      await colaPoner(item);
      return { pendiente: true };
    }
    throw e;
  }
}

let enviandoCola = false;
export async function procesarColaLibreta(usuario) {
  if (enviandoCola || !usuario || !navigator.onLine) return 0;
  enviandoCola = true;
  let n = 0;
  try {
    for (const item of await colaDe(usuario)) {
      try { await enviarItem(item); await colaQuitar(item.id); n++; } catch (e) { if (e.red) break; }
    }
  } finally { enviandoCola = false; }
  if (n) aviso(n === 1 ? "Tu apunte guardado sin señal ya se subió ✓" : `${n} apuntes guardados sin señal ya se subieron ✓`, "ok");
  return n;
}
let colaIniciada = false;
export function iniciarColaLibreta(usuarioFn) {
  if (colaIniciada) return;
  colaIniciada = true;
  window.addEventListener("online", () => procesarColaLibreta(usuarioFn()));
  setTimeout(() => procesarColaLibreta(usuarioFn()), 4000);
}

// ---------------------------------------------------------------------
//  Grabadora y fotos
// ---------------------------------------------------------------------
function tipoGrabacion() {
  if (!window.MediaRecorder) return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (_) { /* sigue */ }
  }
  return "";
}
const extDe = (tipo) => (/mp4|aac|m4a/.test(tipo) ? "m4a" : /ogg/.test(tipo) ? "ogg" : "webm");

async function reducirFoto(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, falla) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falla(new Error("Esa foto no se pudo abrir")); i.src = url; });
    const escala = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala); c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.78));
    if (blob && blob.type === "image/webp") return { blob, ext: "webp" };
    blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
    return { blob, ext: "jpg" };
  } finally { URL.revokeObjectURL(url); }
}

// ---------------------------------------------------------------------
//  Editor de un apunte (nuevo o existente)
// ---------------------------------------------------------------------
// contexto: { curso_id, leccion_id, segundo, referencia }
// urls: { ruta: url } para mostrar el audio/foto que ya tiene la nota
export function editarNota({ nota = null, contexto = {}, urls = {}, idea = null, usuario }) {
  return new Promise((resolver) => {
    const n = nota || { id: nuevoId(), ...contexto, texto: "" };
    const ideaCerrada = idea && idea.estado !== "nueva";
    const tipo = tipoGrabacion();
    let voz = n.audio_path ? { ruta: n.audio_path, url: urls[n.audio_path], seg: n.audio_seg } : null;
    let foto = n.foto_path ? { ruta: n.foto_path, url: urls[n.foto_path] } : null;
    const quitar = [];
    let grabadora = null, flujo = null, trozos = [], inicio = 0, reloj1 = null;

    modal(`
      <h2 class="modal-titulo">${icono("libreta", 22, 'style="vertical-align:-4px;color:var(--oro)"')} ${nota ? "Editar apunte" : "Nuevo apunte"}</h2>
      ${n.referencia || n.segundo != null ? `<p class="texto-tenue" style="margin:-6px 0 0;font-size:13px">${esc(n.referencia || "")}${n.segundo != null ? ` · <b style="color:var(--oro)">minuto ${reloj(n.segundo)}</b>` : ""}</p>` : ""}
      <textarea id="ln-texto" class="ln-texto" rows="5" maxlength="4000" placeholder="¿Qué te llamó la atención? ¿Qué podríamos probar o mejorar en Mozzafiato?">${esc(n.texto || "")}</textarea>
      <div class="ln-adjuntos">
        <div id="ln-voz" class="ln-adjunto"></div>
        <div id="ln-foto" class="ln-adjunto"></div>
      </div>
      ${ideaCerrada ? `<p class="texto-tenue" style="margin:0;font-size:12.5px">${icono("bulb", 14)} Esta idea ya la está revisando Gustavo: los cambios quedan solo en tu libreta.</p>`
        : `<label class="check ln-idea"><input type="checkbox" id="ln-idea" ${idea ? "checked" : ""}><span>${icono("bulb", 16)} ${idea ? "Actualizar mi idea para Gustavo" : "Proponerla a Gustavo como idea"}</span></label>`}
      <p class="error-form" hidden></p>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="ln-guardar">${icono("check", 18)}Guardar</button></div>`);
    const capa = modal.actual;
    const $ = (s) => capa.querySelector(s);
    const error = $(".error-form");
    const apagar = () => { clearInterval(reloj1); try { grabadora?.state === "recording" && grabadora.stop(); } catch (_) { /* nada */ } flujo?.getTracks().forEach((t) => t.stop()); flujo = null; };

    const pintarVoz = (grabando = false) => {
      const caja = $("#ln-voz");
      if (grabando) {
        caja.innerHTML = `<div class="ln-grabando"><i class="punto-rojo"></i><b id="ln-t">0:00</b><span class="texto-tenue">/ ${reloj(MAX_VOZ)}</span>
          <button class="btn btn-chico" id="ln-parar">${icono("check", 16)}Listo</button></div>`;
        $("#ln-parar").onclick = () => grabadora?.stop();
        return;
      }
      if (voz) {
        caja.innerHTML = `<div class="ln-archivo">${icono("audifonos", 18)}${voz.url ? `<audio controls preload="metadata" src="${esc(voz.url)}"></audio>` : `<span class="texto-tenue">Nota de voz${voz.seg ? " · " + reloj(voz.seg) : ""}</span>`}
          <button class="mini-btn" id="ln-voz-quitar" aria-label="Quitar nota de voz">${icono("trash", 18)}</button></div>`;
        $("#ln-voz-quitar").onclick = () => { if (voz.ruta) quitar.push(voz.ruta); if (voz.blob && voz.url) URL.revokeObjectURL(voz.url); voz = null; pintarVoz(); };
        return;
      }
      caja.innerHTML = tipo === null
        ? `<span class="texto-tenue" style="font-size:12.5px">${icono("audifonos", 14)} Tu navegador no deja grabar audio aquí.</span>`
        : `<button class="btn btn-sec btn-chico" id="ln-grabar">${icono("mic", 16)}Nota de voz</button>`;
      $("#ln-grabar")?.addEventListener("click", grabar);
    };
    const grabar = async () => {
      error.hidden = true;
      try { flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (_) { error.textContent = "Permite el uso del micrófono para grabar (en la configuración del navegador)."; error.hidden = false; return; }
      trozos = [];
      try { grabadora = new MediaRecorder(flujo, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 24000 }); }
      catch (_) { grabadora = new MediaRecorder(flujo); }
      grabadora.ondataavailable = (e) => { if (e.data?.size) trozos.push(e.data); };
      grabadora.onstop = () => {
        const seg = Math.max(1, Math.round((Date.now() - inicio) / 1000));
        clearInterval(reloj1); flujo?.getTracks().forEach((t) => t.stop()); flujo = null;
        const mime = (grabadora.mimeType || tipo || "audio/webm").split(";")[0];
        const blob = new Blob(trozos, { type: mime });
        if (blob.size < 500) { pintarVoz(); return; }
        if (voz?.ruta) quitar.push(voz.ruta);
        voz = { blob, ext: extDe(mime), seg, t: Date.now(), url: URL.createObjectURL(blob) };
        pintarVoz();
      };
      inicio = Date.now();
      grabadora.start(1000);
      pintarVoz(true);
      reloj1 = setInterval(() => {
        const s = Math.floor((Date.now() - inicio) / 1000);
        const t = $("#ln-t"); if (t) t.textContent = reloj(s);
        if (s >= MAX_VOZ) grabadora.stop();
      }, 250);
    };
    const pintarFoto = () => {
      const caja = $("#ln-foto");
      if (foto) {
        caja.innerHTML = `<div class="ln-archivo">${foto.url ? `<img src="${esc(foto.url)}" alt="Foto del apunte">` : `<span class="texto-tenue">Foto</span>`}
          <button class="mini-btn" id="ln-foto-quitar" aria-label="Quitar foto">${icono("trash", 18)}</button></div>`;
        $("#ln-foto-quitar").onclick = () => { if (foto.ruta) quitar.push(foto.ruta); if (foto.blob && foto.url) URL.revokeObjectURL(foto.url); foto = null; pintarFoto(); };
        return;
      }
      caja.innerHTML = `<label class="btn btn-sec btn-chico">${icono("camara", 16)}Foto<input type="file" accept="image/*" hidden></label>`;
      caja.querySelector("input").onchange = async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try {
          const r = await reducirFoto(f);
          foto = { ...r, t: Date.now(), url: URL.createObjectURL(r.blob) };
          pintarFoto();
        } catch (err) { error.textContent = err.message; error.hidden = false; }
      };
    };
    pintarVoz(); pintarFoto();

    capa.addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]") || e.target === capa) { apagar(); resolver(null); } });
    $("#ln-guardar").onclick = async (ev) => {
      if (grabadora?.state === "recording") { grabadora.stop(); await new Promise((r) => setTimeout(r, 300)); }
      const texto = $("#ln-texto").value.trim();
      if (!texto && !voz && !foto) { error.textContent = "Escribe algo, graba una nota de voz o agrega una foto."; error.hidden = false; return; }
      const proponer = !!$("#ln-idea")?.checked;
      const item = {
        id: n.id, usuario, creado: Date.now(), proponer,
        nota: { id: n.id, curso_id: n.curso_id || null, leccion_id: n.leccion_id || null, segundo: n.segundo ?? null, referencia: n.referencia || null,
          texto, audio_path: voz?.ruta || null, audio_seg: voz?.ruta ? voz.seg ?? n.audio_seg : null, foto_path: foto?.ruta || null, creado_en: n.creado_en || new Date().toISOString() },
        audio: voz?.blob ? { blob: voz.blob, ext: voz.ext, seg: voz.seg, t: voz.t } : null,
        foto: foto?.blob ? { blob: foto.blob, ext: foto.ext, t: foto.t } : null,
        quitar,
      };
      const b = ev.currentTarget; b.disabled = true; b.innerHTML = "Guardando…";
      try {
        const r = await guardarConCola(item);
        apagar(); capa.cerrar(true);
        if (r.pendiente) aviso("Sin señal: el apunte quedó guardado en tu celular y se sube solo al volver el internet.");
        else aviso(proponer ? "Apunte guardado y enviado a Gustavo 💡" : "Apunte guardado ✓", "ok");
        resolver(r.nota || { ...item.nota, pendiente: true });
      } catch (e) {
        b.disabled = false; b.innerHTML = `${icono("check", 18)}Guardar`;
        error.textContent = errorBonito(e); error.hidden = false;
      }
    };
  });
}

// ---------------------------------------------------------------------
//  Dentro de la lección: "Mis apuntes" + botón Anotar en el minuto actual
// ---------------------------------------------------------------------
// video: { tiempo(), saltar(seg), pausar() }
export function montarLibretaLeccion(caja, { curso, leccion, video, usuario, tip, ir }) {
  if (!caja) return;
  const referencia = `${curso.titulo} · ${leccion.titulo}`;
  let notas = [], urls = {}, ideas = [];
  const pintar = () => {
    const mias = notas.filter((x) => x.leccion_id === leccion.id).sort((a, b) => (a.segundo ?? 0) - (b.segundo ?? 0));
    caja.innerHTML = `
      <div class="libreta-leccion">
        <div class="fila-entre" style="gap:10px">
          <div class="fila" style="gap:8px;min-width:0">${icono("libreta", 20, 'style="color:var(--oro);flex:none"')}<b>Mis apuntes</b>${mias.length ? `<span class="pildora pildora-oro" style="padding:2px 8px">${mias.length}</span>` : ""}</div>
          <button class="btn btn-chico" id="anotar">${icono("plus", 16)}Anotar</button>
        </div>
        <p class="texto-tenue" style="margin:0;font-size:13px">${tip}</p>
        ${mias.length ? `<div class="pila" style="gap:6px">${mias.map((x) => `
          <div class="apunte-mini ${x.pendiente ? "pendiente" : ""}">
            ${x.segundo != null ? `<button class="chip-tiempo" data-saltar="${x.segundo}" aria-label="Ir al minuto ${reloj(x.segundo)}">${icono("play", 12)}${reloj(x.segundo)}</button>` : ""}
            <button class="apunte-mini-texto" data-editar="${esc(x.id)}">${esc((x.texto || "").slice(0, 140)) || `<span class="texto-tenue">${x.audio_path || x.pendiente ? "Nota de voz" : ""}${x.foto_path ? " · Foto" : ""}</span>`}${(x.texto || "").length > 140 ? "…" : ""}
              <span class="apunte-iconos">${x.audio_path ? icono("mic", 13) : ""}${x.foto_path ? icono("camara", 13) : ""}${ideas.some((i) => i.nota_id === x.id) ? icono("bulb", 13) : ""}${x.pendiente ? `<em>sin subir</em>` : ""}</span></button>
          </div>`).join("")}</div>` : ""}
        <button class="btn-texto" id="ver-libreta" style="align-self:flex-start;min-height:30px">${icono("libreta", 14)} Ver toda mi libreta</button>
      </div>`;
    caja.querySelector("#anotar").onclick = async () => {
      video.pausar();
      const seg = Math.floor(video.tiempo() || 0);
      const nueva = await editarNota({ contexto: { curso_id: curso.id, leccion_id: leccion.id, segundo: seg, referencia }, usuario });
      if (nueva) { notas = [nueva, ...notas.filter((x) => x.id !== nueva.id)]; cargar(); }
    };
    caja.querySelectorAll("[data-saltar]").forEach((b) => (b.onclick = () => video.saltar(Number(b.dataset.saltar))));
    caja.querySelectorAll("[data-editar]").forEach((b) => (b.onclick = async () => {
      const x = notas.find((y) => y.id === b.dataset.editar); if (!x || x.pendiente) return;
      video.pausar();
      const r = await editarNota({ nota: x, urls, idea: ideas.find((i) => i.nota_id === x.id), usuario });
      if (r) cargar();
    }));
    caja.querySelector("#ver-libreta").onclick = () => ir("/libreta");
  };
  const cargar = async () => {
    try {
      const [ns, is, cola] = await Promise.all([datos.misNotas(), datos.misIdeas().catch(() => []), colaDe(usuario)]);
      ideas = is;
      const ids = new Set(ns.map((x) => x.id));
      notas = [...cola.filter((c) => !ids.has(c.id)).map((c) => ({ ...c.nota, pendiente: true, audio_path: c.audio ? "pendiente" : c.nota.audio_path })), ...ns];
      const mias = notas.filter((x) => x.leccion_id === leccion.id && !x.pendiente);
      urls = await datos.urlsArchivosNota(mias.flatMap((x) => [x.audio_path, x.foto_path])).catch(() => ({}));
    } catch (e) { console.warn("Libreta:", e.message); }
    pintar();
  };
  pintar();
  cargar();
}

// ---------------------------------------------------------------------
//  Pantalla "Mi libreta"
// ---------------------------------------------------------------------
export async function pintarLibreta(ctx) {
  ctx.cargando();
  const usuario = ctx.estado.perfil?.usuario;
  await procesarColaLibreta(usuario);
  let notas = [], ideas = [], cursos = [], urls = {}, errorCarga = null;
  try {
    [notas, ideas, cursos] = await Promise.all([datos.misNotas(), datos.misIdeas(), datos.misCursos().catch(() => [])]);
  } catch (e) { errorCarga = errorBonito(e); }
  const cola = await colaDe(usuario);
  const ids = new Set(notas.map((x) => x.id));
  const pendientes = cola.filter((c) => !ids.has(c.id)).map((c) => ({ ...c.nota, pendiente: true }));
  let pestana = sessionStorage.getItem("academia-libreta-pestana") === "ideas" ? "ideas" : "apuntes";
  let filtro = "";
  const titulosCurso = Object.fromEntries(cursos.map((c) => [c.id, c.titulo]));

  ctx.sinNav(`
  <main class="vista vista-completa vista-libreta">
    <div class="barra-sup">
      <button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button>
      <span class="texto-tenue" style="flex:1"></span>
      <button class="btn btn-sec btn-chico" id="como">${icono("bulb", 16)}¿Cómo funciona?</button>
      <button class="btn btn-chico" id="nueva">${icono("plus", 16)}Apunte</button>
    </div>
    <section class="libreta-cabeza">
      <div class="medalla medalla-oro" style="width:58px;height:58px;flex:none">${icono("libreta", 28)}</div>
      <div style="flex:1;min-width:0">
        <h1 class="titulo-pagina" style="font-size:26px;margin:0">Mi libreta</h1>
        <span class="texto-tenue">${notas.length + pendientes.length} ${notas.length + pendientes.length === 1 ? "apunte" : "apuntes"} · ${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"} para Gustavo</span>
      </div>
    </section>
    <div class="tip-apuntes">${icono("bulb", 18)}<span>Anota lo que te llame la atención en cada curso. Si algo puede mejorar nuestro menú o el servicio, <b>propónselo a Gustavo</b>: las ideas que se implementan ganan puntos.</span></div>
    ${errorCarga ? `<div class="tarjeta" style="border:1px solid var(--alerta)">${esc(errorCarga)}</div>` : ""}
    ${pendientes.length ? `<div class="tarjeta fila" style="gap:10px;border:1px dashed var(--oro)">${icono("clock", 18)}<span style="flex:1;font-size:13.5px">${pendientes.length} apunte(s) guardados sin señal. Se suben solos al volver el internet.</span><button class="btn btn-chico btn-sec" id="reintentar">Subir ya</button></div>` : ""}
    <div class="pestanas" id="lib-pestanas">
      <button data-p="apuntes" class="${pestana === "apuntes" ? "activo" : ""}">Apuntes</button>
      <button data-p="ideas" class="${pestana === "ideas" ? "activo" : ""}">Mis ideas${ideas.length ? ` · ${ideas.length}` : ""}</button>
    </div>
    <div id="lib-cuerpo" class="pila" style="gap:14px"></div>
    <section class="tarjeta pila" style="gap:10px">
      <b>${icono("descargar", 18, 'style="vertical-align:-3px;color:var(--oro)"')} Respaldo</b>
      <p class="texto-tenue" style="margin:0;font-size:13px">Descarga todos tus apuntes, notas de voz y fotos en un archivo .zip. Es tuyo: guárdalo en tu celular o compu. ${ultimoRespaldo(usuario) ? `Último respaldo: <b>${fechaCorta(ultimoRespaldo(usuario))}</b>.` : ""}</p>
      <button class="btn btn-sec" id="respaldo" ${notas.length ? "" : "disabled"}>${icono("descargar", 18)}Descargar mi respaldo</button>
    </section>
  </main>`);

  const app = ctx.app;
  const cuerpo = app.querySelector("#lib-cuerpo");
  const rutas = [...notas, ...ideas].flatMap((x) => [x.audio_path, x.foto_path]).filter(Boolean);
  urls = await datos.urlsArchivosNota(rutas).catch(() => ({}));

  const tarjetaNota = (x) => {
    const idea = ideas.find((i) => i.nota_id === x.id);
    const est = idea ? ESTADOS_IDEA[idea.estado] : null;
    return `
    <article class="nota-tarjeta ${x.pendiente ? "pendiente" : ""}">
      <div class="fila-entre" style="gap:8px;align-items:flex-start">
        <div style="min-width:0;flex:1">
          ${x.referencia ? `<div class="etiqueta" style="font-size:10.5px;letter-spacing:.06em">${esc(x.referencia)}</div>` : `<div class="etiqueta" style="font-size:10.5px">Apunte general</div>`}
          <small class="texto-tenue">${fechaCorta(x.creado_en)}${x.pendiente ? " · <b style='color:var(--oro)'>sin subir</b>" : ""}</small>
        </div>
        ${x.segundo != null && x.leccion_id && x.curso_id ? `<button class="chip-tiempo" data-ir-video="${esc(x.id)}">${icono("play", 12)}${reloj(x.segundo)}</button>` : ""}
      </div>
      ${x.texto ? `<p class="nota-texto">${esc(x.texto)}</p>` : ""}
      ${x.audio_path && urls[x.audio_path] ? `<audio controls preload="none" src="${esc(urls[x.audio_path])}"></audio>` : x.audio_path || (x.pendiente && cola.find((c) => c.id === x.id)?.audio) ? `<span class="texto-tenue" style="font-size:12.5px">${icono("mic", 14)} Nota de voz</span>` : ""}
      ${x.foto_path && urls[x.foto_path] ? `<button class="nota-foto" data-foto="${esc(urls[x.foto_path])}"><img src="${esc(urls[x.foto_path])}" alt="Foto" loading="lazy"></button>` : ""}
      ${x.pendiente ? "" : `<div class="fila" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">
        ${est ? `<span class="estado-idea ${est.clase}">${icono(est.ic, 13)}${est.txt}</span>` : `<button class="btn btn-chico btn-sec" data-proponer="${esc(x.id)}">${icono("bulb", 15)}Proponer a Gustavo</button>`}
        <button class="mini-btn" data-editar="${esc(x.id)}" aria-label="Editar">${icono("edit", 18)}</button>
        <button class="mini-btn" data-borrar="${esc(x.id)}" aria-label="Borrar">${icono("trash", 18)}</button>
      </div>`}
    </article>`;
  };
  const tarjetaIdea = (i) => {
    const est = ESTADOS_IDEA[i.estado] || ESTADOS_IDEA.nueva;
    return `
    <article class="nota-tarjeta idea ${est.clase}">
      <div class="fila-entre" style="gap:8px">
        <span class="estado-idea ${est.clase}">${icono(est.ic, 13)}${est.txt}</span>
        <small class="texto-tenue">${fechaCorta(i.creado_en)}</small>
      </div>
      ${i.referencia ? `<div class="etiqueta" style="font-size:10.5px">${esc(i.referencia)}</div>` : ""}
      ${i.texto ? `<p class="nota-texto">${esc(i.texto)}</p>` : ""}
      ${i.audio_path && urls[i.audio_path] ? `<audio controls preload="none" src="${esc(urls[i.audio_path])}"></audio>` : ""}
      ${i.foto_path && urls[i.foto_path] ? `<button class="nota-foto" data-foto="${esc(urls[i.foto_path])}"><img src="${esc(urls[i.foto_path])}" alt="Foto" loading="lazy"></button>` : ""}
      ${i.respuesta ? `<div class="respuesta-gustavo">${icono("user", 14)}<span><b>Gustavo:</b> ${esc(i.respuesta)}</span></div>` : ""}
      ${i.puntos ? `<b style="color:var(--oro)">+${i.puntos} pts por tu idea</b>` : ""}
      ${i.estado === "nueva" ? `<button class="btn-texto" data-retirar="${esc(i.id)}" style="align-self:flex-end;min-height:28px">Retirar idea</button>` : ""}
    </article>`;
  };

  const pintar = () => {
    if (pestana === "ideas") {
      cuerpo.innerHTML = ideas.length ? ideas.map(tarjetaIdea).join("")
        : `<div class="vacio"><strong>Aún no has propuesto ideas</strong>Desde cualquier apunte toca "Proponer a Gustavo". Si se implementa, ganas puntos.</div>`;
    } else {
      const todas = [...pendientes, ...notas];
      const f = filtro.trim().toLowerCase();
      const lista = f ? todas.filter((x) => `${x.texto} ${x.referencia || ""}`.toLowerCase().includes(f)) : todas;
      const grupos = new Map();
      for (const x of lista) {
        const k = x.curso_id || "";
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(x);
      }
      cuerpo.innerHTML = `
        ${todas.length > 3 ? `<input class="buscador" id="lib-buscar" type="search" placeholder="Buscar en mis apuntes…" value="${esc(filtro)}">` : ""}
        ${!todas.length ? `<div class="vacio"><strong>Tu libreta está vacía</strong>Mientras ves una lección toca <b>Anotar</b>: el apunte guarda el minuto exacto del video. También puedes grabar una nota de voz o tomar una foto.</div>` : ""}
        ${todas.length && !lista.length ? `<p class="texto-tenue">No encontré apuntes con "${esc(filtro)}".</p>` : ""}
        ${[...grupos.entries()].map(([k, xs]) => `
          <section class="pila" style="gap:8px">
            <h2 class="libreta-grupo">${esc(k ? titulosCurso[k] || (xs[0].referencia || "").split(" · ")[0] || "Curso" : "Apuntes generales")} <span class="texto-tenue">${xs.length}</span></h2>
            ${xs.map(tarjetaNota).join("")}
          </section>`).join("")}`;
      const b = cuerpo.querySelector("#lib-buscar");
      if (b) b.oninput = () => { filtro = b.value; const pos = b.selectionStart; pintar(); const nb = cuerpo.querySelector("#lib-buscar"); nb.focus(); nb.setSelectionRange(pos, pos); };
    }
    conectar();
  };
  const recargar = () => pintarLibreta(ctx);
  const conectar = () => {
    cuerpo.querySelectorAll("[data-foto]").forEach((b) => (b.onclick = () => modal(`<img src="${esc(b.dataset.foto)}" alt="Foto" style="width:100%;border-radius:14px"><button class="btn btn-sec btn-bloque" data-cerrar>Cerrar</button>`)));
    cuerpo.querySelectorAll("[data-ir-video]").forEach((b) => (b.onclick = () => {
      const x = notas.find((y) => y.id === b.dataset.irVideo); if (!x) return;
      try { sessionStorage.setItem("academia-saltar", JSON.stringify({ leccion: x.leccion_id, seg: x.segundo })); } catch (_) { /* nada */ }
      ctx.ir(`/leccion/${x.curso_id}/${x.leccion_id}`);
    }));
    cuerpo.querySelectorAll("[data-editar]").forEach((b) => (b.onclick = async () => {
      const x = notas.find((y) => y.id === b.dataset.editar);
      if (await editarNota({ nota: x, urls, idea: ideas.find((i) => i.nota_id === x.id), usuario })) recargar();
    }));
    cuerpo.querySelectorAll("[data-borrar]").forEach((b) => (b.onclick = async () => {
      const x = notas.find((y) => y.id === b.dataset.borrar);
      if (!(await confirmar("¿Borrar este apunte?", "Se borra de tu libreta (texto, nota de voz y foto). Si lo propusiste como idea, Gustavo la conserva.", "Borrar"))) return;
      try { await datos.borrarNota(x); aviso("Apunte borrado", "ok"); recargar(); } catch (e) { aviso(errorBonito(e), "error"); }
    }));
    cuerpo.querySelectorAll("[data-proponer]").forEach((b) => (b.onclick = async () => {
      if (!(await confirmar("¿Proponer esta idea a Gustavo?", "Le llega tal cual (texto, voz y foto). Si se implementa en Mozzafiato, ganas puntos.", "Proponer"))) return;
      try { await datos.proponerIdea(b.dataset.proponer); confeti({ cantidad: 60, duracion: 1600 }); aviso("¡Idea enviada a Gustavo! 💡", "ok"); recargar(); } catch (e) { aviso(errorBonito(e), "error"); }
    }));
    cuerpo.querySelectorAll("[data-retirar]").forEach((b) => (b.onclick = async () => {
      if (!(await confirmar("¿Retirar esta idea?", "Gustavo ya no la verá. Tu apunte se queda en tu libreta.", "Retirar"))) return;
      try { await datos.retirarIdea(b.dataset.retirar); aviso("Idea retirada", "ok"); recargar(); } catch (e) { aviso(errorBonito(e), "error"); }
    }));
  };
  app.querySelector("#lib-pestanas").onclick = (e) => {
    const b = e.target.closest("[data-p]"); if (!b) return;
    pestana = b.dataset.p;
    try { sessionStorage.setItem("academia-libreta-pestana", pestana); } catch (_) { /* nada */ }
    app.querySelectorAll("#lib-pestanas button").forEach((x) => x.classList.toggle("activo", x === b));
    pintar();
  };
  app.querySelector("#volver").onclick = () => ctx.ir("/inicio");
  app.querySelector("#nueva").onclick = async () => { if (await editarNota({ usuario })) recargar(); };
  app.querySelector("#como").onclick = () => presentarLibreta(usuario, { final: "¡Entendido!" });
  app.querySelector("#reintentar")?.addEventListener("click", async () => { await procesarColaLibreta(usuario); recargar(); });
  app.querySelector("#respaldo").onclick = () => descargarRespaldo({ notas, ideas, titulosCurso, perfil: ctx.estado.perfil });
  pintar();
  if (!vioPresentacionLibreta(usuario)) presentarLibreta(usuario, { final: "¡Empezar!" });
}

// ---------------------------------------------------------------------
//  Respaldo .zip (libreta.html + audios/ + fotos/)
// ---------------------------------------------------------------------
const llaveRespaldo = (u) => `academia-libreta-respaldo-${u}`;
function ultimoRespaldo(usuario) { try { return localStorage.getItem(llaveRespaldo(usuario)); } catch (_) { return null; } }

async function descargarRespaldo({ notas, ideas, titulosCurso, perfil }) {
  modal(`
    <h2 class="modal-titulo">Preparando tu respaldo…</h2>
    <p class="modal-texto" id="rs-txt">Juntando tus apuntes.</p>
    <div class="barra"><i id="rs-barra" style="width:0%"></i></div>`, { cerrable: false });
  const capa = modal.actual;
  const txt = capa.querySelector("#rs-txt"), barra = capa.querySelector("#rs-barra");
  try {
    const archivos = [], nombreDe = {};
    const rutas = [...new Set([...notas, ...ideas].flatMap((x) => [x.audio_path, x.foto_path]).filter(Boolean))];
    let fallaron = 0;
    for (const [k, ruta] of rutas.entries()) {
      txt.textContent = `Descargando notas de voz y fotos (${k + 1} de ${rutas.length})…`;
      barra.style.width = Math.round(((k + 1) / Math.max(1, rutas.length)) * 90) + "%";
      try {
        const blob = await datos.bajarArchivoNota(ruta);
        const base = ruta.split("/").pop();
        const nombre = `${/\.(webm|m4a|ogg|mp3|aac)$/i.test(base) ? "audios" : "fotos"}/${base}`;
        nombreDe[ruta] = nombre;
        archivos.push({ nombre, datos: blob });
      } catch (_) { fallaron++; }
    }
    txt.textContent = "Armando el archivo…";
    archivos.unshift({ nombre: "Mi libreta.html", datos: htmlRespaldo({ notas, ideas, titulosCurso, perfil, nombreDe }) });
    const zip = await crearZip(archivos);
    const nombre = `Mi libreta - ${(perfil?.nombre || "Academia").replace(/[\\/:*?"<>|]/g, "")} - ${new Date().toISOString().slice(0, 10)}.zip`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zip); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    barra.style.width = "100%";
    try { localStorage.setItem(llaveRespaldo(perfil?.usuario), new Date().toISOString()); } catch (_) { /* nada */ }
    await datos.marcarRespaldo().catch(() => {});
    capa.cerrar(true);
    aviso(fallaron ? `Respaldo descargado (${fallaron} archivo(s) no se pudieron bajar)` : "Respaldo descargado ✓ Búscalo en tus Descargas o Archivos.", fallaron ? "info" : "ok");
  } catch (e) {
    capa.cerrar(false);
    aviso(errorBonito(e), "error");
  }
}

function htmlRespaldo({ notas, ideas, titulosCurso, perfil, nombreDe }) {
  const grupos = new Map();
  for (const x of notas) { const k = x.curso_id || ""; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); }
  const medios = (x) => `${x.audio_path && nombreDe[x.audio_path] ? `<audio controls src="${esc(nombreDe[x.audio_path])}"></audio>` : ""}${x.foto_path && nombreDe[x.foto_path] ? `<img src="${esc(nombreDe[x.foto_path])}" alt="Foto">` : ""}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mi libreta · ${esc(perfil?.nombre || "")}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f1ea;color:#2a1e17;margin:0;padding:24px 16px;line-height:1.5}
main{max-width:760px;margin:0 auto}h1{margin:0 0 4px;font-size:28px}h2{margin:28px 0 10px;font-size:18px;color:#8a5a2b;border-bottom:1px solid #e3d5c3;padding-bottom:4px}
.n{background:#fff;border-radius:14px;padding:14px 16px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}.r{font-size:12px;color:#8a7766;text-transform:uppercase;letter-spacing:.05em}
.t{white-space:pre-wrap;margin:6px 0}img{max-width:100%;border-radius:10px;margin-top:8px;display:block}audio{width:100%;margin-top:6px}.e{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:#f0e2c8;color:#7a5523}
.g{background:#fbf6ee;border-left:3px solid #c9954c;padding:6px 10px;margin-top:8px;font-size:14px}small{color:#8a7766}</style></head><body><main>
<h1>Mi libreta</h1><small>${esc(perfil?.nombre || "")} · Academia del Buen Café · Mozzafiato · respaldo del ${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</small>
${[...grupos.entries()].map(([k, xs]) => `<h2>${esc(k ? titulosCurso[k] || (xs[0].referencia || "").split(" · ")[0] || "Curso" : "Apuntes generales")}</h2>
${xs.map((x) => `<div class="n"><div class="r">${esc(x.referencia || "")}${x.segundo != null ? ` · minuto ${reloj(x.segundo)}` : ""} · ${new Date(x.creado_en).toLocaleDateString("es-MX")}</div>
${x.texto ? `<div class="t">${esc(x.texto)}</div>` : ""}${medios(x)}</div>`).join("")}`).join("")}
${ideas.length ? `<h2>Mis ideas para Mozzafiato</h2>${ideas.map((i) => `<div class="n"><span class="e">${esc((ESTADOS_IDEA[i.estado] || ESTADOS_IDEA.nueva).txt)}</span>
${i.referencia ? `<div class="r" style="margin-top:6px">${esc(i.referencia)}</div>` : ""}${i.texto ? `<div class="t">${esc(i.texto)}</div>` : ""}${medios(i)}
${i.respuesta ? `<div class="g"><b>Gustavo:</b> ${esc(i.respuesta)}</div>` : ""}${i.puntos ? `<p><b>+${i.puntos} pts</b></p>` : ""}</div>`).join("")}` : ""}
</main></body></html>`;
}

// ---------------------------------------------------------------------
//  Aviso en Inicio cuando Gustavo cambia el estado de una idea
// ---------------------------------------------------------------------
export async function revisarIdeas(usuario) {
  const llave = `academia-ideas-vistas-${usuario}`;
  let ideas;
  try { ideas = await datos.misIdeas(); } catch (_) { return; }
  let vistas = null;
  try { vistas = JSON.parse(localStorage.getItem(llave) || "null"); } catch (_) { /* nada */ }
  const ahora = Object.fromEntries(ideas.map((i) => [i.id, i.estado]));
  try { localStorage.setItem(llave, JSON.stringify(ahora)); } catch (_) { return; }
  if (!vistas) return; // primera vez: solo memoriza
  const cambios = ideas.filter((i) => i.estado !== "nueva" && vistas[i.id] !== i.estado);
  for (const i of cambios) {
    const corto = esc((i.texto || "Tu nota de voz").slice(0, 90)) + ((i.texto || "").length > 90 ? "…" : "");
    if (i.estado === "implementada") {
      confeti({ cantidad: 200, duracion: 3000 });
      await modal(`
        <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
          <div class="etiqueta" style="color:var(--oro)">¡Tu idea ya es parte de Mozzafiato!</div>
          <div class="destellos"><div class="medalla medalla-oro">${icono("trophy", 48)}</div></div>
          <p class="modal-texto">"${corto}"</p>
          ${i.respuesta ? `<div class="respuesta-gustavo" style="text-align:left">${icono("user", 14)}<span><b>Gustavo:</b> ${esc(i.respuesta)}</span></div>` : ""}
          ${i.puntos ? `<b style="color:var(--oro);font-size:18px">+${i.puntos} pts</b>` : ""}
          <button class="btn btn-bloque" data-cerrar>¡Gracias!</button>
        </div>`, { clase: "desbloqueo" });
    } else {
      momento({ icono: ESTADOS_IDEA[i.estado].ic, titulo: i.estado === "probando" ? "¡Tu idea se va a probar!" : "Gustavo revisó tu idea",
        texto: i.respuesta || `"${(i.texto || "").slice(0, 70)}"`, tono: i.estado === "probando" ? "oro" : "cobre", duracion: 5200 });
    }
  }
}

// ---------------------------------------------------------------------
//  Presentación de "Mi libreta" (una vez, y cuando quieran desde la libreta)
// ---------------------------------------------------------------------
const llaveTour = (u) => `academia-tour-libreta-${u}`;
export function vioPresentacionLibreta(usuario) { try { return !!localStorage.getItem(llaveTour(usuario)); } catch (_) { return true; } }

export function presentarLibreta(usuario, { final = "Abrir mi libreta" } = {}) {
  try { localStorage.setItem(llaveTour(usuario), "1"); } catch (_) { /* nada */ }
  const mock = (html) => `<div class="tour-mock" aria-hidden="true">${html}</div>`;
  const pasos = [
    {
      ic: "libreta", titulo: "Nuevo: Mi libreta",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">Estos cursos son para <b>mejorar nuestro menú y probar cosas nuevas</b> en Mozzafiato. Ahora tienes una libreta dentro de la app para guardar todo lo que aprendas… y mandarle tus mejores ideas a Gustavo.</p>
        ${mock(`<div class="fila" style="gap:12px"><span class="medalla medalla-oro chica" style="flex:none">${icono("libreta", 22)}</span><span><b style="display:block">Mi libreta</b><span class="texto-tenue" style="font-size:12.5px">En Inicio y en tu perfil</span></span></div>`)}`,
    },
    {
      ic: "play", titulo: "Anota en el minuto exacto",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">Mientras ves una lección toca <b>Anotar</b>. El video se pausa y tu apunte guarda el minuto. Después tocas el minuto y el video <b>salta justo ahí</b>.</p>
        ${mock(`<div class="fila-entre"><b>${icono("libreta", 16, 'style="vertical-align:-3px;color:var(--oro)"')} Mis apuntes</b><span class="btn btn-chico" style="pointer-events:none">${icono("plus", 14)}Anotar</span></div>
          <div class="apunte-mini" style="margin-top:10px"><span class="chip-tiempo">${icono("play", 12)}2:35</span><span style="font-size:13px">Aceite de oliva antes de hornear, no después.</span></div>`)}`,
    },
    {
      ic: "mic", titulo: "Escribe, habla o toma foto",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">¿Sin tiempo de escribir? Graba una <b>nota de voz</b> de hasta 1 minuto. ¿Practicaste un emplatado o un arte latte? Tómale <b>foto</b> y guárdala con tu apunte.</p>
        ${mock(`<div class="ln-grabando"><i class="punto-rojo"></i><b>0:12</b><span class="texto-tenue">/ 1:00</span><span class="btn btn-chico" style="margin-left:auto;pointer-events:none">${icono("check", 14)}Listo</span></div>
          <div class="fila" style="gap:8px;margin-top:10px"><span class="btn btn-sec btn-chico" style="pointer-events:none">${icono("mic", 14)}Nota de voz</span><span class="btn btn-sec btn-chico" style="pointer-events:none">${icono("camara", 14)}Foto</span></div>`)}`,
    },
    {
      ic: "bulb", titulo: "Propón tus ideas a Gustavo",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">¿Algo que podríamos agregar al menú o hacer mejor? En tu apunte toca <b>Proponer a Gustavo</b>. Le llega con tu texto, tu voz y tu foto, y tú ves en qué va:</p>
        ${mock(`<div class="pila" style="gap:8px;align-items:flex-start">
          <span class="estado-idea">${icono("send", 13)}Enviada a Gustavo</span>
          <span class="estado-idea probando">${icono("flame", 13)}¡La vamos a probar!</span>
          <span class="estado-idea implementada">${icono("trophy", 13)}¡Implementada! · +50 pts</span></div>`)}
        <p class="texto-tenue" style="margin:0;font-size:13px">Si tu idea se implementa en Mozzafiato, <b style="color:var(--oro)">ganas puntos de bono</b>.</p>`,
    },
    {
      ic: "clock", titulo: "Sin señal, no pasa nada",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">Si se va el internet, tu apunte se queda guardado en tu celular y <b>se sube solo</b> cuando vuelve la señal.</p>
        ${mock(`<div class="apunte-mini pendiente"><span class="chip-tiempo">${icono("play", 12)}0:48</span><span style="font-size:13px">Temperatura del horno: 230 °C <span class="apunte-iconos"><em>sin subir</em></span></span></div>`)}`,
    },
    {
      ic: "descargar", titulo: "Tu libreta es tuya",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">En Mi libreta toca <b>Descargar mi respaldo</b> y te llevas todo en un archivo .zip: apuntes, notas de voz y fotos, para verlos aunque no tengas internet.</p>
        ${mock(`<span class="btn btn-sec btn-bloque" style="pointer-events:none">${icono("descargar", 18)}Descargar mi respaldo</span>`)}
        <p class="texto-tenue" style="margin:0;font-size:13px">${icono("bulb", 14)} Descárgalo cuando termines un curso: después de un tiempo Gustavo puede limpiar los archivos de la nube para liberar espacio.</p>`,
    },
  ];
  return new Promise((resolver) => {
    let i = 0;
    modal(`<div id="tl"></div>`, { cerrable: false, clase: "modal-ancho" }).then((v) => resolver(v));
    const capa = modal.actual;
    const pintar = () => {
      const p = pasos[i], ultimo = i === pasos.length - 1;
      capa.querySelector("#tl").innerHTML = `
        <div class="pila" style="gap:16px">
          <div class="fila-entre">
            <div class="fila" style="gap:6px" aria-label="Paso ${i + 1} de ${pasos.length}">${pasos.map((_, k) => `<i style="display:block;height:6px;border-radius:3px;width:${k === i ? 22 : 6}px;background:${k <= i ? "var(--oro)" : "var(--linea)"};transition:width .3s"></i>`).join("")}</div>
            ${ultimo ? "" : `<button class="btn-texto" id="tl-saltar">Saltar</button>`}
          </div>
          <div class="medalla medalla-oro" style="width:64px;height:64px;align-self:center">${icono(p.ic, 30)}</div>
          <h2 class="modal-titulo" style="text-align:center">${p.titulo}</h2>
          ${p.cuerpo}
          <div class="fila-botones">
            ${i > 0 ? `<button class="btn btn-sec" id="tl-atras">${icono("back", 18)}Atrás</button>` : ""}
            <button class="btn" id="tl-sig">${ultimo ? `${icono("libreta", 18)}${final}` : `Siguiente ${icono("next", 18)}`}</button>
          </div>
        </div>`;
      capa.querySelector("#tl-sig").onclick = () => { if (ultimo) capa.cerrar("libreta"); else { i++; pintar(); } };
      capa.querySelector("#tl-atras")?.addEventListener("click", () => { i--; pintar(); });
      capa.querySelector("#tl-saltar")?.addEventListener("click", () => capa.cerrar("saltar"));
      capa.querySelector(".modal").scrollTop = 0;
    };
    pintar();
  });
}
