// =====================================================================
//  EDITOR DE AVATAR (empleado) · armar el personaje, con piezas que se
//  desbloquean aprendiendo.
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, aviso, modal } from "./ui.js";
import { confeti } from "./fiesta.js";
import { CATEGORIAS, AVATAR_BASE, avatarSVG, avatarCuerpoSVG, avatarAlAzar, desbloqueada, textoReq } from "./avatar.js";

export async function logrosDe(perfil) {
  const [ins, niveles] = await Promise.all([
    datos.insignias().catch(() => ({ mias: [] })),
    datos.niveles().catch(() => []),
  ]);
  return {
    nivel: perfil?.nivel_orden || 1,
    racha: Math.max(perfil?.racha_maxima || 0, perfil?.racha_actual || 0),
    insignias: new Set((ins.mias || []).map((m) => m.insignia_id)),
    niveles: niveles.map((n) => n.nombre),
  };
}

export async function pintarEditorAvatar(ctx) {
  ctx.cargando();
  const [guardado, logros] = await Promise.all([datos.miAvatar(), logrosDe(ctx.estado.perfil)]);
  const primeraVez = !guardado;
  let cfg = { ...AVATAR_BASE, ...(guardado || {}) };
  let cat = CATEGORIAS[0].id;
  let vista = "retrato";
  const dibujo = (c, anim = true) => (vista === "cuerpo" ? avatarCuerpoSVG(c, 250, { animado: anim }) : avatarSVG(c, 200, "", { animado: anim }));
  const total = CATEGORIAS.reduce((a, c) => a + c.opciones.length, 0);
  const libres = CATEGORIAS.reduce((a, c) => a + c.opciones.filter((o) => desbloqueada(o, logros)).length, 0);

  ctx.sinNav(`
  <main class="vista vista-completa vista-avatar">
    <div class="barra-sup">
      <button class="btn-icono" id="volver" aria-label="Volver">${icono("back")}</button>
      <span class="texto-tenue" style="flex:1">Mi avatar</span>
      <button class="btn btn-sec btn-chico" id="azar">🎲 Sorpréndeme</button>
    </div>
    <div class="pestanas av-vistas" id="av-vistas" style="max-width:320px;align-self:center;width:100%">
      <button class="activo" data-vista="retrato">Retrato</button><button data-vista="cuerpo">Cuerpo completo</button>
    </div>
    <div class="avatar-escenario"><button id="av-grande" class="avatar-grande" aria-label="Tócame">${avatarSVG(cfg, 200, "", { animado: true })}</button></div>
    <p class="texto-tenue" style="text-align:center;margin:-6px 0 0;font-size:11.5px">Tócalo 👆</p>
    <p class="texto-tenue" style="text-align:center;margin:0;font-size:13px">Tienes <b style="color:var(--oro)">${libres} de ${total}</b> piezas. ${libres < total ? "Las de candado se ganan subiendo de nivel, con rachas e insignias." : "¡Las tienes todas!"}</p>
    <div class="chips chips-scroll" id="av-cats">${CATEGORIAS.map((c) => `<button class="chip ${c.id === cat ? "activo" : ""}" data-cat="${c.id}">${esc(c.nombre)}</button>`).join("")}</div>
    <div id="av-colores" class="av-colores"></div>
    <div id="av-ops" class="av-ops"></div>
    <div class="barra-guardar"><button class="btn btn-bloque" id="guardar">${icono("check", 18)}${primeraVez ? "¡Listo, este soy yo!" : "Guardar cambios"}</button></div>
  </main>`);

  const app = ctx.app;
  const grande = app.querySelector("#av-grande");
  const pintarGrande = () => {
    grande.innerHTML = dibujo(cfg);
    grande.classList.toggle("cuerpo", vista === "cuerpo");
    grande.classList.remove("rebote"); void grande.offsetWidth; grande.classList.add("rebote");
  };
  const pintarOpciones = () => {
    const c = CATEGORIAS.find((x) => x.id === cat);
    const cajaCol = app.querySelector("#av-colores");
    cajaCol.innerHTML = c.color ? c.colores.map((col, i) => `<button class="muestra ${cfg[c.color] === i ? "activa" : ""}" data-col="${i}" style="background:${col}" aria-label="Color ${i + 1}"></button>`).join("") : "";
    cajaCol.hidden = !c.color;
    app.querySelector("#av-ops").innerHTML = c.opciones.map((o) => {
      const ok = desbloqueada(o, logros), sel = cfg[c.id] === o.id;
      return `<button class="av-op ${sel ? "activa" : ""} ${ok ? "" : "bloq"} ${c.cuerpo ? "cuerpo" : ""}" data-op="${o.id}" title="${esc(ok ? o.nombre : textoReq(o, logros.niveles))}">
        ${c.cuerpo ? avatarCuerpoSVG({ ...cfg, [c.id]: o.id }, 110) : avatarSVG({ ...cfg, [c.id]: o.id }, 76)}
        <span>${esc(o.nombre)}</span>
        ${ok ? "" : `<i class="candado">${icono("lock", 14)}</i>`}
      </button>`;
    }).join("");
  };
  pintarOpciones();

  app.querySelector("#av-cats").onclick = (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    cat = b.dataset.cat;
    app.querySelectorAll("#av-cats .chip").forEach((x) => x.classList.toggle("activo", x === b));
    if (CATEGORIAS.find((x) => x.id === cat)?.cuerpo && vista !== "cuerpo") ponerVista("cuerpo");
    b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    pintarOpciones();
  };
  app.querySelector("#av-colores").onclick = (e) => {
    const b = e.target.closest("[data-col]"); if (!b) return;
    const c = CATEGORIAS.find((x) => x.id === cat);
    cfg[c.color] = Number(b.dataset.col);
    pintarGrande(); pintarOpciones();
  };
  app.querySelector("#av-ops").onclick = (e) => {
    const b = e.target.closest("[data-op]"); if (!b) return;
    const c = CATEGORIAS.find((x) => x.id === cat), o = c.opciones.find((x) => x.id === b.dataset.op);
    if (!desbloqueada(o, logros)) {
      b.classList.remove("sacude"); void b.offsetWidth; b.classList.add("sacude");
      return aviso(`🔒 ${o.nombre}: ${textoReq(o, logros.niveles)}`);
    }
    cfg[c.id] = o.id;
    pintarGrande(); pintarOpciones();
  };
  const ponerVista = (v) => {
    vista = v;
    app.querySelectorAll("#av-vistas button").forEach((x) => x.classList.toggle("activo", x.dataset.vista === v));
    pintarGrande();
  };
  app.querySelector("#av-vistas").onclick = (e) => { const b = e.target.closest("[data-vista]"); if (b) ponerVista(b.dataset.vista); };
  grande.onclick = () => {
    const svg = grande.querySelector("svg"); if (!svg) return;
    const clase = vista === "cuerpo" ? "av-saluda" : "av-salta";
    svg.classList.remove(clase); void svg.getBoundingClientRect(); svg.classList.add(clase);
    setTimeout(() => svg.classList.remove(clase), 1900);
  };
  app.querySelector("#azar").onclick = () => { cfg = avatarAlAzar(logros, { piel: cfg.piel }); pintarGrande(); pintarOpciones(); };
  app.querySelector("#volver").onclick = () => ctx.ir("/inicio");
  app.querySelector("#guardar").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await datos.guardarAvatar(cfg);
      ctx.estado.perfil = { ...ctx.estado.perfil, avatar: cfg };
      ctx.estado.miAvatar = cfg;
      if (primeraVez) {
        confeti({ cantidad: 160, duracion: 2800 });
        await modal(`
          <div class="pila desbloqueo" style="align-items:center;text-align:center;gap:12px">
            <div class="etiqueta" style="color:var(--oro)">¡Así te verá el equipo!</div>
            <div class="avatar-cuerpo-modal rebote">${avatarCuerpoSVG(cfg, 230, { animado: true }).replace('class="av-anim"', 'class="av-anim av-saluda"')}</div>
            <p class="modal-texto">Aparecerás así en el ranking y en tu perfil. Cada nivel, racha e insignia te da piezas nuevas para presumir.</p>
            <button class="btn btn-bloque" data-cerrar>¡Vamos!</button>
          </div>`, { clase: "desbloqueo" });
      } else aviso("Avatar guardado", "ok");
      ctx.ir("/inicio");
    } catch (err) {
      e.currentTarget.disabled = false;
      aviso(/academia_guardar_avatar|function/i.test(err.message) ? "Falta correr el paso 8 de SQL (avatares) en Supabase" : err.message, "error");
    }
  };
}

// Invitación única a crear el avatar (después de la bienvenida).
export async function invitarAvatar(ctx, r) {
  const llave = `academia-avatar-invitado-${r.usuario}`;
  try { if (localStorage.getItem(llave)) return; } catch (_) { return; }
  if (ctx.estado.miAvatar) return;
  try { localStorage.setItem(llave, "1"); } catch (_) { /* nada */ }
  const ejemplos = Array.from({ length: 3 }, () => avatarSVG(avatarAlAzar({ nivel: 1, racha: 0, insignias: new Set() }), 84));
  const v = await modal(`
    <div class="anuncio-nuevo">
      <div class="fila" style="justify-content:center;gap:10px" aria-hidden="true">${ejemplos.map((s, i) => `<span class="avatar-muestra" style="animation-delay:${i * 0.15}s">${s}</span>`).join("")}</div>
      <h2 class="modal-titulo" style="text-align:center">¡Crea tu avatar!</h2>
      <p class="texto-tenue" style="text-align:center;margin:0">Arma tu personaje: peinado, lentes, gorros, ropa, fondos… Así te verá el equipo en el ranking. Y mientras más aprendas, más piezas desbloqueas: coronas, marcos de fuego, ojos de estrella…</p>
      <button class="btn btn-bloque" data-cerrar="crear">${icono("user", 18)}Crear mi avatar</button>
      <button class="btn-texto" data-cerrar style="align-self:center">Después</button>
    </div>`);
  if (v === "crear") ctx.ir("/avatar");
}
