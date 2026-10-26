// =====================================================================
//  ADMIN · Ideas del equipo (lo que proponen desde "Mi libreta") y
//  espacio de las libretas en la nube (borrar después del respaldo).
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, aviso, modal, confirmar, reloj, fechaCorta, haceCuanto } from "./ui.js";
import { avatarOIniciales } from "./avatar.js";
import { ESTADOS_IDEA } from "./libreta.js";
import { cfgPuntos } from "./puntos.js";

const PLAN_GRATIS = 1024 ** 3; // 1 GB de archivos en el plan gratis (compartido con tus otras apps)
const tamano = (b) => (b >= 1e9 ? (b / 1e9).toFixed(2) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(0, Math.round(b / 1e3)) + " KB");
const NOMBRE_ESTADO = { nueva: "Nuevas", probando: "Las vamos a probar", implementada: "Implementadas", descartada: "Descartadas" };
const falta10 = (e) => (/academia_ideas|academia_notas|academia_libretas|does not exist|PGRST20/i.test(e?.message || "") ? "Falta correr el paso 10 de SQL (libreta e ideas) en Supabase." : e?.message);

export async function contarIdeasNuevas() {
  try { return (await datos.adminIdeas()).filter((i) => i.estado === "nueva").length; } catch (_) { return 0; }
}

export async function pintarIdeasAdmin(main, pestana = "ideas") {
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;gap:10px">
      <div><h1 class="titulo-pagina">Ideas del equipo</h1>
        <span class="texto-tenue">Lo que tu equipo te propone desde su libreta para mejorar el menú y el servicio.</span></div>
    </div>
    <div class="pestanas" id="ideas-pestanas" style="max-width:420px">
      <button data-p="ideas" class="${pestana === "ideas" ? "activo" : ""}">${icono("bulb", 16)} Ideas</button>
      <button data-p="libretas" class="${pestana === "libretas" ? "activo" : ""}">${icono("libreta", 16)} Libretas y espacio</button>
    </div>
    <div id="ideas-cuerpo" class="pila"><div class="cargando"><div class="taza-carga"></div></div></div>`;
  main.querySelector("#ideas-pestanas").onclick = (e) => {
    const b = e.target.closest("[data-p]"); if (!b) return;
    history.replaceState(null, "", `${location.pathname}${location.search}#/admin/ideas/${b.dataset.p}`);
    pintarIdeasAdmin(main, b.dataset.p);
  };
  const cuerpo = main.querySelector("#ideas-cuerpo");
  try {
    if (pestana === "libretas") await pintarLibretas(cuerpo, () => pintarIdeasAdmin(main, "libretas"));
    else await pintarIdeas(cuerpo, () => pintarIdeasAdmin(main, "ideas"));
  } catch (e) {
    cuerpo.innerHTML = `<div class="vacio"><strong>No se pudo cargar</strong>${esc(falta10(e))}</div>`;
  }
}

// ---------------------------------------------------------------------
async function pintarIdeas(cuerpo, recargar) {
  const [ideas, perfiles, avs] = await Promise.all([datos.adminIdeas(), datos.adminPerfiles().catch(() => []), datos.avatares().catch(() => ({}))]);
  const persona = (uid) => perfiles.find((p) => p.user_id === uid) || { nombre: "Empleado" };
  let filtro = ideas.some((i) => i.estado === "nueva") ? "nueva" : "todas";
  const urls = await datos.urlsArchivosNota(ideas.flatMap((i) => [i.audio_path, i.foto_path])).catch(() => ({}));
  const cuenta = (est) => ideas.filter((i) => est === "todas" || i.estado === est).length;

  const tarjeta = (i) => {
    const p = persona(i.user_id), est = ESTADOS_IDEA[i.estado] || ESTADOS_IDEA.nueva;
    return `
    <article class="idea-admin ${i.estado}">
      <div class="fila-entre" style="gap:10px;align-items:flex-start">
        <div class="idea-quien">${avatarOIniciales(avs[i.user_id], p.nombre, 40)}
          <div><b>${esc(p.nombre)}</b><div class="texto-tenue" style="font-size:12px">${haceCuanto(i.creado_en)}${i.referencia ? " · " + esc(i.referencia) : ""}${i.segundo != null ? ` · min ${reloj(i.segundo)}` : ""}</div></div></div>
        <span class="estado-idea ${est.clase}">${icono(est.ic, 13)}${{ nueva: "Nueva", probando: "La vamos a probar", implementada: "Implementada", descartada: "Descartada" }[i.estado]}</span>
      </div>
      ${i.texto ? `<p class="nota-texto">${esc(i.texto)}</p>` : ""}
      ${i.audio_path && urls[i.audio_path] ? `<audio controls preload="none" src="${esc(urls[i.audio_path])}" style="width:100%"></audio>` : i.audio_path ? `<span class="texto-tenue">${icono("mic", 14)} Nota de voz (no se pudo cargar)</span>` : ""}
      ${i.foto_path && urls[i.foto_path] ? `<button class="nota-foto" data-foto="${esc(urls[i.foto_path])}"><img src="${esc(urls[i.foto_path])}" alt="Foto" loading="lazy"></button>` : ""}
      ${i.respuesta ? `<div class="respuesta-gustavo">${icono("user", 14)}<span><b>Tu respuesta:</b> ${esc(i.respuesta)}</span></div>` : ""}
      ${i.puntos ? `<b style="color:var(--oro);font-size:13px">Ya recibió +${i.puntos} pts por esta idea</b>` : ""}
      <div class="fila" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">
        ${i.estado === "nueva" ? `<button class="btn btn-chico btn-sec" data-rapido="probando" data-id="${i.id}">${icono("flame", 16)}La vamos a probar</button>` : ""}
        <button class="btn btn-chico" data-responder="${i.id}">${icono("edit", 16)}Responder</button>
      </div>
    </article>`;
  };

  const pintar = () => {
    const lista = ideas.filter((i) => filtro === "todas" || i.estado === filtro);
    cuerpo.innerHTML = `
      <div class="chips chips-scroll" id="ideas-filtro">
        ${["nueva", "probando", "implementada", "descartada", "todas"].map((e) => `<button class="chip ${filtro === e ? "activo" : ""}" data-f="${e}">${e === "todas" ? "Todas" : NOMBRE_ESTADO[e]} · ${cuenta(e)}</button>`).join("")}
      </div>
      ${lista.length ? lista.map(tarjeta).join("") : `<div class="vacio"><strong>${ideas.length ? "Nada en esta lista" : "Todavía no hay ideas"}</strong>${ideas.length ? "" : "Cuando alguien toque \"Proponer a Gustavo\" en su libreta, su idea aparece aquí con su texto, nota de voz o foto."}</div>`}`;
    cuerpo.querySelector("#ideas-filtro").onclick = (e) => { const b = e.target.closest("[data-f]"); if (b) { filtro = b.dataset.f; pintar(); } };
    cuerpo.querySelectorAll("[data-foto]").forEach((b) => (b.onclick = () => modal(`<img src="${esc(b.dataset.foto)}" alt="Foto" style="width:100%;border-radius:14px"><button class="btn btn-sec btn-bloque" data-cerrar>Cerrar</button>`)));
    cuerpo.querySelectorAll("[data-rapido]").forEach((b) => (b.onclick = async () => {
      try { await datos.responderIdea(b.dataset.id, b.dataset.rapido, ideas.find((x) => x.id === b.dataset.id)?.respuesta || "", 0); aviso("Le avisaremos en su app 🔥", "ok"); recargar(); }
      catch (e) { aviso(falta10(e), "error"); }
    }));
    cuerpo.querySelectorAll("[data-responder]").forEach((b) => (b.onclick = () => responder(ideas.find((x) => x.id === b.dataset.responder), persona, recargar)));
  };
  pintar();
}

async function responder(i, persona, recargar) {
  const p = persona(i.user_id);
  const sugeridos = Number(cfgPuntos().puntos_idea) || 50;
  const yaPagada = i.puntos > 0;
  const v = await new Promise((ok) => {
    modal(`
      <h2 class="modal-titulo">Responder a ${esc(p.nombre.split(" ")[0])}</h2>
      ${i.texto ? `<p class="texto-tenue" style="margin:-4px 0 0;font-size:13.5px">"${esc(i.texto.slice(0, 160))}${i.texto.length > 160 ? "…" : ""}"</p>` : ""}
      <div class="pila" style="gap:6px" id="ri-estados">
        ${["nueva", "probando", "implementada", "descartada"].map((e) => `
          <label class="check"><input type="radio" name="estado" value="${e}" ${i.estado === e ? "checked" : ""}><span>${icono(ESTADOS_IDEA[e].ic, 16)} ${{ nueva: "Pendiente (sin revisar)", probando: "La vamos a probar", implementada: "¡Implementada!", descartada: "No por ahora" }[e]}</span></label>`).join("")}
      </div>
      <label class="campo"><span>Mensaje para ${esc(p.nombre.split(" ")[0])} (lo verá en su libreta)</span>
        <textarea id="ri-resp" rows="3" maxlength="2000" placeholder="¡Gracias! La probamos el fin de semana…">${esc(i.respuesta || "")}</textarea></label>
      <label class="campo" id="ri-pts-caja" ${i.estado === "implementada" ? "" : "hidden"}><span>Puntos de bono ${yaPagada ? `(ya recibió ${i.puntos}; no se vuelven a dar)` : "(una sola vez)"}</span>
        <input id="ri-pts" type="number" min="0" max="1000" value="${yaPagada ? 0 : sugeridos}" ${yaPagada ? "disabled" : ""}></label>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="ri-ok">${icono("check", 18)}Guardar</button></div>`);
    const capa = modal.actual;
    capa.querySelector("#ri-estados").onchange = () => { capa.querySelector("#ri-pts-caja").hidden = capa.querySelector('input[name="estado"]:checked')?.value !== "implementada"; };
    capa.querySelector("#ri-ok").onclick = () => {
      const estado = capa.querySelector('input[name="estado"]:checked')?.value || i.estado;
      ok({ estado, respuesta: capa.querySelector("#ri-resp").value, puntos: estado === "implementada" && !yaPagada ? Math.max(0, Math.min(1000, Number(capa.querySelector("#ri-pts").value) || 0)) : 0 });
      capa.cerrar(true);
    };
    capa.addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]") || e.target === capa) ok(null); });
  });
  if (!v) return;
  try {
    const r = await datos.responderIdea(i.id, v.estado, v.respuesta, v.puntos);
    aviso(r?.puntos_dados ? `Guardado · +${r.puntos_dados} pts para ${p.nombre.split(" ")[0]} 🎉` : "Guardado. Lo verá en su app.", "ok");
    recargar();
  } catch (e) { aviso(falta10(e), "error"); }
}

// ---------------------------------------------------------------------
async function pintarLibretas(cuerpo, recargar) {
  const [lista, avs] = await Promise.all([datos.libretasResumen(), datos.avatares().catch(() => ({}))]);
  const total = lista.reduce((a, x) => a + Number(x.bytes || 0), 0);
  const pct = Math.min(100, (total / PLAN_GRATIS) * 100);
  const respaldoAlDia = (x) => x.respaldo_en && (!x.ultima_nota || x.respaldo_en >= x.ultima_nota);
  cuerpo.innerHTML = `
    <section class="tarjeta pila" style="gap:10px">
      <div class="fila-entre"><b>Espacio de las libretas en la nube</b><b style="color:var(--oro)">${tamano(total)}</b></div>
      <div class="uso-barra"><i style="width:${Math.max(pct, total ? 1 : 0)}%"></i></div>
      <span class="texto-tenue" style="font-size:12.5px">Tu plan gratis de Supabase trae 1 GB para archivos, compartido con tus otras apps (portadas, materiales…). Las notas de voz pesan ~200 KB por minuto y las fotos ~150 KB.</span>
      <span class="texto-tenue" style="font-size:12.5px">${icono("descargar", 14)} Antes de borrar, pide a la persona que entre a <b>Mi libreta → Descargar mi respaldo</b>. Aquí ves si ya lo hizo.</span>
    </section>
    ${lista.length ? `<div class="tabla-caja"><table class="tabla">
      <thead><tr><th>Empleado</th><th>Apuntes</th><th>Archivos</th><th>Respaldo</th><th></th></tr></thead>
      <tbody>${lista.map((x) => `
        <tr>
          <td><span class="fila" style="gap:8px">${avatarOIniciales(avs[x.user_id], x.nombre, 32)}<b>${esc(x.nombre)}</b>${x.activo ? "" : ' <span class="pildora">Inactivo</span>'}</span></td>
          <td>${x.notas}${x.ideas ? ` <span class="texto-tenue">· ${x.ideas} ${x.ideas === 1 ? "idea" : "ideas"}</span>` : ""}<div class="texto-tenue" style="font-size:11.5px">${x.ultima_nota ? haceCuanto(x.ultima_nota) : ""}</div></td>
          <td>${x.archivos} <span class="texto-tenue">· ${tamano(Number(x.bytes || 0))}</span></td>
          <td>${respaldoAlDia(x) ? `<span style="color:var(--verde);font-weight:700">${icono("check", 14)} ${fechaCorta(x.respaldo_en)}</span>` : x.respaldo_en ? `<span class="sin-respaldo">Desactualizado</span><div class="texto-tenue" style="font-size:11.5px">${fechaCorta(x.respaldo_en)}</div>` : `<span class="sin-respaldo">Sin respaldo</span>`}</td>
          <td style="text-align:right"><button class="btn btn-chico btn-sec" data-borrar="${x.user_id}" ${x.archivos || x.notas ? "" : "disabled"}>${icono("trash", 16)}Borrar de la nube</button></td>
        </tr>`).join("")}</tbody></table></div>`
      : `<div class="vacio"><strong>Nadie ha usado su libreta todavía</strong>Cuando tu equipo tome apuntes, aquí verás cuánto espacio ocupan.</div>`}`;

  cuerpo.querySelectorAll("[data-borrar]").forEach((b) => (b.onclick = async () => {
    const x = lista.find((y) => y.user_id === b.dataset.borrar);
    const alDia = respaldoAlDia(x);
    const v = await new Promise((ok) => {
      modal(`
        <h2 class="modal-titulo">Borrar libreta de ${esc(x.nombre)} de la nube</h2>
        <div class="tarjeta fila" style="gap:10px;border:1px solid ${alDia ? "var(--verde)" : "var(--alerta)"}">
          ${icono(alDia ? "check" : "descargar", 20, `style="flex:none;color:${alDia ? "var(--verde)" : "var(--alerta)"}"`)}
          <span style="font-size:13.5px">${alDia ? `Descargó su respaldo el <b>${fechaCorta(x.respaldo_en)}</b>, después de su último apunte.` : `<b>No tiene un respaldo al día.</b> Pídele que entre a Mi libreta → Descargar mi respaldo antes de borrar, o lo pierde para siempre.`}</span>
        </div>
        <div class="pila" style="gap:6px">
          <label class="check"><input type="radio" name="alcance" value="terminados" checked><span>Solo de los cursos que ya terminó</span></label>
          <label class="check"><input type="radio" name="alcance" value="todo"><span>Todo (incluye cursos en curso y apuntes generales)</span></label>
        </div>
        <label class="check"><input type="checkbox" id="bl-texto"><span>Borrar también el texto de los apuntes (si no, solo se borran notas de voz y fotos, que son las que ocupan espacio)</span></label>
        <p class="texto-tenue" style="margin:0;font-size:12.5px">${icono("bulb", 14)} Las ideas que siguen abiertas (pendientes o "la vamos a probar") no se tocan. No se puede deshacer.</p>
        <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-peligro" id="bl-ok">${icono("trash", 18)}Borrar</button></div>`);
      const capa = modal.actual;
      capa.querySelector("#bl-ok").onclick = () => {
        ok({ soloTerminados: capa.querySelector('input[name="alcance"]:checked').value === "terminados", borrarTexto: capa.querySelector("#bl-texto").checked });
        capa.cerrar(true);
      };
      capa.addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]") || e.target === capa) ok(null); });
    });
    if (!v) return;
    if (!alDia && !(await confirmar("¿Borrar sin respaldo?", `${x.nombre} no ha descargado su respaldo al día. Lo que se borre no se puede recuperar.`, "Borrar de todos modos"))) return;
    try {
      const r = await datos.borrarLibreta(x.user_id, v);
      aviso(`Listo: ${r.archivos} archivo(s)${v.borrarTexto ? ` y ${r.notas} apunte(s)` : ""} borrados de la nube`, "ok");
      recargar();
    } catch (e) { aviso(falta10(e), "error"); }
  }));
}
