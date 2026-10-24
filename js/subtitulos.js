// =====================================================================
//  SUBTÍTULOS · subir archivos .srt / .vtt (por ejemplo de MacWhisper)
//  a los videos de Bunny, uno por lección o varios por capítulo.
//  En la app arrancan encendidos (lo pide la función academia-video).
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, aviso, modal } from "./ui.js";

const ACEPTA = ".srt,.vtt,text/vtt,application/x-subrip";

// SRT → WebVTT (Bunny y los navegadores se llevan mejor con VTT).
export function aVTT(texto) {
  let t = String(texto || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!t.includes("-->")) throw new Error("Ese archivo no parece de subtítulos (.srt o .vtt)");
  if (/^WEBVTT/.test(t)) return t + "\n";
  t = t.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, "$1.$2") // 00:00:01,500 → 00:00:01.500
       .replace(/^(\d{1,2}:\d{2}),(\d{3})/gm, "$1.$2");
  return "WEBVTT\n\n" + t + "\n";
}

async function leerArchivo(f) {
  if (f.size > 3 * 1048576) throw new Error(`${f.name}: archivo demasiado grande para subtítulos`);
  return aVTT(await f.text());
}

// { videoId: true/false } — si falla (por ejemplo, función sin actualizar) regresa {}.
export async function estadoSubtitulos(lecciones) {
  const ids = [...new Set(lecciones.map((l) => l.bunny_video_id).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const r = await datos.subtitulosVideos(ids);
    return Object.fromEntries(ids.map((id) => [id, (r?.[id] || []).some((x) => /^es/i.test(x))]));
  } catch (e) { console.warn("Subtítulos:", e.message); return null; }
}

function errorBonito(e) {
  return /Acción desconocida/i.test(e.message)
    ? "Falta actualizar la función academia-admin en Supabase (la versión con subtítulos)"
    : e.message;
}

// ---------- Una lección ----------
export function subtitulosLeccion(l, tiene, alCambiar) {
  modal(`
    <h2 class="modal-titulo">${icono("cc", 22, 'style="vertical-align:-4px;color:var(--oro)"')} Subtítulos</h2>
    <p class="modal-texto" style="margin-top:-4px"><b>${esc(l.titulo)}</b></p>
    <p class="texto-tenue" style="margin:0;font-size:13.5px">${tiene
      ? "Este video <b style='color:var(--oro)'>ya tiene subtítulos en español</b>. En la app arrancan encendidos; cada quien puede apagarlos con el botón CC."
      : "Sube el archivo <b>.srt</b> o <b>.vtt</b> (por ejemplo, el que exportas de MacWhisper). En la app arrancan encendidos."}</p>
    <p class="error-form" hidden></p>
    <div class="fila-botones" style="flex-wrap:wrap">
      ${tiene ? `<button class="btn btn-sec" data-quitar>${icono("trash", 16)}Quitar</button>` : `<button class="btn btn-sec" data-cerrar>Cancelar</button>`}
      <label class="btn" id="subs-elegir">${icono("cc", 18)}<span>${tiene ? "Reemplazar archivo" : "Elegir archivo"}</span><input type="file" accept="${ACEPTA}" hidden></label>
    </div>`);
  const capa = modal.actual;
  const error = capa.querySelector(".error-form");
  const etiqueta = capa.querySelector("#subs-elegir span"), textoEtiqueta = etiqueta.textContent;
  const ocupado = (si, txt) => {
    capa.querySelectorAll(".fila-botones .btn").forEach((b) => b.classList.toggle("ocupado", si));
    etiqueta.textContent = si && txt ? txt : textoEtiqueta;
  };
  const fallo = (err) => { ocupado(false); error.textContent = errorBonito(err); error.hidden = false; };
  capa.querySelector("input[type=file]").onchange = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    error.hidden = true; ocupado(true, "Subiendo…");
    try {
      await datos.subirSubtitulo(l.bunny_video_id, await leerArchivo(f));
      capa.cerrar(true);
      aviso("Subtítulos listos ✓", "ok");
      alCambiar?.();
    } catch (err) { fallo(err); }
  };
  capa.querySelector("[data-quitar]")?.addEventListener("click", async () => {
    error.hidden = true; ocupado(true);
    try { await datos.borrarSubtitulo(l.bunny_video_id); capa.cerrar(true); aviso("Subtítulos quitados", "ok"); alCambiar?.(); }
    catch (err) { fallo(err); }
  });
}

// ---------- Varias lecciones (un capítulo) ----------
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\.(srt|vtt)$/i, "").replace(/[_\-.]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const sinNumero = (s) => s.replace(/^\d+\s*/, "");
const numeroDe = (s) => { const m = norm(s).match(/^(\d+)/); return m ? Number(m[1]) : null; };

function parecido(archivo, leccion, pos) {
  const a = norm(archivo), b = norm(leccion.titulo), a2 = sinNumero(a), b2 = sinNumero(b);
  if (!a2 && !b2) return 0;
  if (a === b || (a2 && a2 === b2)) return 100;
  let p = 0;
  if (a2 && b2 && (a2.includes(b2) || b2.includes(a2))) p = 80;
  else {
    const ta = new Set(a2.split(" ").filter((x) => x.length > 2)), tb = new Set(b2.split(" ").filter((x) => x.length > 2));
    const comun = [...ta].filter((x) => tb.has(x)).length;
    if (comun) p = Math.round((comun / Math.max(ta.size, tb.size)) * 70);
  }
  if (numeroDe(archivo) === pos + 1) p += 25;
  return p;
}

// Empareja archivos con lecciones: primero por nombre, lo que sobre en orden.
export function emparejar(archivos, lecciones, { porOrden = true } = {}) {
  const pares = [];
  archivos.forEach((f, i) => lecciones.forEach((l, j) => pares.push({ i, j, p: parecido(f.name, l, j) })));
  pares.sort((x, y) => y.p - x.p);
  const deArchivo = new Array(archivos.length).fill(-1), usadas = new Set();
  for (const { i, j, p } of pares) {
    if (p < 30 || deArchivo[i] !== -1 || usadas.has(j)) continue;
    deArchivo[i] = j; usadas.add(j);
  }
  const libres = lecciones.map((_, j) => j).filter((j) => !usadas.has(j));
  const ordenados = archivos.map((f, i) => i).filter((i) => deArchivo[i] === -1)
    .sort((x, y) => archivos[x].name.localeCompare(archivos[y].name, "es", { numeric: true }));
  if (porOrden || (archivos.length === 1 && lecciones.length === 1)) ordenados.forEach((i) => { if (libres.length) deArchivo[i] = libres.shift(); });
  return deArchivo;
}

export function subtitulosCapitulo(nombre, lecciones, estado, alCambiar) {
  const conVideo = lecciones.filter((l) => l.bunny_video_id);
  modal(`
    <h2 class="modal-titulo">${icono("cc", 22, 'style="vertical-align:-4px;color:var(--oro)"')} Subtítulos del capítulo</h2>
    <p class="modal-texto" style="margin-top:-4px"><b>${esc(nombre)}</b> · ${conVideo.length} videos</p>
    <div id="subs-cuerpo" class="pila" style="gap:12px">
      <p class="texto-tenue" style="margin:0;font-size:13.5px">Elige todos los <b>.srt</b> o <b>.vtt</b> de este capítulo. Los acomodo con su video por el nombre del archivo (o por número: 01, 02…) y antes de subir puedes revisar.</p>
      <div class="pila" style="gap:4px">${conVideo.map((l) => `<div class="fila texto-tenue" style="font-size:13px;gap:6px">${estado?.[l.bunny_video_id] ? `<span class="chip-cc si">CC</span>` : `<span class="chip-cc">CC</span>`}${esc(l.titulo)}</div>`).join("")}</div>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button>
        <label class="btn">${icono("cc", 18)}Elegir archivos<input type="file" accept="${ACEPTA}" multiple hidden></label></div>
    </div>`);
  const capa = modal.actual;
  const cuerpo = capa.querySelector("#subs-cuerpo");
  capa.querySelector("input[type=file]").onchange = (e) => {
    const archivos = [...(e.target.files || [])].filter((f) => /\.(srt|vtt)$/i.test(f.name) || /vtt|subrip/.test(f.type));
    if (!archivos.length) return aviso("Elige archivos .srt o .vtt", "error");
    archivos.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
    const asignado = emparejar(archivos, conVideo);
    cuerpo.innerHTML = `
      <p class="texto-tenue" style="margin:0;font-size:13.5px">Revisa que cada archivo vaya con su video:</p>
      <div class="pila subs-filas" style="gap:10px">${archivos.map((f, i) => `
        <label class="campo subs-fila"><span>${icono("cc", 14)} ${esc(f.name)}</span>
          <select data-archivo="${i}">
            <option value="">— No subir —</option>
            ${conVideo.map((l, j) => `<option value="${j}" ${asignado[i] === j ? "selected" : ""}>${esc(l.titulo)}${estado?.[l.bunny_video_id] ? " (reemplaza)" : ""}</option>`).join("")}
          </select></label>`).join("")}</div>
      <p class="error-form" hidden></p>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="subs-subir">${icono("check", 18)}Subir</button></div>`;
    const error = cuerpo.querySelector(".error-form");
    cuerpo.querySelector("#subs-subir").onclick = async (ev) => {
      const sel = [...cuerpo.querySelectorAll("[data-archivo]")].map((s) => ({ f: archivos[Number(s.dataset.archivo)], j: s.value === "" ? -1 : Number(s.value), s }));
      const elegidos = sel.filter((x) => x.j >= 0);
      if (!elegidos.length) { error.textContent = "No elegiste ningún video."; error.hidden = false; return; }
      const repetidos = elegidos.map((x) => x.j).filter((j, k, a) => a.indexOf(j) !== k);
      if (repetidos.length) { error.textContent = `Dos archivos van al mismo video: ${conVideo[repetidos[0]].titulo}`; error.hidden = false; return; }
      error.hidden = true;
      const btn = ev.currentTarget; btn.disabled = true;
      cuerpo.querySelectorAll("select").forEach((s) => (s.disabled = true));
      let bien = 0; const fallas = [];
      for (const [k, x] of elegidos.entries()) {
        btn.innerHTML = `Subiendo ${k + 1} de ${elegidos.length}…`;
        try {
          await datos.subirSubtitulo(conVideo[x.j].bunny_video_id, await leerArchivo(x.f));
          bien++; x.s.closest(".subs-fila").classList.add("ok");
        } catch (err) {
          fallas.push(`${x.f.name}: ${errorBonito(err)}`); x.s.closest(".subs-fila").classList.add("mal");
          if (/academia-admin/.test(errorBonito(err))) break;
        }
      }
      if (fallas.length) {
        error.innerHTML = fallas.map(esc).join("<br>"); error.hidden = false;
        btn.innerHTML = "Cerrar"; btn.disabled = false; btn.onclick = () => capa.cerrar(true);
        if (bien) { aviso(`${bien} subtítulos listos`, "ok"); alCambiar?.(); }
        return;
      }
      capa.cerrar(true);
      aviso(bien === 1 ? "Subtítulos listos ✓" : `${bien} subtítulos listos ✓`, "ok");
      alCambiar?.();
    };
  };
}
