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
    <div class="fila-entre" style="gap:10px"><h1 class="titulo-pagina">Premios</h1>
      <button class="btn btn-sec btn-chico" id="como-puntos">${icono("bulb", 16)}¿Cómo funcionan mis puntos?</button></div>
    <section class="saldo"><div><div style="font-size:12px;font-weight:700;letter-spacing:1px">PUNTOS DISPONIBLES</div><b>${num(disp)}</b>
      <small style="display:block;font-weight:700;opacity:.8;margin-top:4px">${num(r.puntos_ganados)} ganados en total${r.puntos_ganados > disp ? ` · ${num(r.puntos_ganados - disp)} ya canjeados o apartados` : ""}</small></div>${icono("gift", 40)}</section>
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
    <section class="tarjeta pila" style="gap:10px">
      <b>${icono("gift", 18, 'style="vertical-align:-3px;color:var(--oro)"')} ¿Cómo reclamo mi premio?</b>
      <ol class="pasos-canje">
        <li>Cuando te alcancen los puntos, toca <b>Canjear</b> en el premio.</li>
        <li>Tus puntos se apartan y Gustavo recibe tu solicitud (<b>En revisión</b>).</li>
        <li>Cuando la aprueba, te avisamos aquí en la app: <b>pasa con Gustavo</b> a recoger tu premio.</li>
        <li>Si no se puede, la rechaza y <b>tus puntos regresan</b> completos.</li>
      </ol>
      <small class="texto-tenue">Canjear no te baja de nivel ni del ranking: esos cuentan todos los puntos que has ganado.</small>
    </section>
  </main>`, "premios");

  const app = ctx.app;
  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ctx.ir(b.dataset.ir)));
  app.querySelector("#como-puntos").onclick = () => presentarPuntos(r);
  if (!vioPresentacionPuntos(r.usuario)) presentarPuntos(r);
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
    try {
      await datos.solicitarCanje(p.id); confeti({ cantidad: 120 });
      await modal(`
        <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
          <div class="medalla medalla-oro">${icono("gift", 40)}</div>
          <h2 class="modal-titulo">¡Solicitud enviada!</h2>
          <p class="modal-texto">Apartamos <b>${num(p.costo)} puntos</b> para <b>${esc(p.nombre)}</b>. Gustavo la va a revisar y te avisaremos aquí en la app cuando esté aprobada para que pases a recogerlo.</p>
          <small class="texto-tenue">Si no se puede, tus puntos regresan completos.</small>
          <button class="btn btn-bloque" data-cerrar>¡Entendido!</button>
        </div>`, { clase: "desbloqueo" });
      pintarPremiosEmpleado(ctx);
    }
    catch (e) { aviso(e.message, "error"); }
  }));
}

// ---------------------------------------------------------------------
//  "¿Cómo funcionan mis puntos?" (se ve una vez y cuando quieran)
// ---------------------------------------------------------------------
const llavePuntos = (u) => `academia-tour-puntos-${u}`;
export function vioPresentacionPuntos(u) { try { return !!localStorage.getItem(llavePuntos(u)); } catch (_) { return true; } }

export function presentarPuntos(r) {
  try { localStorage.setItem(llavePuntos(r.usuario), "1"); } catch (_) { /* nada */ }
  const ganados = r.puntos_ganados || 690, ejemplo = Math.min(300, ganados) || 300;
  const mock = (html) => `<div class="tour-mock" aria-hidden="true">${html}</div>`;
  const pasos = [
    { ic: "star", titulo: "Tus puntos tienen dos números",
      cuerpo: `${mock(`<div class="fila" style="gap:10px">
          <div class="pila" style="gap:2px;flex:1;padding:10px;border-radius:12px;background:var(--tarjeta)"><small class="texto-tenue">Ganados</small><b style="font-size:22px;color:var(--oro)">${num(r.puntos_ganados)}</b><small class="texto-tenue">nunca bajan</small></div>
          <div class="pila" style="gap:2px;flex:1;padding:10px;border-radius:12px;background:var(--tarjeta)"><small class="texto-tenue">Disponibles</small><b style="font-size:22px">${num(r.puntos_disponibles)}</b><small class="texto-tenue">para canjear</small></div></div>`)}
        <p class="modal-texto" style="line-height:1.55"><b>Ganados</b> son todos los puntos que has juntado: con ellos subes de <b>nivel</b> y compites en el <b>ranking</b>. <b>Disponibles</b> son los que puedes gastar en premios.</p>` },
    { ic: "gift", titulo: "Canjear no te quita tu nivel",
      cuerpo: `${mock(`<div class="pila" style="gap:6px;font-size:14px">
          <div class="fila-entre"><span>Ganados</span><b style="color:var(--oro)">${num(ganados)} → ${num(ganados)}</b></div>
          <div class="fila-entre"><span>Canjeas un premio de</span><b>−${num(ejemplo)}</b></div>
          <div class="fila-entre"><span>Disponibles</span><b>${num(ganados)} → ${num(ganados - ejemplo)}</b></div></div>`)}
        <p class="modal-texto" style="line-height:1.55">Al canjear solo bajan tus <b>disponibles</b>. Tu nivel, tu lugar en el ranking y tus insignias <b>se quedan igual</b>.</p>` },
    { ic: "check", titulo: "Cómo reclamar tu premio",
      cuerpo: `<ol class="pasos-canje" style="font-size:14.5px">
          <li>En <b>Premios</b>, toca <b>Canjear</b> en el que te alcance.</li>
          <li>Tus puntos se apartan y queda <span class="pildora" style="padding:1px 8px">En revisión</span>.</li>
          <li>Gustavo lo aprueba y te avisamos aquí: <span class="pildora pildora-ok" style="padding:1px 8px">Aprobado</span> → <b>pasa con él a recogerlo</b>.</li>
          <li>Si no se puede, lo rechaza y <b>tus puntos regresan completos</b>.</li></ol>` },
    { ic: "target", titulo: "Elige tu meta",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">Toca la <b>diana</b> 🎯 de un premio para hacerlo tu meta. En Inicio verás cuánto te falta, y te avisamos en cuanto te alcance.</p>
        <p class="texto-tenue" style="margin:0;font-size:13px">¿Cómo juntar más? Termina lecciones y cursos, saca quiz perfecto, escucha audiolibros, mantén tu racha y propón ideas para Mozzafiato.</p>` },
  ];
  return new Promise((resolver) => {
    let i = 0;
    modal(`<div id="tp"></div>`, { cerrable: false, clase: "modal-ancho" }).then(resolver);
    const capa = modal.actual;
    const pintar = () => {
      const p = pasos[i], ultimo = i === pasos.length - 1;
      capa.querySelector("#tp").innerHTML = `
        <div class="pila" style="gap:16px">
          <div class="fila-entre">
            <div class="fila" style="gap:6px">${pasos.map((_, k) => `<i style="display:block;height:6px;border-radius:3px;width:${k === i ? 22 : 6}px;background:${k <= i ? "var(--oro)" : "var(--linea)"};transition:width .3s"></i>`).join("")}</div>
            ${ultimo ? "" : `<button class="btn-texto" id="tp-saltar">Saltar</button>`}
          </div>
          <div class="medalla medalla-oro" style="width:64px;height:64px;align-self:center">${icono(p.ic, 30)}</div>
          <h2 class="modal-titulo" style="text-align:center">${p.titulo}</h2>
          ${p.cuerpo}
          <div class="fila-botones">
            ${i > 0 ? `<button class="btn btn-sec" id="tp-atras">${icono("back", 18)}Atrás</button>` : ""}
            <button class="btn" id="tp-sig">${ultimo ? "¡Entendido!" : `Siguiente ${icono("next", 18)}`}</button>
          </div>
        </div>`;
      capa.querySelector("#tp-sig").onclick = () => { if (ultimo) capa.cerrar(true); else { i++; pintar(); } };
      capa.querySelector("#tp-atras")?.addEventListener("click", () => { i--; pintar(); });
      capa.querySelector("#tp-saltar")?.addEventListener("click", () => capa.cerrar(true));
      capa.querySelector(".modal").scrollTop = 0;
    };
    pintar();
  });
}

// Aviso en Inicio cuando Gustavo aprueba o rechaza un canje.
export async function revisarCanjes(usuario, canjes = [], premios = []) {
  const llave = `academia-canjes-vistos-${usuario}`;
  let vistos = null;
  try { vistos = JSON.parse(localStorage.getItem(llave) || "null"); } catch (_) { /* nada */ }
  const ahora = Object.fromEntries(canjes.map((c) => [c.id, c.estado]));
  try { localStorage.setItem(llave, JSON.stringify(ahora)); } catch (_) { return; }
  if (!vistos) return;
  const nombre = (id) => premios.find((p) => p.id === id)?.nombre || "tu premio";
  for (const c of canjes.filter((x) => x.estado !== "pendiente" && vistos[x.id] && vistos[x.id] !== x.estado)) {
    if (c.estado === "aprobado") {
      confeti({ cantidad: 160, duracion: 2600 });
      await modal(`
        <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
          <div class="etiqueta" style="color:var(--oro)">¡Canje aprobado!</div>
          <div class="destellos"><div class="medalla medalla-oro">${icono("gift", 48)}</div></div>
          <h2 class="modal-titulo">${esc(nombre(c.premio_id))}</h2>
          <p class="modal-texto">Gustavo aprobó tu canje. <b>Pasa con él a recogerlo.</b> ¡Te lo ganaste!</p>
          <button class="btn btn-bloque" data-cerrar>¡Genial!</button>
        </div>`, { clase: "desbloqueo" });
    } else if (c.estado === "rechazado") {
      await modal(`
        <div class="pila" style="align-items:center;text-align:center;gap:12px">
          <div class="medalla medalla-cobre" style="width:64px;height:64px">${icono("gift", 30)}</div>
          <h2 class="modal-titulo">Tu canje no se pudo hacer</h2>
          <p class="modal-texto">${esc(nombre(c.premio_id))}${c.nota ? ` · ${esc(c.nota)}` : ""}. <b>Tus ${num(c.costo)} puntos ya regresaron</b> a tus disponibles.</p>
          <button class="btn btn-bloque" data-cerrar>Entendido</button>
        </div>`);
    }
  }
}
