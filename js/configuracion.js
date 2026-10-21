// =====================================================================
//  CONFIGURACIÓN (admin): puntos, niveles e insignias
// =====================================================================
import { datos } from "./datos.js";
import { icono, esc, num, duracion, aviso, formulario, confirmar, categorias, nombreCategoria, slug } from "./ui.js";
import { CFG_BASE, cfgPuntos, fijarCfgPuntos, valorCurso, valorAudio, puntosLeccion, nivelesSugeridos } from "./puntos.js";

const ICONOS = [["cup", "Taza"], ["coffee", "Café"], ["flame", "Flama"], ["star", "Estrella"], ["trophy", "Trofeo"], ["medal", "Medalla"],
  ["crown", "Corona"], ["target", "Diana"], ["clock", "Reloj"], ["bolt", "Rayo"], ["heart", "Corazón"], ["chef", "Chef"],
  ["tray", "Charola"], ["bed", "Hotel"], ["sunrise", "Amanecer"], ["moon", "Luna"], ["users", "Equipo"], ["book", "Libro"]];
const NIVELES_COLOR = [["", "Normal (cobre)"], ["bronce", "Bronce"], ["plata", "Plata"], ["oro", "Oro"]];
const TIPOS = [
  ["cursos", "Terminar N cursos", "n"], ["lecciones", "Terminar N lecciones", "n"], ["racha", "Racha de N días seguidos", "n"],
  ["maraton", "N lecciones en un mismo día", "n"], ["categoria", "Terminar todos los cursos de una categoría", "categoria"],
  ["asignados", "Terminar todos sus cursos asignados", null], ["quiz_perfecto", "Sacar 100 en un quiz", null],
  ["a_la_primera", "Aprobar un quiz al primer intento", null], ["a_tiempo", "Terminar un curso antes de la fecha límite", null],
  ["madrugador", "Terminar una lección antes de cierta hora", "hora"], ["noctambulo", "Terminar una lección después de cierta hora", "hora"],
  ["manual", "Manual: la otorgas tú (ej. Mejor servicio)", "repetible"],
];

export function describirRegla(r = {}) {
  const n = r.n || 1;
  switch (r.tipo) {
    case "cursos": return n === 1 ? "Al terminar su primer curso" : `Al terminar ${n} cursos`;
    case "lecciones": return n === 1 ? "Al terminar su primera lección" : `Al terminar ${n} lecciones`;
    case "racha": return `Racha de ${n} días seguidos`;
    case "maraton": return `${n} lecciones en un día`;
    case "categoria": return `Todos los cursos de ${nombreCategoria(r.categoria)}`;
    case "asignados": return "Todos sus cursos asignados";
    case "quiz_perfecto": return "100 en un quiz";
    case "a_la_primera": return "Quiz aprobado al primer intento";
    case "a_tiempo": return "Curso terminado antes de la fecha límite";
    case "madrugador": return `Lección terminada antes de las ${r.hora ?? 8}:00`;
    case "noctambulo": return `Lección terminada después de las ${r.hora ?? 22}:00`;
    case "manual": return r.repetible ? "La otorgas tú · repetible cada mes" : "La otorgas tú";
    default: return r.tipo || "";
  }
}

export async function pintarConfiguracion(main, pestana = "puntos") {
  main.innerHTML = `<div class="cargando"><div class="taza-carga"></div></div>`;
  const [cfgFilas, niveles, insignias, catalogo] = await Promise.all([
    datos.config(), datos.niveles(), datos.catalogoInsignias(), datos.adminValorCatalogo().catch(() => []),
  ]);
  fijarCfgPuntos(cfgFilas);
  main.innerHTML = `
    <div class="pila" style="gap:4px">
      <h1 class="titulo-pagina">Configuración</h1>
      <p class="texto-tenue" style="margin:0">Cómo se ganan los puntos, los niveles y las insignias. Los cambios aplican de aquí en adelante; los puntos ya ganados no se tocan.</p>
    </div>
    <div class="pestanas" role="tablist" style="max-width:560px">
      ${[["puntos", "Puntos"], ["niveles", "Niveles"], ["insignias", "Insignias"]].map(([v, t]) =>
        `<button role="tab" data-tab="${v}" aria-selected="${v === pestana}" class="${v === pestana ? "activo" : ""}">${t}</button>`).join("")}
    </div>
    <section class="panel" data-seccion="puntos" ${pestana === "puntos" ? "" : "hidden"}></section>
    <section class="panel" data-seccion="niveles" ${pestana === "niveles" ? "" : "hidden"}></section>
    <section class="panel" data-seccion="insignias" ${pestana === "insignias" ? "" : "hidden"}></section>`;
  main.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => {
    main.querySelectorAll("[data-tab]").forEach((x) => { x.classList.toggle("activo", x === b); x.setAttribute("aria-selected", x === b); });
    main.querySelectorAll("[data-seccion]").forEach((s) => (s.hidden = s.dataset.seccion !== b.dataset.tab));
    history.replaceState(null, "", `${location.pathname}${location.search}#/admin/configuracion/${b.dataset.tab}`);
  }));
  const recargar = (tab) => pintarConfiguracion(main, tab);
  seccionPuntos(main.querySelector('[data-seccion="puntos"]'), catalogo, () => recargar("puntos"));
  seccionNiveles(main.querySelector('[data-seccion="niveles"]'), niveles, catalogo, () => recargar("niveles"));
  seccionInsignias(main.querySelector('[data-seccion="insignias"]'), insignias, () => recargar("insignias"));
}

// ---------------------------------------------------------------------
//  PUNTOS
// ---------------------------------------------------------------------
function seccionPuntos(caja, catalogo, recargar) {
  const c = { ...cfgPuntos() };
  const campo = (k, etiqueta, ayuda = "", sufijo = "") => `
    <label class="campo" style="flex:1 1 150px">${etiqueta}
      <span class="fila" style="gap:6px"><input type="number" min="0" step="1" data-k="${k}" value="${c[k]}" style="flex:1;min-width:0">${sufijo ? `<span class="texto-tenue">${sufijo}</span>` : ""}</span>
      ${ayuda ? `<small class="texto-tenue" style="letter-spacing:0">${ayuda}</small>` : ""}
    </label>`;
  const pintar = () => {
    const porDur = Number(c.puntos_por_duracion) === 1;
    caja.innerHTML = `
      <h2>¿Cómo se ganan los puntos?</h2>
      <div class="chips">
        <button class="chip ${porDur ? "activo" : ""}" data-modo="1">Según la duración del video (recomendado)</button>
        <button class="chip ${porDur ? "" : "activo"}" data-modo="0">Puntos fijos</button>
      </div>
      <p class="texto-tenue" style="margin:0">${porDur ? "Lo justo: un curso largo vale más que uno corto, y nadie gana más por tener muchos videos cortitos." : "Cada lección, curso y quiz vale lo mismo sin importar cuánto dure."}</p>
      ${porDur ? `
        <div class="etiqueta">Cada lección</div>
        <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
          ${campo("puntos_por_minuto", "Puntos por minuto de video")}${campo("puntos_leccion_min", "Mínimo por lección")}${campo("puntos_leccion_max", "Máximo por lección")}
        </div>
        <div class="etiqueta">Bono al terminar el curso</div>
        <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
          ${campo("bono_curso_pct", "% de lo que suman sus lecciones", "", "%")}${campo("bono_curso_min", "Mínimo")}${campo("bono_curso_max", "Máximo")}
        </div>
        <div class="etiqueta">Quiz perfecto (100)</div>
        <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
          ${campo("puntos_quiz_por_pregunta", "Puntos por pregunta")}${campo("puntos_quiz_min", "Mínimo")}${campo("puntos_quiz_max", "Máximo")}
        </div>
        <div class="etiqueta">Bono por terminar antes de la fecha límite</div>
        <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
          ${campo("bono_a_tiempo_pct", "% del bono del curso", "", "%")}${campo("bono_a_tiempo_min", "Mínimo")}<span style="flex:1 1 150px"></span>
        </div>`
      : `
        <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
          ${campo("puntos_leccion", "Por lección")}${campo("puntos_curso", "Por terminar un curso")}${campo("puntos_quiz_perfecto", "Por quiz perfecto")}${campo("puntos_a_tiempo", "Por terminar a tiempo")}
        </div>`}
      <div class="etiqueta">Audiolibros</div>
      <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
        ${campo("audio_puntos_por_minuto", "Puntos por minuto escuchado")}${campo("audio_tramo_min", "Se pagan cada (minutos)")}
      </div>
      <div class="fila" style="flex-wrap:wrap;align-items:flex-start;gap:12px">
        ${campo("audio_bono_pct", "Bono al terminar (% de lo escuchado)", "", "%")}${campo("audio_bono_min", "Bono mínimo")}${campo("audio_bono_max", "Bono máximo")}
      </div>
      <div class="tarjeta pila" id="vista-previa" style="gap:8px"></div>
      <p class="error-form" id="pt-err" hidden></p>
      <div class="fila-botones" style="justify-content:flex-start">
        <button class="btn" id="pt-guardar">Guardar puntos</button>
        <button class="btn btn-sec" id="pt-base">Volver a los valores recomendados</button>
      </div>`;
    caja.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => { c.puntos_por_duracion = Number(b.dataset.modo); pintar(); }));
    caja.querySelectorAll("[data-k]").forEach((inp) => (inp.oninput = () => { c[inp.dataset.k] = Number(inp.value || 0); vista(); }));
    caja.querySelector("#pt-base").onclick = () => { Object.assign(c, CFG_BASE); pintar(); };
    caja.querySelector("#pt-guardar").onclick = guardar;
    vista();
  };
  const vista = () => {
    const ej = [3, 6, 15, 30].map((m) => `${m} min → <b style="color:var(--oro)">${puntosLeccion(m * 60, c)}</b>`).join(" · ");
    const ejA = [1, 3, 6].map((h) => `${h} h → <b style="color:var(--oro)">${num(valorAudio(h * 3600, false, c).total)}</b>`).join(" · ");
    const filas = catalogo.map((k) => ({ ...k, v: valorCurso(k, c), dur: k.lecciones.reduce((a, l) => a + (l.duracion_seg || 0), 0) })).sort((a, b) => b.v.total - a.v.total);
    caja.querySelector("#vista-previa").innerHTML = `
      <b style="font-size:14px">Así quedaría</b>
      ${Number(c.puntos_por_duracion) === 1 ? `<span class="texto-tenue" style="font-size:13px">Lección de ${ej}</span>` : ""}
      <span class="texto-tenue" style="font-size:13px">Audiolibro de ${ejA}</span>
      ${filas.length ? `<div class="tabla-caja"><table class="tabla" style="min-width:420px;font-size:13px"><thead><tr><th>Curso publicado</th><th>Duración</th><th>Vale hasta</th></tr></thead><tbody>
        ${filas.map((f) => `<tr><td>${esc(f.titulo)}</td><td>${duracion(f.dur)}</td><td><b style="color:var(--oro)">${num(f.v.total)} pts</b></td></tr>`).join("")}
      </tbody></table></div>` : `<span class="texto-tenue" style="font-size:13px">Cuando publiques cursos, aquí verás cuánto vale cada uno.</span>`}`;
  };
  const guardar = async () => {
    const err = caja.querySelector("#pt-err");
    const mal = (c.puntos_leccion_min > c.puntos_leccion_max && "El mínimo por lección no puede ser mayor que el máximo")
      || (c.bono_curso_min > c.bono_curso_max && "El mínimo del bono no puede ser mayor que el máximo")
      || (c.puntos_quiz_min > c.puntos_quiz_max && "El mínimo del quiz no puede ser mayor que el máximo")
      || (c.audio_bono_min > c.audio_bono_max && "El bono mínimo del audiolibro no puede ser mayor que el máximo")
      || (Number(c.audio_tramo_min) < 1 && "Los puntos del audio se pagan cada 1 minuto como mínimo");
    if (mal) { err.textContent = mal; err.hidden = false; return; }
    const obj = {};
    for (const k of Object.keys(CFG_BASE)) obj[k] = Math.max(0, Math.round(Number(c[k]) || 0));
    try { await datos.guardarConfig(obj); fijarCfgPuntos(obj); aviso("Puntos guardados", "ok"); recargar(); }
    catch (e) { err.textContent = e.message; err.hidden = false; }
  };
  pintar();
}

// ---------------------------------------------------------------------
//  NIVELES
// ---------------------------------------------------------------------
function seccionNiveles(caja, nivelesIniciales, catalogo, recargar) {
  let lista = nivelesIniciales.map((n) => ({ nombre: n.nombre, puntos_min: n.puntos_min }));
  const totalCatalogo = catalogo.reduce((a, k) => a + valorCurso({ ...k }).total, 0);
  const pintar = () => {
    caja.innerHTML = `
      <div class="fila-entre" style="flex-wrap:wrap"><h2>Niveles</h2>
        <button class="btn btn-sec btn-chico" id="nv-auto">${icono("refresh", 16)}Calcular según mi catálogo</button></div>
      <p class="texto-tenue" style="margin:0">Tus cursos publicados dan hasta <b style="color:var(--oro)">${num(totalCatalogo)} pts</b> en total (sin contar insignias). El cálculo automático reparte los niveles para que el primero llegue rápido y Maestro sea un verdadero logro.</p>
      <div class="pila" style="gap:8px">
        ${lista.map((n, i) => `
          <div class="fila tarjeta" style="padding:8px 10px;gap:8px">
            <span class="medalla chica medalla-cobre" style="width:34px;height:34px;flex:none;font-weight:700">${i + 1}</span>
            <input data-nombre="${i}" value="${esc(n.nombre)}" aria-label="Nombre del nivel ${i + 1}" style="flex:2;min-width:0;min-height:40px;border-radius:10px;border:1px solid var(--linea);background:var(--tarjeta-2);color:var(--crema);padding:0 10px">
            <input data-pts="${i}" type="number" min="0" value="${n.puntos_min}" ${i === 0 ? "disabled" : ""} aria-label="Puntos para el nivel ${i + 1}" style="flex:1;min-width:70px;min-height:40px;border-radius:10px;border:1px solid var(--linea);background:var(--tarjeta-2);color:var(--crema);padding:0 10px">
            <span class="texto-tenue" style="font-size:12px">pts</span>
            ${i > 0 && lista.length > 2 ? `<button class="mini-btn" data-quitar="${i}" aria-label="Quitar nivel">${icono("trash", 16)}</button>` : `<span style="width:36px"></span>`}
          </div>`).join("")}
      </div>
      ${lista.length < 8 ? `<button class="btn-texto" id="nv-mas" style="align-self:flex-start">+ Agregar nivel</button>` : ""}
      <p class="error-form" id="nv-err" hidden></p>
      <div class="fila-botones" style="justify-content:flex-start"><button class="btn" id="nv-guardar">Guardar niveles</button></div>`;
    caja.querySelectorAll("[data-nombre]").forEach((i) => (i.oninput = () => (lista[i.dataset.nombre].nombre = i.value)));
    caja.querySelectorAll("[data-pts]").forEach((i) => (i.oninput = () => (lista[i.dataset.pts].puntos_min = Number(i.value || 0))));
    caja.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => { lista.splice(Number(b.dataset.quitar), 1); pintar(); }));
    caja.querySelector("#nv-mas")?.addEventListener("click", () => { lista.push({ nombre: "Nuevo nivel", puntos_min: (lista.at(-1)?.puntos_min || 0) + 500 }); pintar(); });
    caja.querySelector("#nv-auto").onclick = () => {
      if (!totalCatalogo) return aviso("Primero publica cursos con videos", "error");
      lista = nivelesSugeridos(totalCatalogo, lista.map((n) => n.nombre)).map((n) => ({ nombre: n.nombre, puntos_min: n.puntos_min }));
      pintar(); aviso("Calculado. Revisa y dale Guardar.", "ok");
    };
    caja.querySelector("#nv-guardar").onclick = async () => {
      const err = caja.querySelector("#nv-err");
      lista[0].puntos_min = 0;
      const mal = lista.some((n) => !String(n.nombre).trim()) ? "Ponle nombre a todos los niveles"
        : lista.some((n, i) => i > 0 && n.puntos_min <= lista[i - 1].puntos_min) ? "Cada nivel debe pedir más puntos que el anterior" : null;
      if (mal) { err.textContent = mal; err.hidden = false; return; }
      try { await datos.guardarNiveles(lista.map((n) => ({ nombre: n.nombre.trim(), puntos_min: n.puntos_min }))); aviso("Niveles guardados", "ok"); recargar(); }
      catch (e) { err.textContent = e.message; err.hidden = false; }
    };
  };
  pintar();
}

// ---------------------------------------------------------------------
//  INSIGNIAS
// ---------------------------------------------------------------------
function claseMedalla(i) {
  if (i.nivel === "oro") return "medalla-oro";
  if (i.nivel === "plata") return "medalla-plata";
  if (i.nivel === "bronce") return "medalla-bronce";
  return "medalla-cobre";
}

function seccionInsignias(caja, insignias, recargar) {
  const ordenadas = [...insignias].sort((a, b) => (b.activa - a.activa) || (a.orden || 0) - (b.orden || 0));
  caja.innerHTML = `
    <div class="fila-entre" style="flex-wrap:wrap"><h2>Insignias</h2>
      <button class="btn btn-chico" id="in-nueva">${icono("plus", 16)}Nueva insignia</button></div>
    <p class="texto-tenue" style="margin:0">Las automáticas se ganan solas al cumplir su meta. Las manuales las otorgas tú desde <b>Insignias → Otorgar reconocimiento</b>.</p>
    <div class="pila" style="gap:8px">
      ${ordenadas.map((i) => `
        <div class="leccion-admin" style="${i.activa ? "" : "opacity:.5"}">
          <span class="medalla chica ${claseMedalla(i)}" style="width:40px;height:40px;flex:none">${icono(i.icono || "star", 20)}</span>
          <div class="nombre"><b style="font-weight:600">${esc(i.nombre)}${i.secreta ? ' <span class="pildora" style="padding:2px 8px;font-size:10.5px">Secreta</span>' : ""}</b>
            <small>${esc(describirRegla(i.regla))} · +${num(i.puntos)} pts${i.activa ? "" : " · desactivada"}</small></div>
          <button class="chip ${i.activa ? "activo" : ""}" data-activa="${esc(i.id)}" style="min-height:32px;font-size:11.5px">${i.activa ? "Activa" : "Inactiva"}</button>
          <button class="mini-btn" aria-label="Editar ${esc(i.nombre)}" data-editar="${esc(i.id)}">${icono("edit", 16)}</button>
        </div>`).join("")}
    </div>`;
  const porId = (id) => insignias.find((i) => i.id === id);
  caja.querySelectorAll("[data-activa]").forEach((b) => (b.onclick = async () => {
    const i = porId(b.dataset.activa);
    try { await datos.guardarInsignia({ ...i, activa: !i.activa }); recargar(); } catch (e) { aviso(e.message, "error"); }
  }));
  caja.querySelectorAll("[data-editar]").forEach((b) => (b.onclick = async () => { if (await editarInsignia(porId(b.dataset.editar))) recargar(); }));
  caja.querySelector("#in-nueva").onclick = async () => {
    const t = await formulario("Nueva insignia · ¿cómo se gana?", [
      { nombre: "tipo", etiqueta: "Se gana al…", tipo: "select", opciones: TIPOS.map(([v, txt]) => [v, txt]) },
    ], "Siguiente");
    if (!t) return;
    let id = slug(`ins_${t.tipo}_${Date.now().toString(36)}`);
    const nueva = { id, nombre: "", descripcion: "", categoria: t.tipo === "manual" ? "especial" : "personalizada", icono: t.tipo === "manual" ? "crown" : "star",
      nivel: null, secreta: false, puntos: 50, regla: { tipo: t.tipo, ...(TIPOS.find((x) => x[0] === t.tipo)[2] === "n" ? { n: 3 } : {}), ...(t.tipo === "categoria" ? { categoria: categorias()[0]?.id } : {}), ...(t.tipo === "madrugador" ? { hora: 8 } : {}), ...(t.tipo === "noctambulo" ? { hora: 22 } : {}) },
      activa: true, orden: 150 };
    if (await editarInsignia(nueva, true)) recargar();
  };
}

async function editarInsignia(i, nueva = false) {
  const param = TIPOS.find((x) => x[0] === i.regla?.tipo)?.[2];
  const campos = [
    { nombre: "nombre", etiqueta: "Nombre", valor: i.nombre, requerido: true, placeholder: "Mejor servicio del mes", autofocus: true },
    { nombre: "descripcion", etiqueta: "Descripción (la ven los empleados)", valor: i.descripcion, placeholder: "Por atender con excelencia" },
    { nombre: "puntos", etiqueta: "Puntos que da", tipo: "numero", valor: i.puntos },
  ];
  if (param === "n") campos.push({ nombre: "n", etiqueta: i.regla.tipo === "racha" ? "Días seguidos" : i.regla.tipo === "maraton" ? "Lecciones en un día" : "Cantidad", tipo: "numero", valor: i.regla.n || 1 });
  if (param === "categoria") campos.push({ nombre: "categoria", etiqueta: "Categoría", tipo: "select", opciones: categorias().map((c) => [c.id, c.nombre]), valor: i.regla.categoria });
  if (param === "hora") campos.push({ nombre: "hora", etiqueta: i.regla.tipo === "madrugador" ? "Antes de las (hora, 0-23)" : "Después de las (hora, 0-23)", tipo: "numero", valor: i.regla.hora });
  if (param === "repetible") campos.push({ nombre: "repetible", etiqueta: "Se puede dar varias veces (una por mes)", tipo: "check", valor: !!i.regla.repetible });
  campos.push(
    { nombre: "icono", etiqueta: "Ícono", tipo: "select", opciones: ICONOS, valor: i.icono || "star" },
    { nombre: "nivel", etiqueta: "Color de la medalla", tipo: "select", opciones: NIVELES_COLOR, valor: i.nivel || "" },
    { nombre: "secreta", etiqueta: "Secreta (no se ve qué es hasta ganarla)", tipo: "check", valor: !!i.secreta },
  );
  const v = await formulario(nueva ? "Nueva insignia" : `Editar "${i.nombre}"`, campos, nueva ? "Crear" : "Guardar");
  if (!v) return false;
  const regla = { ...i.regla };
  if (param === "n") regla.n = Math.max(1, Math.round(v.n || 1));
  if (param === "categoria") regla.categoria = v.categoria;
  if (param === "hora") regla.hora = Math.min(23, Math.max(0, Math.round(v.hora ?? 8)));
  if (param === "repetible") regla.repetible = !!v.repetible;
  const ins = { ...i, nombre: v.nombre, descripcion: v.descripcion || describirRegla(regla), puntos: Math.max(0, Math.round(v.puntos || 0)),
    icono: v.icono, nivel: v.nivel || null, secreta: !!v.secreta, regla };
  if (nueva) ins.id = slug(v.nombre).slice(0, 40) + "_" + Date.now().toString(36).slice(-4);
  try { await datos.guardarInsignia(ins); aviso(nueva ? "Insignia creada" : "Insignia guardada", "ok"); return true; }
  catch (e) { aviso(e.message, "error"); return false; }
}
