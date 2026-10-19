// =====================================================================
//  Utilidades de interfaz: íconos, formato, avisos, modales.
// =====================================================================

const P = {
  cup: '<path d="M3 10h14v5a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-5z"/><path d="M16.75 16.7a3 3 0 1 0 .25-5.55"/><path d="M8 3a2.4 2.4 0 0 0-1 2 2.4 2.4 0 0 0 1 2"/><path d="M12 3a2.4 2.4 0 0 0-1 2 2.4 2.4 0 0 0 1 2"/>',
  coffee: '<path d="M3 14c.83.64 2.08 1.02 3.5 1 1.42.02 2.67-.36 3.5-1 .83-.64 2.08-1.02 3.5-1 1.42-.02 2.67.36 3.5 1"/><path d="M8 3a2.4 2.4 0 0 0-1 2 2.4 2.4 0 0 0 1 2"/><path d="M12 3a2.4 2.4 0 0 0-1 2 2.4 2.4 0 0 0 1 2"/><path d="M3 10h14v5a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-5z"/><path d="M16.75 16.7a3 3 0 1 0 .25-5.55"/>',
  flame: '<path d="M12 12c2-2.96 0-7-1-8 0 3.04-1.77 4.74-3 6-1.23 1.27-2 3.26-2 5a6 6 0 1 0 12 0c0-1.51-1.06-3.89-2-5-1.79 3-2.8 3-4 2z"/>',
  star: '<path d="M12 17.75l-6.17 3.25 1.18-6.88-5-4.87 6.9-1L12 2l3.09 6.25 6.9 1-5 4.87 1.18 6.88z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M5 9a2 2 0 0 1 0-4h2"/><path d="M19 9a2 2 0 0 0 0-4h-2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  tray: '<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 7v3"/><path d="M10 7h4"/>',
  chef: '<path d="M12 3c1.92 0 3.6 1.08 4.44 2.66A4 4 0 1 1 18 14v6H6v-6a4 4 0 1 1 1.56-8.34A5 5 0 0 1 12 3z"/><path d="M6 17h12"/>',
  bed: '<path d="M3 7v11"/><path d="M3 14h18"/><path d="M21 18v-6a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  bolt: '<path d="M13 3v7h6l-8 11v-7H5z"/>',
  sunrise: '<path d="M3 17h1m16 0h1M5.6 10.6l.7.7m12.1-.7-.7.7M8 17a4 4 0 0 1 8 0"/><path d="M3 21h18"/><path d="M12 9V3l3 3M12 3 9 6"/>',
  moon: '<path d="M12 3h.39a7.5 7.5 0 0 0 7.92 12.45A9 9 0 1 1 12 3z"/>',
  crown: '<path d="M12 6l4 6 5-4-2 10H5L3 8l5 4z"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="M12 15l3.4 5.9 1.6-3.2 3.6.2-3.4-5.9"/><path d="M6.8 12l-3.4 5.9 3.6-.2 1.6 3.2 3.4-5.9"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  home: '<path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  play: '<path d="M8 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
  q: '<path d="M8 8a3.5 3 0 0 1 3.5-3h1A3.5 3 0 0 1 16 8a3 3 0 0 1-2 3 3 4 0 0 0-2 4"/><path d="M12 19v.01"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  logout: '<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3m0 6 3-3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  book: '<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0"/><path d="M3 6v13M12 6v13M21 6v13"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  wifi_off: '<path d="M12 18h.01M9.17 15.17a4 4 0 0 1 5.66 0M6.34 12.34a8 8 0 0 1 4.1-2.2M17.66 12.34a8 8 0 0 0-1.56-1.2M3.51 9.51a12 12 0 0 1 3.2-2.2M20.49 9.51A12 12 0 0 0 12 6c-.68 0-1.34.06-2 .17M3 3l18 18"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/>',
  heart: '<path d="M19.5 12.57L12 20l-7.5-7.43A5 5 0 1 1 12 6.01a5 5 0 1 1 7.5 6.57"/>',
  eye: '<circle cx="12" cy="12" r="2"/><path d="M22 12c-2.67 4.67-6 7-10 7s-7.33-2.33-10-7c2.67-4.67 6-7 10-7s7.33 2.33 10 7"/>',
};

export function icono(nombre, tam = 22, extra = "") {
  const d = P[nombre] || P.star;
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
}

const MAPA = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => MAPA[c]);

export const num = (n) => Number(n || 0).toLocaleString("es-MX");

export function duracion(seg) {
  seg = Math.round(Number(seg) || 0);
  if (seg < 60) return `${seg} s`;
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
  return h ? `${h} h ${m ? m + " min" : ""}`.trim() : `${m} min`;
}

export function reloj(seg) {
  seg = Math.max(0, Math.floor(seg || 0));
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaCorta(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function haceCuanto(iso) {
  if (!iso) return "sin actividad";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export function iniciales(nombre) {
  return String(nombre || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

export function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

// ---------- Avisos (toast) ----------
export function aviso(texto, tipo = "info") {
  let zona = document.getElementById("avisos");
  if (!zona) {
    zona = document.createElement("div");
    zona.id = "avisos";
    zona.setAttribute("role", "status");
    zona.setAttribute("aria-live", "polite");
    document.body.appendChild(zona);
  }
  const el = document.createElement("div");
  el.className = `aviso aviso-${tipo}`;
  el.textContent = texto;
  zona.appendChild(el);
  setTimeout(() => el.classList.add("sale"), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---------- Modal ----------
export function modal(html, { cerrable = true, clase = "" } = {}) {
  return new Promise((resolver) => {
    const capa = document.createElement("div");
    capa.className = "modal-capa";
    capa.innerHTML = `<div class="modal ${clase}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(capa);
    requestAnimationFrame(() => capa.classList.add("visible"));
    const cerrar = (valor) => {
      capa.classList.remove("visible");
      setTimeout(() => capa.remove(), 200);
      document.removeEventListener("keydown", tecla);
      resolver(valor);
    };
    const tecla = (e) => { if (e.key === "Escape" && cerrable) cerrar(null); };
    document.addEventListener("keydown", tecla);
    capa.addEventListener("click", (e) => {
      if (e.target === capa && cerrable) cerrar(null);
      const b = e.target.closest("[data-cerrar]");
      if (b) cerrar(b.dataset.cerrar || true);
    });
    capa.cerrar = cerrar;
    const foco = capa.querySelector("[autofocus], input, button");
    if (foco) setTimeout(() => foco.focus(), 50);
    modal.actual = capa;
  });
}

export function confirmar(titulo, texto, botonSi = "Sí") {
  return modal(`
    <h2 class="modal-titulo">${esc(titulo)}</h2>
    <p class="modal-texto">${esc(texto)}</p>
    <div class="fila-botones">
      <button class="btn btn-sec" data-cerrar="no">Cancelar</button>
      <button class="btn" data-cerrar="si">${esc(botonSi)}</button>
    </div>`).then((r) => r === "si");
}

// Formulario rápido dentro de un modal. campos: [{nombre, etiqueta, tipo, valor, opciones}]
export function formulario(titulo, campos, botonOk = "Guardar") {
  return new Promise((resolver) => {
    const html = `
      <h2 class="modal-titulo">${esc(titulo)}</h2>
      <form class="form" novalidate>
        ${campos.map(campoHTML).join("")}
        <p class="error-form" hidden></p>
        <div class="fila-botones">
          <button type="button" class="btn btn-sec" data-cerrar="">Cancelar</button>
          <button type="submit" class="btn">${esc(botonOk)}</button>
        </div>
      </form>`;
    modal(html).then((r) => { if (r !== "ok") resolver(null); });
    const capa = modal.actual;
    const form = capa.querySelector("form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const datos = {};
      let falta = null;
      for (const c of campos) {
        const el = form.elements[c.nombre];
        if (!el) continue;
        let v = c.tipo === "check" ? el.checked : el.value.trim();
        if (c.tipo === "numero") v = v === "" ? null : Number(v);
        if (c.requerido && (v === "" || v === null)) falta = falta || c.etiqueta;
        datos[c.nombre] = v === "" ? null : v;
      }
      const err = form.querySelector(".error-form");
      if (falta) { err.textContent = `Completa: ${falta}`; err.hidden = false; return; }
      resolver(datos);
      capa.cerrar("ok");
    });
    form.addEventListener("input", () => { form.querySelector(".error-form").hidden = true; });
  });
}

function campoHTML(c) {
  const id = `f_${c.nombre}`;
  const v = c.valor ?? "";
  if (c.tipo === "check") {
    return `<label class="check"><input type="checkbox" name="${c.nombre}" ${v ? "checked" : ""}><span>${esc(c.etiqueta)}</span></label>`;
  }
  if (c.tipo === "select") {
    return `<label class="campo" for="${id}"><span>${esc(c.etiqueta)}</span>
      <select id="${id}" name="${c.nombre}">${c.opciones.map((o) => {
        const [val, txt] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(txt)}</option>`;
      }).join("")}</select></label>`;
  }
  if (c.tipo === "area") {
    return `<label class="campo" for="${id}"><span>${esc(c.etiqueta)}</span><textarea id="${id}" name="${c.nombre}" rows="3">${esc(v)}</textarea></label>`;
  }
  const tipo = c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "date" : c.tipo === "pin" ? "text" : "text";
  const extra = c.tipo === "pin" ? 'inputmode="numeric" maxlength="6" pattern="\\d{6}"' : "";
  return `<label class="campo" for="${id}"><span>${esc(c.etiqueta)}</span>
    <input id="${id}" name="${c.nombre}" type="${tipo}" value="${esc(v)}" ${extra} placeholder="${esc(c.placeholder || "")}" ${c.autofocus ? "autofocus" : ""}></label>
    ${c.ayuda ? `<small class="ayuda">${esc(c.ayuda)}</small>` : ""}`;
}

// Opciones comunes
export const AREAS = [["piso", "Piso"], ["barra", "Barra"], ["cocina", "Cocina"], ["casa_regina", "Casa Regina"], ["general", "General"]];
export const SEDES = [["Mozzafiato", "Mozzafiato"], ["Casa Regina", "Casa Regina"]];
export const nombreArea = (a) => (AREAS.find(([v]) => v === a) || [a, a || "—"])[1];

// ---------- Categorías de cursos (tema del curso, configurables por el admin) ----------
export const CATEGORIAS_BASE = [
  { id: "barra", nombre: "Barismo y barra" },
  { id: "cocina", nombre: "Cocina" },
  { id: "piso", nombre: "Servicio en piso" },
  { id: "liderazgo", nombre: "Liderazgo" },
  { id: "casa_regina", nombre: "Hospitalidad Casa Regina" },
  { id: "general", nombre: "General" },
];
let categoriasActuales = CATEGORIAS_BASE;
export const categorias = () => categoriasActuales;
export function fijarCategorias(lista) {
  categoriasActuales = Array.isArray(lista) && lista.length ? lista : CATEGORIAS_BASE;
}
export const opcionesCategoria = () => categoriasActuales.map((c) => [c.id, c.nombre]);
export function nombreCategoria(id) {
  return categoriasActuales.find((c) => c.id === id)?.nombre || nombreArea(id) || "General";
}
export const slug = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "categoria";
