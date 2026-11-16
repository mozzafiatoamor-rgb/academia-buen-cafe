// =====================================================================
//  TIENDA DEL AVATAR · piezas divertidas que se compran con pocos puntos.
//  Las compras descuentan de los puntos disponibles (como un canje), pero
//  no bajan el nivel ni el lugar en el ranking.
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, num, aviso, modal } from "./ui.js";
import { confeti } from "./fiesta.js";
import { CATEGORIAS, AVATAR_BASE, TIENDA, avatarSVG, avatarCuerpoSVG } from "./avatar.js";

const falta15 = (e) => /academia_tienda|academia_comprar_pieza|Could not find the function|PGRST202/i.test(e?.message || "");
const nombreCat = (id) => CATEGORIAS.find((c) => c.id === id)?.nombre || id;
const opcionDe = (pieza) => String(pieza).split(":")[1];

export async function pintarTienda(ctx) {
  ctx.cargando();
  const usuario = ctx.estado.perfil?.usuario;
  let datosT, cfg;
  try {
    [datosT, cfg] = await Promise.all([datos.tienda(), datos.miAvatar().catch(() => null)]);
  } catch (e) {
    ctx.sinNav(`<main class="vista vista-completa"><div class="barra-sup"><button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button></div>
      <div class="vacio"><strong>La tienda abre muy pronto</strong>${falta15(e) ? "Gustavo está terminando de prepararla." : esc(e.message)}</div></main>`);
    ctx.app.querySelector("#volver").onclick = () => ctx.ir("/inicio");
    return;
  }
  const sinAvatar = !cfg;
  cfg = { ...AVATAR_BASE, ...(cfg || {}) };
  // Une precios del servidor con el dibujo de la app (solo piezas que la app sabe dibujar).
  const piezas = datosT.piezas.filter((p) => TIENDA.some((t) => t.id === p.id));
  const mias = new Set(datosT.mias || []);
  let disponibles = datosT.disponibles || 0;
  let filtro = "todas";

  ctx.sinNav(`
  <main class="vista vista-completa vista-tienda">
    <div class="barra-sup">
      <button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button>
      <span style="flex:1"></span>
      <button class="btn btn-sec btn-chico" id="como">${icono("bulb", 16)}¿Cómo funciona?</button>
    </div>
    <section class="tienda-cabeza">
      <div class="tienda-avatar">${avatarSVG(cfg, 96, "", { animado: true })}</div>
      <div style="flex:1;min-width:0">
        <div class="etiqueta" style="color:var(--oro)">Nuevo</div>
        <h1 class="titulo-pagina" style="margin:0;font-size:28px">Tienda del avatar</h1>
        <span class="texto-tenue" style="font-size:13px">Piezas divertidas para presumir. Se compran una vez y son tuyas para siempre.</span>
      </div>
    </section>
    <div class="tienda-saldo"><span>Puntos para gastar</span><b id="t-disp">${num(disponibles)}</b></div>
    ${sinAvatar ? `<div class="tip-apuntes">${icono("user", 18)}<span>Todavía no creas tu avatar. <b>Créalo primero</b> para ver cómo te quedan las piezas.</span><button class="btn btn-chico" data-ir="/avatar">Crear</button></div>` : ""}
    <div class="chips chips-scroll" id="t-cats"></div>
    <div class="tienda-grid" id="t-grid"></div>
    <p class="texto-tenue" style="font-size:12.5px;text-align:center;margin:4px 0 0">Comprar aquí descuenta de tus puntos disponibles. Tu nivel y tu lugar en el ranking <b>no bajan</b>.</p>
  </main>`);
  const app = ctx.app;
  const cats = [...new Set(piezas.map((p) => p.categoria))];

  const pintar = () => {
    app.querySelector("#t-disp").textContent = num(disponibles);
    app.querySelector("#t-cats").innerHTML = ["todas", ...cats].map((c) => `<button class="chip ${filtro === c ? "activo" : ""}" data-cat="${c}">${c === "todas" ? "Todo" : esc(nombreCat(c))}</button>`).join("");
    const lista = piezas.filter((p) => filtro === "todas" || p.categoria === filtro)
      .sort((a, b) => Number(mias.has(a.id)) - Number(mias.has(b.id)) || a.costo - b.costo);
    app.querySelector("#t-grid").innerHTML = lista.map((p) => {
      const tuya = mias.has(p.id), puesta = cfg[p.categoria] === opcionDe(p.id), alcanza = disponibles >= p.costo;
      return `
      <article class="tienda-item ${tuya ? "tuya" : ""}">
        <button class="tienda-prev" data-ver="${esc(p.id)}" aria-label="Ver ${esc(p.nombre)}">${avatarSVG({ ...cfg, [p.categoria]: opcionDe(p.id) }, 110)}</button>
        <b>${esc(p.nombre)}</b>
        <small class="texto-tenue">${esc(nombreCat(p.categoria))}</small>
        ${tuya
          ? (puesta ? `<span class="pildora pildora-verde">${icono("check", 13)}La traes puesta</span>` : `<button class="btn btn-chico btn-sec" data-poner="${esc(p.id)}">${icono("check", 15)}Ponérmela</button>`)
          : `<button class="btn btn-chico ${alcanza ? "" : "btn-sec"}" data-comprar="${esc(p.id)}">🛍️ ${num(p.costo)} pts</button>`}
      </article>`;
    }).join("");
  };
  pintar();

  const ponerse = async (p) => {
    cfg = { ...cfg, [p.categoria]: opcionDe(p.id) };
    try {
      await datos.guardarAvatar(cfg);
      ctx.estado.miAvatar = cfg; ctx.estado.perfil = { ...ctx.estado.perfil, avatar: cfg };
      app.querySelector(".tienda-avatar").innerHTML = avatarSVG(cfg, 96, "", { animado: true });
      aviso("¡Te queda increíble! ✨", "ok");
    } catch (e) { aviso(e.message, "error"); }
    pintar();
  };

  const comprar = async (p) => {
    if (disponibles < p.costo) { aviso(`Te faltan ${num(p.costo - disponibles)} puntos. ¡Sigue aprendiendo y vuelve pronto!`); return; }
    const prueba = { ...cfg, [p.categoria]: opcionDe(p.id) };
    const v = await modal(`
      <div class="pila" style="align-items:center;text-align:center;gap:12px">
        <div class="tienda-modal-av">${avatarCuerpoSVG(prueba, 230, { animado: true })}</div>
        <h2 class="modal-titulo">${esc(p.nombre)}</h2>
        <p class="modal-texto">Cuesta <b style="color:var(--oro)">${num(p.costo)} puntos</b>. Te quedarían <b>${num(disponibles - p.costo)}</b> para gastar. Es tuya para siempre.</p>
        <button class="btn btn-bloque" data-cerrar="si">🛍️ Comprar</button>
        <button class="btn-texto" data-cerrar>Ahora no</button>
      </div>`);
    if (v !== "si") return;
    try {
      const r = await datos.comprarPieza(p.id);
      mias.add(p.id); disponibles = r?.disponibles ?? disponibles - p.costo;
      confeti({ cantidad: 140, duracion: 2200 });
      const w = await modal(`
        <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
          <div class="etiqueta" style="color:var(--oro)">¡Es tuya!</div>
          <div class="tienda-modal-av rebote">${avatarCuerpoSVG(prueba, 230, { animado: true }).replace('class="av-anim"', 'class="av-anim av-saluda"')}</div>
          <h2 class="modal-titulo">${esc(p.nombre)}</h2>
          <button class="btn btn-bloque" data-cerrar="poner">${icono("check", 18)}Ponérmela ahora</button>
          <button class="btn-texto" data-cerrar>Después</button>
        </div>`, { clase: "desbloqueo" });
      if (w === "poner") await ponerse(p); else pintar();
    } catch (e) {
      aviso(falta15(e) ? "La tienda todavía no está lista. Intenta más tarde." : e.message, "error");
    }
  };

  app.querySelector("#t-cats").onclick = (e) => { const b = e.target.closest("[data-cat]"); if (b) { filtro = b.dataset.cat; pintar(); } };
  app.querySelector("#t-grid").onclick = (e) => {
    const b = e.target.closest("[data-comprar],[data-poner],[data-ver]"); if (!b) return;
    const p = piezas.find((x) => x.id === (b.dataset.comprar || b.dataset.poner || b.dataset.ver));
    if (b.dataset.poner) ponerse(p);
    else if (mias.has(p.id)) ponerse(p);
    else comprar(p);
  };
  app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ctx.ir(b.dataset.ir)));
  app.querySelector("#volver").onclick = () => ctx.ir("/inicio");
  app.querySelector("#como").onclick = () => presentarTienda(usuario, { final: "¡Entendido!" });
  if (!vioPresentacionTienda(usuario)) presentarTienda(usuario, { final: "¡A comprar!" });
}

// ---------------------------------------------------------------------
//  Presentación (se ve una vez y cuando quieran)
// ---------------------------------------------------------------------
const llaveTour = (u) => `academia-tour-tienda-${u}`;
export function vioPresentacionTienda(u) { try { return !!localStorage.getItem(llaveTour(u)); } catch (_) { return true; } }

export function presentarTienda(usuario, { final = "Ir a la tienda", cfg = null } = {}) {
  try { localStorage.setItem(llaveTour(usuario), "1"); } catch (_) { /* nada */ }
  const base = { ...AVATAR_BASE, ...(cfg || {}) };
  const muestra = (cambios) => avatarSVG({ ...base, ...cambios }, 84);
  const mock = (html) => `<div class="tour-mock" aria-hidden="true">${html}</div>`;
  const precio = (n) => `<span class="pildora pildora-oro" style="padding:2px 9px">🛍️ ${n}</span>`;
  const pasos = [
    { ic: "gift", titulo: "¡Abrió la Tienda del avatar!",
      cuerpo: `${mock(`<div class="fila" style="justify-content:space-around;gap:6px">
          <div class="pila" style="align-items:center;gap:4px">${muestra({ cabeza: "fiesta" })}${precio(25)}</div>
          <div class="pila" style="align-items:center;gap:4px">${muestra({ cabeza: "vikingo", vello: "bigotazo" })}${precio(60)}</div>
          <div class="pila" style="align-items:center;gap:4px">${muestra({ lentes: "3d", fondo: "playa" })}${precio(30)}</div></div>`)}
        <p class="modal-texto" style="line-height:1.55">Gorros locos, lentes, bigotazos, globos, fondos y marcos para tu avatar. <b>Con pocos puntos</b>, para que juegues mientras aprendes.</p>` },
    { ic: "star", titulo: "Cuestan de 20 a 60 puntos",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">Se descuentan de tus <b>puntos disponibles</b>, igual que un premio. Tu <b>nivel</b> y tu lugar en el <b>ranking</b> no bajan: esos cuentan todo lo que has ganado.</p>
        <p class="texto-tenue" style="margin:0;font-size:13px">${icono("bulb", 14)} Si estás juntando para un premio grande, revisa cuántos puntos te quedan antes de comprar.</p>` },
    { ic: "check", titulo: "Compra una vez, úsala siempre",
      cuerpo: `${mock(`<div class="fila" style="gap:14px;align-items:center;justify-content:center">${muestra({ cabeza: "mago", marco: "neon" })}<div class="pila" style="gap:6px"><span class="pildora pildora-verde">${icono("check", 13)}Tuya</span><span class="texto-tenue" style="font-size:12.5px">Póntela o quítatela<br>cuando quieras</span></div></div>`)}
        <p class="modal-texto" style="line-height:1.55">Lo que compras queda en tu avatar para siempre. Combínalo en <b>Mi avatar</b> y presúmelo en el ranking y en tu perfil.</p>` },
    { ic: "flame", titulo: "¿Cómo junto más puntos?",
      cuerpo: `<p class="modal-texto" style="line-height:1.55">Termina lecciones y cursos, saca quiz perfecto, escucha audiolibros, cuida tu racha y propón ideas para Mozzafiato. <b>Mientras más aprendes, más piezas te llevas.</b></p>` },
  ];
  return new Promise((resolver) => {
    let i = 0;
    modal(`<div id="tt"></div>`, { cerrable: false, clase: "modal-ancho" }).then(resolver);
    const capa = modal.actual;
    const pintar = () => {
      const p = pasos[i], ultimo = i === pasos.length - 1;
      capa.querySelector("#tt").innerHTML = `
        <div class="pila" style="gap:16px">
          <div class="fila-entre">
            <div class="fila" style="gap:6px">${pasos.map((_, k) => `<i style="display:block;height:6px;border-radius:3px;width:${k === i ? 22 : 6}px;background:${k <= i ? "var(--oro)" : "var(--linea)"};transition:width .3s"></i>`).join("")}</div>
            ${ultimo ? "" : `<button class="btn-texto" id="tt-saltar">Saltar</button>`}
          </div>
          <div class="medalla medalla-oro" style="width:64px;height:64px;align-self:center">${icono(p.ic, 30)}</div>
          <h2 class="modal-titulo" style="text-align:center">${p.titulo}</h2>
          ${p.cuerpo}
          <div class="fila-botones">
            ${i > 0 ? `<button class="btn btn-sec" id="tt-atras">${icono("back", 18)}Atrás</button>` : ""}
            <button class="btn" id="tt-sig">${ultimo ? `🛍️ ${final}` : `Siguiente ${icono("next", 18)}`}</button>
          </div>
        </div>`;
      capa.querySelector("#tt-sig").onclick = () => { if (ultimo) capa.cerrar("tienda"); else { i++; pintar(); } };
      capa.querySelector("#tt-atras")?.addEventListener("click", () => { i--; pintar(); });
      capa.querySelector("#tt-saltar")?.addEventListener("click", () => capa.cerrar("saltar"));
      capa.querySelector(".modal").scrollTop = 0;
    };
    pintar();
  });
}
