// =====================================================================
//  EDITOR DE CONTENIDO DEL CURSO (admin): quiz y materiales
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, aviso, modal, confirmar, formulario } from "./ui.js";

const MAX_MB = 20;
const LETRAS = "ABCDEF";

// ---------------------------------------------------------------------
//  QUIZ
// ---------------------------------------------------------------------
export async function panelQuiz(caja, curso, alCambiar) {
  caja.innerHTML = `<div class="cargando" style="min-height:80px"><div class="taza-carga"></div></div>`;
  let preguntas;
  try { preguntas = await datos.adminQuiz(curso.id); }
  catch (e) { caja.innerHTML = `<h2>Quiz final</h2><p class="error-form">${esc(e.message)}</p>`; return; }
  const recargar = () => panelQuiz(caja, curso, alCambiar);

  caja.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap"><h2>Quiz final</h2>
      <div class="fila" style="gap:6px">
        <button class="btn btn-sec btn-chico" id="qz-pegar">${icono("file", 16)}Pegar</button>
        <button class="btn btn-chico" id="qz-nueva">${icono("plus", 16)}Pregunta</button>
      </div>
    </div>
    ${preguntas.length ? `
      <div class="fila-entre tarjeta" style="padding:10px 12px;flex-wrap:wrap">
        <span class="texto-tenue" style="font-size:13px">${preguntas.length} pregunta(s) · aprueba con ${curso.quiz_minimo}%</span>
        <button class="btn-texto" id="qz-oblig" style="min-height:32px">${curso.quiz_obligatorio ? "Obligatorio ✓" : "Opcional · hacer obligatorio"}</button>
      </div>
      ${preguntas.map((p, i) => `
        <div class="capitulo-admin" style="gap:6px;padding:12px">
          <div class="fila-entre" style="align-items:flex-start">
            <b style="font-size:14px">${i + 1}. ${esc(p.pregunta)}</b>
            <div class="fila" style="gap:0;flex:none">
              <button class="mini-btn" aria-label="Subir" data-qmov="${p.id}" data-dir="-1" ${i === 0 ? "disabled" : ""}>${icono("up", 16)}</button>
              <button class="mini-btn" aria-label="Bajar" data-qmov="${p.id}" data-dir="1" ${i === preguntas.length - 1 ? "disabled" : ""}>${icono("down", 16)}</button>
              <button class="mini-btn" aria-label="Editar" data-qedit="${p.id}">${icono("edit", 16)}</button>
              <button class="mini-btn" aria-label="Borrar" data-qdel="${p.id}">${icono("trash", 16)}</button>
            </div>
          </div>
          ${(p.opciones || []).map((o, j) => `<div class="fila" style="gap:8px;font-size:13px;${j === p.correcta ? "color:var(--verde-texto);font-weight:600" : "color:var(--crema-2)"}">
            ${j === p.correcta ? icono("check", 15) : `<span style="width:15px;text-align:center">${LETRAS[j]}</span>`}<span>${esc(o)}</span></div>`).join("")}
        </div>`).join("")}`
    : `<p class="texto-tenue" style="margin:0">Sin preguntas todavía. Al agregarlas, el quiz se abre a los empleados cuando terminan todas las lecciones. Las respuestas correctas nunca llegan a su celular.</p>`}`;

  caja.querySelector("#qz-nueva").onclick = async () => {
    if (await editarPregunta(curso.id, { orden: preguntas.length + 1 })) recargar();
  };
  caja.querySelector("#qz-pegar").onclick = async () => {
    if (await pegarPreguntas(curso.id, preguntas.length)) recargar();
  };
  caja.querySelector("#qz-oblig")?.addEventListener("click", async () => {
    try { await datos.guardarCurso({ id: curso.id, quiz_obligatorio: !curso.quiz_obligatorio }); aviso("Guardado", "ok"); alCambiar?.(); }
    catch (e) { aviso(e.message, "error"); }
  });
  caja.querySelectorAll("[data-qedit]").forEach((b) => (b.onclick = async () => {
    if (await editarPregunta(curso.id, preguntas.find((p) => p.id === b.dataset.qedit))) recargar();
  }));
  caja.querySelectorAll("[data-qdel]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmar("¿Borrar pregunta?", "Se quita del quiz. Los intentos anteriores se conservan.", "Borrar"))) return;
    try { await datos.borrarPregunta(b.dataset.qdel); recargar(); } catch (e) { aviso(e.message, "error"); }
  }));
  caja.querySelectorAll("[data-qmov]").forEach((b) => (b.onclick = async () => {
    const i = preguntas.findIndex((p) => p.id === b.dataset.qmov), j = i + Number(b.dataset.dir);
    const lista = [...preguntas]; [lista[i], lista[j]] = [lista[j], lista[i]];
    try { await Promise.all(lista.map((p, k) => (p.orden !== k + 1 ? datos.guardarPregunta({ id: p.id, orden: k + 1 }) : null))); recargar(); }
    catch (e) { aviso(e.message, "error"); }
  }));
}

function editarPregunta(cursoId, p = {}) {
  return new Promise((resolver) => {
    let opciones = p.opciones?.length ? [...p.opciones] : ["", "", ""];
    let correcta = p.correcta ?? 0;
    modal(`<h2 class="modal-titulo">${p.id ? "Editar pregunta" : "Nueva pregunta"}</h2><div id="ep"></div>`, { clase: "modal-ancho" }).then((r) => resolver(r === "ok"));
    const capa = modal.actual;
    const caja = capa.querySelector("#ep");
    const leer = () => {
      opciones = [...caja.querySelectorAll(".ep-op")].map((i) => i.value);
      const marcada = caja.querySelector('input[name="ep-ok"]:checked');
      if (marcada) correcta = Number(marcada.value);
    };
    const pintar = (textoPregunta = p.pregunta || "") => {
      caja.innerHTML = `
        <form class="form" novalidate>
          <label class="campo">Pregunta<textarea id="ep-preg" rows="2" placeholder="¿Cuánto debe durar una extracción de espresso?">${esc(textoPregunta)}</textarea></label>
          <div class="etiqueta">Opciones · marca la correcta</div>
          ${opciones.map((o, j) => `
            <div class="fila" style="gap:8px">
              <label class="check" style="min-height:44px" title="Correcta"><input type="radio" name="ep-ok" value="${j}" ${j === correcta ? "checked" : ""} aria-label="Opción ${LETRAS[j]} es la correcta"></label>
              <input class="ep-op" value="${esc(o)}" placeholder="Opción ${LETRAS[j]}" aria-label="Opción ${LETRAS[j]}" style="flex:1;min-height:44px;border-radius:10px;border:1px solid var(--linea);background:var(--tarjeta-2);color:var(--crema);padding:0 12px;font-size:15px">
              ${opciones.length > 2 ? `<button type="button" class="mini-btn" data-quitar="${j}" aria-label="Quitar opción ${LETRAS[j]}">${icono("x", 16)}</button>` : ""}
            </div>`).join("")}
          ${opciones.length < 6 ? `<button type="button" class="btn-texto" id="ep-mas" style="align-self:flex-start">+ Agregar opción</button>` : ""}
          <p class="error-form" id="ep-err" hidden></p>
          <div class="fila-botones"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Guardar</button></div>
        </form>`;
      caja.querySelector("#ep-mas")?.addEventListener("click", () => { const t = caja.querySelector("#ep-preg").value; leer(); opciones.push(""); pintar(t); });
      caja.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => {
        const t = caja.querySelector("#ep-preg").value; leer();
        const j = Number(b.dataset.quitar); opciones.splice(j, 1);
        if (correcta === j) correcta = 0; else if (correcta > j) correcta--;
        pintar(t);
      }));
      caja.querySelector("form").onsubmit = async (e) => {
        e.preventDefault(); leer();
        const pregunta = caja.querySelector("#ep-preg").value.trim();
        const err = caja.querySelector("#ep-err");
        const limpias = opciones.map((o) => o.trim());
        const mal = !pregunta ? "Escribe la pregunta" : limpias.filter(Boolean).length < 2 ? "Pon al menos 2 opciones"
          : !limpias[correcta] ? "La opción marcada como correcta está vacía" : null;
        if (mal) { err.textContent = mal; err.hidden = false; return; }
        // Quita opciones vacías conservando cuál es la correcta
        const finales = [], nuevaCorrecta = { v: 0 };
        limpias.forEach((o, j) => { if (o) { if (j === correcta) nuevaCorrecta.v = finales.length; finales.push(o); } });
        try {
          await datos.guardarPregunta({ id: p.id, curso_id: cursoId, pregunta, opciones: finales, orden: p.orden, correcta: nuevaCorrecta.v });
          capa.cerrar("ok"); aviso("Pregunta guardada", "ok");
        } catch (e2) { err.textContent = e2.message; err.hidden = false; }
      };
      caja.querySelector("#ep-preg").focus();
    };
    pintar();
  });
}

// Formato para pegar:  pregunta en un renglón, opciones con "-" y la correcta con "*",
// y una línea en blanco entre preguntas.
export function leerPreguntasPegadas(texto) {
  const bloques = String(texto || "").replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const preguntas = [], errores = [];
  bloques.forEach((b, i) => {
    const lineas = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const pregunta = lineas.shift()?.replace(/^\d+\s*[.)-]\s*/, "");
    const opciones = [], marcas = [];
    for (const l of lineas) {
      const m = l.match(/^([*✓✔-]|[a-fA-F][.)])\s*(.+)$/);
      if (!m) continue;
      const texto = m[2].replace(/\s*\((correcta|ok)\)\s*$/i, "").trim();
      const esCorrecta = m[1] === "*" || m[1] === "✓" || m[1] === "✔" || /\((correcta|ok)\)\s*$/i.test(m[2]);
      if (esCorrecta) marcas.push(opciones.length);
      opciones.push(texto);
    }
    if (!pregunta || opciones.length < 2) errores.push(`Pregunta ${i + 1}: necesita al menos 2 opciones`);
    else if (marcas.length !== 1) errores.push(`Pregunta ${i + 1}: marca exactamente una correcta con *`);
    else preguntas.push({ pregunta, opciones, correcta: marcas[0] });
  });
  return { preguntas, errores };
}

function pegarPreguntas(cursoId, yaHay) {
  return new Promise((resolver) => {
    modal(`
      <h2 class="modal-titulo">Pegar preguntas</h2>
      <p class="modal-texto" style="font-size:14px">Escribe o pega varias de una vez. Cada pregunta en un renglón, sus opciones abajo con <b>-</b> y la correcta con <b>*</b>. Deja un renglón vacío entre preguntas.</p>
      <label class="campo"><span class="oculto">Preguntas</span><textarea id="pp-txt" rows="11" style="font-size:14px" placeholder="¿Cuánto debe durar una extracción de espresso?&#10;- 10 a 15 segundos&#10;* 25 a 30 segundos&#10;- 1 minuto&#10;&#10;Si el espresso sale muy rápido, la molienda está…&#10;* Muy gruesa&#10;- Muy fina"></textarea></label>
      <p class="texto-tenue" id="pp-info" style="margin:0"></p>
      <p class="error-form" id="pp-err" hidden></p>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="pp-ok">Agregar</button></div>`, { clase: "modal-ancho" }).then((r) => resolver(r === "ok"));
    const capa = modal.actual;
    const txt = capa.querySelector("#pp-txt"), info = capa.querySelector("#pp-info"), err = capa.querySelector("#pp-err");
    txt.oninput = () => {
      const { preguntas, errores } = leerPreguntasPegadas(txt.value);
      info.textContent = txt.value.trim() ? `${preguntas.length} pregunta(s) lista(s)${errores.length ? ` · ${errores.length} con detalle` : ""}` : "";
      err.hidden = !errores.length; err.textContent = errores.join(" · ");
    };
    capa.querySelector("#pp-ok").onclick = async () => {
      const { preguntas, errores } = leerPreguntasPegadas(txt.value);
      if (!preguntas.length || errores.length) { err.textContent = errores.join(" · ") || "No encontré preguntas"; err.hidden = false; return; }
      const btn = capa.querySelector("#pp-ok"); btn.disabled = true; btn.textContent = "Guardando…";
      try {
        for (let i = 0; i < preguntas.length; i++) await datos.guardarPregunta({ curso_id: cursoId, ...preguntas[i], orden: yaHay + i + 1 });
        capa.cerrar("ok"); aviso(`${preguntas.length} pregunta(s) agregadas`, "ok");
      } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = "Agregar"; }
    };
    txt.focus();
  });
}

// ---------------------------------------------------------------------
//  MATERIALES (PDFs, imágenes, links)
// ---------------------------------------------------------------------
export const pesoTexto = (kb) => (!kb ? "" : kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB");
export const tituloDeArchivo = (nombre) => String(nombre || "Material").replace(/\.[^.]+$/, "").replace(/^\s*\d+\s*[-_.)]*\s*/, "").replace(/[_]+/g, " ").trim() || nombre;

export async function panelMateriales(caja, curso) {
  caja.innerHTML = `<div class="cargando" style="min-height:80px"><div class="taza-carga"></div></div>`;
  let lista;
  try { lista = await datos.adminMateriales(curso.id); }
  catch (e) { caja.innerHTML = `<h2>Materiales</h2><p class="error-form">${esc(e.message)}</p>`; return; }
  const recargar = () => panelMateriales(caja, curso);
  caja.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap"><h2>Materiales</h2>
      <div class="fila" style="gap:6px">
        <button class="btn btn-sec btn-chico" id="mt-link">${icono("next", 16)}Link</button>
        <button class="btn btn-chico" id="mt-archivo">${icono("plus", 16)}Archivo</button>
      </div>
    </div>
    ${lista.length ? lista.map((m) => `
      <div class="leccion-admin">
        ${icono(m.tipo === "link" ? "next" : "file", 18, 'style="color:var(--oro);flex:none"')}
        <div class="nombre"><b style="font-weight:600">${esc(m.titulo)}</b><small>${m.tipo === "link" ? "Link" : (m.tipo || "pdf").toUpperCase()}${m.peso_kb ? " · " + pesoTexto(m.peso_kb) : ""}</small></div>
        <button class="mini-btn" aria-label="Renombrar" data-medit="${m.id}">${icono("edit", 16)}</button>
        <button class="mini-btn" aria-label="Quitar" data-mdel="${m.id}">${icono("trash", 16)}</button>
      </div>`).join("")
    : `<p class="texto-tenue" style="margin:0">PDFs, recetas, fichas técnicas o imágenes (máx. ${MAX_MB} MB cada uno). También links, por ejemplo a un documento de Drive.</p>`}
    <p class="texto-tenue" id="mt-estado" style="margin:0"></p>`;

  caja.querySelector("#mt-archivo").onclick = () => {
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true; input.accept = "application/pdf,image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const archivos = [...input.files];
      const grandes = archivos.filter((f) => f.size > MAX_MB * 1024 * 1024);
      if (grandes.length) aviso(`${grandes.map((f) => f.name).join(", ")} pesa más de ${MAX_MB} MB y se omitió`, "error");
      const ok = archivos.filter((f) => f.size <= MAX_MB * 1024 * 1024);
      const estado = caja.querySelector("#mt-estado");
      for (let i = 0; i < ok.length; i++) {
        estado.textContent = `Subiendo ${i + 1} de ${ok.length}: ${ok[i].name}…`;
        try { await datos.subirMaterial(curso.id, ok[i], tituloDeArchivo(ok[i].name), lista.length + i + 1); }
        catch (e) { aviso(`${ok[i].name}: ${e.message}`, "error"); }
      }
      if (ok.length) { aviso(`${ok.length} material(es) agregados`, "ok"); recargar(); }
    };
    input.click();
  };
  caja.querySelector("#mt-link").onclick = async () => {
    const v = await formulario("Agregar link", [
      { nombre: "titulo", etiqueta: "Nombre", requerido: true, autofocus: true, placeholder: "Recetario de bebidas" },
      { nombre: "url", etiqueta: "Link", requerido: true, placeholder: "https://…" },
    ], "Agregar");
    if (!v) return;
    if (!/^https?:\/\//i.test(v.url)) return aviso("El link debe empezar con https://", "error");
    try { await datos.agregarMaterialLink(curso.id, v.titulo, v.url, lista.length + 1); recargar(); } catch (e) { aviso(e.message, "error"); }
  };
  caja.querySelectorAll("[data-medit]").forEach((b) => (b.onclick = async () => {
    const m = lista.find((x) => x.id === b.dataset.medit);
    const v = await formulario("Renombrar material", [{ nombre: "titulo", etiqueta: "Nombre", valor: m.titulo, requerido: true }]);
    if (!v) return;
    try { await datos.actualizarMaterial(m.id, { titulo: v.titulo }); recargar(); } catch (e) { aviso(e.message, "error"); }
  }));
  caja.querySelectorAll("[data-mdel]").forEach((b) => (b.onclick = async () => {
    const m = lista.find((x) => x.id === b.dataset.mdel);
    if (!(await confirmar("¿Quitar material?", `"${m.titulo}" se borra del curso.`, "Quitar"))) return;
    try { await datos.borrarMaterial(m); recargar(); } catch (e) { aviso(e.message, "error"); }
  }));
}
