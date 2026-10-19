// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · Panel de administración
// =====================================================================
import { datos, MODO } from "./datos.js";
import { icono, esc, num, duracion, fechaCorta, hoyISO, haceCuanto, aviso, modal, confirmar, formulario, AREAS, SEDES, nombreArea } from "./ui.js";
import { subirCursoDesdeCarpeta } from "./subir.js";

const LOGO = "img/logo.png";
let ctx; // { ir, salir }

export async function vistaAdmin(app, partes, contexto) {
  ctx = contexto;
  const [seccion = "", id] = partes;
  const menu = [["", "chart", "Resumen"], ["empleados", "users", "Empleados"], ["cursos", "book", "Cursos"], ["premios", "gift", "Premios y canjes"], ["insignias", "medal", "Insignias"]];
  const activa = seccion === "curso" ? "cursos" : seccion;
  app.className = "";
  app.innerHTML = `
  ${MODO === "demo" ? `<div class="banda-demo">MODO DEMO · datos de ejemplo</div>` : ""}
  <div class="admin">
    <aside class="admin-menu">
      <div class="pila" style="gap:8px">
        <img src="${LOGO}" alt="Mozzafiato">
        <div class="serif" style="font-size:20px;line-height:1.1">Academia del Buen Café</div>
        <div class="etiqueta">Panel de administración</div>
      </div>
      <nav aria-label="Secciones">${menu.map(([r, ic, t]) => `<a href="#/admin${r ? "/" + r : ""}" class="${activa === r ? "activo" : ""}">${icono(ic, 18)}${t}</a>`).join("")}</nav>
      <div class="admin-pie pila" style="margin-top:auto">
        <button class="btn btn-sec btn-chico" id="salir">${icono("logout", 16)}Cerrar sesión</button>
      </div>
    </aside>
    <main class="admin-main" id="admin-main"><div class="cargando"><div class="taza-carga"></div></div></main>
  </div>`;
  app.querySelector("#salir").onclick = ctx.salir;
  const main = app.querySelector("#admin-main");
  try {
    if (seccion === "empleados") return await pintarEmpleados(main);
    if (seccion === "cursos") return await pintarCursos(main);
    if (seccion === "curso") return await pintarEditorCurso(main, id);
    if (seccion === "premios") return await pintarPremios(main);
    if (seccion === "insignias") return await pintarInsignias(main);
    return await pintarResumen(main);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="vacio"><strong>No se pudo cargar</strong>${esc(e.message)}</div><button class="btn" id="re">Reintentar</button>`;
    main.querySelector("#re").onclick = () => vistaAdmin(app, partes, contexto);
  }
}

const recargar = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
const pct = (e) => (e.lecciones_asignadas ? Math.round((e.lecciones_completadas / e.lecciones_asignadas) * 100) : 0);

function estadoEmpleado(e) {
  if (!e.activo) return ["Inactivo", ""];
  if (!e.lecciones_asignadas) return ["Sin cursos", ""];
  if (e.cursos_atrasados) return ["Atrasado", "pildora-alerta"];
  if (e.lecciones_completadas === 0) return ["Sin empezar", ""];
  if (e.lecciones_completadas === e.lecciones_asignadas) return ["Completo", "pildora-ok"];
  return ["Al día", "pildora-ok"];
}

// ---------------------------------------------------------------------
//  RESUMEN
// ---------------------------------------------------------------------
async function pintarResumen(main) {
  const [equipo, cursos, { canjes, premios }] = await Promise.all([datos.adminAvance(), datos.adminCursos(), datos.adminPremios()]);
  canjes.forEach((c) => (c.premio_nombre = premios.find((p) => p.id === c.premio_id)?.nombre || "Premio"));
  const activos = equipo.filter((e) => e.activo);
  const conCursos = activos.filter((e) => e.lecciones_asignadas);
  const promedio = conCursos.length ? Math.round(conCursos.reduce((a, e) => a + pct(e), 0) / conCursos.length) : 0;
  const atrasados = activos.filter((e) => e.cursos_atrasados).length;
  const pendientes = canjes.filter((c) => c.estado === "pendiente");
  let filtro = "todas";

  const f0 = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const fecha = f0.charAt(0).toUpperCase() + f0.slice(1);
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <div><div class="texto-tenue">${esc(fecha)}</div><h1 class="titulo-pagina" style="font-size:38px">Resumen del equipo</h1></div>
      <div class="fila" style="flex-wrap:wrap">
        <a class="btn btn-sec" href="#/admin/empleados">${icono("plus", 18)}Empleado</a>
        <a class="btn" href="#/admin/cursos">${icono("plus", 18)}Curso</a>
      </div>
    </div>
    <div class="metricas">
      <div class="metrica"><small>Empleados activos</small><b>${activos.length}</b><span>con acceso a la Academia</span></div>
      <div class="metrica"><small>Cursos publicados</small><b>${cursos.filter((c) => c.publicado).length}</b><span>${cursos.reduce((a, c) => a + c.lecciones, 0)} lecciones en total</span></div>
      <div class="metrica"><small>Avance promedio</small><b style="color:var(--oro)">${promedio}%</b><span>de lo asignado</span></div>
      <div class="metrica"><small>Atrasados</small><b style="color:${atrasados ? "var(--alerta)" : "inherit"}">${atrasados}</b><span>pasaron su fecha límite</span></div>
    </div>
    <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:20px">
      <section class="panel" style="flex:2 1 560px">
        <div class="fila-entre" style="flex-wrap:wrap"><h2>Avance por empleado</h2>
          <div class="chips" id="filtros">${[["todas", "Todas las áreas"], ...AREAS.filter(([a]) => equipo.some((e) => e.area === a))].map(([v, t]) => `<button class="chip ${v === filtro ? "activo" : ""}" data-f="${v}">${t}</button>`).join("")}</div>
        </div>
        <div class="tabla-caja" id="tabla-avance"></div>
      </section>
      <section class="panel" style="flex:1 1 300px">
        <h2>Canjes por aprobar</h2>
        <div id="canjes" class="pila">${listaCanjesHTML(pendientes)}</div>
      </section>
    </div>`;

  const pintarTabla = () => {
    const filas = activos.filter((e) => filtro === "todas" || e.area === filtro);
    main.querySelector("#tabla-avance").innerHTML = filas.length ? `
      <table class="tabla"><thead><tr><th>Empleado</th><th>Área</th><th style="width:32%">Avance</th><th>Puntos</th><th>Estado</th></tr></thead><tbody>
      ${filas.map((e) => { const [txt, cls] = estadoEmpleado(e); return `<tr>
        <td><b>${esc(e.nombre)}</b><div class="texto-tenue" style="font-size:12px">${esc(e.sede || "")}${e.turno ? " · " + esc(e.turno) : ""} · ${haceCuanto(e.ultima_actividad)}</div></td>
        <td>${esc(nombreArea(e.area))}</td>
        <td><div class="fila"><div class="barra fina" style="flex:1"><i style="width:${pct(e)}%;${e.cursos_atrasados ? "background:var(--alerta)" : ""}"></i></div><b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct(e)}%</b></div></td>
        <td>${num(e.puntos)}</td>
        <td><span class="pildora ${cls}">${txt}</span></td></tr>`; }).join("")}
      </tbody></table>` : `<div class="vacio"><strong>Sin empleados todavía</strong><a href="#/admin/empleados">Da de alta a tu equipo</a></div>`;
  };
  pintarTabla();
  main.querySelector("#filtros").onclick = (e) => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    filtro = b.dataset.f;
    main.querySelectorAll("#filtros .chip").forEach((c) => c.classList.toggle("activo", c === b));
    pintarTabla();
  };
  conectarCanjes(main);
}

function listaCanjesHTML(pendientes) {
  if (!pendientes.length) return `<p class="texto-tenue" style="margin:0">No hay solicitudes pendientes.</p>`;
  return pendientes.map((c) => `
    <div class="tarjeta pila" style="padding:12px">
      <div><b style="font-size:14px">${esc(c.nombre)} · ${esc(c.premio_nombre || "Premio")}</b><div class="texto-tenue" style="font-size:12px">${num(c.costo)} pts · ${haceCuanto(c.creado_en)}</div></div>
      <div class="fila"><button class="btn btn-chico" style="flex:1" data-canje="${c.id}" data-estado="aprobado">Aprobar</button>
      <button class="btn btn-sec btn-chico" style="flex:1" data-canje="${c.id}" data-estado="rechazado">Rechazar</button></div>
    </div>`).join("");
}
function conectarCanjes(main) {
  main.querySelectorAll("[data-canje]").forEach((b) => (b.onclick = async () => {
    const txt = b.dataset.estado === "aprobado" ? "Aprobar" : "Rechazar";
    if (!(await confirmar(`¿${txt} canje?`, b.dataset.estado === "aprobado" ? "Recuerda entregarle su premio." : "Los puntos regresan al empleado.", txt))) return;
    try { await datos.resolverCanje(b.dataset.canje, b.dataset.estado); aviso(b.dataset.estado === "aprobado" ? "Canje aprobado" : "Canje rechazado", "ok"); recargar(); }
    catch (e) { aviso(e.message, "error"); }
  }));
}

// ---------------------------------------------------------------------
//  EMPLEADOS · alta con usuario + PIN
// ---------------------------------------------------------------------
async function pintarEmpleados(main) {
  const equipo = await datos.adminAvance();
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina" style="font-size:38px">Empleados</h1>
      <div class="fila" style="flex-wrap:wrap">
        <button class="btn btn-sec" id="lote">${icono("users", 18)}Alta en lote</button>
        <button class="btn" id="nuevo">${icono("plus", 18)}Nuevo empleado</button>
      </div>
    </div>
    <section class="panel">
      ${equipo.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Nombre</th><th>Usuario</th><th>Área</th><th>Sede · turno</th><th>Avance</th><th></th></tr></thead><tbody>
      ${equipo.map((e) => `<tr class="${e.activo ? "" : "inactivo"}">
        <td><b>${esc(e.nombre)}</b>${e.activo ? "" : ' <span class="pildora">Inactivo</span>'}</td>
        <td>@${esc(e.usuario)}</td><td>${esc(nombreArea(e.area))}</td>
        <td>${esc(e.sede || "—")}${e.turno ? " · " + esc(e.turno) : ""}</td>
        <td>${pct(e)}% · ${num(e.puntos)} pts</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="mini-btn" title="Nuevo PIN" aria-label="Nuevo PIN de ${esc(e.nombre)}" data-pin="${e.user_id}">${icono("key", 18)}</button>
          <button class="mini-btn" title="Editar" aria-label="Editar ${esc(e.nombre)}" data-editar="${e.user_id}">${icono("edit", 18)}</button>
          <button class="mini-btn" title="${e.activo ? "Desactivar" : "Activar"}" aria-label="${e.activo ? "Desactivar" : "Activar"} ${esc(e.nombre)}" data-activo="${e.user_id}">${icono(e.activo ? "x" : "check", 18)}</button>
        </td></tr>`).join("")}
      </tbody></table></div>` : `<div class="vacio"><strong>Da de alta a tu equipo</strong>Cada empleado entra con un usuario y un PIN de 6 dígitos.</div>`}
    </section>
    <p class="texto-tenue">Desactivar a alguien le quita el acceso pero conserva su avance, por si regresa.</p>`;

  const porId = (id) => equipo.find((e) => e.user_id === id);
  main.querySelector("#nuevo").onclick = async () => {
    const d = await formulario("Nuevo empleado", [
      { nombre: "nombre", etiqueta: "Nombre", requerido: true, autofocus: true, placeholder: "Ana Pérez" },
      { nombre: "usuario", etiqueta: "Usuario (para entrar)", placeholder: "ana.barra", ayuda: "Si lo dejas vacío se arma con nombre y área." },
      { nombre: "area", etiqueta: "Área", tipo: "select", opciones: AREAS, valor: "piso" },
      { nombre: "sede", etiqueta: "Sede", tipo: "select", opciones: SEDES },
      { nombre: "turno", etiqueta: "Turno", tipo: "select", opciones: [["", "—"], ["AM", "AM"], ["PM", "PM"]] },
      { nombre: "pin", etiqueta: "PIN (opcional)", tipo: "pin", placeholder: "Se genera solo", ayuda: "6 dígitos. Si lo dejas vacío se genera uno seguro." },
    ], "Crear");
    if (!d) return;
    d.usuario = d.usuario || sugerirUsuario(d.nombre, d.area, equipo);
    try {
      const r = await datos.crearEmpleado(d);
      await mostrarAcceso(r.nombre || d.nombre, r.usuario, r.pin);
      recargar();
    } catch (e) { aviso(e.message, "error"); }
  };
  main.querySelector("#lote").onclick = () => altaEnLote(equipo);
  main.querySelectorAll("[data-pin]").forEach((b) => (b.onclick = async () => {
    const e = porId(b.dataset.pin);
    if (!(await confirmar("¿Generar nuevo PIN?", `${e.nombre} ya no podrá entrar con su PIN anterior.`, "Generar"))) return;
    try { const r = await datos.cambiarPin(e.user_id); await mostrarAcceso(e.nombre, e.usuario, r.pin); }
    catch (err) { aviso(err.message, "error"); }
  }));
  main.querySelectorAll("[data-editar]").forEach((b) => (b.onclick = async () => {
    const e = porId(b.dataset.editar);
    const d = await formulario(`Editar a ${e.nombre}`, [
      { nombre: "nombre", etiqueta: "Nombre", valor: e.nombre, requerido: true },
      { nombre: "area", etiqueta: "Área", tipo: "select", opciones: AREAS, valor: e.area },
      { nombre: "sede", etiqueta: "Sede", tipo: "select", opciones: SEDES, valor: e.sede },
      { nombre: "turno", etiqueta: "Turno", tipo: "select", opciones: [["", "—"], ["AM", "AM"], ["PM", "PM"]], valor: e.turno || "" },
    ]);
    if (!d) return;
    try { await datos.actualizarEmpleado(e.user_id, d); aviso("Guardado", "ok"); recargar(); } catch (err) { aviso(err.message, "error"); }
  }));
  main.querySelectorAll("[data-activo]").forEach((b) => (b.onclick = async () => {
    const e = porId(b.dataset.activo);
    if (e.activo && !(await confirmar(`¿Desactivar a ${e.nombre}?`, "Ya no podrá entrar. Su avance se conserva.", "Desactivar"))) return;
    try { await datos.actualizarEmpleado(e.user_id, { activo: !e.activo }); aviso(e.activo ? "Desactivado" : "Activado", "ok"); recargar(); }
    catch (err) { aviso(err.message, "error"); }
  }));
}

function sugerirUsuario(nombre, area, equipo) {
  const base = String(nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "") || "empleado";
  let u = `${base}.${(area || "mozza").replace(/_.*/, "")}`, n = 2;
  while (equipo.some((e) => e.usuario === u)) u = `${base}.${area}${n++}`;
  return u;
}

function mensajeAcceso(nombre, usuario, pin) {
  const link = location.origin + location.pathname;
  return `Hola ${String(nombre).split(" ")[0]} 👋\nYa tienes acceso a la *Academia del Buen Café* de Mozzafiato.\n\nEntra aquí: ${link}\nUsuario: *${usuario}*\nPIN: *${pin}*\n\nTip: ábrelo en tu celular y elige "Agregar a pantalla de inicio" para tenerla como app. No compartas tu PIN.`;
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); aviso("Copiado", "ok"); }
  catch { aviso("No se pudo copiar; selecciónalo a mano", "error"); }
}

function mostrarAcceso(nombre, usuario, pin) {
  const msg = mensajeAcceso(nombre, usuario, pin);
  const p = modal(`
    <h2 class="modal-titulo">Acceso de ${esc(nombre)}</h2>
    <p class="modal-texto">Usuario <b>@${esc(usuario)}</b></p>
    <div class="pin-grande" aria-label="PIN">${esc(pin)}</div>
    <p class="texto-tenue" style="margin:0">Guárdalo o envíaselo ahora: por seguridad no se vuelve a mostrar (puedes generar otro cuando quieras).</p>
    <div class="fila-botones">
      <button class="btn btn-sec" id="copiar-msg">${icono("file", 18)}Copiar mensaje</button>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a>
    </div>
    <button class="btn btn-sec btn-bloque" data-cerrar>Listo</button>`, { cerrable: false });
  modal.actual.querySelector("#copiar-msg").onclick = () => copiar(msg);
  return p;
}

async function altaEnLote(equipo) {
  const p = modal(`
    <h2 class="modal-titulo">Alta en lote</h2>
    <p class="modal-texto">Una persona por renglón: <b>Nombre, área, sede, turno</b>. Área: piso, barra, cocina, casa_regina. Los PIN se generan solos.</p>
    <label class="campo">Lista<textarea id="lote-txt" rows="8" placeholder="Ana Pérez, barra, Mozzafiato, AM&#10;Luis Méndez, piso, Mozzafiato, PM"></textarea></label>
    <p class="error-form" id="lote-err" hidden></p>
    <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="lote-ok">Crear cuentas</button></div>`, { clase: "modal-ancho" });
  const capa = modal.actual;
  capa.querySelector("#lote-ok").onclick = async () => {
    const usados = [...equipo];
    const lista = capa.querySelector("#lote-txt").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [nombre, area = "piso", sede = "Mozzafiato", turno = ""] = l.split(",").map((x) => x.trim());
      const a = AREAS.some(([v]) => v === area.toLowerCase()) ? area.toLowerCase() : "piso";
      const usuario = sugerirUsuario(nombre, a, usados);
      usados.push({ usuario });
      return { nombre, area: a, sede: sede || "Mozzafiato", turno: turno.toUpperCase() || null, usuario };
    });
    const err = capa.querySelector("#lote-err");
    if (!lista.length) { err.textContent = "Escribe al menos un renglón"; err.hidden = false; return; }
    const btn = capa.querySelector("#lote-ok"); btn.disabled = true; btn.textContent = `Creando ${lista.length}…`;
    try {
      const r = await datos.importarEmpleados(lista);
      capa.cerrar(true);
      const ok = r.resultados.filter((x) => x.ok);
      const todo = ok.map((x) => `${x.nombre}: usuario ${x.usuario} · PIN ${x.pin}`).join("\n");
      const p2 = modal(`
        <h2 class="modal-titulo">${r.creados} cuentas creadas</h2>
        ${r.con_error ? `<p class="error-form">${r.con_error} con error: ${r.resultados.filter((x) => !x.ok).map((x) => esc(`${x.usuario} (${x.error})`)).join(", ")}</p>` : ""}
        <div class="tabla-caja"><table class="tabla" style="min-width:0"><thead><tr><th>Nombre</th><th>Usuario</th><th>PIN</th><th></th></tr></thead><tbody>
          ${ok.map((x, i) => `<tr><td>${esc(x.nombre)}</td><td>@${esc(x.usuario)}</td><td><b style="color:var(--oro);letter-spacing:2px">${esc(x.pin)}</b></td>
            <td><a class="mini-btn" target="_blank" rel="noopener" aria-label="WhatsApp" href="https://wa.me/?text=${encodeURIComponent(mensajeAcceso(x.nombre, x.usuario, x.pin))}">${icono("next", 18)}</a></td></tr>`).join("")}
        </tbody></table></div>
        <p class="texto-tenue" style="margin:0">Los PIN no se vuelven a mostrar. Cópialos ahora.</p>
        <div class="fila-botones"><button class="btn btn-sec" id="copiar-todo">Copiar lista</button><button class="btn" data-cerrar>Listo</button></div>`, { cerrable: false, clase: "modal-ancho" });
      modal.actual.querySelector("#copiar-todo").onclick = () => copiar(todo);
      await p2;
      recargar();
    } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = "Crear cuentas"; }
  };
  await p;
}

// ---------------------------------------------------------------------
//  CURSOS
// ---------------------------------------------------------------------
async function pintarCursos(main) {
  const cursos = await datos.adminCursos();
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina" style="font-size:38px">Cursos</h1>
      <div class="fila" style="flex-wrap:wrap">
        <button class="btn btn-sec" id="nuevo">${icono("plus", 18)}Curso vacío</button>
        <button class="btn" id="carpeta">${icono("video", 18)}Subir curso desde carpeta</button>
      </div>
    </div>
    <p class="texto-tenue" style="margin:0">Tip: organiza en tu computadora <b>Curso / Capítulos / videos</b> y súbelo de una vez. Cada subcarpeta se vuelve un capítulo y cada video una lección, en orden por nombre (usa 01, 02, 03…).</p>
    ${cursos.length ? `<div class="rejilla">${cursos.map((c) => `
      <a class="tarjeta-borde pila" href="#/admin/curso/${c.id}" style="gap:8px">
        <div class="fila-entre" style="align-items:flex-start"><b style="font-size:16px">${esc(c.titulo)}</b>
          <span class="pildora ${c.publicado ? "pildora-ok" : ""}">${c.publicado ? "Publicado" : "Borrador"}</span></div>
        <span class="texto-tenue">${esc(nombreArea(c.categoria))} · ${c.lecciones} lecciones · ${duracion(c.duracion_seg)}</span>
        <span class="texto-tenue" style="font-size:12px">${c.asignaciones ? `${c.asignaciones} asignación(es)` : "Sin asignar todavía"}</span>
      </a>`).join("")}</div>`
      : `<div class="vacio"><strong>Crea tu primer curso</strong>Luego le agregas capítulos y eliges los videos de tu biblioteca de Bunny.</div>`}`;
  main.querySelector("#nuevo").onclick = async () => {
    const d = await formulario("Nuevo curso", [
      { nombre: "titulo", etiqueta: "Título", requerido: true, autofocus: true, placeholder: "Barismo nivel 1" },
      { nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: AREAS, valor: "barra" },
      { nombre: "descripcion", etiqueta: "Descripción (opcional)", tipo: "area" },
    ], "Crear curso");
    if (!d) return;
    try { const c = await datos.guardarCurso({ ...d, orden: cursos.length + 1 }); ctx.ir(`/admin/curso/${c.id}`); }
    catch (e) { aviso(e.message, "error"); }
  };
  main.querySelector("#carpeta").onclick = () => subirCursoDesdeCarpeta({ alTerminar: (id) => ctx.ir(`/admin/curso/${id}`) });
}

// Completa duraciones de lecciones recién subidas cuando Bunny termina de procesarlas.
async function sincronizarDuraciones(lecciones) {
  const faltan = lecciones.filter((l) => l.bunny_video_id && !l.duracion_seg);
  if (!faltan.length) return false;
  try {
    const videos = await datos.bunnyVideos();
    const porId = Object.fromEntries(videos.map((v) => [v.id, v]));
    const cambios = faltan.filter((l) => porId[l.bunny_video_id]?.duracion_seg > 0);
    await Promise.all(cambios.map((l) => datos.actualizarLeccion(l.id, { duracion_seg: Math.round(porId[l.bunny_video_id].duracion_seg) })));
    return cambios.length > 0;
  } catch (e) { console.warn("No se pudieron leer duraciones", e); return false; }
}

async function pintarEditorCurso(main, id) {
  const d = await datos.adminCurso(id);
  if (!d.curso) throw new Error("Curso no encontrado");
  const c = d.curso;
  const caps = [...d.modulos].sort((a, b) => a.orden - b.orden).map((m) => ({ ...m, lecciones: d.lecciones.filter((l) => l.modulo_id === m.id).sort((a, b) => a.orden - b.orden) }));
  const sueltas = d.lecciones.filter((l) => !l.modulo_id || !d.modulos.some((m) => m.id === l.modulo_id));
  const durTotal = d.lecciones.reduce((a, l) => a + (l.duracion_seg || 0), 0);
  const nombrePerfil = (uid) => d.perfiles.find((p) => p.user_id === uid)?.nombre || "Persona";

  const leccionHTML = (l, lista, i) => `
    <div class="leccion-admin">
      ${icono("video", 18, 'style="color:var(--arena);flex:none"')}
      <div class="nombre"><b style="font-weight:600">${esc(l.titulo)}</b><small>${l.duracion_seg ? duracion(l.duracion_seg) : l.bunny_video_id ? "Bunny lo está procesando…" : ""}${l.bunny_video_id ? "" : "sin video"}</small></div>
      <button class="mini-btn" aria-label="Subir" data-mover-l="${l.id}" data-dir="-1" ${i === 0 ? "disabled" : ""}>${icono("up", 18)}</button>
      <button class="mini-btn" aria-label="Bajar" data-mover-l="${l.id}" data-dir="1" ${i === lista.length - 1 ? "disabled" : ""}>${icono("down", 18)}</button>
      <button class="mini-btn" aria-label="Renombrar" data-renombrar-l="${l.id}">${icono("edit", 18)}</button>
      <button class="mini-btn" aria-label="Quitar" data-borrar-l="${l.id}">${icono("trash", 18)}</button>
    </div>`;

  main.innerHTML = `
    <a href="#/admin/cursos" class="btn-texto" style="display:inline-flex;align-items:center;gap:4px;align-self:flex-start">${icono("back", 16)}Cursos</a>
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-start">
      <div class="pila" style="gap:4px;flex:1 1 320px">
        <span class="etiqueta">${esc(nombreArea(c.categoria))} · ${c.publicado ? "Publicado" : "Borrador"}</span>
        <h1 class="titulo-pagina" style="font-size:38px">${esc(c.titulo)}</h1>
        <span class="texto-tenue">${caps.length} capítulos · ${d.lecciones.length} lecciones · ${duracion(durTotal)}${c.quiz_obligatorio ? ` · quiz obligatorio (${c.quiz_minimo}%)` : ""}</span>
      </div>
      <div class="fila" style="flex-wrap:wrap">
        <a class="btn btn-sec" href="#/admin/ver/curso/${c.id}">${icono("eye", 18)}Ver como empleado</a>
        <button class="btn btn-sec" id="editar">${icono("edit", 18)}Datos del curso</button>
        <button class="btn ${c.publicado ? "btn-sec" : ""}" id="publicar">${c.publicado ? "Pasar a borrador" : "Publicar"}</button>
      </div>
    </div>
    ${!c.publicado ? `<div class="tarjeta texto-tenue">En borrador: los empleados todavía no lo ven. Agrega capítulos, videos y asignaciones; luego dale <b>Publicar</b>.</div>` : ""}

    <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:20px">
      <section class="panel" style="flex:2 1 520px">
        <div class="fila-entre"><h2>Capítulos y lecciones</h2><button class="btn btn-chico" id="nuevo-cap">${icono("plus", 16)}Capítulo</button></div>
        ${caps.map((cap, ci) => `
          <div class="capitulo-admin">
            <div class="fila-entre">
              <b>Capítulo ${ci + 1} · ${esc(cap.titulo)}</b>
              <div class="fila" style="gap:0">
                <button class="mini-btn" aria-label="Subir capítulo" data-mover-m="${cap.id}" data-dir="-1" ${ci === 0 ? "disabled" : ""}>${icono("up", 18)}</button>
                <button class="mini-btn" aria-label="Bajar capítulo" data-mover-m="${cap.id}" data-dir="1" ${ci === caps.length - 1 ? "disabled" : ""}>${icono("down", 18)}</button>
                <button class="mini-btn" aria-label="Renombrar capítulo" data-renombrar-m="${cap.id}">${icono("edit", 18)}</button>
                <button class="mini-btn" aria-label="Borrar capítulo" data-borrar-m="${cap.id}">${icono("trash", 18)}</button>
              </div>
            </div>
            ${cap.lecciones.map((l, i) => leccionHTML(l, cap.lecciones, i)).join("") || `<span class="texto-tenue">Sin videos todavía.</span>`}
            <button class="btn btn-sec btn-chico" data-agregar="${cap.id}" style="align-self:flex-start">${icono("plus", 16)}Agregar videos</button>
          </div>`).join("")}
        ${sueltas.length ? `<div class="capitulo-admin"><b>Sin capítulo</b>${sueltas.map((l, i) => leccionHTML(l, sueltas, i)).join("")}</div>` : ""}
        ${!caps.length && !sueltas.length ? `<div class="vacio"><strong>Empieza con un capítulo</strong>Por ejemplo "El grano y el café". Luego eliges sus videos de Bunny.</div>` : ""}
      </section>

      <div class="pila" style="flex:1 1 300px;gap:20px">
        <section class="panel">
          <div class="fila-entre"><h2>¿Quién lo toma?</h2><button class="btn btn-chico" id="asignar">${icono("plus", 16)}Asignar</button></div>
          ${d.asignaciones.length ? d.asignaciones.map((a) => `
            <div class="tarjeta fila-entre" style="padding:12px">
              <div><b style="font-size:14px">${a.user_id ? esc(nombrePerfil(a.user_id)) : a.area ? esc(nombreArea(a.area)) : "Todo el equipo"}${a.sede ? " · " + esc(a.sede) : ""}</b>
                <div class="texto-tenue" style="font-size:12px">${a.obligatorio ? "Obligatorio" : "Opcional"}${a.fecha_limite ? " · vence " + fechaCorta(a.fecha_limite) : ""}</div></div>
              <button class="mini-btn" aria-label="Quitar asignación" data-borrar-a="${a.id}">${icono("trash", 18)}</button>
            </div>`).join("") : `<p class="texto-tenue" style="margin:0">Aún no está asignado a nadie.</p>`}
        </section>
        <section class="panel">
          <h2>Quiz y materiales</h2>
          <p class="texto-tenue" style="margin:0">El editor de preguntas, los PDFs y el certificado llegan en la siguiente versión.</p>
        </section>
        <button class="btn btn-peligro" id="borrar-curso">${icono("trash", 18)}Borrar curso</button>
      </div>
    </div>`;

  const conError = async (fn, ok) => { try { await fn(); if (ok) aviso(ok, "ok"); recargar(); } catch (e) { aviso(e.message, "error"); } };
  sincronizarDuraciones(d.lecciones).then((hubo) => { if (hubo && location.hash.includes(c.id)) recargar(); });

  main.querySelector("#editar").onclick = async () => {
    const v = await formulario("Datos del curso", [
      { nombre: "titulo", etiqueta: "Título", valor: c.titulo, requerido: true },
      { nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: AREAS, valor: c.categoria },
      { nombre: "descripcion", etiqueta: "Descripción", tipo: "area", valor: c.descripcion },
      { nombre: "quiz_obligatorio", etiqueta: "Quiz obligatorio para terminar", tipo: "check", valor: c.quiz_obligatorio },
      { nombre: "quiz_minimo", etiqueta: "Calificación mínima del quiz (%)", tipo: "numero", valor: c.quiz_minimo },
      { nombre: "certificado", etiqueta: "Entrega certificado", tipo: "check", valor: c.certificado },
    ]);
    if (v) conError(() => datos.guardarCurso({ id: c.id, ...v, quiz_minimo: Math.min(100, Math.max(1, v.quiz_minimo || 80)) }), "Guardado");
  };
  main.querySelector("#publicar").onclick = async () => {
    if (!c.publicado && !d.lecciones.length) return aviso("Agrega al menos un video antes de publicar", "error");
    if (!c.publicado && !d.asignaciones.length && !(await confirmar("Sin asignaciones", "Nadie lo verá hasta que lo asignes. ¿Publicar de todos modos?", "Publicar"))) return;
    conError(() => datos.guardarCurso({ id: c.id, publicado: !c.publicado }), c.publicado ? "Pasó a borrador" : "Curso publicado");
  };
  main.querySelector("#borrar-curso").onclick = async () => {
    if (!(await confirmar("¿Borrar este curso?", "Se borra también el avance de todos en este curso. No se puede deshacer. Los videos en Bunny no se tocan.", "Borrar"))) return;
    try { await datos.borrarCurso(c.id); aviso("Curso borrado", "ok"); ctx.ir("/admin/cursos"); } catch (e) { aviso(e.message, "error"); }
  };
  main.querySelector("#nuevo-cap").onclick = async () => {
    const v = await formulario("Nuevo capítulo", [{ nombre: "titulo", etiqueta: "Nombre del capítulo", requerido: true, autofocus: true, placeholder: "Molienda y extracción" }], "Crear");
    if (v) conError(() => datos.guardarModulo({ curso_id: c.id, titulo: v.titulo, orden: (caps.at(-1)?.orden || 0) + 1 }));
  };
  main.querySelectorAll("[data-renombrar-m]").forEach((b) => (b.onclick = async () => {
    const m = caps.find((x) => x.id === b.dataset.renombrarM);
    const v = await formulario("Renombrar capítulo", [{ nombre: "titulo", etiqueta: "Nombre", valor: m.titulo, requerido: true }]);
    if (v) conError(() => datos.guardarModulo({ id: m.id, titulo: v.titulo }));
  }));
  main.querySelectorAll("[data-borrar-m]").forEach((b) => (b.onclick = async () => {
    const m = caps.find((x) => x.id === b.dataset.borrarM);
    if (!(await confirmar("¿Borrar capítulo?", m.lecciones.length ? "Sus lecciones quedarán en \"Sin capítulo\"." : "Está vacío.", "Borrar"))) return;
    conError(() => datos.borrarModulo(m.id));
  }));
  main.querySelectorAll("[data-mover-m]").forEach((b) => (b.onclick = () => {
    const i = caps.findIndex((x) => x.id === b.dataset.moverM), j = i + Number(b.dataset.dir);
    if (!caps[j]) return;
    conError(() => Promise.all(caps.map((m, k) => {
      const nuevo = k === i ? j : k === j ? i : k;
      return m.orden !== nuevo + 1 ? datos.guardarModulo({ id: m.id, orden: nuevo + 1 }) : null;
    })));
  }));
  const listaDe = (lid) => { for (const cap of caps) if (cap.lecciones.some((l) => l.id === lid)) return cap.lecciones; return sueltas; };
  main.querySelectorAll("[data-mover-l]").forEach((b) => (b.onclick = () => {
    const lista = listaDe(b.dataset.moverL);
    const i = lista.findIndex((x) => x.id === b.dataset.moverL), j = i + Number(b.dataset.dir);
    if (!lista[j]) return;
    conError(() => Promise.all(lista.map((l, k) => {
      const nuevo = k === i ? j : k === j ? i : k;
      return l.orden !== nuevo + 1 ? datos.actualizarLeccion(l.id, { orden: nuevo + 1 }) : null;
    })));
  }));
  main.querySelectorAll("[data-renombrar-l]").forEach((b) => (b.onclick = async () => {
    const l = d.lecciones.find((x) => x.id === b.dataset.renombrarL);
    const opciones = [["", "Sin capítulo"], ...caps.map((m, i) => [m.id, `Capítulo ${i + 1} · ${m.titulo}`])];
    const v = await formulario("Editar lección", [
      { nombre: "titulo", etiqueta: "Título que verán los empleados", valor: l.titulo, requerido: true },
      { nombre: "modulo_id", etiqueta: "Capítulo", tipo: "select", opciones, valor: l.modulo_id || "" },
    ]);
    if (!v) return;
    const cambios = { titulo: v.titulo };
    if ((v.modulo_id || null) !== (l.modulo_id || null)) {
      cambios.modulo_id = v.modulo_id || null;
      cambios.orden = (d.lecciones.filter((x) => (x.modulo_id || null) === cambios.modulo_id).reduce((a, x) => Math.max(a, x.orden), 0)) + 1;
    }
    conError(() => datos.actualizarLeccion(l.id, cambios));
  }));
  main.querySelectorAll("[data-borrar-l]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmar("¿Quitar lección?", "Se quita del curso (y el avance de esa lección). El video sigue en Bunny.", "Quitar"))) return;
    conError(() => datos.borrarLeccion(b.dataset.borrarL));
  }));
  main.querySelectorAll("[data-agregar]").forEach((b) => (b.onclick = () => elegirVideos(c.id, b.dataset.agregar, d.lecciones)));
  main.querySelector("#asignar").onclick = async () => {
    const v = await formulario("Asignar curso", [
      { nombre: "area", etiqueta: "Área", tipo: "select", opciones: [["", "Todas las áreas"], ...AREAS], valor: c.categoria && AREAS.some(([a]) => a === c.categoria) && c.categoria !== "general" ? c.categoria : "" },
      { nombre: "sede", etiqueta: "Sede", tipo: "select", opciones: [["", "Todas las sedes"], ...SEDES] },
      { nombre: "user_id", etiqueta: "Persona específica (opcional)", tipo: "select", opciones: [["", "—"], ...d.perfiles.map((p) => [p.user_id, p.nombre])] },
      { nombre: "obligatorio", etiqueta: "Obligatorio", tipo: "check", valor: true },
      { nombre: "fecha_limite", etiqueta: "Fecha límite (opcional)", tipo: "fecha" },
    ], "Asignar");
    if (!v) return;
    if (v.fecha_limite && v.fecha_limite < hoyISO()) return aviso("La fecha límite ya pasó", "error");
    conError(() => datos.agregarAsignacion({ curso_id: c.id, area: v.user_id ? null : v.area, sede: v.user_id ? null : v.sede, user_id: v.user_id, obligatorio: !!v.obligatorio, fecha_limite: v.fecha_limite }), "Asignado");
  };
  main.querySelectorAll("[data-borrar-a]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmar("¿Quitar asignación?", "Esas personas dejarán de ver el curso (su avance se conserva).", "Quitar"))) return;
    conError(() => datos.borrarAsignacion(b.dataset.borrarA));
  }));
}

// Selector de videos de Bunny
async function elegirVideos(cursoId, moduloId, leccionesActuales) {
  const p = modal(`
    <h2 class="modal-titulo">Agregar videos</h2>
    <div id="sel-cuerpo"><div class="cargando" style="min-height:160px"><div class="taza-carga"></div></div></div>`, { clase: "modal-ancho" });
  const capa = modal.actual;
  const cuerpo = capa.querySelector("#sel-cuerpo");
  try {
    const colecciones = await datos.bunnyColecciones();
    let coleccion = "";
    const usados = new Set(leccionesActuales.map((l) => l.bunny_video_id));
    const pintarLista = async () => {
      cuerpo.querySelector(".lista-videos").innerHTML = `<div class="cargando" style="min-height:120px"><div class="taza-carga"></div></div>`;
      const videos = await datos.bunnyVideos(coleccion);
      cuerpo.querySelector(".lista-videos").innerHTML = videos.length ? videos.map((v) => `
        <label class="${usados.has(v.id) ? "ya" : ""}"><input type="checkbox" value="${esc(v.id)}" ${usados.has(v.id) ? "disabled" : ""}>
          <span style="flex:1;min-width:0"><b style="font-weight:600">${esc(v.titulo)}</b>
          <small class="texto-tenue" style="display:block">${v.duracion_seg ? duracion(v.duracion_seg) : ""}${usados.has(v.id) ? " · ya está en este curso" : ""}${v.listo ? "" : " · aún procesándose en Bunny"}</small></span></label>`).join("")
        : `<p class="texto-tenue">No hay videos${coleccion ? " en esta colección" : ""}.</p>`;
      cuerpo.videos = videos;
    };
    cuerpo.innerHTML = `
      <label class="campo">Colección de Bunny<select id="sel-col"><option value="">Todos los videos</option>${colecciones.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)} (${c.videos})</option>`).join("")}</select></label>
      <div class="lista-videos" style="margin-top:12px"></div>
      <p class="texto-tenue" style="margin:8px 0 0">Se agregan en orden alfabético; luego puedes reordenarlos y cambiarles el nombre.</p>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="sel-ok">Agregar seleccionados</button></div>`;
    cuerpo.querySelector("#sel-col").onchange = (e) => { coleccion = e.target.value; pintarLista(); };
    await pintarLista();
    cuerpo.querySelector("#sel-ok").onclick = async () => {
      const ids = [...cuerpo.querySelectorAll(".lista-videos input:checked")].map((i) => i.value);
      if (!ids.length) return aviso("Elige al menos un video");
      const base = leccionesActuales.filter((l) => l.modulo_id === moduloId).reduce((a, l) => Math.max(a, l.orden), 0);
      const filas = ids.map((vid, i) => {
        const v = cuerpo.videos.find((x) => x.id === vid);
        return { curso_id: cursoId, modulo_id: moduloId, titulo: limpiarTitulo(v.titulo), bunny_video_id: v.id, duracion_seg: v.duracion_seg || null, orden: base + i + 1 };
      });
      const btn = cuerpo.querySelector("#sel-ok"); btn.disabled = true; btn.textContent = "Agregando…";
      try { await datos.agregarLecciones(filas); capa.cerrar(true); aviso(`${filas.length} video(s) agregados`, "ok"); recargar(); }
      catch (e) { aviso(e.message, "error"); btn.disabled = false; btn.textContent = "Agregar seleccionados"; }
    };
  } catch (e) {
    cuerpo.innerHTML = `<div class="vacio"><strong>No se pudo leer tu biblioteca de Bunny</strong>${esc(e.message)}</div><button class="btn btn-sec" data-cerrar>Cerrar</button>`;
  }
  await p;
}
const limpiarTitulo = (t) => String(t || "Lección").replace(/\.(mp4|mov|m4v|webm|mkv|avi)$/i, "").replace(/^\d+\s*[-_.]\s*/, "").replace(/[_]+/g, " ").trim();

// ---------------------------------------------------------------------
//  PREMIOS Y CANJES
// ---------------------------------------------------------------------
async function pintarPremios(main) {
  const { premios, canjes } = await datos.adminPremios();
  const nombrePremio = (id) => premios.find((p) => p.id === id)?.nombre || "Premio";
  canjes.forEach((c) => (c.premio_nombre = nombrePremio(c.premio_id)));
  const pendientes = canjes.filter((c) => c.estado === "pendiente");
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina" style="font-size:38px">Premios y canjes</h1>
      <button class="btn" id="nuevo">${icono("plus", 18)}Nuevo premio</button>
    </div>
    <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:20px">
      <section class="panel" style="flex:1 1 420px">
        <h2>Catálogo</h2>
        ${premios.map((p) => `
          <div class="tarjeta fila-entre" style="padding:12px 14px;${p.activo ? "" : "opacity:.55"}">
            <div><b>${esc(p.nombre)}</b><div class="texto-tenue" style="font-size:12px">${num(p.costo)} pts${p.descripcion ? " · " + esc(p.descripcion) : ""}${p.activo ? "" : " · oculto"}</div></div>
            <div class="fila" style="gap:0"><button class="mini-btn" aria-label="Editar" data-editar="${p.id}">${icono("edit", 18)}</button>
            <button class="mini-btn" aria-label="${p.activo ? "Ocultar" : "Mostrar"}" data-activo="${p.id}">${icono(p.activo ? "x" : "eye", 18)}</button></div>
          </div>`).join("") || `<p class="texto-tenue">Sin premios.</p>`}
      </section>
      <section class="panel" style="flex:1 1 320px">
        <h2>Por aprobar (${pendientes.length})</h2>
        <div class="pila">${listaCanjesHTML(pendientes)}</div>
        <h2 style="margin-top:8px">Historial</h2>
        ${canjes.filter((c) => c.estado !== "pendiente").slice(0, 30).map((c) => `
          <div class="fila-entre" style="font-size:13px;border-bottom:1px solid var(--linea-suave);padding:6px 0">
            <span>${esc(c.nombre)} · ${esc(c.premio_nombre)}<br><small class="texto-tenue">${num(c.costo)} pts · ${haceCuanto(c.creado_en)}</small></span>
            <span class="pildora ${c.estado === "aprobado" ? "pildora-ok" : "pildora-alerta"}">${c.estado === "aprobado" ? "Aprobado" : "Rechazado"}</span>
          </div>`).join("") || `<p class="texto-tenue" style="margin:0">Aún no hay canjes resueltos.</p>`}
      </section>
    </div>`;
  const editar = async (p = {}) => {
    const v = await formulario(p.id ? "Editar premio" : "Nuevo premio", [
      { nombre: "nombre", etiqueta: "Premio", valor: p.nombre, requerido: true, placeholder: "Día libre extra" },
      { nombre: "costo", etiqueta: "Costo en puntos", tipo: "numero", valor: p.costo, requerido: true },
      { nombre: "descripcion", etiqueta: "Detalle (opcional)", valor: p.descripcion },
    ]);
    if (!v) return;
    if (!(v.costo > 0)) return aviso("El costo debe ser mayor a 0", "error");
    try { await datos.guardarPremio({ id: p.id, ...v }); aviso("Guardado", "ok"); recargar(); } catch (e) { aviso(e.message, "error"); }
  };
  main.querySelector("#nuevo").onclick = () => editar();
  main.querySelectorAll("[data-editar]").forEach((b) => (b.onclick = () => editar(premios.find((p) => p.id === b.dataset.editar))));
  main.querySelectorAll("[data-activo]").forEach((b) => (b.onclick = async () => {
    const p = premios.find((x) => x.id === b.dataset.activo);
    try { await datos.guardarPremio({ id: p.id, activo: !p.activo }); recargar(); } catch (e) { aviso(e.message, "error"); }
  }));
  conectarCanjes(main);
}

// ---------------------------------------------------------------------
//  INSIGNIAS · catálogo y reconocimientos manuales
// ---------------------------------------------------------------------
async function pintarInsignias(main) {
  const [catalogo, equipo] = await Promise.all([datos.catalogoInsignias(), datos.adminAvance()]);
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina" style="font-size:38px">Insignias</h1>
      <button class="btn" id="otorgar">${icono("crown", 18)}Otorgar reconocimiento</button>
    </div>
    <p class="texto-tenue" style="margin:0">Casi todas se ganan solas al avanzar. "Empleado del mes" la otorgas tú (puedes darla cada mes).</p>
    <div class="vitrina">${catalogo.map((i) => `
      <div class="vitrina-item"><div class="medalla ${i.nivel === "oro" || i.categoria === "especial" ? "medalla-oro" : i.nivel === "plata" ? "medalla-plata" : i.nivel === "bronce" ? "medalla-bronce" : "medalla-cobre"}">${icono(i.icono, 24)}</div>
        <b>${esc(i.nombre)}</b><small>${esc(i.descripcion)}</small><small style="color:var(--oro)">+${num(i.puntos)} pts${i.secreta ? " · secreta" : ""}</small></div>`).join("")}</div>`;
  main.querySelector("#otorgar").onclick = async () => {
    const v = await formulario("Otorgar reconocimiento", [
      { nombre: "user_id", etiqueta: "Empleado", tipo: "select", opciones: equipo.filter((e) => e.activo).map((e) => [e.user_id, e.nombre]) },
      { nombre: "insignia", etiqueta: "Insignia", tipo: "select", opciones: catalogo.filter((i) => i.regla?.tipo === "manual").map((i) => [i.id, `${i.nombre} (+${i.puntos} pts)`]) },
    ], "Otorgar");
    if (!v?.user_id || !v.insignia) return;
    try { await datos.otorgarInsignia(v.user_id, v.insignia); aviso("Reconocimiento otorgado", "ok"); } catch (e) { aviso(e.message, "error"); }
  };
}
