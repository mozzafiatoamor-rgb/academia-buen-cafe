// =====================================================================
//  VISOR DE MATERIALES DE SOLO LECTURA
//  Muestra PDFs e imágenes dentro de la app, sin descarga y con marca de
//  agua (nombre del empleado + fecha) para desanimar que se compartan.
// =====================================================================
import { icono, esc, modal } from "./ui.js";

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let cargaPdf = null;
function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!cargaPdf) {
    cargaPdf = new Promise((ok, falla) => {
      const s = document.createElement("script");
      s.src = PDFJS;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
      s.onerror = () => { cargaPdf = null; falla(new Error("No se pudo cargar el visor. Revisa tu conexión.")); };
      document.head.appendChild(s);
    });
  }
  return cargaPdf;
}

function marcaDeAgua(ctx, ancho, alto, texto) {
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = "#5A3E31";
  const tam = Math.max(14, Math.round(ancho / 34));
  ctx.font = `700 ${tam}px Nunito, system-ui, sans-serif`;
  ctx.translate(ancho / 2, alto / 2);
  ctx.rotate(-Math.PI / 6);
  const paso = tam * 7;
  for (let y = -alto; y < alto; y += paso) {
    for (let x = -ancho; x < ancho; x += ctx.measureText(texto).width + tam * 3) ctx.fillText(texto, x, y);
  }
  ctx.restore();
}

// Todo se pinta en <canvas>: no hay <img> ni enlace que se pueda guardar con un toque.
export async function abrirVisor({ titulo, url, tipo, marca }) {
  const p = modal(`
    <div class="fila-entre"><h2 class="modal-titulo" style="font-size:22px">${esc(titulo)}</h2>
      <button class="btn-icono" data-cerrar aria-label="Cerrar">${icono("x")}</button></div>
    <p class="texto-tenue" style="margin:0;font-size:12px">${icono("lock", 12)} Solo lectura · material de uso interno de Mozzafiato</p>
    <div id="visor" class="pila" style="gap:10px;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none">
      <div class="cargando" style="min-height:200px"><div class="taza-carga"></div></div>
    </div>`, { clase: "modal-ancho visor-material" });
  const capa = modal.actual;
  const caja = capa.querySelector("#visor");
  capa.addEventListener("contextmenu", (e) => e.preventDefault());
  capa.addEventListener("dragstart", (e) => e.preventDefault());
  const ancho = Math.min(1400, Math.round((caja.clientWidth || 600) * (window.devicePixelRatio || 1)));
  try {
    if (tipo === "pdf") {
      const pdfjs = await cargarPdfJs();
      const doc = await pdfjs.getDocument({ url }).promise;
      caja.innerHTML = "";
      for (let n = 1; n <= doc.numPages; n++) {
        if (!document.body.contains(capa)) break; // se cerró
        const pagina = await doc.getPage(n);
        const base = pagina.getViewport({ scale: 1 });
        const vista = pagina.getViewport({ scale: ancho / base.width });
        const c = document.createElement("canvas");
        c.width = vista.width; c.height = vista.height;
        c.style.cssText = "width:100%;height:auto;border-radius:8px;background:#fff";
        caja.appendChild(c);
        const ctx = c.getContext("2d");
        await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
        marcaDeAgua(ctx, c.width, c.height, marca);
      }
      doc.destroy?.();
    } else {
      const img = await new Promise((ok, falla) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => falla(new Error("No se pudo abrir la imagen")); i.src = url; });
      const esc2 = Math.min(1, ancho / img.naturalWidth) || 1;
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * esc2); c.height = Math.round(img.naturalHeight * esc2);
      c.style.cssText = "width:100%;height:auto;border-radius:8px";
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      marcaDeAgua(ctx, c.width, c.height, marca);
      caja.innerHTML = ""; caja.appendChild(c);
    }
  } catch (e) {
    console.error(e);
    caja.innerHTML = `<div class="vacio"><strong>No se pudo abrir</strong>${esc(e.message || "Intenta de nuevo")}</div>`;
  }
  return p;
}
