// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · Panel de administración
// =====================================================================
import { datos, MODO } from "./datos.js";
import { icono, esc, num, duracion, fechaCorta, hoyISO, haceCuanto, aviso, modal, confirmar, formulario, marcaTitulo, AREAS, SEDES, nombreArea, nombreCategoria, opcionesCategoria, categorias, fijarCategorias, slug } from "./ui.js";
import { subirCursoDesdeCarpeta } from "./subir.js";
import { panelQuiz, panelMateriales } from "./contenido.js";
import { pintarConfiguracion } from "./configuracion.js";
import { valorCurso, valorAudio } from "./puntos.js";
import { pintarAudiolibrosAdmin, pintarEditorAudio } from "./admin-audio.js";
import { cambiarPortada, quitarPortada } from "./portadas.js";
import { avatarOIniciales, avatarCuerpoSVG } from "./avatar.js";
import { estadoSubtitulos, subtitulosLeccion, subtitulosCapitulo } from "./subtitulos.js";

const LOGO = "img/logo.png";
let ctx; // { ir, salir }

export async function vistaAdmin(app, partes, contexto) {
  ctx = contexto;
  const [seccion = "", id, pestana] = partes;
  const menu = [["cursos", "book", "Cursos"], ["audiolibros", "audifonos", "Audiolibros"], ["empleados", "users", "Empleados"], ["resumen", "chart", "Resumen"], ["premios", "gift", "Premios y canjes"], ["insignias", "medal", "Insignias"], ["configuracion", "ajustes", "Configuración"]];
  const activa = seccion === "curso" || !seccion ? "cursos" : seccion === "audio" ? "audiolibros" : seccion;
  app.className = "";
  app.innerHTML = `
  ${MODO === "demo" ? `<div class="banda-demo">MODO DEMO · datos de ejemplo</div>` : ""}
  <div class="admin">
    <aside class="admin-menu">
      <div class="admin-marca">
        <img class="admin-iso" src="img/isotipo.webp" alt="Mozzafiato">
        ${marcaTitulo("chica", "div")}
        <div class="etiqueta admin-subtitulo">Panel de administración</div>
        <button class="btn btn-sec btn-chico salir-movil" id="salir-movil">${icono("logout", 16)}Salir</button>
      </div>
      <div class="pestanas-envoltura"><nav aria-label="Secciones">${menu.map(([r, ic, t]) => `<a href="#/admin/${r}" class="${activa === r ? "activo" : ""}">${icono(ic, 18)}${t}</a>`).join("")}</nav>
        <span class="pestanas-mas izq" aria-hidden="true">${icono("back", 16)}</span><span class="pestanas-mas der" aria-hidden="true">${icono("next", 16)}</span></div>
      <div class="admin-pie pila" style="margin-top:auto">
        <button class="btn btn-sec btn-chico" id="salir">${icono("logout", 16)}Cerrar sesión</button>
      </div>
    </aside>
    <div class="admin-columna">
      <main class="admin-main" id="admin-main"><div class="cargando"><div class="taza-carga"></div></div></main>
    </div>
  </div>`;
  fijarMenuMovil(app);
  app.querySelector("#salir").onclick = ctx.salir;
  app.querySelector("#salir-movil").onclick = ctx.salir;
  const main = app.querySelector("#admin-main");
  try {
    if (seccion === "empleados") return await pintarEmpleados(main);
    if (seccion === "resumen") return await pintarResumen(main);
    if (seccion === "audiolibros") return await pintarAudiolibrosAdmin(main, ctx);
    if (seccion === "audio") return await pintarEditorAudio(main, id, pestana, ctx);
    if (seccion === "curso") return await pintarEditorCurso(main, id, pestana);
    if (seccion === "premios") return await pintarPremios(main);
    if (seccion === "insignias") return await pintarInsignias(main);
    if (seccion === "configuracion") return await pintarConfiguracion(main, id || "puntos");
    return await pintarCursos(main);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="vacio"><strong>No se pudo cargar</strong>${esc(e.message)}</div><button class="btn" id="re">Reintentar</button>`;
    main.querySelector("#re").onclick = () => vistaAdmin(app, partes, contexto);
  }
}

// En celular: la barra de pestañas se queda pegada arriba al desplazar
// y la pestaña activa siempre queda a la vista (no regresa al inicio).
let observadorMarca;
function fijarMenuMovil(app) {
  const menuEl = app.querySelector(".admin-menu"), marca = app.querySelector(".admin-marca"), nav = menuEl.querySelector("nav");
  const medir = () => menuEl.style.setProperty("--alto-marca", `${marca.offsetHeight + 10}px`);
  observadorMarca?.disconnect();
  observadorMarca = new ResizeObserver(medir);
  observadorMarca.observe(marca);
  medir();
  // Avisos en los bordes cuando hay pestañas ocultas a la izquierda o derecha
  const env = nav.parentElement;
  const revisar = () => {
    const hay = nav.scrollWidth > nav.clientWidth + 2;
    env.classList.toggle("mas-izq", hay && nav.scrollLeft > 4);
    env.classList.toggle("mas-der", hay && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4);
  };
  nav.addEventListener("scroll", revisar, { passive: true });
  window.addEventListener("resize", revisar, { passive: true });
  const activo = nav.querySelector("a.activo");
  requestAnimationFrame(() => {
    if (activo && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, activo.offsetLeft - nav.offsetLeft - (nav.clientWidth - activo.offsetWidth) / 2);
    revisar();
  });
}

export const recargar = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
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
  const [equipo, cursos, { canjes, premios }, avs] = await Promise.all([datos.adminAvance(), datos.adminCursos(), datos.adminPremios(), datos.avatares()]);
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
      <div><div class="texto-tenue">${esc(fecha)}</div><h1 class="titulo-pagina">Resumen del equipo</h1></div>
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
      <div class="pila" style="flex:1 1 300px;gap:20px">
        <section class="panel" id="alertas-cuentas" hidden></section>
        <section class="panel">
          <h2>Canjes por aprobar</h2>
          <div id="canjes" class="pila">${listaCanjesHTML(pendientes)}</div>
        </section>
      </div>
    </div>`;

  const pintarTabla = () => {
    const filas = activos.filter((e) => filtro === "todas" || e.area === filtro);
    main.querySelector("#tabla-avance").innerHTML = filas.length ? `
      <table class="tabla"><thead><tr><th>Empleado</th><th>Área</th><th style="width:32%">Avance</th><th>Puntos</th><th>Estado</th></tr></thead><tbody>
      ${filas.map((e) => { const [txt, cls] = estadoEmpleado(e); return `<tr>
        <td><span class="fila" style="gap:10px;align-items:center"><button class="avatar-boton" data-ver-av="${e.user_id}" aria-label="Ver avatar de ${esc(e.nombre)}">${avatarOIniciales(avs[e.user_id], e.nombre, 36)}</button><span><b>${esc(e.nombre)}</b><div class="texto-tenue" style="font-size:12px">${esc(e.sede || "")}${e.turno ? " · " + esc(e.turno) : ""} · ${haceCuanto(e.ultima_actividad)}</div></span></span></td>
        <td>${esc(nombreArea(e.area))}</td>
        <td><div class="fila"><div class="barra fina" style="flex:1"><i style="width:${pct(e)}%;${e.cursos_atrasados ? "background:var(--alerta)" : ""}"></i></div><b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct(e)}%</b></div></td>
        <td>${num(e.puntos)}</td>
        <td><span class="pildora ${cls}">${txt}</span></td></tr>`; }).join("")}
      </tbody></table>` : `<div class="vacio"><strong>Sin empleados todavía</strong><a href="#/admin/empleados">Da de alta a tu equipo</a></div>`;
    conectarVerAvatar(main.querySelector("#tabla-avance"), equipo, avs);
  };
  pintarTabla();
  main.querySelector("#filtros").onclick = (e) => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    filtro = b.dataset.f;
    main.querySelectorAll("#filtros .chip").forEach((c) => c.classList.toggle("activo", c === b));
    pintarTabla();
  };
  conectarCanjes(main);
  pintarAlertasCuentas(main.querySelector("#alertas-cuentas"));
}

// Cuentas que se usaron en más de 2 dispositivos en 30 días.
async function pintarAlertasCuentas(caja) {
  let lista;
  try { lista = await datos.adminDispositivos(); } catch (_) { return; } // SQL de dispositivos aún no instalado
  const raras = lista.filter((x) => x.en_30_dias > 2);
  if (!raras.length) return;
  caja.hidden = false;
  caja.style.borderColor = "var(--alerta)";
  caja.innerHTML = `<h2>Cuentas a revisar</h2>
    <p class="texto-tenue" style="margin:0">Entraron desde más de 2 dispositivos en 30 días. Puede ser un PIN compartido, o que cambiaron de celular o borraron datos del navegador.</p>
    ${raras.map((x) => `<button class="tarjeta fila-entre" data-disp="${x.user_id}" style="border:0;color:inherit;text-align:left;width:100%;padding:12px">
      <span><b style="font-size:14px">${esc(x.nombre)}</b><br><small class="texto-tenue">${x.en_30_dias} dispositivos en 30 días</small></span>
      <span class="pildora pildora-alerta">Revisar</span></button>`).join("")}`;
  caja.querySelectorAll("[data-disp]").forEach((b) => (b.onclick = () => verDispositivos(lista.find((x) => x.user_id === b.dataset.disp))));
}

async function verDispositivos(x) {
  if (!x) return;
  const fecha = (iso) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const r = await modal(`
    <h2 class="modal-titulo">Dispositivos de ${esc(x.nombre)}</h2>
    <p class="texto-tenue" style="margin:0">Últimos 60 días. Solo el marcado como <b>activo</b> puede usar la cuenta ahora; los demás se cerraron.</p>
    <div class="pila" style="gap:8px">${x.dispositivos.length ? x.dispositivos.map((d) => `
      <div class="tarjeta fila-entre" style="padding:12px">
        <span><b style="font-size:14px">${esc(d.nombre || "Dispositivo")}</b><br>
        <small class="texto-tenue">Primera vez ${fecha(d.primer_ingreso)} · última ${fecha(d.ultimo_ingreso)} · ${d.ingresos} ingreso(s)</small></span>
        ${d.activo ? '<span class="pildora pildora-ok">Activo</span>' : ""}
      </div>`).join("") : '<p class="texto-tenue">Sin registros.</p>'}</div>
    <p class="texto-tenue" style="margin:0">Si crees que compartió su PIN, genera uno nuevo: se cierran todas sus sesiones.</p>
    <div class="fila-botones">
      <button class="btn btn-sec" data-cerrar="olvidar">Olvidar dispositivos</button>
      <button class="btn" data-cerrar="pin">${icono("key", 18)}Nuevo PIN</button>
    </div>
    <button class="btn btn-sec btn-bloque" data-cerrar>Cerrar</button>`, { clase: "modal-ancho" });
  try {
    if (r === "olvidar") { await datos.olvidarDispositivos(x.user_id); aviso("Historial borrado (se conserva el activo)", "ok"); recargar(); }
    if (r === "pin") { const p = await datos.cambiarPin(x.user_id); await mostrarAcceso(x.nombre, x.usuario, p.pin); recargar(); }
  } catch (e) { aviso(e.message, "error"); }
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
  const [equipo, avs] = await Promise.all([datos.adminAvance(), datos.avatares()]);
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina">Empleados</h1>
      <div class="fila" style="flex-wrap:wrap">
        <a class="btn btn-whats" target="_blank" rel="noopener" href="${linkWhats(mensajeLinkApp(), null)}">${icono("share", 18)}Compartir link de la app</a>
        <button class="btn btn-sec" id="galeria">${icono("user", 18)}Avatares del equipo</button>
        <button class="btn btn-sec" id="reenviar">${icono("key", 18)}Reenviar accesos</button>
        <button class="btn" id="gestor">${icono("refresh", 18)}Importar del Gestor</button>
        <button class="btn btn-sec" id="lote">${icono("users", 18)}Alta en lote</button>
        <button class="btn btn-sec" id="nuevo">${icono("plus", 18)}Nuevo empleado</button>
      </div>
    </div>
    <section class="panel">
      ${equipo.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Nombre</th><th>Usuario</th><th>Área</th><th>Sede · turno</th><th>Avance</th><th>Dispositivos</th><th></th></tr></thead><tbody>
      ${equipo.map((e) => `<tr class="${e.activo ? "" : "inactivo"}">
        <td><span class="fila" style="gap:8px"><button class="avatar-boton" data-ver-av="${e.user_id}" aria-label="Ver avatar de ${esc(e.nombre)}">${avatarOIniciales(avs[e.user_id], e.nombre, 34)}</button><b>${esc(e.nombre)}</b></span>${e.activo ? "" : ' <span class="pildora">Inactivo</span>'}</td>
        <td>@${esc(e.usuario)}</td><td>${esc(nombreArea(e.area))}</td>
        <td>${esc(e.sede || "—")}${e.turno ? " · " + esc(e.turno) : ""}</td>
        <td>${pct(e)}% · ${num(e.puntos)} pts</td>
        <td><button class="btn-texto" data-disp="${e.user_id}" style="min-height:36px;color:var(--arena)">—</button></td>
        <td style="white-space:nowrap;text-align:right">
          <button class="mini-btn" title="Reenviar acceso (PIN nuevo)" aria-label="Reenviar acceso a ${esc(e.nombre)}" data-pin="${e.user_id}">${icono("key", 18)}</button>
          <button class="mini-btn" title="Editar" aria-label="Editar ${esc(e.nombre)}" data-editar="${e.user_id}">${icono("edit", 18)}</button>
          <button class="mini-btn" title="${e.activo ? "Desactivar" : "Activar"}" aria-label="${e.activo ? "Desactivar" : "Activar"} ${esc(e.nombre)}" data-activo="${e.user_id}">${icono(e.activo ? "x" : "check", 18)}</button>
        </td></tr>`).join("")}
      </tbody></table></div>` : `<div class="vacio"><strong>Trae a tu equipo del Gestor de Descansos</strong>Toca <b>Importar del Gestor</b>: cada empleado recibe un usuario y un PIN de 6 dígitos, y se lo mandas por WhatsApp.</div>`}
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
  main.querySelector("#gestor").onclick = () => importarDelGestor();
  datos.adminDispositivos().then((lista) => {
    main.querySelectorAll("[data-disp]").forEach((b) => {
      const x = lista.find((y) => y.user_id === b.dataset.disp);
      const n = x?.en_30_dias || 0;
      b.textContent = n ? `${n} ${n === 1 ? "dispositivo" : "dispositivos"}` : "Sin ingresar";
      if (n > 2) { b.style.color = "var(--alerta-texto)"; b.textContent += " · revisar"; }
      b.onclick = () => verDispositivos(x);
    });
  }).catch(() => main.querySelectorAll("[data-disp]").forEach((b) => (b.textContent = "—")));
  main.querySelector("#reenviar").onclick = () => reenviarAccesos(equipo.filter((e) => e.activo), avs);
  main.querySelector("#galeria").onclick = () => galeriaAvatares(equipo.filter((e) => e.activo), avs);
  conectarVerAvatar(main, equipo, avs);
  main.querySelectorAll("[data-pin]").forEach((b) => (b.onclick = async () => {
    const e = porId(b.dataset.pin);
    if (!(await confirmar("¿Reenviar acceso?", `Por seguridad los PIN no se guardan, así que se genera uno nuevo para ${e.nombre}. El anterior deja de servir y, si tenía la sesión abierta, tendrá que entrar con el nuevo.`, "Generar y enviar"))) return;
    try {
      const r = await datos.cambiarPin(e.user_id);
      let wa = null;
      try {
        const perfil = (await datos.adminPerfiles()).find((x) => x.user_id === e.user_id);
        if (perfil?.gestor_id) wa = (await datos.gestorEmpleados()).find((g) => g.gestor_id === perfil.gestor_id)?.whatsapp || null;
      } catch (_) { /* sin WhatsApp */ }
      await mostrarAcceso(e.nombre, e.usuario, r.pin, wa);
    }
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

// Link general de la app para mandar al grupo del equipo (sin usuario ni PIN).
function mensajeLinkApp() {
  const link = location.origin + location.pathname;
  return `¡Hola equipo! ☕\nYa está lista la *Academia del Buen Café* de Mozzafiato: cursos en video para crecer, ganar puntos, insignias y premios. 🏆\n\nEntra aquí: ${link}\n\nTu *usuario y PIN* te los mando por privado (no los compartas con nadie).\n\n📲 Tip: guárdala como app en tu celular.\n• iPhone: ábrela en Safari → botón Compartir → "Agregar a inicio".\n• Android: ábrela en Chrome → menú ⋮ → "Instalar app" o "Agregar a pantalla principal".`;
}

function mensajeAcceso(nombre, usuario, pin) {
  const link = location.origin + location.pathname;
  return `Hola ${String(nombre).split(" ")[0]} 👋\nYa tienes acceso a la *Academia del Buen Café* de Mozzafiato.\n\nEntra aquí: ${link}\nUsuario: *${usuario}*\nPIN: *${pin}*\n\nTip: ábrelo en tu celular y elige "Agregar a pantalla de inicio" para tenerla como app. No compartas tu PIN.`;
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); aviso("Copiado", "ok"); }
  catch { aviso("No se pudo copiar; selecciónalo a mano", "error"); }
}

const linkWhats = (msg, numero) => `https://wa.me/${numero ? String(numero).replace(/\D/g, "") : ""}?text=${encodeURIComponent(msg)}`;

// Ver el avatar de un empleado en grande (cuerpo completo, saluda al abrir).
function verAvatar(e, avatar) {
  modal(`
    <div class="pila" style="align-items:center;text-align:center;gap:10px">
      ${avatar ? `<button class="avatar-cuerpo-modal" id="av-admin">${avatarCuerpoSVG(avatar, 260, { animado: true })}</button>`
        : `<div class="vacio" style="width:100%"><strong>${esc(e.nombre)} aún no crea su avatar</strong>Le sale la invitación al entrar a la app, y también puede hacerlo desde su perfil.</div>`}
      <h2 class="modal-titulo">${esc(e.nombre)}</h2>
      <span class="texto-tenue">${esc(nombreArea(e.area))}${e.sede ? " · " + esc(e.sede) : ""} · ${num(e.puntos || 0)} pts</span>
      <button class="btn btn-bloque" data-cerrar>Cerrar</button>
    </div>`);
  const svg = modal.actual?.querySelector("#av-admin svg");
  if (svg) {
    setTimeout(() => svg.classList.add("av-saluda"), 300);
    modal.actual.querySelector("#av-admin").onclick = () => { svg.classList.remove("av-saluda"); void svg.getBoundingClientRect(); svg.classList.add("av-saluda"); };
  }
}
function conectarVerAvatar(raiz, equipo, avs) {
  raiz.querySelectorAll("[data-ver-av]").forEach((b) => (b.onclick = (ev) => {
    ev.stopPropagation();
    const e = equipo.find((x) => x.user_id === b.dataset.verAv);
    if (e) verAvatar(e, avs[e.user_id]);
  }));
}

// Galería con los avatares de todo el equipo.
function galeriaAvatares(equipo, avs) {
  const con = equipo.filter((e) => avs[e.user_id]).sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
  const sin = equipo.filter((e) => !avs[e.user_id]);
  modal(`
    <div class="fila-entre"><h2 class="modal-titulo">Avatares del equipo</h2><button class="btn-icono" data-cerrar aria-label="Cerrar">${icono("x")}</button></div>
    <p class="texto-tenue" style="margin:0">${con.length} de ${equipo.length} ya crearon su avatar. Toca uno para verlo saludar.</p>
    <div class="galeria-avatares">${con.map((e) => `
      <button class="galeria-item" data-g="${e.user_id}">${avatarCuerpoSVG(avs[e.user_id], 170, { animado: true })}
        <b>${esc(e.nombre)}</b><small>${num(e.puntos || 0)} pts</small></button>`).join("") || `<div class="vacio" style="grid-column:1/-1">Todavía nadie crea su avatar.</div>`}</div>
    ${sin.length ? `<div class="pila" style="gap:6px"><span class="etiqueta">Les falta crearlo</span>
      <div class="fila" style="flex-wrap:wrap;gap:6px">${sin.map((e) => `<span class="pildora">${esc(e.nombre)}</span>`).join("")}</div></div>` : ""}`, { clase: "modal-ancho" });
  modal.actual.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
    const svg = b.querySelector("svg"); svg.classList.remove("av-saluda"); void svg.getBoundingClientRect(); svg.classList.add("av-saluda");
  }));
}

// Reenviar acceso a varios: elige a quién, genera PIN nuevo a cada uno y deja listo el WhatsApp.
async function reenviarAccesos(equipo, avs = {}) {
  let elegidos = new Set(), texto = "";
  const p = modal(`
    <h2 class="modal-titulo">Reenviar accesos</h2>
    <p class="texto-tenue" style="margin:0">Por seguridad los PIN no se guardan, así que a cada persona elegida se le genera <b>un PIN nuevo</b> (el anterior deja de servir). Luego le mandas su invitación por WhatsApp.</p>
    <input class="buscar-persona" type="search" id="ra-buscar" placeholder="Buscar por nombre…">
    <div class="fila-entre"><span class="texto-tenue" style="font-size:12px" id="ra-cuenta">Nadie seleccionado</span><button type="button" class="btn-texto" id="ra-todos">Seleccionar todos</button></div>
    <div class="lista-personas" id="ra-lista" style="max-height:42vh"></div>
    <p class="error-form" hidden></p>
    <div class="fila-botones"><button class="btn btn-sec" data-cerrar="">Cancelar</button><button class="btn" id="ra-ok">Generar PIN nuevos</button></div>`, { clase: "modal-ancho" });
  const capa = modal.actual;
  const visibles = () => equipo.filter((e) => !texto || e.nombre.toLowerCase().includes(texto) || e.usuario.toLowerCase().includes(texto));
  const pintar = () => {
    capa.querySelector("#ra-lista").innerHTML = visibles().map((e) => `
      <label class="persona-check"><input type="checkbox" value="${e.user_id}" ${elegidos.has(e.user_id) ? "checked" : ""}>
        ${avatarOIniciales(avs[e.user_id], e.nombre, 34)}
        <span style="flex:1;min-width:0"><b>${esc(e.nombre)}</b><small>@${esc(e.usuario)} · ${esc(nombreArea(e.area))}</small></span></label>`).join("") || `<p class="texto-tenue">Nadie coincide.</p>`;
    capa.querySelector("#ra-cuenta").textContent = elegidos.size ? `${elegidos.size} seleccionada${elegidos.size === 1 ? "" : "s"}` : "Nadie seleccionado";
    capa.querySelector("#ra-ok").textContent = elegidos.size ? `Generar ${elegidos.size} PIN nuevo${elegidos.size === 1 ? "" : "s"}` : "Generar PIN nuevos";
    const libres = visibles();
    capa.querySelector("#ra-todos").textContent = libres.length && libres.every((e) => elegidos.has(e.user_id)) ? "Quitar todos" : "Seleccionar todos";
  };
  capa.querySelector("#ra-buscar").oninput = (ev) => { texto = ev.target.value.trim().toLowerCase(); pintar(); };
  capa.querySelector("#ra-lista").onchange = (ev) => { const cb = ev.target.closest("input"); if (!cb) return; cb.checked ? elegidos.add(cb.value) : elegidos.delete(cb.value); pintar(); };
  capa.querySelector("#ra-todos").onclick = () => { const v = visibles(); const todos = v.every((e) => elegidos.has(e.user_id)); v.forEach((e) => (todos ? elegidos.delete(e.user_id) : elegidos.add(e.user_id))); pintar(); };
  let ir = false;
  capa.querySelector("#ra-ok").onclick = () => {
    if (!elegidos.size) { const er = capa.querySelector(".error-form"); er.textContent = "Elige al menos una persona"; er.hidden = false; return; }
    ir = true; capa.cerrar("ok");
  };
  pintar();
  await p;
  if (!ir) return;
  const lista = equipo.filter((e) => elegidos.has(e.user_id));
  const r2 = modal(`<h2 class="modal-titulo">Accesos nuevos</h2><div id="ra-res"><div class="cargando" style="min-height:120px"><div class="taza-carga"></div></div></div>`, { cerrable: false, clase: "modal-ancho" });
  const capaRes = modal.actual, caja = capaRes.querySelector("#ra-res");
  let wa = {};
  try {
    const [perfiles, gestor] = await Promise.all([datos.adminPerfiles(), datos.gestorEmpleados().catch(() => [])]);
    const tel = Object.fromEntries((gestor || []).filter((g) => g.whatsapp).map((g) => [g.gestor_id, g.whatsapp]));
    wa = Object.fromEntries(perfiles.map((pf) => [pf.user_id, tel[pf.gestor_id] || null]));
  } catch (_) { /* sin WhatsApp */ }
  const res = [];
  for (const e of lista) {
    try { const r = await datos.cambiarPin(e.user_id); res.push({ ...e, pin: r.pin }); }
    catch (err) { res.push({ ...e, error: err.message }); }
    caja.innerHTML = `<p class="texto-tenue">Generando ${res.length} de ${lista.length}…</p>`;
  }
  caja.innerHTML = `
    <p class="texto-tenue" style="margin:0 0 6px">Mándale a cada quien su mensaje. <b>Los PIN no se vuelven a mostrar</b> cuando cierres esta ventana.</p>
    <div class="lista-aviso">${res.map((x) => `
      <div class="fila-aviso" data-fila="${x.user_id}">
        ${avatarOIniciales(avs[x.user_id], x.nombre, 38)}
        <div style="flex:1;min-width:0"><b style="font-size:14px">${esc(x.nombre)}</b>
          <div class="texto-tenue" style="font-size:12px">${x.error ? `<span style="color:var(--alerta-texto)">${esc(x.error)}</span>` : `@${esc(x.usuario)} · PIN <b style="color:var(--oro);letter-spacing:.1em">${esc(x.pin)}</b>${wa[x.user_id] ? "" : " · sin número"}`}</div></div>
        ${x.error ? "" : `<a class="btn btn-chico" target="_blank" rel="noopener" data-enviado="${x.user_id}" href="${linkWhats(mensajeAcceso(x.nombre, x.usuario, x.pin), wa[x.user_id])}">Enviar</a>`}
      </div>`).join("")}</div>
    <div class="pila" style="gap:8px;margin-top:8px">
      <button class="btn btn-sec btn-bloque" id="ra-copiar">${icono("file", 18)}Copiar todos los accesos</button>
      <button class="btn btn-bloque" id="ra-listo">Listo</button>
    </div>`;
  caja.querySelectorAll("[data-enviado]").forEach((a) => a.addEventListener("click", () => { a.textContent = "Enviado ✓"; a.classList.add("btn-sec"); a.closest(".fila-aviso").classList.add("enviado"); }));
  caja.querySelector("#ra-copiar").onclick = () => copiar(res.filter((x) => !x.error).map((x) => `${x.nombre}: usuario ${x.usuario} · PIN ${x.pin}`).join("\n"));
  caja.querySelector("#ra-listo").onclick = async () => {
    if (await confirmar("¿Ya los enviaste?", "Al cerrar, los PIN ya no se vuelven a mostrar.", "Sí, cerrar")) capaRes.cerrar(true);
  };
  await r2;
}

function mostrarAcceso(nombre, usuario, pin, whatsapp) {
  const msg = mensajeAcceso(nombre, usuario, pin);
  const p = modal(`
    <h2 class="modal-titulo">Acceso de ${esc(nombre)}</h2>
    <p class="modal-texto">Usuario <b>@${esc(usuario)}</b></p>
    <div class="pin-grande" aria-label="PIN">${esc(pin)}</div>
    <p class="texto-tenue" style="margin:0">Guárdalo o envíaselo ahora: por seguridad no se vuelve a mostrar (puedes generar otro cuando quieras).</p>
    <div class="fila-botones">
      <button class="btn btn-sec" id="copiar-msg">${icono("file", 18)}Copiar mensaje</button>
      <a class="btn" target="_blank" rel="noopener" href="${linkWhats(msg, whatsapp)}">${whatsapp ? "Enviar a su WhatsApp" : "Enviar por WhatsApp"}</a>
    </div>
    <button class="btn btn-sec btn-bloque" data-cerrar>Listo</button>`, { cerrable: false });
  modal.actual.querySelector("#copiar-msg").onclick = () => copiar(msg);
  return p;
}

// Importa al equipo desde el Gestor de Descansos (solo lectura del Gestor).
async function importarDelGestor() {
  const p = modal(`<h2 class="modal-titulo">Importar del Gestor</h2><div id="ig"><div class="cargando" style="min-height:160px"><div class="taza-carga"></div></div></div>`, { clase: "modal-ancho" });
  const capa = modal.actual;
  const caja = capa.querySelector("#ig");
  let gestor, perfiles;
  try { [gestor, perfiles] = await Promise.all([datos.gestorEmpleados(), datos.adminPerfiles()]); }
  catch (e) {
    caja.innerHTML = `<div class="vacio"><strong>No se pudo leer el Gestor</strong>${esc(e.message)}<br>Entra a la Academia con la misma cuenta que usas en el Gestor.</div><button class="btn btn-sec" data-cerrar>Cerrar</button>`;
    return p;
  }
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const yaEsta = (g) => perfiles.find((x) => x.gestor_id === g.gestor_id) || perfiles.find((x) => norm(x.nombre) === norm(g.nombre));
  // Una cuenta por persona: si alguien está en las dos sedes, se toma la primera.
  const vistos = new Set();
  const filas = gestor.filter((g) => { const k = norm(g.nombre); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map((g) => ({ ...g, existente: yaEsta(g) }));
  const puedeEntrar = (f) => f.activo || !!f.entra;
  const nuevos = filas.filter((f) => puedeEntrar(f) && !f.existente);
  const bajas = filas.filter((f) => !f.activo && f.existente?.activo);
  let verBajas = false;

  const pintar = () => {
    const visibles = filas.filter((f) => verBajas || puedeEntrar(f));
    const fechaC = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "");
    caja.innerHTML = `
      <p class="modal-texto">${nuevos.length ? `${nuevos.length} empleado(s) del Gestor todavía no tienen cuenta.` : "Todo tu equipo activo ya tiene cuenta en la Academia."}</p>
      <p class="texto-tenue" style="margin:0;font-size:12.5px">${icono("refresh", 13)} El Gestor subió su lista a la nube por última vez <b>${gestor.actualizado ? haceCuanto(gestor.actualizado) : "(sin fecha)"}</b>. Se toma en cuenta la semana del ${fechaC(gestor.semana)}. ¿Falta alguien o sale alguien que ya se fue? Abre el Gestor en el equipo donde hiciste el cambio y revisa que diga <b>"Al día ✓"</b> (o toca <b>"Subir este dispositivo"</b>).</p>
      <label class="check"><input type="checkbox" id="ig-bajas" ${verBajas ? "checked" : ""}><span>Mostrar también a los dados de baja</span></label>
      <div class="tabla-caja" style="max-height:46vh;overflow:auto"><table class="tabla" style="min-width:560px">
        <thead><tr><th style="width:36px"><input type="checkbox" id="ig-todos" aria-label="Seleccionar todos" checked></th><th>Nombre</th><th>Área</th><th>Sede · turno</th><th>WhatsApp</th></tr></thead>
        <tbody>${visibles.map((f) => `<tr class="${puedeEntrar(f) ? "" : "inactivo"}">
          <td>${f.existente ? icono("check", 18, 'style="color:var(--verde)"') : `<input type="checkbox" class="ig-sel" value="${esc(f.gestor_id)}" ${puedeEntrar(f) ? "checked" : ""} aria-label="Importar a ${esc(f.nombre)}">`}</td>
          <td><b>${esc(f.nombre)}</b>${f.existente ? `<div class="texto-tenue" style="font-size:12px">Ya tiene cuenta: @${esc(f.existente.usuario)}</div>` : ""}
            ${f.entra ? ` <span class="pildora pildora-ok">Entra el ${fechaC(f.entra)}</span>` : f.activo ? (f.sale ? ` <span class="pildora">Sale el ${fechaC(f.sale)}</span>` : "") : ` <span class="pildora">Baja${f.salio ? " desde el " + fechaC(f.salio) : ""}</span>`}</td>
          <td>${esc(nombreArea(f.area))}</td><td>${esc(f.sede)}${f.turno ? " · " + esc(f.turno) : ""}</td>
          <td>${f.whatsapp ? "Sí" : '<span class="texto-tenue">—</span>'}</td></tr>`).join("")}</tbody>
      </table></div>
      ${bajas.length ? `<div class="tarjeta pila" style="padding:12px;border:1px solid var(--alerta)">
        <b style="font-size:14px">${bajas.length} persona(s) están dadas de baja en el Gestor pero siguen activas aquí</b>
        <span class="texto-tenue">${bajas.map((b) => esc(b.nombre)).join(", ")}</span>
        <button class="btn btn-sec btn-chico" id="ig-desactivar" style="align-self:flex-start">Quitarles el acceso</button></div>` : ""}
      <p class="error-form" id="ig-err" hidden></p>
      <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="ig-ok">Crear cuentas</button></div>`;
    caja.querySelector("#ig-bajas").onchange = (e) => { verBajas = e.target.checked; pintar(); };
    caja.querySelector("#ig-todos").onchange = (e) => caja.querySelectorAll(".ig-sel").forEach((c) => (c.checked = e.target.checked));
    const des = caja.querySelector("#ig-desactivar");
    if (des) des.onclick = async () => {
      des.disabled = true; des.textContent = "Quitando acceso…";
      try { for (const b of bajas) await datos.actualizarEmpleado(b.existente.user_id, { activo: false }); aviso("Acceso retirado", "ok"); capa.cerrar(true); recargar(); }
      catch (e) { aviso(e.message, "error"); des.disabled = false; }
    };
    caja.querySelector("#ig-ok").onclick = async () => {
      const ids = new Set([...caja.querySelectorAll(".ig-sel:checked")].map((c) => c.value));
      const elegidos = filas.filter((f) => ids.has(f.gestor_id));
      const err = caja.querySelector("#ig-err");
      if (!elegidos.length) { err.textContent = "Selecciona al menos a una persona"; err.hidden = false; return; }
      const usados = perfiles.map((x) => ({ usuario: x.usuario }));
      const lista = elegidos.map((f) => {
        const usuario = sugerirUsuario(f.nombre, f.area, usados); usados.push({ usuario });
        return { nombre: f.nombre, area: f.area, sede: f.sede, turno: f.turno, gestor_id: f.gestor_id, usuario };
      });
      const btn = caja.querySelector("#ig-ok"); btn.disabled = true; btn.textContent = `Creando ${lista.length}…`;
      try {
        const r = await datos.importarEmpleados(lista);
        capa.cerrar(true);
        const wa = Object.fromEntries(elegidos.map((f) => [f.gestor_id, f.whatsapp]));
        r.resultados.forEach((x, i) => (x.whatsapp = wa[lista[i]?.gestor_id] || null));
        await mostrarResultadosLote(r);
        recargar();
      } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = "Crear cuentas"; }
    };
  };
  pintar();
  return p;
}

function mostrarResultadosLote(r) {
  const ok = r.resultados.filter((x) => x.ok);
  const todo = ok.map((x) => `${x.nombre}: usuario ${x.usuario} · PIN ${x.pin}`).join("\n");
  const p2 = modal(`
    <h2 class="modal-titulo">${r.creados} cuentas creadas</h2>
    ${r.con_error ? `<p class="error-form">${r.con_error} con error: ${r.resultados.filter((x) => !x.ok).map((x) => esc(`${x.usuario} (${x.error})`)).join(", ")}</p>` : ""}
    <p class="texto-tenue" style="margin:0">Toca <b>Enviar</b> en cada persona para mandarle su acceso por WhatsApp. Los PIN no se vuelven a mostrar.</p>
    <div class="tabla-caja" style="max-height:50vh;overflow:auto"><table class="tabla" style="min-width:0"><thead><tr><th>Nombre</th><th>Usuario</th><th>PIN</th><th></th></tr></thead><tbody>
      ${ok.map((x) => `<tr><td>${esc(x.nombre)}</td><td>@${esc(x.usuario)}</td><td><b style="color:var(--oro);letter-spacing:2px">${esc(x.pin)}</b></td>
        <td style="text-align:right"><a class="btn btn-chico ${x.whatsapp ? "" : "btn-sec"}" target="_blank" rel="noopener" href="${linkWhats(mensajeAcceso(x.nombre, x.usuario, x.pin), x.whatsapp)}">${x.whatsapp ? "Enviar" : "WhatsApp"}</a></td></tr>`).join("")}
    </tbody></table></div>
    <div class="fila-botones"><button class="btn btn-sec" id="copiar-todo">Copiar lista</button><button class="btn" data-cerrar>Listo</button></div>`, { cerrable: false, clase: "modal-ancho" });
  modal.actual.querySelector("#copiar-todo").onclick = () => copiar(todo);
  return p2;
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
  const grupos = categorias().map((cat) => ({ ...cat, cursos: cursos.filter((c) => (c.categoria || "general") === cat.id) }));
  const huerfanos = cursos.filter((c) => !categorias().some((cat) => cat.id === (c.categoria || "general")));
  if (huerfanos.length) grupos.push({ id: "_otros", nombre: "Sin categoría", cursos: huerfanos });
  const tarjeta = (c) => `
      <a class="tarjeta-borde pila" href="#/admin/curso/${c.id}" style="gap:8px">
        ${c.portada_url ? `<img class="portada-tarjeta" src="${esc(c.portada_url)}" alt="" loading="lazy">` : ""}
        <div class="fila-entre" style="align-items:flex-start"><b style="font-size:16px">${esc(c.titulo)}</b>
          <span class="pildora ${c.publicado ? "pildora-ok" : ""}">${c.publicado ? "Publicado" : "Borrador"}</span></div>
        <span class="texto-tenue">${c.lecciones} lecciones · ${duracion(c.duracion_seg)}</span>
        <span class="texto-tenue" style="font-size:12px">${c.asignaciones ? `${c.asignaciones} asignación(es)` : "Sin asignar todavía"}</span>
      </a>`;
  main.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-end">
      <h1 class="titulo-pagina">Cursos</h1>
      <div class="fila" style="flex-wrap:wrap">
        <button class="btn btn-sec" id="categorias">${icono("book", 18)}Categorías</button>
        <button class="btn btn-sec" id="nuevo">${icono("plus", 18)}Curso vacío</button>
        <button class="btn" id="carpeta">${icono("video", 18)}Subir curso desde carpeta</button>
      </div>
    </div>
    <p class="texto-tenue" style="margin:0">Tip: organiza en tu computadora <b>Curso / Capítulos / videos</b> y súbelo de una vez. Cada subcarpeta se vuelve un capítulo y cada video una lección, en orden por nombre (usa 01, 02, 03…).</p>
    ${cursos.length ? grupos.filter((g) => g.cursos.length).map((g) => `
      <section class="pila" style="gap:10px">
        <div class="fila-entre"><h2 style="font-size:18px">${esc(g.nombre)}</h2><span class="texto-tenue">${g.cursos.length} curso(s)</span></div>
        <div class="rejilla">${g.cursos.map(tarjeta).join("")}</div>
      </section>`).join("")
      : `<div class="vacio"><strong>Crea tu primer curso</strong>Súbelo desde una carpeta o empieza uno vacío y elige los videos de tu biblioteca de Bunny.</div>`}`;
  main.querySelector("#categorias").onclick = () => editarCategorias(cursos);
  main.querySelector("#nuevo").onclick = async () => {
    const d = await formulario("Nuevo curso", [
      { nombre: "titulo", etiqueta: "Título", requerido: true, autofocus: true, placeholder: "Barismo nivel 1" },
      { nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: opcionesCategoria() },
      { nombre: "descripcion", etiqueta: "Descripción (opcional)", tipo: "area" },
    ], "Crear curso");
    if (!d) return;
    try { const c = await datos.guardarCurso({ ...d, orden: cursos.length + 1 }); ctx.ir(`/admin/curso/${c.id}`); }
    catch (e) { aviso(e.message, "error"); }
  };
  main.querySelector("#carpeta").onclick = () => subirCursoDesdeCarpeta({ alTerminar: (id) => ctx.ir(`/admin/curso/${id}`) });
}

// Crear, renombrar y quitar categorías (se guardan en Supabase para todos).
async function editarCategorias(cursos) {
  let lista = categorias().map((c) => ({ ...c }));
  const uso = (id) => cursos.filter((c) => (c.categoria || "general") === id).length;
  const p = modal(`<h2 class="modal-titulo">Categorías de cursos</h2>
    <p class="modal-texto" style="font-size:14px">El tema del curso (Cocina, Liderazgo, Barismo…). Quién lo toma se define al asignarlo.</p>
    <div id="cat-lista" class="pila" style="gap:8px"></div>
    <form id="cat-nueva" class="fila" style="gap:8px">
      <label class="campo" style="flex:1"><span class="oculto">Nueva categoría</span><input id="cat-nombre" placeholder="Nueva categoría, ej. Atención al cliente"></label>
      <button class="btn btn-chico" type="submit" style="min-height:48px">${icono("plus", 16)}Agregar</button>
    </form>
    <label class="check"><input type="checkbox" id="cat-insignia" checked><span>Crear insignia "Experto en…" para las categorías nuevas</span></label>
    <p class="error-form" id="cat-err" hidden></p>
    <div class="fila-botones"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn" id="cat-ok">Guardar</button></div>`);
  const capa = modal.actual;
  const err = capa.querySelector("#cat-err");
  const nuevas = new Set();
  const pintar = () => {
    capa.querySelector("#cat-lista").innerHTML = lista.map((c, i) => `
      <div class="fila tarjeta" style="padding:8px 10px;gap:8px">
        <input class="cat-nom" data-i="${i}" value="${esc(c.nombre)}" aria-label="Nombre de la categoría" style="flex:1;min-height:40px;border-radius:10px;border:1px solid var(--linea);background:var(--tarjeta-2);color:var(--crema);padding:0 10px">
        <span class="texto-tenue" style="font-size:12px;white-space:nowrap">${uso(c.id)} curso(s)</span>
        <button class="mini-btn" aria-label="Subir" data-sub="${i}" ${i === 0 ? "disabled" : ""}>${icono("up", 18)}</button>
        <button class="mini-btn" aria-label="Quitar ${esc(c.nombre)}" data-quitar="${i}">${icono("trash", 18)}</button>
      </div>`).join("");
    capa.querySelectorAll(".cat-nom").forEach((inp) => (inp.oninput = () => { lista[Number(inp.dataset.i)].nombre = inp.value; }));
    capa.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => { const i = Number(b.dataset.sub); [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; pintar(); }));
    capa.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => {
      const c = lista[Number(b.dataset.quitar)];
      if (uso(c.id)) { err.textContent = `"${c.nombre}" tiene ${uso(c.id)} curso(s). Cámbialos de categoría antes de quitarla.`; err.hidden = false; return; }
      lista = lista.filter((x) => x !== c); pintar();
    }));
  };
  pintar();
  capa.querySelector("#cat-nueva").onsubmit = (e) => {
    e.preventDefault();
    const inp = capa.querySelector("#cat-nombre");
    const nombre = inp.value.trim(); if (!nombre) return;
    let id = slug(nombre), n = 2;
    while (lista.some((c) => c.id === id)) id = `${slug(nombre)}_${n++}`;
    lista.push({ id, nombre }); nuevas.add(id); inp.value = ""; err.hidden = true; pintar();
  };
  capa.querySelector("#cat-ok").onclick = async () => {
    lista = lista.map((c) => ({ id: c.id, nombre: c.nombre.trim() })).filter((c) => c.nombre);
    if (!lista.length) { err.textContent = "Deja al menos una categoría"; err.hidden = false; return; }
    const btn = capa.querySelector("#cat-ok"); btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await datos.guardarCategorias(lista);
      if (capa.querySelector("#cat-insignia").checked) {
        for (const c of lista.filter((x) => nuevas.has(x.id))) {
          await datos.crearInsignia({ id: `experto_${c.id}`.slice(0, 60), nombre: `Experto en ${c.nombre}`, descripcion: `Completaste todos los cursos de ${c.nombre}`,
            categoria: "especialidad", icono: "trophy", puntos: 150, regla: { tipo: "categoria", categoria: c.id }, orden: 85 });
        }
      }
      fijarCategorias(lista);
      capa.cerrar(true); aviso("Categorías guardadas", "ok"); recargar();
    } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = "Guardar"; }
  };
  return p;
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

async function pintarEditorCurso(main, id, pestana = "lecciones") {
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
      ${l.bunny_video_id ? `<button class="mini-btn btn-cc" aria-label="Subtítulos" title="Subtítulos" data-subs-l="${l.id}">${icono("cc", 18)}</button>` : ""}
      <button class="mini-btn" aria-label="Subir" data-mover-l="${l.id}" data-dir="-1" ${i === 0 ? "disabled" : ""}>${icono("up", 18)}</button>
      <button class="mini-btn" aria-label="Bajar" data-mover-l="${l.id}" data-dir="1" ${i === lista.length - 1 ? "disabled" : ""}>${icono("down", 18)}</button>
      <button class="mini-btn" aria-label="Editar, mover o renombrar" title="Renombrar o cambiar posición" data-renombrar-l="${l.id}">${icono("edit", 18)}</button>
      <button class="mini-btn" aria-label="Quitar" data-borrar-l="${l.id}">${icono("trash", 18)}</button>
    </div>`;

  main.innerHTML = `
    <a href="#/admin/cursos" class="btn-texto" style="display:inline-flex;align-items:center;gap:4px;align-self:flex-start">${icono("back", 16)}Cursos</a>
    <div class="portada-editar">
      ${c.portada_url ? `<img class="portada-curso" src="${esc(c.portada_url)}" alt="Portada">` : `<div class="portada-curso portada-vacia">${icono("video", 28)}<span>Sin portada</span></div>`}
      <div class="pila" style="gap:6px">
        <button class="btn btn-sec btn-chico" id="portada-cambiar">${icono("edit", 16)}${c.portada_url ? "Cambiar portada" : "Subir portada"}</button>
        ${c.portada_url ? `<button class="btn-texto" id="portada-quitar" style="min-height:32px">Quitar portada</button>` : ""}
        <small class="ayuda">Horizontal (16:9). Se recorta al centro.</small>
      </div>
    </div>
    <div class="fila-entre" style="flex-wrap:wrap;align-items:flex-start">
      <div class="pila" style="gap:4px;flex:1 1 320px">
        <span class="etiqueta">${esc(nombreCategoria(c.categoria))} · ${c.publicado ? "Publicado" : "Borrador"}</span>
        <h1 class="titulo-pagina">${esc(c.titulo)}</h1>
        <span class="texto-tenue">${caps.length} capítulos · ${d.lecciones.length} lecciones · ${duracion(durTotal)}${c.quiz_obligatorio ? ` · quiz obligatorio (${c.quiz_minimo}%)` : ""}<span id="valor-curso"></span></span>
      </div>
      <div class="fila" style="flex-wrap:wrap">
        <a class="btn btn-sec" href="#/admin/ver/curso/${c.id}">${icono("eye", 18)}Ver como empleado</a>
        <button class="btn btn-sec" id="editar">${icono("edit", 18)}Datos del curso</button>
        <button class="btn ${c.publicado ? "btn-sec" : ""}" id="publicar">${c.publicado ? "Pasar a borrador" : "Publicar"}</button>
      </div>
    </div>
    ${!c.publicado ? `<div class="tarjeta texto-tenue">En borrador: los empleados todavía no lo ven. Agrega capítulos, videos y asignaciones; luego dale <b>Publicar</b>.</div>` : ""}

    <div class="pestanas" role="tablist" id="pestanas-curso" style="max-width:720px;overflow-x:auto">
      ${[["lecciones", "Lecciones", d.lecciones.length], ["quiz", "Quiz", null], ["materiales", "Materiales", null], ["asignacion", "Asignación", d.asignaciones.length]]
        .map(([v, t, n]) => `<button role="tab" data-pestana="${v}" aria-selected="${v === pestana}" class="${v === pestana ? "activo" : ""}" style="flex:1 0 auto;padding:0 12px;white-space:nowrap">${t}<span class="cuenta" data-cuenta="${v}">${n !== null ? ` · ${n}` : ""}</span></button>`).join("")}
    </div>

    <div>
      <section class="panel" data-panel="lecciones" ${pestana === "lecciones" ? "" : "hidden"}>
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
            <div class="fila" style="flex-wrap:wrap;gap:8px">
              <button class="btn btn-sec btn-chico" data-agregar="${cap.id}">${icono("plus", 16)}Agregar videos</button>
              ${cap.lecciones.some((l) => l.bunny_video_id) ? `<button class="btn btn-sec btn-chico" data-subs-m="${cap.id}">${icono("cc", 16)}Subtítulos</button>` : ""}
            </div>
          </div>`).join("")}
        ${sueltas.length ? `<div class="capitulo-admin"><b>Sin capítulo</b>${sueltas.map((l, i) => leccionHTML(l, sueltas, i)).join("")}${sueltas.some((l) => l.bunny_video_id) ? `<button class="btn btn-sec btn-chico" data-subs-m="" style="align-self:flex-start">${icono("cc", 16)}Subtítulos</button>` : ""}</div>` : ""}
        ${d.lecciones.some((l) => l.bunny_video_id) ? `<p class="texto-tenue subs-ayuda" style="margin:0;font-size:12.5px">${icono("cc", 14, 'style="vertical-align:-2px"')} <span id="subs-resumen">Revisando subtítulos…</span></p>` : ""}
        ${!caps.length && !sueltas.length ? `<div class="vacio"><strong>Empieza con un capítulo</strong>Por ejemplo "El grano y el café". Luego eliges sus videos de Bunny.</div>` : ""}
      </section>

        <section class="panel" data-panel="asignacion" ${pestana === "asignacion" ? "" : "hidden"}>
          <div class="fila-entre" style="flex-wrap:wrap"><h2>¿Quién lo toma?</h2><div class="fila" style="flex-wrap:wrap">
            ${c.publicado && d.asignaciones.length ? `<button class="btn btn-sec btn-chico" id="avisar">${icono("bell", 16)}Avisar por WhatsApp</button>` : ""}
            <button class="btn btn-chico" id="asignar">${icono("plus", 16)}Asignar</button></div></div>
          ${d.asignaciones.length ? d.asignaciones.map((a) => `
            <div class="tarjeta fila-entre" style="padding:12px">
              <div><b style="font-size:14px">${a.user_id ? esc(nombrePerfil(a.user_id)) : a.area ? esc(nombreArea(a.area)) : "Todo el equipo"}${a.sede ? " · " + esc(a.sede) : ""}</b>
                <div class="texto-tenue" style="font-size:12px">${a.obligatorio ? "Obligatorio" : "Opcional"}${a.fecha_limite ? " · vence " + fechaCorta(a.fecha_limite) : ""}</div></div>
              <button class="mini-btn" aria-label="Quitar asignación" data-borrar-a="${a.id}">${icono("trash", 18)}</button>
            </div>`).join("") : `<p class="texto-tenue" style="margin:0">Aún no está asignado a nadie.</p>`}
          <div style="border-top:1px solid var(--linea);padding-top:14px;margin-top:6px">
            <button class="btn btn-peligro btn-chico" id="borrar-curso">${icono("trash", 16)}Borrar curso</button>
          </div>
        </section>
        <section class="panel" id="panel-quiz" data-panel="quiz" ${pestana === "quiz" ? "" : "hidden"}></section>
        <section class="panel" id="panel-materiales" data-panel="materiales" ${pestana === "materiales" ? "" : "hidden"}></section>
    </div>`;

  const conError = async (fn, ok) => { try { await fn(); if (ok) aviso(ok, "ok"); recargar(); } catch (e) { aviso(e.message, "error"); } };
  sincronizarDuraciones(d.lecciones).then((hubo) => { if (hubo && location.hash.includes(c.id)) recargar(); });
  panelQuiz(main.querySelector("#panel-quiz"), c, recargar);
  panelMateriales(main.querySelector("#panel-materiales"), c);
  main.querySelectorAll("[data-pestana]").forEach((b) => (b.onclick = () => {
    const v = b.dataset.pestana;
    main.querySelectorAll("[data-pestana]").forEach((x) => { x.classList.toggle("activo", x === b); x.setAttribute("aria-selected", x === b); });
    main.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== v));
    history.replaceState(null, "", `${location.pathname}${location.search}#/admin/curso/${c.id}/${v}`);
  }));
  Promise.all([datos.adminQuiz(c.id).catch(() => null), datos.adminMateriales(c.id).catch(() => null)]).then(([qz, mt]) => {
    if (qz) main.querySelector('[data-cuenta="quiz"]').textContent = ` · ${qz.length}`;
    const v = valorCurso({ lecciones: d.lecciones, preguntas: qz ? qz.length : 0, conFecha: d.asignaciones.some((a) => a.fecha_limite) });
    const el = main.querySelector("#valor-curso");
    if (el && d.lecciones.length) el.innerHTML = ` · <b style="color:var(--oro)">vale hasta ${num(v.total)} pts</b>`;
    if (mt) main.querySelector('[data-cuenta="materiales"]').textContent = ` · ${mt.length}`;
  });

  main.querySelector("#portada-cambiar").onclick = async () => { if (await cambiarPortada("curso", c.id)) recargar(); };
  main.querySelector("#portada-quitar")?.addEventListener("click", async () => { if (await quitarPortada("curso", c.id)) recargar(); });
  main.querySelector("#editar").onclick = async () => {
    const v = await formulario("Datos del curso", [
      { nombre: "titulo", etiqueta: "Título", valor: c.titulo, requerido: true },
      { nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: opcionesCategoria(), valor: c.categoria },
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
    if (c.publicado) return conError(() => datos.guardarCurso({ id: c.id, publicado: false }), "Pasó a borrador");
    try { await datos.guardarCurso({ id: c.id, publicado: true }); } catch (e) { return aviso(e.message, "error"); }
    aviso("Curso publicado", "ok");
    if (d.asignaciones.length) await avisarCurso({ ...c, publicado: true }, d.lecciones, d.asignaciones, "publicado");
    recargar();
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
    const lista = listaDe(l.id);
    const posActual = lista.findIndex((x) => x.id === l.id) + 1;
    const opciones = [["", "Sin capítulo"], ...caps.map((m, i) => [m.id, `Capítulo ${i + 1} · ${m.titulo}`])];
    const posiciones = lista.map((x, i) => [String(i + 1), i + 1 === posActual ? `${i + 1} (actual)` : i === 0 ? "1 · al inicio" : i === lista.length - 1 ? `${i + 1} · al final` : String(i + 1)]);
    const v = await formulario("Editar lección", [
      { nombre: "titulo", etiqueta: "Título que verán los empleados", valor: l.titulo, requerido: true },
      { nombre: "posicion", etiqueta: "Posición dentro del capítulo", tipo: "select", opciones: posiciones, valor: String(posActual) },
      { nombre: "modulo_id", etiqueta: "Capítulo", tipo: "select", opciones, valor: l.modulo_id || "" },
    ]);
    if (!v) return;
    const cambiaCap = (v.modulo_id || null) !== (l.modulo_id || null);
    conError(async () => {
      if (cambiaCap) {
        // Se manda al final del otro capítulo
        const orden = (d.lecciones.filter((x) => (x.modulo_id || null) === (v.modulo_id || null)).reduce((a, x) => Math.max(a, x.orden), 0)) + 1;
        return datos.actualizarLeccion(l.id, { titulo: v.titulo, modulo_id: v.modulo_id || null, orden });
      }
      const nueva = lista.filter((x) => x.id !== l.id);
      nueva.splice(Number(v.posicion) - 1, 0, l);
      await Promise.all(nueva.map((x, i) => {
        const c = {};
        if (x.orden !== i + 1) c.orden = i + 1;
        if (x.id === l.id && v.titulo !== l.titulo) c.titulo = v.titulo;
        return Object.keys(c).length ? datos.actualizarLeccion(x.id, c) : null;
      }));
    });
  }));
  main.querySelectorAll("[data-borrar-l]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmar("¿Quitar lección?", "Se quita del curso (y el avance de esa lección). El video sigue en Bunny.", "Quitar"))) return;
    conError(() => datos.borrarLeccion(b.dataset.borrarL));
  }));
  main.querySelectorAll("[data-agregar]").forEach((b) => (b.onclick = () => elegirVideos(c.id, b.dataset.agregar, d.lecciones)));

  // Subtítulos: marca en dorado los videos que ya tienen
  let subs = {};
  const pintarSubs = async () => {
    const r = await estadoSubtitulos(d.lecciones);
    const res = main.querySelector("#subs-resumen");
    if (r === null) { if (res) res.textContent = "No pude revisar los subtítulos (¿falta actualizar la función academia-admin?)."; return; }
    subs = r;
    main.querySelectorAll("[data-subs-l]").forEach((b) => {
      const l = d.lecciones.find((x) => x.id === b.dataset.subsL), si = !!subs[l?.bunny_video_id];
      b.classList.toggle("con-subs", si);
      b.title = si ? "Tiene subtítulos · cambiar o quitar" : "Subir subtítulos";
    });
    const conVideo = d.lecciones.filter((l) => l.bunny_video_id), n = conVideo.filter((l) => subs[l.bunny_video_id]).length;
    if (res) res.innerHTML = n ? `<b style="color:var(--oro)">${n} de ${conVideo.length}</b> videos con subtítulos. En la app arrancan encendidos.` : "Ningún video tiene subtítulos todavía. Toca CC en un video o \"Subtítulos\" en un capítulo.";
  };
  pintarSubs();
  main.querySelectorAll("[data-subs-l]").forEach((b) => (b.onclick = () => {
    const l = d.lecciones.find((x) => x.id === b.dataset.subsL);
    subtitulosLeccion(l, !!subs[l.bunny_video_id], pintarSubs);
  }));
  main.querySelectorAll("[data-subs-m]").forEach((b) => (b.onclick = () => {
    const cap = caps.find((x) => x.id === b.dataset.subsM);
    subtitulosCapitulo(cap ? cap.titulo : "Sin capítulo", cap ? cap.lecciones : sueltas, subs, pintarSubs);
  }));
  main.querySelector("#asignar").onclick = async () => {
    const v = await elegirAsignacion(c, d.asignaciones);
    if (!v) return;
    const base = { curso_id: c.id, obligatorio: v.obligatorio, fecha_limite: v.fecha_limite };
    const filas = v.modo === "personas"
      ? v.ids.map((uid) => ({ ...base, area: null, sede: null, user_id: uid }))
      : [{ ...base, area: v.area, sede: v.sede, user_id: null }];
    const creadas = [];
    try { for (const f of filas) creadas.push((await datos.agregarAsignacion(f)) || f); }
    catch (e) { aviso(e.message, "error"); if (!creadas.length) return; }
    aviso(filas.length > 1 ? `Asignado a ${creadas.length} personas` : "Asignado", "ok");
    if (c.publicado) await avisarCurso(c, d.lecciones, creadas.map((a, k) => (a && a.curso_id ? a : filas[k])), "asignado");
    recargar();
  };
  main.querySelector("#avisar")?.addEventListener("click", () => avisarCurso(c, d.lecciones, d.asignaciones, "manual"));
  main.querySelectorAll("[data-borrar-a]").forEach((b) => (b.onclick = async () => {
    if (!(await confirmar("¿Quitar asignación?", "Esas personas dejarán de ver el curso (su avance se conserva).", "Quitar"))) return;
    conError(() => datos.borrarAsignacion(b.dataset.borrarA));
  }));
}

// ---------------------------------------------------------------------
//  ASIGNAR · por área/sede o eligiendo varias personas
// ---------------------------------------------------------------------
export async function elegirAsignacion(c, asignaciones, titulo = "Asignar curso") {
  const p = modal(`
    <h2 class="modal-titulo">${esc(titulo)}</h2>
    <div class="pestanas" role="tablist" id="modo-asig">
      <button type="button" class="activo" data-modo="personas">Elegir personas</button>
      <button type="button" data-modo="grupo">Por área o sede</button>
    </div>
    <form class="form" novalidate id="form-asig">
      <div data-panel-modo="personas" class="pila" style="gap:10px">
        <div class="cargando" style="min-height:120px"><div class="taza-carga"></div></div>
      </div>
      <div data-panel-modo="grupo" class="pila" style="gap:10px" hidden>
        <label class="campo"><span>Área</span><select name="area"><option value="">Todas las áreas</option>${AREAS.map(([v, t]) => `<option value="${v}" ${c.categoria === v && v !== "general" ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        <label class="campo"><span>Sede</span><select name="sede"><option value="">Todas las sedes</option>${SEDES.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select></label>
        <small class="ayuda">Quien entre después a esa área o sede también lo recibe automáticamente.</small>
      </div>
      <label class="check"><input type="checkbox" name="obligatorio" checked><span>Obligatorio</span></label>
      <label class="campo"><span>Fecha límite (opcional)</span><input type="date" name="fecha_limite"></label>
      <p class="error-form" hidden></p>
      <div class="fila-botones">
        <button type="button" class="btn btn-sec" data-cerrar="">Cancelar</button>
        <button type="submit" class="btn" id="ok-asig">Asignar</button>
      </div>
    </form>`, { clase: "modal-ancho" });
  const capa = modal.actual, form = capa.querySelector("#form-asig");
  let modo = "personas", perfiles = [], elegidos = new Set(), filtroArea = "", texto = "";
  const err = form.querySelector(".error-form");
  const panelP = form.querySelector('[data-panel-modo="personas"]');
  const okBtn = form.querySelector("#ok-asig");
  const yaLoTiene = (pf) => asignaciones.some((a) => coincide(a, pf));
  const actualizarBoton = () => { okBtn.textContent = modo === "personas" ? (elegidos.size ? `Asignar a ${elegidos.size}` : "Asignar") : "Asignar"; };

  capa.querySelector("#modo-asig").onclick = (e) => {
    const b = e.target.closest("[data-modo]"); if (!b) return;
    modo = b.dataset.modo;
    capa.querySelectorAll("[data-modo]").forEach((x) => x.classList.toggle("activo", x === b));
    form.querySelectorAll("[data-panel-modo]").forEach((x) => (x.hidden = x.dataset.panelModo !== modo));
    err.hidden = true; actualizarBoton();
  };

  const visibles = () => perfiles.filter((pf) => (!filtroArea || pf.area === filtroArea)
    && (!texto || pf.nombre.toLowerCase().includes(texto) || String(pf.usuario || "").toLowerCase().includes(texto)));
  const pintarLista = () => {
    const lista = visibles();
    const libres = lista.filter((pf) => !yaLoTiene(pf));
    const todos = libres.length && libres.every((pf) => elegidos.has(pf.user_id));
    panelP.querySelector("#personas").innerHTML = lista.length ? lista.map((pf) => {
      const ya = yaLoTiene(pf);
      return `<label class="persona-check ${ya ? "ya" : ""}">
        <input type="checkbox" value="${pf.user_id}" ${ya ? "disabled" : elegidos.has(pf.user_id) ? "checked" : ""}>
        <span class="avatar" style="width:34px;height:34px;font-size:12px;flex:none">${esc(pf.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase())}</span>
        <span style="flex:1;min-width:0"><b>${esc(pf.nombre)}</b><small>${esc(nombreArea(pf.area))}${pf.sede ? " · " + esc(pf.sede) : ""}</small></span>
        ${ya ? `<span class="pildora">Ya lo tiene</span>` : ""}
      </label>`;
    }).join("") : `<p class="texto-tenue" style="margin:8px 0">Nadie coincide con la búsqueda.</p>`;
    const t = panelP.querySelector("#todos");
    t.textContent = todos ? "Quitar todos" : `Seleccionar ${filtroArea || texto ? "los visibles" : "todos"}`;
    t.disabled = !libres.length;
    panelP.querySelector("#cuenta-sel").textContent = elegidos.size ? `${elegidos.size} seleccionada${elegidos.size === 1 ? "" : "s"}` : "Nadie seleccionado";
    actualizarBoton();
  };

  try {
    perfiles = (await datos.adminPerfiles()).filter((pf) => pf.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const areas = [...new Set(perfiles.map((pf) => pf.area).filter(Boolean))];
    panelP.innerHTML = `
      <input class="buscar-persona" type="search" placeholder="Buscar por nombre…" aria-label="Buscar persona" id="buscar-p">
      ${areas.length > 1 ? `<div class="chips" id="areas-p"><button type="button" class="chip activo" data-a="">Todas</button>${areas.map((a) => `<button type="button" class="chip" data-a="${esc(a)}">${esc(nombreArea(a))}</button>`).join("")}</div>` : ""}
      <div class="fila-entre"><span class="texto-tenue" style="font-size:12px" id="cuenta-sel"></span><button type="button" class="btn-texto" id="todos"></button></div>
      <div class="lista-personas" id="personas"></div>`;
    panelP.querySelector("#buscar-p").oninput = (e) => { texto = e.target.value.trim().toLowerCase(); pintarLista(); };
    const chips = panelP.querySelector("#areas-p");
    if (chips) chips.onclick = (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      filtroArea = b.dataset.a;
      chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("activo", x === b));
      pintarLista();
    };
    panelP.querySelector("#personas").onchange = (e) => {
      const cb = e.target.closest("input[type=checkbox]"); if (!cb) return;
      cb.checked ? elegidos.add(cb.value) : elegidos.delete(cb.value);
      err.hidden = true; pintarLista();
    };
    panelP.querySelector("#todos").onclick = () => {
      const libres = visibles().filter((pf) => !yaLoTiene(pf));
      const todos = libres.every((pf) => elegidos.has(pf.user_id));
      libres.forEach((pf) => (todos ? elegidos.delete(pf.user_id) : elegidos.add(pf.user_id)));
      pintarLista();
    };
    pintarLista();
  } catch (e) {
    panelP.innerHTML = `<div class="vacio"><strong>No se pudo cargar el equipo</strong>${esc(e.message)}</div>`;
  }

  let resultado = null;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fecha = form.elements.fecha_limite.value || null;
    if (fecha && fecha < hoyISO()) { err.textContent = "La fecha límite ya pasó"; err.hidden = false; return; }
    const comun = { obligatorio: form.elements.obligatorio.checked, fecha_limite: fecha };
    if (modo === "personas") {
      if (!elegidos.size) { err.textContent = "Elige al menos una persona"; err.hidden = false; return; }
      resultado = { modo, ids: [...elegidos], ...comun };
    } else {
      resultado = { modo, area: form.elements.area.value || null, sede: form.elements.sede.value || null, ...comun };
    }
    capa.cerrar("ok");
  });
  await p;
  return resultado;
}

// ---------------------------------------------------------------------
//  AVISAR POR WHATSAPP · a quienes tienen asignado un curso publicado
// ---------------------------------------------------------------------
const coincide = (a, p) => (!a.area || String(a.area).toLowerCase() === String(p.area || "").toLowerCase())
  && (!a.sede || String(a.sede).toLowerCase() === String(p.sede || "").toLowerCase())
  && (!a.user_id || a.user_id === p.user_id);
const urlApp = () => `${location.origin}${location.pathname}`;
const llaveAvisados = (cursoId) => `academia-avisados-${cursoId}`;
function leerAvisados(cursoId) { try { return JSON.parse(localStorage.getItem(llaveAvisados(cursoId)) || "{}"); } catch (_) { return {}; } }
function marcarAvisado(cursoId, userId) {
  try { const m = leerAvisados(cursoId); m[userId] = hoyISO(); localStorage.setItem(llaveAvisados(cursoId), JSON.stringify(m)); } catch (_) { /* nada */ }
}
function fechaLarga(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}
function mensajeCurso(nombre, c, segundos, puntos, fecha, tipo = "curso") {
  const primer = String(nombre || "").split(" ")[0];
  const audio = tipo === "audio";
  return [
    `¡Hola ${primer}! ☕`,
    `Ya tienes ${audio ? "un audiolibro nuevo 🎧" : "un curso nuevo"} en la *Academia del Buen Café*: *${c.titulo}*${c.autor && audio ? ` de ${c.autor}` : ""}${segundos ? ` (${duracion(segundos)})` : ""}.`,
    puntos ? `Vale hasta ${num(puntos)} puntos para tu nivel y premios${audio ? ": ganas por cada minuto que escuches" : ""}. 🏆` : "",
    fecha ? `Tienes hasta el ${fechaLarga(fecha)} para ${audio ? "escucharlo completo" : "terminarlo"}.` : audio ? "Escúchalo a tu ritmo, hasta con la pantalla apagada." : "Avanza a tu ritmo, un video a la vez.",
    `Entra aquí con tu usuario y PIN: ${urlApp()}`,
  ].filter(Boolean).join("\n");
}

export async function avisarCurso(c, lecciones, asignaciones, motivo = "manual", tipo = "curso") {
  const p = modal(`
    <div class="fila-entre"><h2 class="modal-titulo">Avisar a tu equipo</h2><button class="btn-icono" data-cerrar aria-label="Cerrar">${icono("x")}</button></div>
    <div id="avisar-cuerpo"><div class="cargando" style="min-height:140px"><div class="taza-carga"></div></div></div>`, { clase: "modal-ancho" });
  const capa = modal.actual, cuerpo = capa.querySelector("#avisar-cuerpo");
  try {
    const [perfiles, gestor, qz] = await Promise.all([
      datos.adminPerfiles(),
      datos.gestorEmpleados().catch(() => []),
      tipo === "audio" ? Promise.resolve(null) : datos.adminQuiz(c.id).catch(() => null),
    ]);
    const wa = Object.fromEntries((gestor || []).filter((g) => g.whatsapp).map((g) => [g.gestor_id, g.whatsapp]));
    const segundos = tipo === "audio" ? c.duracion_seg || 0 : lecciones.reduce((a, l) => a + (l.duracion_seg || 0), 0);
    const gente = perfiles.filter((pf) => pf.activo !== false).map((pf) => {
      const suyas = asignaciones.filter((a) => coincide(a, pf));
      if (!suyas.length) return null;
      const fechas = suyas.map((a) => a.fecha_limite).filter(Boolean).sort();
      return { ...pf, fecha: fechas[0] || null, whatsapp: wa[pf.gestor_id] || null };
    }).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const v = tipo === "audio" ? valorAudio(segundos, gente.some((g) => g.fecha)) : valorCurso({ lecciones, preguntas: qz ? qz.length : 0, conFecha: gente.some((g) => g.fecha) });
    const que = tipo === "audio" ? "audiolibro" : "curso";
    const avisados = leerAvisados(c.id);
    const intro = motivo === "publicado" ? "¡Listo, ya está publicado! Mándales un mensaje para que lo empiecen."
      : motivo === "asignado" ? `Estas personas acaban de recibir el ${que}.` : `Quienes tienen asignado este ${que}:`;
    if (!gente.length) {
      cuerpo.innerHTML = `<p class="texto-tenue">${intro}</p><div class="vacio"><strong>Nadie coincide todavía</strong>Revisa que los empleados tengan el área y la sede correctas.</div>`;
      return p;
    }
    const general = mensajeCurso("equipo", c, segundos, v.total, gente.every((g) => g.fecha === gente[0].fecha) ? gente[0].fecha : null, tipo);
    cuerpo.innerHTML = `
      <p class="texto-tenue" style="margin:0 0 4px">${intro} El mensaje ya va escrito con su nombre${v.total ? `, los <b style="color:var(--oro)">${num(v.total)} pts</b>` : ""} y su fecha límite.</p>
      <div class="lista-aviso">${gente.map((g) => `
        <div class="fila-aviso ${avisados[g.user_id] ? "enviado" : ""}" data-fila="${g.user_id}">
          <div class="avatar" style="width:38px;height:38px;font-size:13px;flex:none">${esc(g.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase())}</div>
          <div style="flex:1;min-width:0"><b style="font-size:14px">${esc(g.nombre)}</b>
            <div class="texto-tenue" style="font-size:12px">${g.whatsapp ? "WhatsApp del Gestor" : "Sin número: eliges el chat"}${g.fecha ? " · vence " + fechaCorta(g.fecha) : ""}${avisados[g.user_id] ? ` · <span class="ok-aviso">avisado ${avisados[g.user_id] === hoyISO() ? "hoy" : fechaCorta(avisados[g.user_id])}</span>` : ""}</div></div>
          <a class="btn btn-chico ${avisados[g.user_id] ? "btn-sec" : ""}" target="_blank" rel="noopener" data-enviar="${g.user_id}"
             href="${linkWhats(mensajeCurso(g.nombre, c, segundos, v.total, g.fecha, tipo), g.whatsapp)}">${avisados[g.user_id] ? "Otra vez" : "Enviar"}</a>
        </div>`).join("")}</div>
      <div class="pila" style="gap:8px;margin-top:6px">
        <a class="btn btn-sec btn-bloque" target="_blank" rel="noopener" href="${linkWhats(general, null)}">${icono("users", 18)}Un solo mensaje para el grupo</a>
        <button class="btn btn-bloque" data-cerrar>Listo</button>
      </div>`;
    cuerpo.querySelectorAll("[data-enviar]").forEach((a) => a.addEventListener("click", () => {
      const id = a.dataset.enviar;
      marcarAvisado(c.id, id);
      const fila = cuerpo.querySelector(`[data-fila="${id}"]`);
      fila.classList.add("enviado");
      a.classList.add("btn-sec"); a.textContent = "Otra vez";
      const info = fila.querySelector(".texto-tenue");
      if (!info.querySelector(".ok-aviso")) info.insertAdjacentHTML("beforeend", ` · <span class="ok-aviso">avisado hoy</span>`);
    }));
  } catch (e) {
    console.error(e);
    cuerpo.innerHTML = `<div class="vacio"><strong>No se pudo armar la lista</strong>${esc(e.message)}</div>`;
  }
  return p;
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
      <h1 class="titulo-pagina">Premios y canjes</h1>
      <button class="btn" id="nuevo">${icono("plus", 18)}Nuevo premio</button>
    </div>
    <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:20px">
      <section class="panel" style="flex:1 1 420px">
        <h2>Catálogo</h2>
        ${premios.map((p) => `
          <div class="tarjeta fila-entre" style="padding:10px 12px;gap:10px;${p.activo ? "" : "opacity:.55"}">
            <button class="premio-mini" data-foto="${p.id}" title="${p.imagen_url ? "Cambiar foto" : "Subir foto"}">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="">` : icono("plus", 18)}</button>
            <div style="flex:1;min-width:0"><b>${esc(p.nombre)}</b>${p.destacado ? ` <span class="pildora pildora-oro" style="font-size:10px">Destacado</span>` : ""}
              <div class="texto-tenue" style="font-size:12px">${num(p.costo)} pts${p.descripcion ? " · " + esc(p.descripcion) : ""}${p.disponible_hasta ? ` · hasta ${fechaCorta(p.disponible_hasta)}${p.disponible_hasta < hoyISO() ? " (vencido)" : ""}` : ""}${p.activo ? "" : " · oculto"}</div></div>
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
      { nombre: "destacado", etiqueta: "Destacarlo (sale arriba, más grande)", tipo: "check", valor: !!p.destacado },
      { nombre: "disponible_hasta", etiqueta: "Disponible hasta (opcional, para premios por tiempo limitado)", tipo: "fecha", valor: p.disponible_hasta || "" },
    ]);
    if (!v) return;
    if (!(v.costo > 0)) return aviso("El costo debe ser mayor a 0", "error");
    try { await datos.guardarPremio({ id: p.id, ...v, destacado: !!v.destacado, disponible_hasta: v.disponible_hasta || null }); aviso(p.id ? "Guardado" : "Premio creado. Tócale el cuadrito para agregarle foto.", "ok"); recargar(); }
    catch (e) { aviso(/destacado|disponible_hasta|imagen_url/i.test(e.message) ? "Falta correr el paso 9 de SQL en Supabase" : e.message, "error"); }
  };
  main.querySelector("#nuevo").onclick = () => editar();
  main.querySelectorAll("[data-foto]").forEach((b) => (b.onclick = async () => {
    const p = premios.find((x) => x.id === b.dataset.foto);
    if (p.imagen_url) {
      const op = await modal(`<h2 class="modal-titulo">Foto de "${esc(p.nombre)}"</h2><img src="${esc(p.imagen_url)}" alt="" style="width:100%;border-radius:14px">
        <div class="fila-botones"><button class="btn btn-sec" data-cerrar="quitar">Quitar</button><button class="btn" data-cerrar="cambiar">Cambiar foto</button></div>`);
      if (op === "quitar") { if (await quitarPortada("premio", p.id)) recargar(); return; }
      if (op !== "cambiar") return;
    }
    if (await cambiarPortada("premio", p.id)) recargar();
  }));
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
      <h1 class="titulo-pagina">Insignias</h1>
      <button class="btn" id="otorgar">${icono("crown", 18)}Otorgar reconocimiento</button>
    </div>
    <p class="texto-tenue" style="margin:0">Casi todas se ganan solas al avanzar. Las manuales (como "Empleado del mes") las otorgas tú. Para editarlas o crear nuevas ve a <a href="#/admin/configuracion/insignias">Configuración → Insignias</a>.</p>
    <div class="vitrina">${catalogo.map((i) => `
      <div class="vitrina-item"><div class="medalla ${i.nivel === "oro" || i.categoria === "especial" ? "medalla-oro" : i.nivel === "plata" ? "medalla-plata" : i.nivel === "bronce" ? "medalla-bronce" : "medalla-cobre"}">${icono(i.icono, 24)}</div>
        <b>${esc(i.nombre)}</b><small>${esc(i.descripcion)}</small><small style="color:var(--oro)">+${num(i.puntos)} pts${i.secreta ? " · secreta" : ""}</small></div>`).join("")}</div>`;
  main.querySelector("#otorgar").onclick = async () => {
    const v = await formulario("Otorgar reconocimiento", [
      { nombre: "user_id", etiqueta: "Empleado", tipo: "select", opciones: equipo.filter((e) => e.activo).map((e) => [e.user_id, e.nombre]) },
      { nombre: "insignia", etiqueta: "Insignia", tipo: "select", opciones: catalogo.filter((i) => i.regla?.tipo === "manual" && i.activa !== false).map((i) => [i.id, `${i.nombre} (+${i.puntos} pts)`]) },
    ], "Otorgar");
    if (!v?.user_id || !v.insignia) return;
    try { await datos.otorgarInsignia(v.user_id, v.insignia); aviso("Reconocimiento otorgado", "ok"); } catch (e) { aviso(e.message, "error"); }
  };
}
