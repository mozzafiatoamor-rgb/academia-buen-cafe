// =====================================================================
//  AVATARES · personaje armable (100% propio, SVG). Se guarda solo la
//  "receta" en JSON. Algunas piezas se desbloquean con nivel, racha o
//  insignias para que valga la pena aprender.
// =====================================================================

const T = 'stroke="#2B1A14" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const T2 = 'stroke="#2B1A14" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

export const PIELES = ["#FFE0C7", "#F6CBA4", "#E5AE80", "#CB8C5E", "#A86C47", "#7E4E33", "#5B3624"];
export const COLORES_PELO = ["#1E1512", "#3B2416", "#6B3F22", "#A0612F", "#D9A84E", "#F1D592", "#B5502A", "#A8A29E", "#F2F0EC", "#E58BB0", "#5B8DEF", "#8B5CF6", "#2FA37A"];
export const COLORES_ROPA = ["#C9824B", "#3B2416", "#2B1A14", "#F2E4CF", "#B23A3A", "#2F5D8A", "#3E7C59", "#E3B66B", "#7A4E9E", "#E86F9A", "#F2F0EC", "#4A4A4A"];
export const COLORES_FONDO = ["#3A2A22", "#C9824B", "#E3B66B", "#F2E4CF", "#7FA77A", "#5B8DEF", "#E86F9A", "#8B5CF6", "#B23A3A", "#2B1A14", "#2FA37A", "#F59E0B"];

const oscurecer = (hex, f = 0.72) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

// ---------------------------------------------------------------------
//  Catálogo. "req": { nivel } | { racha } | { insignia: id, nombre }
// ---------------------------------------------------------------------
export const CATEGORIAS = [
  { id: "cara", nombre: "Cara", color: "piel", colores: PIELES, opciones: [
    { id: "redonda", nombre: "Redonda" }, { id: "ovalada", nombre: "Ovalada" }, { id: "cuadrada", nombre: "Cuadrada" }] },
  { id: "detalle", nombre: "Mejillas", opciones: [
    { id: "nada", nombre: "Nada" }, { id: "rubor", nombre: "Rubor" }, { id: "pecas", nombre: "Pecas" },
    { id: "rubor-pecas", nombre: "Rubor y pecas" }, { id: "lunar", nombre: "Lunar" }, { id: "curita", nombre: "Curita" }] },
  { id: "pelo", nombre: "Pelo", color: "colorPelo", colores: COLORES_PELO, opciones: [
    { id: "corto", nombre: "Corto" }, { id: "picos", nombre: "Picos" }, { id: "copete", nombre: "Copete" },
    { id: "chino", nombre: "Chinos" }, { id: "afro", nombre: "Afro" }, { id: "largo", nombre: "Largo" },
    { id: "coleta", nombre: "Coleta" }, { id: "chongo", nombre: "Chongo" }, { id: "rapado", nombre: "Rapado" },
    { id: "calvo", nombre: "Calvo" }, { id: "mohicano", nombre: "Mohicano", req: { nivel: 2 } }] },
  { id: "ojos", nombre: "Ojos", opciones: [
    { id: "normales", nombre: "Normales" }, { id: "felices", nombre: "Felices" }, { id: "guino", nombre: "Guiño" },
    { id: "grandes", nombre: "Grandes" }, { id: "pestanas", nombre: "Pestañas" }, { id: "dormidos", nombre: "Dormilón" },
    { id: "corazones", nombre: "Enamorado", req: { insignia: "primer_sorbo", nombre: "Primer sorbo" } },
    { id: "estrellas", nombre: "Estrellas", req: { insignia: "extraccion_perfecta", nombre: "Extracción perfecta" } }] },
  { id: "cejas", nombre: "Cejas", opciones: [
    { id: "normales", nombre: "Normales" }, { id: "gruesas", nombre: "Gruesas" }, { id: "arriba", nombre: "Sorpresa" }, { id: "serias", nombre: "Serias" }] },
  { id: "boca", nombre: "Boca", opciones: [
    { id: "sonrisa", nombre: "Sonrisa" }, { id: "sonrisota", nombre: "Carcajada" }, { id: "dientes", nombre: "Dientes" },
    { id: "lengua", nombre: "Lengua" }, { id: "sorpresa", nombre: "¡Oh!" }, { id: "picara", nombre: "Pícara" }, { id: "neutral", nombre: "Tranqui" }] },
  { id: "vello", nombre: "Barba", color: "colorPelo", colores: COLORES_PELO, opciones: [
    { id: "nada", nombre: "Nada" }, { id: "bigote", nombre: "Bigote" }, { id: "candado", nombre: "Candado" },
    { id: "barba", nombre: "Barba" }, { id: "tresdias", nombre: "De 3 días" }, { id: "manubrio", nombre: "Manubrio", req: { racha: 3 } }] },
  { id: "lentes", nombre: "Lentes", opciones: [
    { id: "nada", nombre: "Nada" }, { id: "redondos", nombre: "Redondos" }, { id: "cuadrados", nombre: "Cuadrados" },
    { id: "sol", nombre: "De sol" }, { id: "aviador", nombre: "Aviador", req: { racha: 7 } },
    { id: "corazon", nombre: "Corazón", req: { nivel: 2 } }, { id: "estrella", nombre: "Estrella rock", req: { nivel: 3 } }] },
  { id: "cabeza", nombre: "Gorros", color: "colorGorro", colores: COLORES_ROPA, opciones: [
    { id: "nada", nombre: "Nada" }, { id: "gorra", nombre: "Gorra" }, { id: "gorra-reves", nombre: "Gorra al revés" },
    { id: "boina", nombre: "Boina" }, { id: "chef", nombre: "Gorro chef" }, { id: "lana", nombre: "Gorro de lana" },
    { id: "audifonos", nombre: "Audífonos" }, { id: "flores", nombre: "Corona de flores" }, { id: "palma", nombre: "Sombrero" },
    { id: "aureola", nombre: "Aureola", req: { insignia: "a_la_primera", nombre: "A la primera" } },
    { id: "corona", nombre: "Corona", req: { nivel: 5 } }] },
  { id: "ropa", nombre: "Ropa", color: "colorRopa", colores: COLORES_ROPA, opciones: [
    { id: "delantal", nombre: "Delantal barista" }, { id: "playera", nombre: "Playera" }, { id: "sudadera", nombre: "Sudadera" },
    { id: "chef", nombre: "Filipina chef" }, { id: "mono", nombre: "Camisa y moño" }, { id: "rayas", nombre: "Rayas" },
    { id: "capa", nombre: "Capa de héroe", req: { insignia: "barra_completa", nombre: "Barra completa" } }] },
  { id: "extra", nombre: "Extras", opciones: [
    { id: "nada", nombre: "Nada" }, { id: "taza", nombre: "Taza de café" }, { id: "aretes", nombre: "Aretes" },
    { id: "collar", nombre: "Collar" }, { id: "flor", nombre: "Flor" }, { id: "pin", nombre: "Pin estrella" },
    { id: "taza-oro", nombre: "Taza de oro", req: { insignia: "barista_certificado", nombre: "Barista certificado" } }] },
  { id: "fondo", nombre: "Fondo", color: "colorFondo", colores: COLORES_FONDO, opciones: [
    { id: "liso", nombre: "Liso" }, { id: "granos", nombre: "Granos de café" }, { id: "rayos", nombre: "Rayos" },
    { id: "lunares", nombre: "Lunares" }, { id: "estrellas", nombre: "Estrellas" },
    { id: "confeti", nombre: "Confeti", req: { insignia: "a_tiempo", nombre: "A tiempo" } }, { id: "galaxia", nombre: "Galaxia", req: { nivel: 4 } }] },
  { id: "marco", nombre: "Marco", opciones: [
    { id: "nada", nombre: "Nada" }, { id: "cobre", nombre: "Cobre" }, { id: "fuego", nombre: "Fuego", req: { racha: 3 } },
    { id: "oro", nombre: "Oro", req: { nivel: 3 } }, { id: "arcoiris", nombre: "Arcoíris", req: { nivel: 4 } }, { id: "diamante", nombre: "Diamante", req: { nivel: 5 } }] },
];

export const AVATAR_BASE = {
  cara: "redonda", piel: 1, detalle: "rubor", pelo: "corto", colorPelo: 1, ojos: "normales", cejas: "normales",
  boca: "sonrisa", vello: "nada", lentes: "nada", cabeza: "nada", colorGorro: 0, ropa: "delantal", colorRopa: 3,
  extra: "nada", fondo: "granos", colorFondo: 1, marco: "nada",
};

// ¿Está desbloqueada? logros = { nivel, racha, insignias:Set }
export function desbloqueada(op, logros) {
  const r = op.req;
  if (!r) return true;
  if (!logros) return false;
  if (r.nivel) return (logros.nivel || 1) >= r.nivel;
  if (r.racha) return (logros.racha || 0) >= r.racha;
  if (r.insignia) return logros.insignias?.has(r.insignia);
  return false;
}
export function textoReq(op, niveles = []) {
  const r = op.req || {};
  if (r.nivel) return `Llega al nivel ${niveles[r.nivel - 1] || r.nivel}`;
  if (r.racha) return `Logra una racha de ${r.racha} días`;
  if (r.insignia) return `Gana la insignia "${r.nombre}"`;
  return "";
}

// ---------------------------------------------------------------------
//  Dibujo
// ---------------------------------------------------------------------
const cabezaGeo = {
  redonda: { forma: (c) => `<circle cx="100" cy="96" r="46" fill="${c}" ${T}/>`, orejas: [54, 146], menton: 142 },
  ovalada: { forma: (c) => `<ellipse cx="100" cy="97" rx="42" ry="50" fill="${c}" ${T}/>`, orejas: [58, 142], menton: 147 },
  cuadrada: { forma: (c) => `<rect x="55" y="50" width="90" height="92" rx="32" fill="${c}" ${T}/>`, orejas: [55, 145], menton: 142 },
};

function fondo(cfg) {
  const c = COLORES_FONDO[cfg.colorFondo] ?? COLORES_FONDO[0];
  const claro = "rgba(255,255,255,.16)", osc = "rgba(0,0,0,.14)";
  let p = "";
  if (cfg.fondo === "granos") {
    const g = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="9" ry="6" fill="${osc}"/><path d="M-7 0 C-2 -3 2 3 7 0" stroke="${claro}" stroke-width="1.6" fill="none"/></g>`;
    p = [[28, 34, 20], [168, 40, -30], [22, 120, -10], [178, 128, 40], [60, 178, 15], [150, 182, -20], [100, 20, 0]].map((a) => g(...a)).join("");
  } else if (cfg.fondo === "rayos") {
    p = Array.from({ length: 12 }, (_, i) => `<path d="M100 100 L${100 + 160 * Math.cos((i * 30 - 6) * Math.PI / 180)} ${100 + 160 * Math.sin((i * 30 - 6) * Math.PI / 180)} L${100 + 160 * Math.cos((i * 30 + 6) * Math.PI / 180)} ${100 + 160 * Math.sin((i * 30 + 6) * Math.PI / 180)} Z" fill="${claro}"/>`).join("");
  } else if (cfg.fondo === "lunares") {
    for (let y = 12; y < 200; y += 30) for (let x = (y / 30) % 2 ? 26 : 11; x < 200; x += 30) p += `<circle cx="${x}" cy="${y}" r="5" fill="${claro}"/>`;
  } else if (cfg.fondo === "estrellas" || cfg.fondo === "galaxia") {
    const est = (x, y, s, col) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" fill="${col}"/>`;
    const pos = [[30, 30, 1.4], [165, 36, 1], [24, 140, 0.9], [176, 120, 1.5], [52, 182, 1], [146, 176, 0.8], [96, 16, 0.9], [184, 74, 0.7], [16, 82, 0.8]];
    p = pos.map(([x, y, s]) => est(x, y, s, cfg.fondo === "galaxia" ? "#FFF7D6" : claro)).join("");
  } else if (cfg.fondo === "confeti") {
    const cols = ["#E3B66B", "#E86F9A", "#5B8DEF", "#7FA77A", "#F2E4CF", "#C9824B"];
    p = Array.from({ length: 22 }, (_, i) => {
      const x = (i * 53) % 190 + 5, y = (i * 37) % 190 + 5;
      return `<rect x="${x}" y="${y}" width="7" height="4" rx="1.5" fill="${cols[i % cols.length]}" transform="rotate(${(i * 47) % 180} ${x + 3} ${y + 2})"/>`;
    }).join("");
  }
  const base = cfg.fondo === "galaxia"
    ? `<defs><radialGradient id="gx" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#8B5CF6"/><stop offset=".55" stop-color="#2E1B5B"/><stop offset="1" stop-color="#120A24"/></radialGradient></defs><rect width="200" height="200" fill="url(#gx)"/>`
    : `<rect width="200" height="200" fill="${c}"/>`;
  return base + p;
}

function peloAtras(cfg, c) {
  const o = oscurecer(c, 0.8);
  switch (cfg.pelo) {
    case "afro": return `<g fill="${c}" ${T}><circle cx="100" cy="74" r="56"/></g><g fill="${o}" opacity=".35"><circle cx="70" cy="58" r="8"/><circle cx="128" cy="52" r="7"/><circle cx="148" cy="88" r="6"/></g>`;
    case "largo": return `<path d="M52 96 C46 54 70 36 100 36 C130 36 154 54 148 96 L152 168 C138 176 122 172 118 160 L118 128 L82 128 L82 160 C78 172 62 176 48 168 Z" fill="${c}" ${T}/>`;
    case "coleta": return `<path d="M136 74 C164 70 176 98 168 128 C162 150 150 160 142 166 C146 146 150 126 140 108 Z" fill="${c}" ${T}/><rect x="133" y="70" width="14" height="10" rx="4" fill="#E86F9A" ${T2} transform="rotate(20 140 75)"/>`;
    case "chongo": return `<circle cx="100" cy="40" r="18" fill="${c}" ${T}/><path d="M90 36 C96 30 104 30 110 36" stroke="${o}" stroke-width="2" fill="none"/>`;
    default: return "";
  }
}

function peloFrente(cfg, c) {
  const o = oscurecer(c, 0.78), brillo = `<path d="M78 52 C86 46 96 44 104 45" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  switch (cfg.pelo) {
    case "corto": return `<path d="M54 94 C50 58 72 40 100 40 C128 40 150 58 146 94 C142 76 130 66 114 66 C104 60 86 60 76 70 C64 76 58 84 54 94 Z" fill="${c}" ${T}/>${brillo}`;
    case "picos": return `<path d="M54 92 L49 66 L63 70 L60 46 L77 56 L82 33 L95 50 L105 28 L114 49 L128 34 L132 55 L149 49 L142 70 L151 67 L146 92 C137 72 121 63 100 63 C80 63 63 72 54 92 Z" fill="${c}" ${T}/>`;
    case "copete": return `<path d="M55 90 C48 60 60 32 94 28 C126 24 152 40 147 66 C150 74 149 82 146 90 C140 73 126 64 110 64 C94 64 77 66 66 74 C60 78 57 84 55 90 Z" fill="${c}" ${T}/><path d="M78 40 C92 32 112 32 128 40" stroke="${o}" stroke-width="2.4" fill="none" stroke-linecap="round"/>${brillo}`;
    case "chino": return `<g fill="${c}" ${T}>${[[58, 82, 11], [62, 64, 12], [76, 50, 13], [94, 43, 13], [112, 44, 13], [129, 52, 12], [140, 66, 12], [143, 84, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g><path d="M60 76 C70 64 86 60 100 62 C116 60 132 66 140 78" stroke="${c}" stroke-width="10" fill="none"/>`;
    case "afro": return `<path d="M58 80 C66 66 84 62 100 64 C118 62 134 66 142 80" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    case "largo": return `<path d="M55 88 C52 56 76 40 100 40 C124 40 148 56 145 88 C136 74 124 64 108 62 C104 70 92 76 78 78 C68 80 60 84 55 88 Z" fill="${c}" ${T}/>${brillo}`;
    case "coleta": return `<path d="M54 92 C50 58 72 40 100 40 C128 40 150 58 146 92 C140 72 124 62 100 62 C80 62 62 72 54 92 Z" fill="${c}" ${T}/><path d="M72 56 C86 50 110 48 132 58" stroke="${o}" stroke-width="2" fill="none"/>`;
    case "chongo": return `<path d="M55 90 C52 60 74 48 100 48 C126 48 148 60 145 90 C138 72 122 64 100 64 C80 64 62 72 55 90 Z" fill="${c}" ${T}/>`;
    case "rapado": return `<path d="M56 86 C56 58 76 46 100 46 C124 46 144 58 144 86 C132 72 116 66 100 66 C84 66 68 72 56 86 Z" fill="${c}" opacity=".55"/>`;
    case "mohicano": return `<path d="M89 70 C86 46 91 24 100 12 C109 24 114 46 111 70 C105 66 95 66 89 70 Z" fill="${c}" ${T}/><path d="M60 82 C70 70 82 66 90 68 M110 68 C118 66 130 70 140 82" stroke="${c}" stroke-width="3" opacity=".45" fill="none"/>`;
    default: return "";
  }
}

function ojos(cfg) {
  const L = [82, 98], R = [118, 98];
  const normal = ([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.2" ry="6.6" fill="#2B1A14"/><circle cx="${x + 1.8}" cy="${y - 2.4}" r="1.9" fill="#fff"/>`;
  const feliz = ([x, y]) => `<path d="M${x - 7} ${y + 2} Q${x} ${y - 7} ${x + 7} ${y + 2}" ${T} fill="none" stroke-width="3"/>`;
  switch (cfg.ojos) {
    case "felices": return feliz(L) + feliz(R);
    case "guino": return normal(L) + feliz(R);
    case "grandes": return [L, R].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fff" ${T2}/><circle cx="${x + 1}" cy="${y + 1}" r="5" fill="#2B1A14"/><circle cx="${x + 2.6}" cy="${y - 1.2}" r="1.8" fill="#fff"/>`).join("");
    case "pestanas": return [L, R].map(([x, y], k) => normal([x, y]) + `<path d="M${x - 6} ${y - 6} L${x - 9} ${y - 10} M${x - 2} ${y - 7.5} L${x - 3} ${y - 12} M${x + 2.5} ${y - 7.5} L${x + 3.5} ${y - 12} ${k ? `M${x + 6} ${y - 6} L${x + 9} ${y - 10}` : `M${x + 6} ${y - 6} L${x + 9} ${y - 10}`}" ${T2}/>`).join("");
    case "dormidos": return [L, R].map(([x, y]) => `<path d="M${x - 7} ${y} Q${x} ${y + 6} ${x + 7} ${y}" ${T} fill="none" stroke-width="3"/>`).join("");
    case "corazones": return [L, R].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 6 C-10 -1 -7 -9 -2.5 -8 C-1 -7.6 0 -6.5 0 -5 C0 -6.5 1 -7.6 2.5 -8 C7 -9 10 -1 0 6 Z" fill="#E5484D" ${T2} stroke-width="1.6"/>`).join("");
    case "estrellas": return [L, R].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 -8 L2.4 -2.6 L8 -2.2 L3.6 1.4 L5 7.2 L0 4 L-5 7.2 L-3.6 1.4 L-8 -2.2 L-2.4 -2.6 Z" fill="#F5C542" ${T2} stroke-width="1.6"/>`).join("");
    default: return normal(L) + normal(R);
  }
}

function cejas(cfg, c) {
  const col = oscurecer(c, 0.85);
  switch (cfg.cejas) {
    case "gruesas": return `<path d="M72 84 Q82 78 91 83" stroke="${col}" stroke-width="5.5" fill="none" stroke-linecap="round"/><path d="M109 83 Q118 78 128 84" stroke="${col}" stroke-width="5.5" fill="none" stroke-linecap="round"/>`;
    case "arriba": return `<path d="M73 80 Q82 72 91 78" stroke="${col}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M109 78 Q118 72 127 80" stroke="${col}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case "serias": return `<path d="M73 82 L91 86" stroke="${col}" stroke-width="4" stroke-linecap="round"/><path d="M109 86 L127 82" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;
    default: return `<path d="M74 85 Q82 80 90 84" stroke="${col}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M110 84 Q118 80 126 85" stroke="${col}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  }
}

function boca(cfg) {
  switch (cfg.boca) {
    case "sonrisota": return `<path d="M86 116 Q100 116 114 116 Q112 134 100 134 Q88 134 86 116 Z" fill="#6B1F1F" ${T2}/><path d="M92 128 Q100 123 108 128 Q104 133 100 133 Q96 133 92 128 Z" fill="#E86F7A"/>`;
    case "dientes": return `<path d="M86 116 Q100 120 114 116 Q111 132 100 132 Q89 132 86 116 Z" fill="#6B1F1F" ${T2}/><path d="M88.5 117.6 Q100 121 111.5 117.6 L110.6 122 Q100 124.5 89.4 122 Z" fill="#fff"/>`;
    case "lengua": return `<path d="M88 117 Q100 128 112 117" ${T} fill="none" stroke-width="3"/><path d="M99 122 Q100 134 107 132 Q112 128 108 121" fill="#E86F7A" ${T2}/>`;
    case "sorpresa": return `<ellipse cx="100" cy="122" rx="6" ry="7.5" fill="#6B1F1F" ${T2}/>`;
    case "picara": return `<path d="M88 120 Q102 124 113 113" ${T} fill="none" stroke-width="3"/>`;
    case "neutral": return `<path d="M91 120 L109 120" ${T} stroke-width="3"/>`;
    default: return `<path d="M88 116 Q100 129 112 116" ${T} fill="none" stroke-width="3"/>`;
  }
}

function vello(cfg, c, menton) {
  const o = oscurecer(c, 0.9);
  const bigote = `<path d="M84 113 C89 107 97 108 100 112 C103 108 111 107 116 113 C110 117 104 116 100 114 C96 116 90 117 84 113 Z" fill="${o}" ${T2}/>`;
  switch (cfg.vello) {
    case "bigote": return { atras: "", frente: bigote };
    case "manubrio": return { atras: "", frente: `<path d="M100 112 C94 106 86 108 82 112 C78 116 74 116 72 112 C72 120 82 122 88 116 C92 113 96 114 100 115 C104 114 108 113 112 116 C118 122 128 120 128 112 C126 116 122 116 118 112 C114 108 106 106 100 112 Z" fill="${o}" ${T2}/>` };
    case "candado": return { atras: `<path d="M86 124 C88 ${menton - 2} 112 ${menton - 2} 114 124 C108 128 92 128 86 124 Z" fill="${o}" ${T2}/>`, frente: bigote };
    case "barba": return { atras: `<path d="M56 98 C58 ${menton + 4} 78 ${menton + 8} 100 ${menton + 8} C122 ${menton + 8} 142 ${menton + 4} 144 98 C140 116 130 126 118 126 C110 132 90 132 82 126 C70 126 60 116 56 98 Z" fill="${o}" ${T2}/>`, frente: bigote };
    case "tresdias": return { atras: `<path d="M58 104 C62 ${menton + 2} 80 ${menton + 4} 100 ${menton + 4} C120 ${menton + 4} 138 ${menton + 2} 142 104 C136 122 124 128 100 128 C76 128 64 122 58 104 Z" fill="${o}" opacity=".28"/>`, frente: "" };
    default: return { atras: "", frente: "" };
  }
}

function detalle(cfg) {
  const rubor = `<ellipse cx="70" cy="112" rx="7" ry="4.5" fill="#F28B82" opacity=".45"/><ellipse cx="130" cy="112" rx="7" ry="4.5" fill="#F28B82" opacity=".45"/>`;
  const pecas = [[66, 106], [72, 110], [64, 112], [134, 106], [128, 110], [136, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#8A4F2E" opacity=".7"/>`).join("");
  switch (cfg.detalle) {
    case "rubor": return rubor;
    case "pecas": return pecas;
    case "rubor-pecas": return rubor + pecas;
    case "lunar": return `<circle cx="124" cy="118" r="1.8" fill="#3B2416"/>`;
    case "curita": return `<g transform="rotate(-20 128 108)"><rect x="118" y="104" width="20" height="8" rx="3" fill="#F2C9A0" ${T2} stroke-width="1.4"/><rect x="125" y="104" width="6" height="8" fill="#E5AE80" opacity=".6"/></g>`;
    default: return "";
  }
}

function lentes(cfg) {
  switch (cfg.lentes) {
    case "redondos": return `<g fill="rgba(255,255,255,.18)" ${T}><circle cx="82" cy="98" r="12"/><circle cx="118" cy="98" r="12"/></g><path d="M94 97 Q100 93 106 97 M70 96 L56 92 M130 96 L144 92" ${T} fill="none"/>`;
    case "cuadrados": return `<g fill="rgba(255,255,255,.18)" ${T}><rect x="68" y="88" width="27" height="20" rx="5"/><rect x="105" y="88" width="27" height="20" rx="5"/></g><path d="M95 96 L105 96 M68 94 L56 91 M132 94 L144 91" ${T}/>`;
    case "sol": return `<g fill="#1E1512" ${T}><path d="M67 90 L96 90 C96 104 90 110 81 110 C72 110 67 102 67 90 Z"/><path d="M104 90 L133 90 C133 102 128 110 119 110 C110 110 104 104 104 90 Z"/></g><path d="M96 92 L104 92 M67 91 L56 89 M133 91 L144 89" ${T}/><path d="M72 93 L78 93 M109 93 L115 93" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/>`;
    case "aviador": return `<g fill="rgba(80,60,40,.55)" stroke="#D4A13A" stroke-width="2.4"><path d="M68 90 L95 90 C96 104 90 112 81 112 C70 112 66 102 68 90 Z"/><path d="M105 90 L132 90 C134 102 130 112 119 112 C110 112 104 104 105 90 Z"/></g><path d="M95 91 Q100 88 105 91 M68 91 L56 89 M132 91 L144 89" stroke="#D4A13A" stroke-width="2.4" fill="none"/>`;
    case "corazon": return `<g fill="#E86F9A" fill-opacity=".75" ${T}>${[82, 118].map((x) => `<path transform="translate(${x} 98) scale(1.25)" d="M0 8 C-13 -1 -9 -11 -3.5 -10 C-1.5 -9.6 0 -8 0 -6 C0 -8 1.5 -9.6 3.5 -10 C9 -11 13 -1 0 8 Z"/>`).join("")}</g><path d="M94 95 L106 95 M68 94 L56 91 M132 94 L144 91" ${T}/>`;
    case "estrella": return `<g fill="#F5C542" fill-opacity=".85" ${T}>${[82, 118].map((x) => `<path transform="translate(${x} 98) scale(1.5)" d="M0 -9 L2.6 -3 L9 -2.6 L4 1.6 L5.6 8 L0 4.6 L-5.6 8 L-4 1.6 L-9 -2.6 L-2.6 -3 Z"/>`).join("")}</g><path d="M95 96 L105 96" ${T}/>`;
    default: return "";
  }
}

function sombrero(cfg, c) {
  const o = oscurecer(c, 0.75);
  switch (cfg.cabeza) {
    case "gorra": return `<path d="M54 80 C52 50 74 36 100 36 C126 36 148 50 146 80 Z" fill="${c}" ${T}/><path d="M138 78 C158 74 178 80 180 88 C160 92 144 90 132 86 Z" fill="${o}" ${T}/><path d="M54 80 L146 80" ${T}/><circle cx="100" cy="58" r="7" fill="#E3B66B" ${T2}/><path d="M97 58 C99 55 101 61 103 58" stroke="#3B2416" stroke-width="1.6" fill="none"/>`;
    case "gorra-reves": return `<path d="M60 78 C44 76 30 80 28 87 C44 90 58 88 66 84 Z" fill="${o}" ${T}/><path d="M54 80 C52 50 74 36 100 36 C126 36 148 50 146 80 Z" fill="${c}" ${T}/><path d="M54 80 L146 80" ${T}/>`;
    case "boina": return `<ellipse cx="96" cy="56" rx="54" ry="18" fill="${c}" ${T} transform="rotate(-8 96 56)"/><path d="M96 38 L98 30" ${T} stroke-width="3.4"/>`;
    case "chef": return `<g fill="#FFFFFF" ${T}><circle cx="74" cy="42" r="17"/><circle cx="126" cy="42" r="17"/><circle cx="100" cy="30" r="22"/><rect x="62" y="48" width="76" height="24" rx="7"/></g><path d="M78 58 L78 68 M92 58 L92 68 M108 58 L108 68 M122 58 L122 68" stroke="#E3D6C2" stroke-width="2"/>`;
    case "lana": return `<path d="M54 78 C52 46 74 32 100 32 C126 32 148 46 146 78 Z" fill="${c}" ${T}/><rect x="50" y="70" width="100" height="16" rx="8" fill="${o}" ${T}/><circle cx="100" cy="26" r="10" fill="#F2E4CF" ${T}/><path d="M70 50 L70 70 M85 42 L85 70 M100 40 L100 70 M115 42 L115 70 M130 50 L130 70" stroke="${o}" stroke-width="2" opacity=".6"/>`;
    case "audifonos": return `<path d="M52 96 C48 44 152 44 148 96" stroke="#2B1A14" stroke-width="7" fill="none"/><path d="M52 96 C48 44 152 44 148 96" stroke="${c}" stroke-width="3.6" fill="none"/><rect x="40" y="84" width="16" height="28" rx="7" fill="${c}" ${T}/><rect x="144" y="84" width="16" height="28" rx="7" fill="${c}" ${T}/>`;
    case "flores": return [[60, 70, "#E86F9A"], [72, 54, "#F5C542"], [88, 46, "#FFFFFF"], [104, 44, "#E86F9A"], [120, 48, "#F5C542"], [134, 58, "#FFFFFF"], [142, 74, "#E86F9A"]]
      .map(([x, y, col]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${5 * Math.cos(a * Math.PI / 180)}" cy="${5 * Math.sin(a * Math.PI / 180)}" r="4.2" fill="${col}" ${T2} stroke-width="1.2"/>`).join("")}<circle r="2.8" fill="#C9824B"/></g>`).join("");
    case "palma": return `<ellipse cx="100" cy="66" rx="74" ry="16" fill="#E5C27A" ${T}/><path d="M68 64 C68 40 80 28 100 28 C120 28 132 40 132 64 Z" fill="#E5C27A" ${T}/><path d="M69 56 C88 60 112 60 131 56" stroke="${c}" stroke-width="6"/><path d="M40 66 C70 72 130 72 160 66" stroke="#B88D45" stroke-width="1.6" fill="none"/>`;
    case "aureola": return `<ellipse cx="100" cy="30" rx="32" ry="8" fill="none" stroke="#F5C542" stroke-width="6"/><ellipse cx="100" cy="30" rx="32" ry="8" fill="none" stroke="#FFF2B3" stroke-width="2"/>`;
    case "corona": return `<path d="M64 62 L60 30 L80 46 L100 22 L120 46 L140 30 L136 62 Z" fill="#F5C542" ${T}/><rect x="62" y="58" width="76" height="12" rx="4" fill="#E3A82B" ${T}/><circle cx="100" cy="64" r="4" fill="#E5484D"/><circle cx="80" cy="64" r="3" fill="#5B8DEF"/><circle cx="120" cy="64" r="3" fill="#2FA37A"/>`;
    default: return "";
  }
}

function ropa(cfg, c, piel) {
  const cuerpo = "M36 210 C36 168 62 150 100 150 C138 150 164 168 164 210 Z";
  const cuello = `<path d="M88 130 L88 152 Q100 160 112 152 L112 130 Z" fill="${piel}" ${T}/>`;
  const o = oscurecer(c, 0.78);
  switch (cfg.ropa) {
    case "playera": return cuello + `<path d="${cuerpo}" fill="${c}" ${T}/><path d="M84 151 Q100 166 116 151" ${T} fill="none"/>`;
    case "sudadera": return `<path d="M64 158 C62 132 84 124 100 124 C116 124 138 132 136 158 Z" fill="${o}" ${T}/>` + cuello + `<path d="${cuerpo}" fill="${c}" ${T}/><path d="M80 152 Q100 172 120 152" ${T} fill="${o}"/><path d="M92 166 L90 186 M108 166 L110 186" ${T}/><circle cx="90" cy="187" r="2.6" fill="#F2E4CF"/><circle cx="110" cy="187" r="2.6" fill="#F2E4CF"/>`;
    case "chef": return cuello + `<path d="${cuerpo}" fill="#FFFFFF" ${T}/><path d="M86 152 L100 166 L114 152" ${T} fill="none"/><g fill="${c}" ${T2}>${[176, 192].map((y) => `<circle cx="88" cy="${y}" r="3.2"/><circle cx="112" cy="${y}" r="3.2"/>`).join("")}</g>`;
    case "mono": return cuello + `<path d="${cuerpo}" fill="${c}" ${T}/><path d="M86 151 L100 200 L114 151 Q100 158 86 151 Z" fill="#FFFFFF" ${T}/><path d="M88 156 L100 162 L88 168 Z M112 156 L100 162 L112 168 Z" fill="#B23A3A" ${T2}/><circle cx="100" cy="162" r="3" fill="#8E2A2A"/>`;
    case "rayas": return cuello + `<defs><clipPath id="cp-ropa"><path d="${cuerpo}"/></clipPath></defs><path d="${cuerpo}" fill="#F2F0EC"/><g clip-path="url(#cp-ropa)" fill="${c}">${[164, 180, 196].map((y) => `<rect x="30" y="${y}" width="140" height="8"/>`).join("")}</g><path d="${cuerpo}" fill="none" ${T}/><path d="M84 151 Q100 166 116 151" ${T} fill="none"/>`;
    case "capa": return `<path d="M50 158 C30 180 26 200 24 210 L176 210 C174 200 170 180 150 158 Z" fill="#B23A3A" ${T}/>` + cuello + `<path d="${cuerpo}" fill="${c}" ${T}/><path d="M84 151 Q100 166 116 151" ${T} fill="none"/><path transform="translate(100 182)" d="M0 -11 L3.2 -3.6 L11 -3 L5 2 L6.8 10 L0 5.8 L-6.8 10 L-5 2 L-11 -3 L-3.2 -3.6 Z" fill="#F5C542" ${T2}/>`;
    default: // delantal barista
      return cuello + `<path d="${cuerpo}" fill="${c}" ${T}/><path d="M84 151 Q100 162 116 151" ${T} fill="none"/><path d="M72 170 L128 170 L132 210 L68 210 Z" fill="#3B2416" ${T}/><path d="M78 170 L86 151 M122 170 L114 151" stroke="#3B2416" stroke-width="4"/><g transform="translate(100 188)"><ellipse rx="5.5" ry="7.5" fill="#E3B66B"/><path d="M0 -6 C-3 -2 3 2 0 6" stroke="#3B2416" stroke-width="1.6" fill="none"/></g>`;
  }
}

function extra(cfg, orejas) {
  const taza = (oro) => `<g transform="translate(140 178) rotate(-8)"><path d="M-14 -12 L14 -12 L11 14 Q0 18 -11 14 Z" fill="${oro ? "#F5C542" : "#F2E4CF"}" ${T}/><path d="M14 -6 C24 -6 24 8 12 8" ${T} fill="none"/><path d="M-6 -20 Q-2 -26 -6 -32 M4 -20 Q8 -26 4 -32" stroke="${oro ? "#F5C542" : "rgba(255,255,255,.8)"}" stroke-width="2.2" fill="none" stroke-linecap="round"/>${oro ? `<path d="M-4 0 L0 -6 L4 0 L0 6 Z" fill="#fff" opacity=".8"/>` : `<rect x="-11" y="-2" width="22" height="6" fill="#C9824B"/>`}</g>`;
  switch (cfg.extra) {
    case "taza": return taza(false);
    case "taza-oro": return taza(true);
    case "aretes": return orejas.map((x) => `<circle cx="${x}" cy="${110}" r="3.4" fill="#F5C542" ${T2} stroke-width="1.4"/>`).join("");
    case "collar": return `<path d="M84 152 Q100 172 116 152" stroke="#F5C542" stroke-width="2.6" fill="none"/><circle cx="100" cy="166" r="4" fill="#5B8DEF" ${T2} stroke-width="1.4"/>`;
    case "flor": return `<g transform="translate(138 64)">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${6 * Math.cos(a * Math.PI / 180)}" cy="${6 * Math.sin(a * Math.PI / 180)}" r="5" fill="#E86F9A" ${T2} stroke-width="1.4"/>`).join("")}<circle r="3.4" fill="#F5C542"/></g>`;
    case "pin": return `<path transform="translate(124 178)" d="M0 -8 L2.4 -2.6 L8 -2.2 L3.6 1.4 L5 7.2 L0 4 L-5 7.2 L-3.6 1.4 L-8 -2.2 L-2.4 -2.6 Z" fill="#F5C542" ${T2} stroke-width="1.6"/>`;
    default: return "";
  }
}

function marco(cfg) {
  switch (cfg.marco) {
    case "cobre": return `<circle cx="100" cy="100" r="95" fill="none" stroke="#C9824B" stroke-width="8"/>`;
    case "oro": return `<circle cx="100" cy="100" r="95" fill="none" stroke="url(#mk-oro)" stroke-width="9"/><defs><linearGradient id="mk-oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B3"/><stop offset=".5" stop-color="#E3B66B"/><stop offset="1" stop-color="#A9742E"/></linearGradient></defs>`;
    case "fuego": return `<circle cx="100" cy="100" r="95" fill="none" stroke="url(#mk-fuego)" stroke-width="9"/><defs><linearGradient id="mk-fuego" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F59E0B"/><stop offset=".6" stop-color="#E5484D"/><stop offset="1" stop-color="#FDE68A"/></linearGradient></defs>`;
    case "arcoiris": return `<circle cx="100" cy="100" r="95" fill="none" stroke="url(#mk-arco)" stroke-width="9"/><defs><linearGradient id="mk-arco" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E5484D"/><stop offset=".2" stop-color="#F59E0B"/><stop offset=".4" stop-color="#F5C542"/><stop offset=".6" stop-color="#2FA37A"/><stop offset=".8" stop-color="#5B8DEF"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>`;
    case "diamante": return `<circle cx="100" cy="100" r="95" fill="none" stroke="url(#mk-diam)" stroke-width="9"/><defs><linearGradient id="mk-diam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0F2FE"/><stop offset=".35" stop-color="#7DD3FC"/><stop offset=".65" stop-color="#FFFFFF"/><stop offset="1" stop-color="#38BDF8"/></linearGradient></defs>${[[100, 6], [194, 100], [100, 194], [6, 100]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 -7 L5 0 L0 7 L-5 0 Z" fill="#FFFFFF" stroke="#38BDF8" stroke-width="1.4"/>`).join("")}`;
    default: return "";
  }
}

let contador = 0;
// Devuelve el SVG del avatar. cfg = receta (se completa con la base).
export function avatarSVG(cfgEntrada, tam = 64, extraAttr = "") {
  const cfg = { ...AVATAR_BASE, ...(cfgEntrada || {}) };
  const piel = PIELES[cfg.piel] ?? PIELES[1];
  const cPelo = COLORES_PELO[cfg.colorPelo] ?? COLORES_PELO[1];
  const cRopa = COLORES_ROPA[cfg.colorRopa] ?? COLORES_ROPA[3];
  const cGorro = COLORES_ROPA[cfg.colorGorro] ?? COLORES_ROPA[0];
  const geo = cabezaGeo[cfg.cara] || cabezaGeo.redonda;
  const pielO = oscurecer(piel, 0.85);
  const v = vello(cfg, cPelo, geo.menton);
  const id = "av" + (++contador);
  // Ids únicos (varios avatares en la misma página).
  const svg = `<svg viewBox="0 0 200 200" width="${tam}" height="${tam}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar" ${extraAttr}>
    <defs><clipPath id="${id}"><circle cx="100" cy="100" r="100"/></clipPath></defs>
    <g clip-path="url(#${id})">
      ${fondo(cfg)}
      ${peloAtras(cfg, cPelo)}
      ${ropa(cfg, cRopa, piel)}
      ${geo.orejas.map((x) => `<circle cx="${x}" cy="100" r="9" fill="${piel}" ${T}/><path d="M${x + (x < 100 ? 2 : -2)} 96 q${x < 100 ? -3 : 3} 4 0 8" stroke="${pielO}" stroke-width="2" fill="none"/>`).join("")}
      ${geo.forma(piel)}
      ${detalle(cfg)}
      ${v.atras}
      ${cejas(cfg, cPelo)}
      ${ojos(cfg)}
      <path d="M97 106 Q100 110 103 106" stroke="${pielO}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      ${boca(cfg)}
      ${v.frente}
      ${peloFrente(cfg, cPelo)}
      ${lentes(cfg)}
      ${sombrero(cfg, cGorro)}
      ${extra(cfg, geo.orejas)}
    </g>
    ${marco(cfg)}
  </svg>`;
  return svg.replace(/id="mk-/g, `id="${id}-mk-`).replace(/url\(#mk-/g, `url(#${id}-mk-`)
    .replace(/id="gx"/g, `id="${id}-gx"`).replace(/url\(#gx\)/g, `url(#${id}-gx)`)
    .replace(/id="cp-ropa"/g, `id="${id}-cpr"`).replace(/url\(#cp-ropa\)/g, `url(#${id}-cpr)`);
}

// Avatar o iniciales (para listas, ranking, perfil).
export function avatarOIniciales(avatar, nombre, tam = 40, clase = "") {
  if (avatar && typeof avatar === "object") return `<span class="avatar avatar-svg ${clase}" style="width:${tam}px;height:${tam}px">${avatarSVG(avatar, tam)}</span>`;
  const ini = String(nombre || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  return `<span class="avatar ${clase}" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.32)}px">${ini}</span>`;
}

// Uno al azar con lo que tenga desbloqueado.
export function avatarAlAzar(logros, base = {}) {
  const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cfg = { ...AVATAR_BASE, ...base };
  for (const cat of CATEGORIAS) {
    const ops = cat.opciones.filter((o) => desbloqueada(o, logros));
    cfg[cat.id === "cara" ? "cara" : cat.id] = r(ops).id;
    if (cat.color && cat.id !== "cara" && cat.id !== "vello") cfg[cat.color] = Math.floor(Math.random() * cat.colores.length);
  }
  cfg.piel = base.piel ?? cfg.piel; // la piel no cambia al azar (es la de la persona)
  if (Math.random() < 0.55) cfg.vello = "nada";
  if (Math.random() < 0.4) cfg.lentes = "nada";
  if (Math.random() < 0.35) cfg.cabeza = "nada";
  return cfg;
}
