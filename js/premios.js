// =====================================================================
//  PREMIOS (empleado) · catálogo con fotos, destacados, por tiempo
//  limitado, "Mi meta" y "Cómo juntar más puntos".
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, num, duracion, hoyISO, haceCuanto, aviso, modal, confirmar } from "./ui.js";
import { confeti } from "./fiesta.js";
import { puntosLeccion, valorCurso } from "./puntos.js";

const vigente = (p) => !p.disponible_hasta || p.disponible_hasta >= hoyISO();
const diasHasta = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(hoyISO() + "T12:00:00")) / 864e5);
const fechaC = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const pct = (disp, costo) => Math.max(0, Math.min(100, Math.round((disp / costo) * 100)));

function imagenPremio(p, clase = "") {
  return p.imagen_url
    ? `<div class="premio-foto ${clase}"><img src="${esc(p.imagen_url)}" alt="" loading="lazy"></div>`
    : `<div class="premio-foto premio-sin-foto ${clase}">${icono("gift", 34)}</div>`;
}

function etiquetaTiempo(p) {
  if (!p.disponible_hasta) return "";
  const d = diasHasta(p.disponible_hasta);
  return `<span class="pildora pildora-alerta">${icono("clock", 12)} ${d <= 0 ? "Último día" : d === 1 ? "Queda 1 día" : d <= 7 ? `Quedan ${d} días` : `Hasta el ${fechaC(p.disponible_hasta)}`}</span>`;
}

// Lo que todavía puede ganar, con cuánto vale (aproximado) y a dónde ir.
export async function formasDeGanar(r) {
  const [cursos, audios, ins] = await Promise.all([
    datos.misCursos().catch(() => []), datos.misAudiolibros().catch(() => []), datos.insignias().catch(() => ({ catalogo: [], mias: [] })),
  ]);
  const lista = [];
  for (const c of cursos.filter((x) => !x.terminado && x.lecciones)) {
    const prom = (c.duracion_seg || 0) / c.lecciones;
    const total = valorCurso({ lecciones: Array.from({ length: c.lecciones }, () => ({ duracion_seg: prom })) }).total;
    const ya = (c.completadas || 0) * puntosLeccion(prom);
    lista.push({ icono: "video", titulo: `${c.completadas ? "Termina" : "Empieza"} "${c.titulo}"`, detalle: `${c.lecciones - (c.completadas || 0)} lecciones por ver`, pts: Math.max(0, total - ya), ruta: `/curso/${c.id}` });
  }
  for (const b of audios.filter((x) => x.asignado && !x.completado)) {
    const avance = b.duracion_seg ? Math.min(1, (b.max_segundo || 0) / b.duracion_seg) : 0;
    lista.push({ icono: "audifonos", titulo: `Escucha "${b.titulo}"`, detalle: b.duracion_seg ? `${duracion(Math.max(0, b.duracion_seg - (b.max_segundo || 0)))} por escuchar` : "Audiolibro", pts: Math.round((b.valor || 0) * (1 - avance * 0.8)), ruta: `/audio/${b.id}` });
  }
  const mias = new Set((ins.mias || []).map((m) => m.insignia_id));
  const racha = (ins.catalogo || []).filter((i) => i.activa !== false && !mias.has(i.id) && i.regla?.tipo === "racha" && i.regla.n > (r.racha_actual || 0)).sort((a, b) => a.regla.n - b.regla.n)[0];
  if (racha) lista.push({ icono: "flame", titulo: `Aprende ${racha.regla.n} días seguidos`, detalle: `Insignia "${racha.nombre}" · llevas ${r.racha_actual || 0}`, pts: racha.puntos || 0, ruta: "/insignias" });
  const quiz = (ins.catalogo || []).find((i) => i.activa !== false && !mias.has(i.id) && i.regla?.tipo === "quiz_perfecto");
  if (quiz) lista.push({ icono: "star", titulo: "Saca 100 en un quiz", detalle: `Insignia "${quiz.nombre}"`, pts: quiz.puntos || 0, ruta: "/insignias" });
  return lista.filter((x) => x.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 5);
}

function formasHTML(formas) {
  if (!formas.length) return "";
  return `<section class="pila">
    <div class="etiqueta">Cómo juntar más puntos</div>
    ${formas.map((f) => `<button class="forma-ganar" data-ir="${f.ruta}">
      <span class="forma-ic">${icono(f.icono, 18)}</span>
      <span style="flex:1;min-width:0;text-align:left"><b>${esc(f.titulo)}</b><small>${esc(f.detalle)}</small></span>
      <b class="forma-pts">+${num(f.pts)}</b></button>`).join("")}
  </section>`;
}

// Tarjeta de la meta (para Inicio).
export function tarjetaMeta(premio, disp) {
  if (!premio) return `<button class="tarjeta meta-vacia" data-ir="/premios">${icono("target", 22)}<span><b>Elige tu meta</b><small>Escoge un premio y te mostramos cuánto te falta.</small></span>${icono("next", 18)}</button>`;
  const p = pct(disp, premio.costo), listo = disp >= premio.costo;
  return `<button class="tarjeta meta-tarjeta ${listo ? "lista" : ""}" data-ir="/premios">
    ${imagenPremio(premio, "chica")}
    <span class="pila" style="gap:6px;flex:1;min-width:0;text-align:left">
      <span class="etiqueta">${icono("target", 12)} Tu meta</span>
      <b style="font-size:15px">${esc(premio.nombre)}</b>
      <span class="barra"><i style="width:${p}%"></i></span>
      <small class="texto-tenue">${listo ? "¡Ya te alcanza! Toca para canjearlo 🎉" : `${num(disp)} de ${num(premio.costo)} pts · te faltan <b style="color:var(--oro)">${num(premio.costo - disp)}</b>`}</small>
    </span>
  </button>`;
}

// Festeja una sola vez cuando la meta se alcanza.
export async function revisarMeta(usuario, premio, disp, ir) {
  if (!premio || disp < premio.costo) return;
  const llave = `academia-meta-lista-${usuario}-${premio.id}`;
  try { if (localStorage.getItem(llave)) return; localStorage.setItem(llave, "1"); } catch (_) { return; }
  confeti({ cantidad: 200, duracion: 3000 });
  const v = await modal(`
    <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
      <div class="etiqueta" style="color:var(--oro)">¡Meta cumplida!</div>
      ${imagenPremio(premio, "grande")}
      <h2 class="modal-titulo">${esc(premio.nombre)}</h2>
      <p class="modal-texto">Juntaste los ${num(premio.costo)} puntos. Te lo ganaste aprendiendo. ¿Lo canjeas?</p>
      <button class="btn btn-bloque" data-cerrar="canjear">${icono("gift", 18)}Ir a canjearlo</button>
      <button class="btn-texto" data-cerrar>Después</button>
    </div>`, { clase: "desbloqueo" });
  if (v === "canjear") ir("/premios");
}

export async function pintarPremiosEmpleado(ctx) {
  ctx.cargando();
  const [{ premios: todos, canjes }, r, metaId] = await Promise.all([datos.premios(), datos.resumen(), datos.miMeta()]);
  const premios = todos.filter(vigente);
  const disp = r.puntos_disponibles;
  const meta = premios.find((p) => p.id === metaId) || null;
  const formas = await formasDeGanar(r).catch(() => []);
  const destacados = premios.filter((p) => p.destacado || p.disponible_hasta);
  const nombrePremio = (id) => todos.find((p) => p.id === id)?.nombre || "Premio";

  const tarjeta = (p, grande = false) => {
    const alcanza = disp >= p.costo, pendiente = canjes.some((c) => c.premio_id === p.id && c.estado === "pendiente"), esMeta = meta?.id === p.id;
    return `<div class="premio-tarjeta ${grande ? "grande" : ""} ${esMeta ? "es-meta" : ""}">
      ${imagenPremio(p)}
      <button class="premio-meta-btn ${esMeta ? "activa" : ""}" data-meta="${p.id}" aria-label="${esMeta ? "Quitar de mi meta" : "Hacerlo mi meta"}" title="${esMeta ? "Es tu meta" : "Hacerlo mi meta"}">${icono("target", 16)}</button>
      <div class="pila" style="gap:6px;padding:10px 12px 12px">
        <div class="fila" style="gap:6px;flex-wrap:wrap">${p.destacado ? `<span class="pildora pildora-oro">${icono("star", 12)} Destacado</span>` : ""}${etiquetaTiempo(p)}</div>
        <b style="font-size:15px">${esc(p.nombre)}</b>
        ${p.descripcion ? `<small class="texto-tenue">${esc(p.descripcion)}</small>` : ""}
        <div class="barra fina ${alcanza ? "ok" : ""}"><i style="width:${pct(disp, p.costo)}%"></i></div>
        <div class="fila-entre" style="gap:8px">
          <b style="color:var(--oro)">${num(p.costo)} pts</b>
          ${pendiente ? `<span class="pildora pildora-ok">Solicitado</span>`
            : alcanza ? `<button class="btn btn-chico" data-canjear="${p.id}">Canjear</button>`
            : `<small class="texto-tenue">Te faltan ${num(p.costo - disp)}</small>`}
        </div>
      </div>
    </div>`;
  };

  ctx.conNav(`
  <main class="vista">
    <h1 class="titulo-pagina">Premios</h1>
    <section class="saldo"><div><div style="font-size:12px;font-weight:700;letter-spacing:1px">PUNTOS DISPONIBLES</div><b>${num(disp)}</b></div>${icono("gift", 40)}</section>
    ${meta ? tarjetaMeta(meta, disp) : `<p class="texto-tenue" style="margin:0">${icono("target", 14)} Toca la diana de un premio para hacerlo <b>tu meta</b>: lo verás en Inicio con tu avance.</p>`}
    ${destacados.length ? `<section class="pila"><div class="etiqueta">Destacados</div><div class="carrusel-premios">${destacados.map((p) => tarjeta(p, true)).join("")}</div></section>` : ""}
    ${formasHTML(formas)}
    <section class="pila">
      <div class="etiqueta">Catálogo</div>
      ${premios.length ? `<div class="rejilla-premios">${premios.map((p) => tarjeta(p)).join("")}</div>` : `<div class="vacio">Pronto habrá premios para canjear.</div>`}
    </section>
    ${canjes.length ? `<section class="pila"><div class="etiqueta">Mis canjes</div>
      ${canjes.slice(0, 10).map((c) => `<div class="fila-entre tarjeta" style="padding:12px 14px"><div><b style="font-size:14px">${esc(nombrePremio(c.premio_id))}</b><div class="texto-tenue" style="font-size:12px">${num(c.costo)} pts · ${haceCuanto(c.creado_en)}</div></div>
        <span class="pildora ${c.estado === "aprobado" ? "pildora-ok" : c.estado === "rechazado" ? "pildora-alerta" : ""}">${c.estado === "pendiente" ? "En revisión" : c.estado === "aprobado" ? "Aprobado" : "Rechazado"}</span></div>`).join("")}
    </section>` : ""}
    <p class="texto-tenue">Al canjear, Gustavo recibe tu solicitud y la aprueba desde su panel. Si la rechaza, tus puntos regresan.</p>
  </main>`, "premios");

  const app = ctx.app;
  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ctx.ir(b.dataset.ir)));
  app.querySelectorAll("[data-meta]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.meta, quitar = meta?.id === id;
    try {
      await datos.fijarMeta(quitar ? null : id);
      if (!quitar) { const p = premios.find((x) => x.id === id); aviso(`🎯 Tu meta: ${p.nombre}`, "ok"); }
      pintarPremiosEmpleado(ctx);
    } catch (e) { aviso(/academia_fijar_meta|function/i.test(e.message) ? "Falta correr el paso 9 de SQL en Supabase" : e.message, "error"); }
  }));
  app.querySelectorAll("[data-canjear]").forEach((b) => (b.onclick = async () => {
    const p = premios.find((x) => x.id === b.dataset.canjear);
    if (!(await confirmar("¿Canjear premio?", `${p.nombre} por ${num(p.costo)} puntos.`, "Canjear"))) return;
    try { await datos.solicitarCanje(p.id); confeti({ cantidad: 120 }); aviso("¡Solicitud enviada!", "ok"); pintarPremiosEmpleado(ctx); }
    catch (e) { aviso(e.message, "error"); }
  }));
}
