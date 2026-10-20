// =====================================================================
//  CERTIFICADO DE FINALIZACIÓN · imagen con el logo de Mozzafiato
// =====================================================================
import { icono, esc, modal, aviso, duracion } from "./ui.js";

const W = 2000, H = 1414; // proporción A4 horizontal
const C = { fondo: "#F7EFE3", fondo2: "#EFE3D2", espresso: "#2B1A14", cafe: "#5A3E31", cobre: "#B8703C", oro: "#C99A45", tenue: "#8A7262" };

function cargarImagen(src) {
  return new Promise((ok, falla) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falla; i.src = src; });
}

// El logo es blanco: se pinta en color espresso para el fondo crema.
async function logoTenido(color) {
  const img = await cargarImagen("img/logo.png");
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

export function folio(userKey, cursoId) {
  let h = 2166136261;
  for (const ch of `${userKey}|${cursoId}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const t = h.toString(36).toUpperCase().padStart(7, "0");
  return `MZ-${t.slice(0, 3)}-${t.slice(3, 7)}`;
}

function ajustarTexto(x, texto, maxAncho, tamano, fuente, minimo = 40) {
  let t = tamano;
  do { x.font = fuente.replace("{t}", t); t -= 4; } while (x.measureText(texto).width > maxAncho && t > minimo);
  return x.font;
}

function partirLineas(x, texto, maxAncho) {
  const palabras = String(texto).split(/\s+/), lineas = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? actual + " " + p : p;
    if (x.measureText(prueba).width > maxAncho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function dibujarCertificado({ nombre, curso, fecha, segundos, puntaje, codigo }) {
  try {
    await Promise.all([
      document.fonts.load('600 96px "Cormorant Garamond"'), document.fonts.load('italic 600 96px "Cormorant Garamond"'),
      document.fonts.load('500 30px "Manrope"'), document.fonts.load('700 30px "Manrope"'),
    ]);
  } catch (_) { /* usa fuentes del sistema */ }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const serif = '"Cormorant Garamond", Georgia, serif', sans = '"Manrope", system-ui, sans-serif';

  // Fondo y marcos
  const g = x.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, C.fondo); g.addColorStop(1, C.fondo2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = C.cobre; x.lineWidth = 10; x.strokeRect(46, 46, W - 92, H - 92);
  x.strokeStyle = C.oro; x.lineWidth = 2; x.strokeRect(70, 70, W - 140, H - 140);
  // Esquinas
  x.fillStyle = C.cobre;
  for (const [cx, cy] of [[70, 70], [W - 70, 70], [70, H - 70], [W - 70, H - 70]]) {
    x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillRect(-11, -11, 22, 22); x.restore();
  }

  x.textAlign = "center"; x.textBaseline = "alphabetic";
  // Logo
  try {
    const logo = await logoTenido(C.espresso);
    const lw = 460, lh = lw * (logo.height / logo.width);
    x.drawImage(logo, (W - lw) / 2, 120, lw, lh);
  } catch (_) {
    x.fillStyle = C.espresso; x.font = `600 80px ${serif}`; x.fillText("MOZZAFIATO", W / 2, 260);
  }

  x.fillStyle = C.cobre; x.font = `700 26px ${sans}`;
  if ("letterSpacing" in x) x.letterSpacing = "10px";
  x.fillText("ACADEMIA DEL BUEN CAFÉ", W / 2, 420);
  if ("letterSpacing" in x) x.letterSpacing = "0px";

  x.fillStyle = C.espresso; x.font = `600 104px ${serif}`;
  x.fillText("Certificado de finalización", W / 2, 540);

  x.fillStyle = C.cafe; x.font = `500 32px ${sans}`;
  x.fillText("Se otorga con orgullo a", W / 2, 625);

  x.fillStyle = C.espresso;
  ajustarTexto(x, nombre, 1500, 128, `italic 600 {t}px ${serif}`);
  x.fillText(nombre, W / 2, 770);
  x.strokeStyle = C.oro; x.lineWidth = 3;
  x.beginPath(); x.moveTo(W / 2 - 520, 805); x.lineTo(W / 2 + 520, 805); x.stroke();

  x.fillStyle = C.cafe; x.font = `500 32px ${sans}`;
  x.fillText("por completar con éxito el curso", W / 2, 875);

  x.fillStyle = C.espresso; x.font = `700 72px ${serif}`;
  const lineas = partirLineas(x, curso, 1500).slice(0, 2);
  lineas.forEach((l, i) => x.fillText(l, W / 2, 965 + i * 78));
  const yDet = 965 + (lineas.length - 1) * 78 + 70;
  const detalles = [segundos ? `${duracion(segundos)} de formación` : null, puntaje ? `Quiz final: ${puntaje}%` : null].filter(Boolean).join("   ·   ");
  if (detalles) { x.fillStyle = C.tenue; x.font = `500 28px ${sans}`; x.fillText(detalles, W / 2, yDet); }

  // Pie: fecha · sello · firma
  const yPie = H - 190;
  x.strokeStyle = C.cafe; x.lineWidth = 2;
  x.beginPath(); x.moveTo(250, yPie); x.lineTo(700, yPie); x.stroke();
  x.beginPath(); x.moveTo(W - 700, yPie); x.lineTo(W - 250, yPie); x.stroke();
  x.fillStyle = C.espresso; x.font = `600 30px ${sans}`;
  x.fillText(fecha, 475, yPie - 18);
  x.fillText("Gustavo", W - 475, yPie - 18);
  x.fillStyle = C.tenue; x.font = `500 24px ${sans}`;
  x.fillText("Felipe Carrillo Puerto, Q. Roo", 475, yPie + 40);
  x.fillText("Mozzafiato · El placer del buen café", W - 475, yPie + 40);

  // Sello
  const sx = W / 2, sy = yPie - 20;
  x.fillStyle = C.cobre; x.beginPath(); x.arc(sx, sy, 92, 0, Math.PI * 2); x.fill();
  x.strokeStyle = C.fondo; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, 78, 0, Math.PI * 2); x.stroke();
  x.fillStyle = C.fondo; x.font = `700 20px ${sans}`;
  if ("letterSpacing" in x) x.letterSpacing = "4px";
  x.fillText("ACADEMIA", sx, sy - 18);
  if ("letterSpacing" in x) x.letterSpacing = "0px";
  x.font = `600 44px ${serif}`; x.fillText("★", sx, sy + 26);
  x.font = `700 18px ${sans}`; x.fillText(String(new Date().getFullYear()), sx, sy + 56);

  x.fillStyle = C.tenue; x.font = `500 20px ${sans}`;
  x.fillText(`Folio ${codigo}`, W / 2, H - 92);
  return c;
}

export async function mostrarCertificado(datosCert) {
  const p = modal(`
    <h2 class="modal-titulo">Tu certificado</h2>
    <div id="cert-prev" class="cargando" style="min-height:180px"><div class="taza-carga"></div></div>
    <div class="fila-botones">
      <button class="btn btn-sec" id="cert-desc" disabled>${icono("file", 18)}Descargar</button>
      <button class="btn" id="cert-comp" disabled>Compartir</button>
    </div>
    <button class="btn btn-sec btn-bloque" data-cerrar>Cerrar</button>`, { clase: "modal-ancho" });
  const capa = modal.actual;
  try {
    const canvas = await dibujarCertificado(datosCert);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    const url = URL.createObjectURL(blob);
    const nombreArchivo = `Certificado ${datosCert.curso} - ${datosCert.nombre}.png`.replace(/[\\/:*?"<>|]+/g, "");
    const prev = capa.querySelector("#cert-prev");
    prev.className = "";
    prev.innerHTML = `<img src="${url}" alt="Certificado de ${esc(datosCert.nombre)}" style="width:100%;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.4)">`;
    const desc = capa.querySelector("#cert-desc"), comp = capa.querySelector("#cert-comp");
    desc.disabled = false; comp.disabled = false;
    desc.onclick = () => { const a = document.createElement("a"); a.href = url; a.download = nombreArchivo; document.body.appendChild(a); a.click(); a.remove(); };
    const archivo = new File([blob], nombreArchivo, { type: "image/png" });
    if (navigator.canShare?.({ files: [archivo] })) {
      comp.onclick = () => navigator.share({ files: [archivo], title: "Mi certificado · Academia del Buen Café" }).catch(() => {});
    } else {
      comp.textContent = "Abrir en grande";
      comp.onclick = () => window.open(url, "_blank");
    }
    p.then(() => setTimeout(() => URL.revokeObjectURL(url), 60000));
  } catch (e) {
    console.error(e);
    capa.querySelector("#cert-prev").innerHTML = `<p class="error-form">No se pudo generar: ${esc(e.message)}</p>`;
    aviso("No se pudo generar el certificado", "error");
  }
  return p;
}
