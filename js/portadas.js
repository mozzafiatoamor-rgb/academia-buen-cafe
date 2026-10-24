// =====================================================================
//  PORTADAS · elegir una imagen (compu o cel), recortarla al centro,
//  achicarla y subirla. Cursos en 16:9, audiolibros en cuadrado.
// =====================================================================
import { datos } from "./datos.js";
import { aviso } from "./ui.js";

const MEDIDAS = { curso: [1280, 720], audio: [800, 800], premio: [900, 675] };
const CARPETA = { curso: "cursos", audio: "audiolibros", premio: "premios" };

function elegirImagen() {
  return new Promise((ok) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.style.display = "none";
    inp.onchange = () => { ok(inp.files?.[0] || null); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
  });
}

function leerImagen(archivo) {
  return new Promise((ok, falla) => {
    const url = URL.createObjectURL(archivo), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); falla(new Error("Esa imagen no se pudo abrir. Prueba con JPG o PNG.")); };
    img.src = url;
  });
}

// Recorta al centro con la proporción pedida y la deja ligera (WebP, o JPG si no hay WebP).
async function prepararImagen(archivo, [w, h]) {
  const img = await leerImagen(archivo);
  const prop = w / h, propImg = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (propImg > prop) { sw = Math.round(sh * prop); sx = Math.round((img.naturalWidth - sw) / 2); }
  else { sh = Math.round(sw / prop); sy = Math.round((img.naturalHeight - sh) / 2); }
  const escala = Math.min(1, w / sw);
  const c = document.createElement("canvas");
  c.width = Math.round(sw * escala); c.height = Math.round(sh * escala);
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.82));
  if (blob && blob.type === "image/webp") return { blob, ext: "webp" };
  return { blob: await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85)), ext: "jpg" };
}

// tipo: "curso" | "audio". Devuelve la URL pública nueva (o null si canceló).
export async function cambiarPortada(tipo, id) {
  const archivo = await elegirImagen();
  if (!archivo) return null;
  if (!/^image\//.test(archivo.type) && !/\.(jpe?g|png|webp|heic|gif)$/i.test(archivo.name)) { aviso("Elige una imagen (JPG, PNG o WebP)", "error"); return null; }
  aviso(tipo === "premio" ? "Subiendo foto…" : "Subiendo portada…");
  try {
    const { blob, ext } = await prepararImagen(archivo, MEDIDAS[tipo] || MEDIDAS.audio);
    const url = await datos.subirPortada(blob, `${CARPETA[tipo] || "otros"}/${id}.${ext}`);
    if (tipo === "curso") await datos.guardarCurso({ id, portada_url: url });
    else if (tipo === "premio") await datos.guardarPremio({ id, imagen_url: url });
    else await datos.guardarAudiolibro({ id, portada_url: url });
    aviso(tipo === "premio" ? "Foto lista" : "Portada lista", "ok");
    return url;
  } catch (e) {
    console.error(e);
    aviso(/bucket|not found|Bucket/i.test(e.message) ? "Falta correr el paso 7 de SQL (portadas) en Supabase" : e.message, "error");
    return null;
  }
}

export async function quitarPortada(tipo, id) {
  try {
    if (tipo === "curso") await datos.guardarCurso({ id, portada_url: null });
    else if (tipo === "premio") await datos.guardarPremio({ id, imagen_url: null });
    else await datos.guardarAudiolibro({ id, portada_url: null });
    aviso("Portada quitada", "ok");
    return true;
  } catch (e) { aviso(e.message, "error"); return false; }
}
