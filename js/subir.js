// =====================================================================
//  SUBIR CURSO DESDE CARPETA
//  Estructura esperada en tu computadora:
//    Nombre del curso/
//      01 Capítulo uno/
//        01 Video.mp4
//        02 Video.mp4
//      02 Capítulo dos/
//        ...
//  Cada subcarpeta = un capítulo; cada video = una lección (en orden por nombre).
//  Los videos se suben directo de tu computadora a Bunny (subida reanudable).
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, modal, aviso, AREAS } from "./ui.js";

const EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const MIME = { mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo" };
const SIMULTANEOS = 2;
const natural = (a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

export const limpiarNombre = (t) => String(t || "")
  .replace(EXT, "")
  .replace(/^\s*\d+\s*[-_.)]*\s*/, "")       // "01 - ", "1. ", "03_"
  .replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim() || String(t || "");

export function tamano(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return Math.round(bytes / 1e6) + " MB";
  return Math.max(1, Math.round(bytes / 1e3)) + " KB";
}

// Convierte la lista de archivos de la carpeta en curso → capítulos → videos.
export function analizarCarpeta(archivos) {
  const videos = [], otros = [];
  for (const f of archivos) {
    const ruta = f.webkitRelativePath || f.name;
    const partes = ruta.split("/");
    if (partes.some((p) => p.startsWith("."))) continue; // .DS_Store y ocultos
    if (EXT.test(f.name)) videos.push({ file: f, partes, ruta });
    else otros.push(ruta);
  }
  if (!videos.length) return null;
  const nombreCurso = videos[0].partes.length > 1 ? videos[0].partes[0] : "Nuevo curso";
  const grupos = new Map();
  for (const v of videos) {
    const clave = v.partes.length >= 3 ? v.partes[1] : "";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(v);
  }
  const capitulos = [...grupos.keys()].sort(natural).map((clave) => ({
    nombre: clave ? limpiarNombre(clave) : "Lecciones",
    videos: grupos.get(clave).sort((a, b) => natural(a.ruta, b.ruta)).map((v) => ({
      file: v.file, titulo: limpiarNombre(v.file.name), bytes: v.file.size,
    })),
  }));
  return {
    curso: limpiarNombre(nombreCurso),
    capitulos,
    otros: otros.length,
    total: videos.length,
    bytes: videos.reduce((a, v) => a + v.file.size, 0),
  };
}

function elegirCarpeta() {
  return new Promise((resolver) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    input.setAttribute("webkitdirectory", "");
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = () => { resolver([...input.files]); input.remove(); };
    input.addEventListener("cancel", () => { resolver([]); input.remove(); });
    input.click();
  });
}

export async function subirCursoDesdeCarpeta({ alTerminar }) {
  const archivos = await elegirCarpeta();
  if (!archivos.length) return;
  const plan = analizarCarpeta(archivos);
  if (!plan) return aviso("Esa carpeta no tiene videos (.mp4, .mov…)", "error");

  // ---------- 1. Vista previa ----------
  const p = modal(`
    <h2 class="modal-titulo">Subir curso desde carpeta</h2>
    <label class="campo">Nombre del curso<input id="sc-nombre" value="${esc(plan.curso)}"></label>
    <label class="campo">Categoría<select id="sc-cat">${AREAS.map(([v, t]) => `<option value="${v}" ${v === "barra" ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <div class="pila" style="gap:8px">
      <div class="etiqueta">${plan.capitulos.length} ${plan.capitulos.length === 1 ? "capítulo" : "capítulos"} · ${plan.total} videos · ${tamano(plan.bytes)}</div>
      ${plan.capitulos.map((c, i) => `
        <details class="capitulo-admin" ${i === 0 ? "open" : ""}>
          <summary style="cursor:pointer;font-weight:700">Capítulo ${i + 1} · ${esc(c.nombre)} <span class="texto-tenue" style="font-weight:400">(${c.videos.length})</span></summary>
          <ol style="margin:8px 0 0;padding-left:22px;display:flex;flex-direction:column;gap:4px;font-size:13.5px">
            ${c.videos.map((v) => `<li>${esc(v.titulo)} <span class="texto-tenue">· ${tamano(v.bytes)}</span></li>`).join("")}
          </ol>
        </details>`).join("")}
    </div>
    ${plan.otros ? `<p class="texto-tenue" style="margin:0">${plan.otros} archivo(s) que no son video se omiten (los PDFs se podrán agregar como materiales).</p>` : ""}
    <p class="texto-tenue" style="margin:0">El curso se crea en <b>borrador</b>: nadie lo ve hasta que lo publiques. Después puedes renombrar y reordenar todo.</p>
    <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="sc-ok">${icono("video", 18)}Crear y subir ${plan.total} videos</button></div>`, { clase: "modal-ancho" });
  const capa = modal.actual;

  capa.querySelector("#sc-ok").onclick = () => {
    const titulo = capa.querySelector("#sc-nombre").value.trim() || plan.curso;
    const categoria = capa.querySelector("#sc-cat").value;
    capa.cerrar("ok");
    ejecutarSubida(plan, titulo, categoria, alTerminar);
  };
  await p;
}

// ---------- 2. Crear todo y subir ----------
async function ejecutarSubida(plan, titulo, categoria, alTerminar) {
  const items = [];
  plan.capitulos.forEach((c, ci) => c.videos.forEach((v, vi) => items.push({ ...v, ci, vi, id: `${ci}-${vi}`, estado: "espera", subidos: 0 })));

  modal(`
    <h2 class="modal-titulo">Subiendo "${esc(titulo)}"</h2>
    <p class="texto-tenue" style="margin:0" id="sp-aviso">No cierres esta pestaña ni dejes que la computadora se duerma. Si se corta el internet, la subida se reanuda sola.</p>
    <div class="pila" style="gap:6px">
      <div class="fila-entre"><b id="sp-estado">Preparando curso…</b><b id="sp-pct" style="color:var(--oro)">0%</b></div>
      <div class="barra"><i id="sp-barra" style="width:0%"></i></div>
      <span class="texto-tenue" id="sp-bytes">0 de ${tamano(plan.bytes)}</span>
    </div>
    <div class="lista-videos" id="sp-lista">
      ${items.map((it) => `<div class="fila" style="padding:8px 10px;border-radius:10px;background:var(--tarjeta-2);gap:10px" id="sp-${it.id}">
        <span class="sp-ic" style="flex:none;color:var(--arena)">${icono("clock", 16)}</span>
        <span style="flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.ci + 1}.${it.vi + 1} ${esc(it.titulo)}</span>
        <span class="sp-pct texto-tenue" style="font-size:12px;min-width:44px;text-align:right">—</span></div>`).join("")}
    </div>
    <div class="fila-botones" id="sp-botones"></div>`, { cerrable: false, clase: "modal-ancho" });
  const capa = modal.actual;
  const $ = (s) => capa.querySelector(s);

  let activo = true;
  const antesDeSalir = (e) => { if (activo) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", antesDeSalir);
  let bloqueo = null;
  try { bloqueo = await navigator.wakeLock?.request("screen"); } catch (_) { /* no soportado */ }

  const pintarFila = (it) => {
    const fila = capa.querySelector(`#sp-${it.id}`); if (!fila) return;
    const ic = { espera: ["clock", "var(--arena)"], subiendo: ["video", "var(--oro)"], listo: ["check", "var(--verde)"], error: ["x", "var(--alerta)"] }[it.estado];
    fila.querySelector(".sp-ic").innerHTML = icono(ic[0], 16);
    fila.querySelector(".sp-ic").style.color = ic[1];
    fila.querySelector(".sp-pct").textContent = it.estado === "listo" ? "Listo" : it.estado === "error" ? "Error" : it.estado === "subiendo" ? Math.floor((it.subidos / it.bytes) * 100) + "%" : "—";
  };
  const pintarTotal = () => {
    const sub = items.reduce((a, it) => a + (it.estado === "listo" ? it.bytes : it.subidos), 0);
    const pct = Math.floor((sub / plan.bytes) * 100);
    $("#sp-barra").style.width = pct + "%";
    $("#sp-pct").textContent = pct + "%";
    $("#sp-bytes").textContent = `${tamano(sub)} de ${tamano(plan.bytes)} · ${items.filter((i) => i.estado === "listo").length} de ${items.length} videos`;
  };

  let curso, coleccion;
  try {
    // Curso, colección en Bunny y capítulos
    curso = await datos.guardarCurso({ titulo, categoria, publicado: false });
    $("#sp-estado").textContent = "Creando colección en Bunny…";
    coleccion = await datos.crearColeccion(titulo);
    $("#sp-estado").textContent = "Creando capítulos…";
    const modulos = [];
    for (let i = 0; i < plan.capitulos.length; i++) {
      modulos.push(await datos.guardarModulo({ curso_id: curso.id, titulo: plan.capitulos[i].nombre, orden: i + 1 }));
    }
    items.forEach((it) => (it.modulo_id = modulos[it.ci].id));
  } catch (e) {
    activo = false; window.removeEventListener("beforeunload", antesDeSalir); bloqueo?.release?.();
    $("#sp-estado").textContent = "No se pudo preparar el curso";
    $("#sp-aviso").textContent = e.message;
    $("#sp-botones").innerHTML = `<button class="btn" data-cerrar>Cerrar</button>`;
    return;
  }

  // Sube un video: crea la lección (con su video en Bunny) y manda el archivo.
  const subirUno = async (it) => {
    it.estado = "subiendo"; it.subidos = 0; pintarFila(it);
    try {
      const firma = await datos.prepararSubida(it.titulo, coleccion.id, it.video_id);
      if (!it.video_id) {
        it.video_id = firma.video_id;
        await datos.agregarLecciones([{ curso_id: curso.id, modulo_id: it.modulo_id, titulo: it.titulo, bunny_video_id: firma.video_id, orden: it.vi + 1 }]);
      }
      await enviarArchivo(it, firma, () => { pintarFila(it); pintarTotal(); });
      it.estado = "listo";
    } catch (e) {
      console.error(e);
      it.estado = "error"; it.error = e.message;
    }
    pintarFila(it); pintarTotal();
  };

  const correrCola = async (lista) => {
    const cola = [...lista];
    const trabajador = async () => { while (cola.length) await subirUno(cola.shift()); };
    $("#sp-estado").textContent = "Subiendo videos…";
    await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, cola.length) }, trabajador));
  };

  const terminar = () => {
    const fallidos = items.filter((i) => i.estado === "error");
    activo = fallidos.length > 0;
    if (!activo) { window.removeEventListener("beforeunload", antesDeSalir); bloqueo?.release?.(); }
    $("#sp-estado").textContent = fallidos.length ? `${fallidos.length} video(s) no se subieron` : "¡Listo! Todos los videos se subieron";
    $("#sp-aviso").textContent = fallidos.length
      ? "Revisa tu conexión y dale Reintentar. Los que ya subieron no se repiten."
      : "Bunny los está procesando (unos minutos por video). Las duraciones aparecen solas en el editor. Cuando quieras, asígnalo y publícalo.";
    $("#sp-botones").innerHTML = `${fallidos.length ? `<button class="btn btn-sec" id="sp-reintentar">${icono("refresh", 18)}Reintentar ${fallidos.length}</button>` : ""}
      <button class="btn" id="sp-ir">Ir al curso</button>`;
    $("#sp-ir").onclick = () => {
      if (fallidos.length && !confirm("Hay videos sin subir. ¿Salir de todos modos?")) return;
      window.removeEventListener("beforeunload", antesDeSalir); bloqueo?.release?.();
      capa.cerrar(true); alTerminar?.(curso.id);
    };
    const r = $("#sp-reintentar");
    if (r) r.onclick = async () => { $("#sp-botones").innerHTML = ""; await correrCola(fallidos); terminar(); };
  };

  await correrCola(items);
  terminar();
}

// Subida reanudable (TUS) directo a Bunny.
function enviarArchivo(it, firma, alAvanzar) {
  if (firma.demo) {
    return new Promise((ok) => {
      const t = setInterval(() => {
        it.subidos = Math.min(it.bytes, it.subidos + Math.max(it.bytes / 8, 1));
        alAvanzar();
        if (it.subidos >= it.bytes) { clearInterval(t); ok(); }
      }, 150);
    });
  }
  if (!window.tus) return Promise.reject(new Error("No cargó el componente de subida. Recarga la página."));
  const ext = (it.file.name.split(".").pop() || "mp4").toLowerCase();
  return new Promise((ok, falla) => {
    const subida = new window.tus.Upload(it.file, {
      endpoint: "https://video.bunnycdn.com/tusupload",
      retryDelays: [0, 3000, 10000, 30000, 60000, 120000],
      chunkSize: 50 * 1024 * 1024,
      headers: {
        AuthorizationSignature: firma.firma,
        AuthorizationExpire: String(firma.expira),
        VideoId: firma.video_id,
        LibraryId: String(firma.library_id),
      },
      metadata: { filetype: it.file.type || MIME[ext] || "video/mp4", title: it.titulo },
      onProgress: (subidos) => { it.subidos = subidos; alAvanzar(); },
      onSuccess: () => ok(),
      onError: (e) => falla(new Error(e?.message || "Error de subida")),
    });
    subida.findPreviousUploads().then((previas) => {
      if (previas.length) subida.resumeFromPreviousUpload(previas[0]);
      subida.start();
    }).catch(() => subida.start());
  });
}
