// =====================================================================
//  ADMIN · Ranking, "Para reconocer" (premios que ya alcanzan y diplomas
//  listos) y ficha de cada empleado (de dónde salieron sus puntos).
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, num, duracion, fechaCorta, hoyISO, haceCuanto, aviso, modal, nombreArea } from "./ui.js";
import { avatarOIniciales } from "./avatar.js";
import { mostrarCertificado, folio } from "./certificado.js";

export const MOTIVOS = {
  leccion: ["Lecciones vistas", "video"],
  curso: ["Cursos terminados", "trophy"],
  quiz_perfecto: ["Quiz perfecto", "target"],
  a_tiempo: ["Cursos a tiempo", "clock"],
  insignia: ["Insignias", "medal"],
  audio: ["Minutos de audiolibro", "audifonos"],
  audiolibro: ["Audiolibros terminados", "biblioteca"],
  audio_a_tiempo: ["Audiolibros a tiempo", "clock"],
  idea: ["Ideas implementadas", "bulb"],
  bono: ["Bonos", "gift"],
};
const nombreMotivo = (m) => (MOTIVOS[m] || [m || "Otro"])[0];
const iconoMotivo = (m) => (MOTIVOS[m] || [null, "star"])[1];
const falta11 = (e) => (/academia_admin_ficha|academia_admin_reconocer|Could not find the function|PGRST202/i.test(e?.message || "")
  ? "Falta correr el paso 11 de SQL (ficha del empleado) en Supabase." : e?.message);
const linkWhats = (msg, numero) => `https://wa.me/${numero ? String(numero).replace(/\D/g, "") : ""}?text=${encodeURIComponent(msg)}`;
const urlApp = () => `${location.origin}${location.pathname}`;
const fechaLarga = (iso) => new Date(iso || Date.now()).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (_) { return {}; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* nada */ } };
const LLAVE_DIPLOMAS = "academia-admin-diplomas-entregados", LLAVE_PREMIOS = "academia-admin-premios-avisados", LLAVE_PROPUESTAS = "academia-admin-propuestas-recordadas";

// Números de WhatsApp desde el Gestor (si está conectado).
async function numerosWhats() {
  try {
    const [perfiles, gestor] = await Promise.all([datos.adminPerfiles(), datos.gestorEmpleados()]);
    const porGestor = Object.fromEntries((gestor || []).filter((g) => g.whatsapp).map((g) => [g.gestor_id, g.whatsapp]));
    return Object.fromEntries(perfiles.filter((p) => porGestor[p.gestor_id]).map((p) => [p.user_id, porGestor[p.gestor_id]]));
  } catch (_) { return {}; }
}
const premiosVigentes = (premios) => premios.filter((p) => p.activo !== false && (!p.disponible_hasta || p.disponible_hasta >= hoyISO()));

// ---------------------------------------------------------------------
//  Ranking (panel en Resumen)
// ---------------------------------------------------------------------
export function montarRanking(caja, avs = {}) {
  let periodo = "semana";
  const pintar = async () => {
    caja.innerHTML = `
      <div class="fila-entre"><h2>${icono("trophy", 20, 'style="vertical-align:-3px;color:var(--oro)"')} Ranking</h2></div>
      <div class="pestanas" id="rk-per">${[["semana", "Semana"], ["mes", "Mes"], ["total", "Total"]].map(([v, t]) => `<button data-p="${v}" class="${v === periodo ? "activo" : ""}">${t}</button>`).join("")}</div>
      <div id="rk-lista" class="pila" style="gap:6px"><div class="cargando" style="min-height:80px"><div class="taza-carga"></div></div></div>`;
    caja.querySelector("#rk-per").onclick = (e) => { const b = e.target.closest("[data-p]"); if (b) { periodo = b.dataset.p; pintar(); } };
    try {
      const filas = (await datos.ranking(periodo)).filter((f) => f.puntos > 0 || periodo !== "total");
      const medalla = (n) => (n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : `<span class="rk-pos">${n}</span>`);
      caja.querySelector("#rk-lista").innerHTML = filas.length ? filas.slice(0, 15).map((f) => `
        <a class="rk-fila ${f.puntos ? "" : "cero"}" href="#/admin/empleado/${f.user_id}">
          <span class="rk-medalla">${medalla(Number(f.posicion))}</span>
          ${avatarOIniciales(avs[f.user_id], f.nombre, 32)}
          <span style="flex:1;min-width:0"><b>${esc(f.nombre)}</b><small class="texto-tenue" style="display:block">${esc(nombreArea(f.area))}</small></span>
          <b style="color:var(--oro)">${num(f.puntos)}</b>
        </a>`).join("") : `<p class="texto-tenue" style="margin:0">Nadie ha sumado puntos ${periodo === "semana" ? "esta semana" : periodo === "mes" ? "este mes" : "todavía"}.</p>`;
    } catch (e) { caja.querySelector("#rk-lista").innerHTML = `<p class="texto-tenue">${esc(e.message)}</p>`; }
  };
  pintar();
}

// ---------------------------------------------------------------------
//  Para reconocer: premios que ya les alcanzan + diplomas listos
// ---------------------------------------------------------------------
export async function montarReconocer(caja, avs = {}) {
  caja.innerHTML = `<h2>${icono("gift", 20, 'style="vertical-align:-3px;color:var(--oro)"')} Para reconocer</h2><div class="cargando" style="min-height:80px"><div class="taza-carga"></div></div>`;
  let gente, premios, numeros;
  try {
    [gente, { premios }, numeros] = await Promise.all([datos.adminReconocer(), datos.adminPremios(), numerosWhats()]);
  } catch (e) {
    caja.innerHTML = `<h2>Para reconocer</h2><p class="texto-tenue" style="margin:0">${esc(falta11(e))}</p>`;
    return;
  }
  const vigentes = premiosVigentes(premios).sort((a, b) => a.costo - b.costo);
  let verEntregados = false;
  const pintar = () => {
    const avisados = leer(LLAVE_PREMIOS), entregados = leer(LLAVE_DIPLOMAS), recordados = leer(LLAVE_PROPUESTAS);
    const faltan = gente.filter((g) => Array.isArray(g.sin_propuesta) && g.sin_propuesta.length);
    const alcanzan = gente.map((g) => {
      const ok = vigentes.filter((p) => p.costo <= g.disponibles);
      const meta = premios.find((p) => p.id === g.meta_premio);
      return { ...g, ok, meta, metaLista: meta && meta.costo <= g.disponibles };
    }).filter((g) => g.ok.length).sort((a, b) => Number(b.metaLista) - Number(a.metaLista) || b.disponibles - a.disponibles);
    const diplomas = gente.flatMap((g) => g.diplomas.map((d) => ({ ...d, g, clave: `${g.user_id}|${d.curso_id}` })))
      .sort((a, b) => String(b.terminado_en).localeCompare(String(a.terminado_en)));
    const pendientes = diplomas.filter((d) => !entregados[d.clave]);
    const lista = verEntregados ? diplomas : pendientes;
    caja.innerHTML = `
      <h2>${icono("gift", 20, 'style="vertical-align:-3px;color:var(--oro)"')} Para reconocer</h2>
      <div class="etiqueta">Ya les alcanza un premio · ${alcanzan.length}</div>
      ${alcanzan.length ? alcanzan.map((g) => {
        const top = g.ok[g.ok.length - 1];
        const av = avisados[g.user_id];
        return `
        <div class="rec-fila">
          <a href="#/admin/empleado/${g.user_id}" class="avatar-boton">${avatarOIniciales(avs[g.user_id], g.nombre, 34)}</a>
          <span style="flex:1;min-width:0">
            <a href="#/admin/empleado/${g.user_id}" class="rec-nombre">${esc(g.nombre)}</a> <b style="color:var(--oro)">${num(g.disponibles)} pts</b>
            <small class="texto-tenue" style="display:block">${g.metaLista ? `🎯 ¡Ya alcanza su meta: <b style="color:var(--crema)">${esc(g.meta.nombre)}</b>!` : `Le alcanza: ${esc(top.nombre)}${g.ok.length > 1 ? ` y ${g.ok.length - 1} más` : ""}`}${av ? ` · <span class="ok-aviso">avisado ${av === hoyISO() ? "hoy" : fechaCorta(av)}</span>` : ""}</small>
          </span>
          <a class="btn btn-chico btn-sec" target="_blank" rel="noopener" data-avisar="${g.user_id}" href="${linkWhats(mensajePremio(g), numeros[g.user_id])}">${icono("send", 15)}Avisar</a>
        </div>`;
      }).join("") : `<p class="texto-tenue" style="margin:0;font-size:13px">A nadie le alcanza todavía${vigentes.length ? ` (el premio más barato cuesta ${num(vigentes[0].costo)} pts)` : " — no hay premios activos"}.</p>`}
      ${gente.some((g) => Array.isArray(g.sin_propuesta)) ? `<div class="etiqueta" style="margin-top:8px">Les falta su propuesta · ${faltan.length}</div>
      ${faltan.length ? faltan.map((g) => {
        const rec = recordados[g.user_id];
        return `
        <div class="rec-fila">
          <a href="#/admin/empleado/${g.user_id}" class="avatar-boton">${avatarOIniciales(avs[g.user_id], g.nombre, 34)}</a>
          <span style="flex:1;min-width:0">
            <a href="#/admin/empleado/${g.user_id}" class="rec-nombre">${esc(g.nombre)}</a>
            <small class="texto-tenue" style="display:block">Terminó ${g.sin_propuesta.map((c) => esc(c.titulo)).join(", ")} y no ha enviado su propuesta${rec ? ` · <span class="ok-aviso">recordado ${rec === hoyISO() ? "hoy" : fechaCorta(rec)}</span>` : ""}</small>
          </span>
          <a class="btn btn-chico btn-sec" target="_blank" rel="noopener" data-recordar="${g.user_id}" href="${linkWhats(mensajePropuesta(g), numeros[g.user_id])}">${icono("send", 15)}Recordar</a>
        </div>`;
      }).join("") : `<p class="texto-tenue" style="margin:0;font-size:13px">Todos los que terminaron un curso ya enviaron su propuesta. 👏</p>`}` : ""}
      <div class="fila-entre" style="margin-top:8px"><div class="etiqueta">Diplomas listos · ${pendientes.length}</div>
        ${diplomas.length > pendientes.length ? `<button class="btn-texto" id="rec-ver" style="min-height:28px">${verEntregados ? "Ocultar entregados" : `Ver entregados (${diplomas.length - pendientes.length})`}</button>` : ""}</div>
      ${lista.length ? lista.map((d) => `
        <div class="rec-fila ${entregados[d.clave] ? "entregado" : ""}">
          <span class="medalla medalla-oro chica" style="flex:none;width:34px;height:34px">${icono("medal", 16)}</span>
          <span style="flex:1;min-width:0">
            <a href="#/admin/empleado/${d.g.user_id}" class="rec-nombre">${esc(d.g.nombre)}</a>
            <small class="texto-tenue" style="display:block">${esc(d.titulo)} · ${d.terminado_en ? fechaCorta(d.terminado_en) : ""}${entregados[d.clave] ? ` · <span class="ok-aviso">entregado ${fechaCorta(entregados[d.clave])}</span>` : ""}</small>
          </span>
          <button class="btn btn-chico btn-sec" data-diploma="${d.clave}">${icono("eye", 15)}Diploma</button>
          <button class="mini-btn" data-entregado="${d.clave}" title="${entregados[d.clave] ? "Marcar como no entregado" : "Marcar como entregado"}" aria-label="Entregado">${icono(entregados[d.clave] ? "x" : "check", 18)}</button>
        </div>`).join("") : `<p class="texto-tenue" style="margin:0;font-size:13px">${diplomas.length ? "Todos los diplomas ya están entregados. 🎉" : "Todavía nadie termina un curso con diploma."}</p>`}`;
    caja.querySelectorAll("[data-avisar]").forEach((a) => (a.onclick = () => { const m = leer(LLAVE_PREMIOS); m[a.dataset.avisar] = hoyISO(); escribir(LLAVE_PREMIOS, m); setTimeout(pintar, 300); }));
    caja.querySelectorAll("[data-recordar]").forEach((a) => (a.onclick = () => { const m = leer(LLAVE_PROPUESTAS); m[a.dataset.recordar] = hoyISO(); escribir(LLAVE_PROPUESTAS, m); setTimeout(pintar, 300); }));
    caja.querySelector("#rec-ver")?.addEventListener("click", () => { verEntregados = !verEntregados; pintar(); });
    caja.querySelectorAll("[data-diploma]").forEach((b) => (b.onclick = () => { const d = diplomas.find((x) => x.clave === b.dataset.diploma); verDiploma(d.g, d); }));
    caja.querySelectorAll("[data-entregado]").forEach((b) => (b.onclick = () => {
      const m = leer(LLAVE_DIPLOMAS);
      if (m[b.dataset.entregado]) delete m[b.dataset.entregado]; else m[b.dataset.entregado] = hoyISO();
      escribir(LLAVE_DIPLOMAS, m); pintar();
    }));
  };
  pintar();
}

function mensajePremio(g) {
  const nombre = String(g.nombre || "").split(" ")[0];
  const lista = g.ok.slice(-4).reverse().map((p) => `• ${p.nombre} (${num(p.costo)} pts)`).join("\n");
  return `¡Felicidades ${nombre}! 🎉 Ya juntaste *${num(g.disponibles)} puntos* en la Academia del Buen Café.\n\n`
    + (g.metaLista ? `¡Ya te alcanza para tu meta: *${g.meta.nombre}*! 🎯\n\n` : "")
    + `Te alcanza para:\n${lista}\n\nEntra a la app → Premios para canjearlo 🎁\n${urlApp()}`;
}

function mensajePropuesta(g) {
  const nombre = String(g.nombre || "").split(" ")[0];
  const cursos = g.sin_propuesta.map((c) => `«${c.titulo}»`).join(", ");
  return `¡Hola ${nombre}! 👋 Felicidades por terminar ${cursos} en la Academia del Buen Café. 🎉\n\n`
    + `Me falta tu *propuesta por escrito*: con lo que aprendiste, ¿qué podríamos implementar o mejorar en Mozzafiato? (un platillo, una bebida, la presentación, el servicio…)\n\n`
    + `Entra a la app y toca *Escribir mi propuesta* en Inicio. Si la implementamos, ganas puntos de bono 💡\n${urlApp()}`;
}

export function verDiploma(persona, curso) {
  const nombre = String(persona.nombre || "").split(" ")[0];
  return mostrarCertificado({
    titulo: `Diploma de ${persona.nombre}`,
    tituloCompartir: `Diploma · ${curso.titulo}`,
    textoCompartir: `¡Felicidades ${nombre}! Terminaste el curso "${curso.titulo}" en la Academia del Buen Café. Aquí está tu diploma 🎓`,
    nombre: persona.nombre,
    curso: curso.titulo,
    fecha: fechaLarga(curso.terminado_en),
    segundos: curso.duracion_seg || 0,
    puntaje: curso.quiz_mejor || null,
    codigo: folio(persona.usuario, curso.curso_id || curso.id),
  });
}

// ---------------------------------------------------------------------
//  Ficha del empleado
// ---------------------------------------------------------------------
export async function pintarFicha(main, userId) {
  let f, premios = [], avs = {}, numeros = {};
  try {
    let ideasTodas;
    [f, { premios }, avs, numeros, ideasTodas] = await Promise.all([datos.adminFicha(userId), datos.adminPremios().catch(() => ({ premios: [] })),
      datos.avatares().catch(() => ({})), numerosWhats(), datos.adminIdeas().catch(() => [])]);
    f.propuestasPorCurso = {};
    for (const i of ideasTodas.filter((x) => x.user_id === userId && x.curso_id)) f.propuestasPorCurso[i.curso_id] = (f.propuestasPorCurso[i.curso_id] || 0) + 1;
  } catch (e) {
    main.innerHTML = `<a href="#/admin/resumen" class="btn-texto" style="display:inline-flex;align-items:center;gap:4px">${icono("back", 16)}Resumen</a>
      <div class="vacio"><strong>No se pudo cargar la ficha</strong>${esc(falta11(e))}</div>`;
    return;
  }
  const p = f.perfil;
  const totalMotivos = f.por_motivo.filter((m) => m.puntos > 0).reduce((a, m) => a + m.puntos, 0) || 1;
  const vigentes = premiosVigentes(premios).sort((a, b) => a.costo - b.costo);
  const alcanza = vigentes.filter((x) => x.costo <= f.disponibles);
  const meta = premios.find((x) => x.id === p.meta_premio);
  const ideasTot = Object.values(f.ideas || {}).reduce((a, n) => a + n, 0);
  let verTodo = false;

  const cursoHTML = (c) => {
    const pct = c.lecciones ? Math.round((c.completadas / c.lecciones) * 100) : 0;
    const atrasado = !c.terminado && c.fecha_limite && c.fecha_limite < hoyISO();
    return `
    <div class="ficha-curso">
      <div class="fila-entre" style="gap:10px;align-items:flex-start">
        <div style="min-width:0"><b>${esc(c.titulo)}</b>
          <small class="texto-tenue" style="display:block">${c.completadas} de ${c.lecciones} lecciones${c.quiz_mejor ? ` · quiz ${c.quiz_mejor}%` : ""}${c.fecha_limite ? ` · vence ${fechaCorta(c.fecha_limite)}` : ""}${!c.asignado ? " · ya no asignado" : ""}</small></div>
        ${c.terminado ? `<span class="pildora pildora-verde">${icono("check", 13)}Terminado ${c.terminado_en ? fechaCorta(c.terminado_en) : ""}</span>`
          : atrasado ? `<span class="pildora pildora-alerta">Atrasado</span>` : c.completadas ? `<span class="pildora">En curso</span>` : `<span class="pildora">Sin empezar</span>`}
      </div>
      <div class="fila"><div class="barra fina ${c.terminado ? "ok" : ""}" style="flex:1"><i style="width:${pct}%"></i></div><b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct}%</b></div>
      ${c.terminado ? `<div class="fila" style="gap:8px;flex-wrap:wrap">
        ${f.propuestasPorCurso[c.id] ? `<span class="pildora pildora-verde">${icono("bulb", 13)}${f.propuestasPorCurso[c.id] === 1 ? "Propuesta enviada" : `${f.propuestasPorCurso[c.id]} propuestas`}</span>` : `<span class="pildora pildora-alerta">${icono("bulb", 13)}Falta su propuesta</span>`}
        ${c.certificado ? `<button class="btn btn-chico btn-sec" data-diploma="${c.id}">${icono("medal", 15)}Ver diploma</button>` : ""}</div>` : ""}
    </div>`;
  };
  const audioHTML = (b) => {
    const pct = b.duracion_seg ? Math.min(100, Math.round((b.escuchado / b.duracion_seg) * 100)) : 0;
    return `
    <div class="ficha-curso">
      <div class="fila-entre" style="gap:10px"><div style="min-width:0"><b>${esc(b.titulo)}</b><small class="texto-tenue" style="display:block">${duracion(b.escuchado)} de ${duracion(b.duracion_seg || 0)}${b.ultima_actividad ? " · " + haceCuanto(b.ultima_actividad) : ""}</small></div>
        ${b.completado ? `<span class="pildora pildora-verde">${icono("check", 13)}Terminado</span>` : b.escuchado ? `<span class="pildora">Escuchando</span>` : `<span class="pildora">Sin empezar</span>`}</div>
      <div class="fila"><div class="barra fina ${b.completado ? "ok" : ""}" style="flex:1"><i style="width:${pct}%"></i></div><b style="font-size:12px;color:var(--oro);min-width:36px;text-align:right">${pct}%</b></div>
    </div>`;
  };
  const historialHTML = () => {
    const filas = verTodo ? f.historial : f.historial.slice(0, 25);
    return `${filas.map((h) => `
      <div class="hist-fila">
        <span class="hist-ic">${icono(iconoMotivo(h.motivo), 16)}</span>
        <span style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(nombreMotivo(h.motivo))}</b><small class="texto-tenue" style="display:block">${esc(h.detalle || "")}</small></span>
        <span style="text-align:right;flex:none"><b style="color:${h.puntos < 0 ? "var(--alerta)" : "var(--oro)"}">${h.puntos > 0 ? "+" : ""}${num(h.puntos)}</b><small class="texto-tenue" style="display:block">${fechaCorta(h.creado_en)}</small></span>
      </div>`).join("") || `<p class="texto-tenue" style="margin:0">Todavía no ha ganado puntos.</p>`}
      ${f.historial.length > 25 ? `<button class="btn-texto" id="hist-todo" style="align-self:center">${verTodo ? "Ver menos" : `Ver todo (${f.historial.length})`}</button>` : ""}`;
  };

  main.innerHTML = `
    <a href="#/admin/resumen" class="btn-texto" style="display:inline-flex;align-items:center;gap:4px;align-self:flex-start">${icono("back", 16)}Resumen</a>
    <section class="ficha-cabeza">
      ${avatarOIniciales(avs[p.user_id], p.nombre, 72)}
      <div style="flex:1;min-width:0">
        <h1 class="titulo-pagina" style="margin:0">${esc(p.nombre)}</h1>
        <span class="texto-tenue">@${esc(p.usuario)} · ${esc(nombreArea(p.area))}${p.sede ? " · " + esc(p.sede) : ""}${p.turno ? " · " + esc(p.turno) : ""}${p.activo ? "" : " · <b>Inactivo</b>"}</span>
      </div>
    </section>
    <div class="metricas">
      <div class="metrica"><small>Puntos ganados</small><b style="color:var(--oro)">${num(f.ganados)}</b><span>${esc(f.nivel || "")}</span></div>
      <div class="metrica"><small>Disponibles</small><b>${num(f.disponibles)}</b><span>para canjear</span></div>
      <div class="metrica"><small>Racha</small><b>${f.racha_actual} ${f.racha_actual === 1 ? "día" : "días"}</b><span>mejor: ${f.racha_maxima}</span></div>
      <div class="metrica"><small>Cursos terminados</small><b>${f.cursos.filter((c) => c.terminado).length}/${f.cursos.filter((c) => c.asignado).length}</b><span>de sus asignados</span></div>
    </div>
    <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:20px">
      <div class="pila" style="flex:2 1 520px;gap:20px">
        <section class="panel">
          <h2>¿De dónde salieron sus puntos?</h2>
          ${f.por_motivo.length ? `<div class="pila" style="gap:10px">${f.por_motivo.filter((m) => m.puntos > 0).map((m) => `
            <div class="motivo-fila">
              <span class="hist-ic">${icono(iconoMotivo(m.motivo), 16)}</span>
              <span style="flex:1;min-width:0"><span class="fila-entre"><b style="font-size:13.5px">${esc(nombreMotivo(m.motivo))} <span class="texto-tenue" style="font-weight:400">· ${m.veces}</span></b><b style="color:var(--oro)">${num(m.puntos)}</b></span>
                <div class="barra fina"><i style="width:${Math.max(2, Math.round((m.puntos / totalMotivos) * 100))}%"></i></div></span>
            </div>`).join("")}</div>` : `<p class="texto-tenue" style="margin:0">Todavía no ha ganado puntos.</p>`}
        </section>
        <section class="panel">
          <h2>Cursos</h2>
          ${f.cursos.length ? `<div class="pila" style="gap:10px">${f.cursos.map(cursoHTML).join("")}</div>` : `<p class="texto-tenue" style="margin:0">No tiene cursos asignados.</p>`}
        </section>
        ${f.audiolibros.length ? `<section class="panel"><h2>Audiolibros</h2><div class="pila" style="gap:10px">${f.audiolibros.map(audioHTML).join("")}</div></section>` : ""}
        <section class="panel">
          <h2>Historial de puntos</h2>
          <div class="pila" style="gap:4px" id="historial">${historialHTML()}</div>
        </section>
      </div>
      <div class="pila" style="flex:1 1 280px;gap:20px">
        <section class="panel">
          <h2>Premios</h2>
          ${meta ? `<div class="tarjeta fila" style="gap:10px;padding:10px">${icono("target", 18, 'style="color:var(--oro);flex:none"')}<span style="font-size:13.5px">Su meta: <b>${esc(meta.nombre)}</b> (${num(meta.costo)} pts)${meta.costo <= f.disponibles ? ` · <b style="color:var(--verde)">¡ya le alcanza!</b>` : ` · le faltan ${num(meta.costo - f.disponibles)}`}</span></div>` : ""}
          ${alcanza.length ? `<p class="texto-tenue" style="margin:0;font-size:13px">Ya le alcanza para:</p>
            <div class="pila" style="gap:6px">${alcanza.slice().reverse().map((x) => `<div class="fila-entre" style="font-size:13.5px"><span>${icono("gift", 14, 'style="vertical-align:-2px;color:var(--oro)"')} ${esc(x.nombre)}</span><b>${num(x.costo)}</b></div>`).join("")}</div>
            <a class="btn btn-sec btn-chico" target="_blank" rel="noopener" href="${linkWhats(mensajePremio({ ...p, disponibles: f.disponibles, ok: alcanza, meta, metaLista: meta && meta.costo <= f.disponibles }), numeros[p.user_id])}">${icono("send", 15)}Avisarle por WhatsApp</a>`
            : `<p class="texto-tenue" style="margin:0;font-size:13px">Todavía no le alcanza ningún premio${vigentes.length ? ` (el más barato: ${num(vigentes[0].costo)} pts)` : ""}.</p>`}
          ${f.canjes.length ? `<div class="etiqueta" style="margin-top:6px">Canjes</div><div class="pila" style="gap:6px">${f.canjes.map((k) => `
            <div class="fila-entre" style="font-size:13px"><span>${esc(k.premio)} <small class="texto-tenue">· ${fechaCorta(k.creado_en)}</small></span><span class="pildora ${k.estado === "aprobado" ? "pildora-verde" : k.estado === "rechazado" ? "" : "pildora-oro"}">${esc(k.estado)}</span></div>`).join("")}</div>` : ""}
        </section>
        <section class="panel">
          <h2>Insignias · ${f.insignias.length}</h2>
          ${f.insignias.length ? `<div class="fila" style="flex-wrap:wrap;gap:6px">${f.insignias.map((i) => `<span class="pildora" title="${fechaCorta(i.otorgada_en)}">${icono(i.icono || "medal", 13)}${esc(i.nombre || i.id)}</span>`).join("")}</div>` : `<p class="texto-tenue" style="margin:0;font-size:13px">Aún sin insignias.</p>`}
        </section>
        <section class="panel">
          <h2>Ideas · ${ideasTot}</h2>
          ${ideasTot ? `<p class="texto-tenue" style="margin:0;font-size:13px">${["nueva", "probando", "implementada", "descartada"].filter((e) => f.ideas[e]).map((e) => `${f.ideas[e]} ${{ nueva: "nueva(s)", probando: "en prueba", implementada: "implementada(s)", descartada: "descartada(s)" }[e]}`).join(" · ")}</p>
            <a class="btn btn-chico btn-sec" href="#/admin/ideas">${icono("bulb", 15)}Ver ideas</a>` : `<p class="texto-tenue" style="margin:0;font-size:13px">Todavía no propone ideas.</p>`}
        </section>
      </div>
    </div>`;

  const conectarHist = () => main.querySelector("#hist-todo")?.addEventListener("click", () => {
    verTodo = !verTodo; main.querySelector("#historial").innerHTML = historialHTML(); conectarHist();
  });
  conectarHist();
  main.querySelectorAll("[data-diploma]").forEach((b) => (b.onclick = () => verDiploma(p, f.cursos.find((c) => c.id === b.dataset.diploma))));
}

// ---------------------------------------------------------------------
//  Avisos para el admin: qué tiene pendiente por dar o revisar
// ---------------------------------------------------------------------
const diasDesde = (iso) => (iso ? (Date.now() - new Date(iso + "T12:00:00").getTime()) / 864e5 : Infinity);

export async function pendientesAdmin() {
  const [rec, pr, ideas] = await Promise.all([
    datos.adminReconocer().then((x) => ({ gente: x })).catch((e) => ({ error: e })),
    datos.adminPremios().catch(() => ({ premios: [], canjes: [] })),
    datos.adminIdeas().catch(() => []),
  ]);
  const r = { canjes: (pr.canjes || []).filter((c) => c.estado === "pendiente").length, premios: 0, diplomas: 0, propuestas: 0,
    ideas: ideas.filter((i) => i.estado === "nueva").length, faltaSql: !!rec.error };
  if (rec.gente) {
    const vig = premiosVigentes(pr.premios || []);
    const avisados = leer(LLAVE_PREMIOS), entregados = leer(LLAVE_DIPLOMAS), recordados = leer(LLAVE_PROPUESTAS);
    r.premios = rec.gente.filter((g) => vig.some((p) => p.costo <= g.disponibles) && diasDesde(avisados[g.user_id]) > 7).length;
    r.diplomas = rec.gente.reduce((a, g) => a + g.diplomas.filter((d) => !entregados[`${g.user_id}|${d.curso_id}`]).length, 0);
    r.propuestas = rec.gente.filter((g) => (g.sin_propuesta || []).length && diasDesde(recordados[g.user_id]) > 3).length;
  }
  r.resumen = r.premios + r.diplomas + r.propuestas;
  r.total = r.canjes + r.resumen + r.ideas;
  return r;
}

function lineas(p) {
  return [
    [p.canjes, "canjes por aprobar", "canje por aprobar", "gift", "#/admin/resumen", "canjes"],
    [p.premios, "personas a las que ya les alcanza un premio", "persona a la que ya le alcanza un premio", "star", "#/admin/resumen", "reconocer"],
    [p.diplomas, "diplomas por entregar", "diploma por entregar", "medal", "#/admin/resumen", "reconocer"],
    [p.propuestas, "personas sin su propuesta", "persona sin su propuesta", "bulb", "#/admin/resumen", "reconocer"],
    [p.ideas, "ideas nuevas", "idea nueva", "send", "#/admin/ideas", ""],
  ].filter(([n]) => n > 0);
}

// Franja "Pendientes de hoy" arriba del Resumen.
export function franjaPendientes(caja, p) {
  if (!caja) return;
  const ls = lineas(p);
  if (!ls.length && !p.faltaSql) { caja.innerHTML = `<div class="pendientes-hoy listo">${icono("check", 18)}<span>Estás al día: no tienes canjes, premios, diplomas ni ideas pendientes.</span></div>`; return; }
  caja.innerHTML = `
    <div class="pendientes-hoy">
      <b>${icono("bell", 18, 'style="vertical-align:-3px"')} Pendientes de hoy</b>
      <div class="fila" style="gap:8px;flex-wrap:wrap">${ls.map(([n, pl, sg, ic, href, ancla]) => `<a class="chip-pendiente" href="${href}" data-ancla="${ancla}">${icono(ic, 15)}<b>${n}</b> ${n === 1 ? sg : pl}</a>`).join("")}</div>
      ${p.faltaSql ? `<small class="texto-tenue">${icono("bulb", 13)} Para ver premios por ofrecer y diplomas por entregar, corre en Supabase los pasos 11 y 13 de SQL.</small>` : ""}
    </div>`;
  caja.querySelectorAll("[data-ancla]").forEach((a) => (a.onclick = (e) => {
    const destino = a.dataset.ancla && document.getElementById(a.dataset.ancla);
    if (destino && location.hash.startsWith("#/admin/resumen")) { e.preventDefault(); destino.scrollIntoView({ behavior: "smooth", block: "start" }); destino.classList.add("resaltar"); setTimeout(() => destino.classList.remove("resaltar"), 1600); }
  }));
}

// Ventana de avisos al entrar al panel (una vez por sesión del navegador).
export async function avisoAlEntrar(p, ir) {
  try { if (sessionStorage.getItem("academia-admin-avisos")) return; sessionStorage.setItem("academia-admin-avisos", "1"); } catch (_) { return; }
  const ls = lineas(p);
  if (!ls.length) return;
  const v = await modal(`
    <div class="pila" style="gap:14px">
      <div class="medalla medalla-oro" style="width:64px;height:64px;align-self:center">${icono("bell", 30)}</div>
      <h2 class="modal-titulo" style="text-align:center">Tienes pendientes</h2>
      <div class="pila" style="gap:8px">${ls.map(([n, pl, sg, ic, href]) => `<button class="aviso-admin-fila" data-cerrar="${href}">${icono(ic, 18)}<span style="flex:1;text-align:left"><b>${n}</b> ${n === 1 ? sg : pl}</span>${icono("next", 16)}</button>`).join("")}</div>
      <button class="btn btn-sec btn-bloque" data-cerrar>Después</button>
    </div>`);
  if (typeof v === "string" && v.startsWith("#/")) ir(v.slice(1));
}

// Globitos en el menú del panel.
export function globosMenu(app, p) {
  const poner = (ruta, n) => {
    const a = app.querySelector(`.admin-menu a[href="#/admin/${ruta}"]`);
    if (!a) return;
    a.querySelector(".globo-cuenta")?.remove();
    if (n) a.insertAdjacentHTML("beforeend", `<span class="globo-cuenta">${n}</span>`);
  };
  poner("resumen", p.resumen + p.canjes);
  poner("premios", p.canjes);
  poner("ideas", p.ideas);
}
