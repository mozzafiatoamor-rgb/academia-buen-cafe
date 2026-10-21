// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · Función "academia-audio"
//  Entrega el link firmado de un audiolibro guardado en Bunny Storage,
//  solo si la persona lo tiene asignado (o es admin). El link caduca en
//  6 horas: aunque alguien lo copie, deja de funcionar.
//
//  Acciones (body):
//    { accion: "url", audiolibro_id }  → link firmado para escuchar
//    { accion: "url_ruta", ruta }      → (admin) link firmado de un archivo
//    { accion: "listar", carpeta }     → (admin) archivos de audio en Storage
//
//  Secretos que necesita (Edge Functions → Secrets):
//    BUNNY_STORAGE_ZONE      nombre de la Storage Zone (ej. academia-audio)
//    BUNNY_STORAGE_KEY       "Password" de la Storage Zone (FTP & API Access)
//    BUNNY_STORAGE_HOST      opcional, según la región (por defecto storage.bunnycdn.com)
//    BUNNY_AUDIO_HOST        hostname de la Pull Zone (ej. academia-audio.b-cdn.net)
//    BUNNY_AUDIO_TOKEN_KEY   "Url Token Authentication Key" de esa Pull Zone
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const VIGENCIA_SEG = 6 * 60 * 60;
const EXT_AUDIO = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac)$/i;

// Lee un secreto sin espacios ni saltos de línea (pasa mucho al copiar y pegar).
const secreto = (n: string) => (Deno.env.get(n) ?? "").trim();
// "https://algo.b-cdn.net/" → "algo.b-cdn.net"
const soloHost = (h: string) => h.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function llave(nombreDict: string, clasica: string): string {
  try {
    const dict = JSON.parse(Deno.env.get(nombreDict) ?? "{}");
    const v = Object.values(dict)[0];
    if (typeof v === "string" && v) return v;
  } catch (_) { /* usa la llave clásica */ }
  return Deno.env.get(clasica) ?? "";
}

// Ruta segura dentro de la Storage Zone: sin "..", sin barras dobles.
function limpiarRuta(r: string): string {
  return String(r || "").split("/").map((s) => s.trim()).filter((s) => s && s !== "." && s !== "..").join("/");
}
const rutaCodificada = (r: string) => "/" + limpiarRuta(r).split("/").map(encodeURIComponent).join("/");

// Token avanzado de Bunny CDN: "HS256-" + Base64URL(HMAC-SHA256(llave, ruta + expira))
async function firmar(host: string, llaveToken: string, ruta: string) {
  const path = rutaCodificada(ruta);
  const expira = Math.floor(Date.now() / 1000) + VIGENCIA_SEG;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(llaveToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(path + expira)));
  const b64 = btoa(String.fromCharCode(...firma)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { url: `https://${host}${path}?token=HS256-${b64}&expires=${expira}`, expira };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try { return await atender(req); }
  catch (e) {
    console.error(e);
    return json({ error: `Error en academia-audio: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});

async function atender(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const host = soloHost(secreto("BUNNY_AUDIO_HOST"));
  const llaveToken = secreto("BUNNY_AUDIO_TOKEN_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "Sesión no válida" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  // Cliente con la sesión de quien llama: las funciones de la base deciden si puede escuchar.
  const sb = createClient(url, llave("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const servicio = createClient(url, llave("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const accion = String(body.accion ?? "url");

  const esAdmin = async () => {
    const { data, error } = await sb.rpc("academia_es_admin");
    return !error && data === true;
  };

  if (accion === "url") {
    if (!host || !llaveToken) return json({ error: "Faltan secretos de Bunny para audio" }, 500);
    const id = String(body.audiolibro_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "audiolibro_id inválido" }, 400);
    const { data: puede, error } = await sb.rpc("academia_puede_oir", { p_libro: id });
    if (error) return json({ error: "Sesión no válida" }, 401);
    if (!puede) return json({ error: "Este audiolibro no está asignado a ti" }, 403);
    const { data: libro } = await servicio.from("academia_audiolibros").select("archivo, titulo, duracion_seg").eq("id", id).maybeSingle();
    if (!libro?.archivo) return json({ error: "Audiolibro no disponible" }, 404);
    const f = await firmar(host, llaveToken, libro.archivo);
    return json({ ...f, titulo: libro.titulo, duracion_seg: libro.duracion_seg });
  }

  // Lo de abajo es solo para el admin.
  if (!(await esAdmin())) return json({ error: "Solo el administrador" }, 403);

  if (accion === "url_ruta") {
    if (!host || !llaveToken) return json({ error: "Faltan secretos de Bunny para audio" }, 500);
    const ruta = limpiarRuta(String(body.ruta ?? ""));
    if (!ruta) return json({ error: "Ruta vacía" }, 400);
    return json(await firmar(host, llaveToken, ruta));
  }

  if (accion === "diagnostico") {
    return json({
      BUNNY_STORAGE_ZONE: secreto("BUNNY_STORAGE_ZONE") || "(falta)",
      BUNNY_STORAGE_KEY: secreto("BUNNY_STORAGE_KEY") ? `ok (${secreto("BUNNY_STORAGE_KEY").length} caracteres)` : "(falta)",
      BUNNY_STORAGE_HOST: soloHost(secreto("BUNNY_STORAGE_HOST")) || "storage.bunnycdn.com (por defecto)",
      BUNNY_AUDIO_HOST: host || "(falta)",
      BUNNY_AUDIO_TOKEN_KEY: llaveToken ? `ok (${llaveToken.length} caracteres)` : "(falta)",
    });
  }

  if (accion === "listar") {
    const zona = secreto("BUNNY_STORAGE_ZONE");
    const clave = secreto("BUNNY_STORAGE_KEY");
    const hostSt = soloHost(secreto("BUNNY_STORAGE_HOST")) || "storage.bunnycdn.com";
    if (!zona || !clave) return json({ error: "Faltan secretos de Bunny Storage (BUNNY_STORAGE_ZONE o BUNNY_STORAGE_KEY)" }, 500);
    const carpeta = limpiarRuta(String(body.carpeta ?? ""));
    let r: Response;
    try {
      r = await fetch(`https://${hostSt}/${encodeURIComponent(zona)}/${carpeta ? carpeta.split("/").map(encodeURIComponent).join("/") + "/" : ""}`, {
        headers: { AccessKey: clave, Accept: "application/json" },
      });
    } catch (e) {
      return json({ error: `No se pudo conectar con ${hostSt}. Revisa BUNNY_STORAGE_HOST (debe ser como ny.storage.bunnycdn.com, sin https://). Detalle: ${e instanceof Error ? e.message : e}` }, 502);
    }
    if (!r.ok) return json({ error: `Bunny Storage respondió ${r.status}. Revisa el nombre de la zona, la contraseña y la región.` }, 502);
    const lista = (await r.json()) as Array<{ ObjectName: string; IsDirectory: boolean; Length: number; LastChanged: string }>;
    const items = lista
      .filter((x) => x.IsDirectory || EXT_AUDIO.test(x.ObjectName))
      .map((x) => ({ nombre: x.ObjectName, carpeta: x.IsDirectory, bytes: x.Length, cambiado: x.LastChanged,
                     ruta: (carpeta ? carpeta + "/" : "") + x.ObjectName }))
      .sort((a, b) => Number(b.carpeta) - Number(a.carpeta) || a.nombre.localeCompare(b.nombre));
    return json({ carpeta, items });
  }

  return json({ error: "Acción desconocida" }, 400);
}
