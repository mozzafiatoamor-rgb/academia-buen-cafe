// =====================================================================
//  CELEBRACIONES · confeti, momentos de avance, subida de nivel y frases
// =====================================================================
import { icono, esc, num, modal } from "./ui.js";

const COLORES = ["#C9824B", "#E3B66B", "#F2E4CF", "#7FA77A", "#A8693F"];
const sinMovimiento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Confeti ligero en un canvas temporal (no bloquea la pantalla).
export function confeti({ cantidad = 140, duracion = 2600, origenY = 0.35 } = {}) {
  if (sinMovimiento()) return;
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:70";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const x = c.getContext("2d"); x.scale(dpr, dpr);
  const piezas = Array.from({ length: cantidad }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * origenY,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 5,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
    color: COLORES[Math.floor(Math.random() * COLORES.length)], grano: Math.random() < 0.25,
  }));
  const inicio = performance.now();
  const paso = (t) => {
    const p = (t - inicio) / duracion;
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (const q of piezas) {
      q.vy += 0.35; q.vx *= 0.99; q.x += q.vx; q.y += q.vy; q.r += q.vr;
      x.save(); x.globalAlpha = Math.max(0, 1 - p * 1.1); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = q.color;
      if (q.grano) { x.beginPath(); x.ellipse(0, 0, q.w * 0.6, q.w * 0.85, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = "rgba(43,26,20,.5)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, -q.w * 0.7); x.quadraticCurveTo(q.w * 0.25, 0, 0, q.w * 0.7); x.stroke(); }
      else x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      x.restore();
    }
    if (p < 1) requestAnimationFrame(paso); else c.remove();
  };
  requestAnimationFrame(paso);
}

// Tarjeta flotante que aparece unos segundos (lección completada, hitos, rachas).
export function momento({ icono: ic = "check", titulo, texto = "", puntos = 0, tono = "cobre", duracion = 3200 }) {
  let zona = document.getElementById("momentos");
  if (!zona) {
    zona = document.createElement("div");
    zona.id = "momentos";
    zona.setAttribute("role", "status"); zona.setAttribute("aria-live", "polite");
    zona.style.cssText = "position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top));transform:translateX(-50%);z-index:65;display:flex;flex-direction:column;gap:10px;width:min(92vw,420px);pointer-events:none";
    document.body.appendChild(zona);
  }
  const fondo = tono === "oro" ? "var(--oro)" : tono === "verde" ? "#4A6B4F" : "var(--cobre)";
  const el = document.createElement("div");
  el.className = "momento";
  el.innerHTML = `
    <span class="momento-ic" style="background:${fondo}">${icono(ic, 22)}</span>
    <span style="flex:1;min-width:0"><b style="display:block;font-size:15px">${esc(titulo)}</b>${texto ? `<span style="font-size:13px;color:var(--crema-2)">${esc(texto)}</span>` : ""}</span>
    ${puntos ? `<b class="momento-pts">+${num(puntos)}</b>` : ""}`;
  zona.appendChild(el);
  setTimeout(() => el.classList.add("sale"), duracion);
  setTimeout(() => el.remove(), duracion + 500);
}

// Gran celebración al subir de nivel.
export function subidaDeNivel(nivel, siguiente, faltan) {
  confeti({ cantidad: 200 });
  return modal(`
    <div class="pila" style="align-items:center;text-align:center;gap:12px">
      <div class="etiqueta" style="color:var(--oro)">¡Subiste de nivel!</div>
      <div class="nivel-taza" aria-hidden="true"><div class="nivel-taza-llenado"></div>${icono("coffee", 54)}</div>
      <h2 class="modal-titulo" style="font-size:34px">${esc(nivel)}</h2>
      <p class="modal-texto">${esc(fraseNivel(nivel))}</p>
      ${siguiente ? `<p class="texto-tenue" style="margin:0">Siguiente meta: <b style="color:var(--oro)">${esc(siguiente)}</b> · faltan ${num(faltan)} pts</p>` : `<p class="texto-tenue" style="margin:0">Llegaste a la cima. ¡Eres ejemplo para todo el equipo!</p>`}
      <button class="btn btn-bloque" data-cerrar autofocus>¡Vamos por más!</button>
    </div>`, { clase: "desbloqueo" });
}

function fraseNivel(nivel) {
  const n = String(nivel).toLowerCase();
  if (n.includes("claro")) return "Ya no eres grano verde: empiezas a dominar el oficio.";
  if (n.includes("medio")) return "Equilibrio perfecto: conocimiento y práctica en su punto.";
  if (n.includes("oscuro")) return "Intenso y con carácter. Pocos llegan hasta aquí.";
  if (n.includes("maestro")) return "Lo lograste: eres Maestro tostador de la Academia.";
  return "Tu esfuerzo se nota. ¡Sigue así!";
}

const FRASES_LECCION = [
  "Un paso más cerca de ser Maestro tostador.",
  "Así se hace: constancia y buen café.",
  "Lo que aprendes hoy, lo sirves mañana.",
  "Cada lección cuenta. ¡Vas muy bien!",
  "Tu esfuerzo se nota. Sigue así.",
  "Buenas manos, buen café. Eso eres tú.",
  "Poco a poco se llena la taza.",
  "¿Ya anotaste lo más importante? Esa idea puede llegar a nuestro menú.",
  "Anota la idea que más te gustó: puede ser lo próximo que probemos en Mozzafiato.",
  "Lección lista. Escribe en tu libreta una cosa que podríamos mejorar.",
];
export const fraseLeccion = () => FRASES_LECCION[Math.floor(Math.random() * FRASES_LECCION.length)];

// Mensaje para los hitos de avance dentro de un curso.
export function hitoCurso(pctAntes, pctDespues, curso) {
  if (pctAntes < 25 && pctDespues >= 25 && pctDespues < 50) return { icono: "flame", titulo: "¡Buen arranque!", texto: `Ya llevas una cuarta parte de ${curso}.` };
  if (pctAntes < 50 && pctDespues >= 50 && pctDespues < 75) return { icono: "star", titulo: "¡Vas a la mitad!", texto: `La mitad de ${curso} ya es tuya. ¿Cómo van tus apuntes?` };
  if (pctAntes < 75 && pctDespues >= 75 && pctDespues < 100) return { icono: "target", titulo: "¡Recta final!", texto: "Solo te falta un cuarto. Repasa tus apuntes: al final queremos tus ideas." };
  return null;
}

// Frase personalizada para la pantalla de inicio.
export function fraseInicio(r, cursos) {
  const pendientes = cursos.filter((c) => !c.terminado);
  const enCurso = pendientes.filter((c) => c.completadas > 0).sort((a, b) => (b.completadas / b.lecciones) - (a.completadas / a.lecciones))[0];
  const urgente = pendientes.filter((c) => c.fecha_limite).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))[0];
  if (r.racha_actual >= 2) return `Llevas ${r.racha_actual} días seguidos aprendiendo. ¡No rompas la racha hoy!`;
  if (enCurso) {
    const faltan = enCurso.lecciones - enCurso.completadas;
    return faltan === 1 ? `¡Te falta solo 1 lección para terminar ${enCurso.titulo}!` : `Te faltan ${faltan} lecciones para terminar ${enCurso.titulo}. ¡Tú puedes!`;
  }
  if (urgente) return `Tu siguiente reto: ${urgente.titulo}. Empieza hoy y llega sobrado a la fecha.`;
  if (cursos.length && !pendientes.length) return "¡Terminaste todo lo asignado! Eres ejemplo para el equipo.";
  if (cursos.length) return "Hoy es un gran día para empezar tu primer curso.";
  return "Pronto tendrás cursos aquí. ¡Prepárate!";
}

// Anima las barras de progreso desde cero al mostrarse.
export function animarBarras(raiz) {
  if (sinMovimiento()) return;
  const barras = [...raiz.querySelectorAll(".barra > i")];
  const metas = barras.map((b) => b.style.width);
  barras.forEach((b) => { b.style.transition = "none"; b.style.width = "0%"; });
  requestAnimationFrame(() => requestAnimationFrame(() => barras.forEach((b, i) => { b.style.transition = "width .9s cubic-bezier(.2,.8,.2,1)"; b.style.width = metas[i]; })));
}
