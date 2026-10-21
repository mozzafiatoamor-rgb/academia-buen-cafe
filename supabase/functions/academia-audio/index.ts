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
//    { accion: "credencial_subida" }   → (admin) datos para subir directo desde su navegador
//    POST ?accion=subir&ruta=…  (cuerpo = archivo) → (admin) sube pasando por aquí (respaldo)
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
// Bunny acepta varias formas de firmar el link; probamos cuál acepta tu Pull Zone
// y la recordamos. Se puede fijar con el secreto BUNNY_AUDIO_TOKEN_TIPO (hs256 | sha256 | md5).
type Tipo = "hs256" | "sha256" | "md5";
const TIPOS: Tipo[] = ["sha256", "hs256", "md5"];
let tipoElegido: Tipo | null = null;
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function firmarCon(tipo: Tipo, host: string, llaveToken: string, ruta: string) {
  const path = rutaCodificada(ruta);
  const expira = Math.floor(Date.now() / 1000) + VIGENCIA_SEG;
  const enc = new TextEncoder();
  let token = "";
  if (tipo === "hs256") {
    const k = await crypto.subtle.importKey("raw", enc.encode(llaveToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    token = "HS256-" + b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(path + expira))));
  } else if (tipo === "sha256") {
    token = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(llaveToken + path + expira))));
  } else {
    token = b64url(md5(enc.encode(llaveToken + path + expira)));
  }
  return { url: `https://${host}${path}?token=${token}&expires=${expira}`, expira };
}

// MD5 (para la firma "básica" de Bunny; WebCrypto no lo trae).
function md5(datos: Uint8Array): Uint8Array {
  const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const largo = datos.length, n = (((largo + 8) >>> 6) + 1) * 64, m = new Uint8Array(n);
  m.set(datos); m[largo] = 0x80;
  const v = new DataView(m.buffer);
  v.setUint32(n - 8, (largo * 8) >>> 0, true); v.setUint32(n - 4, Math.floor(largo / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < n; off += 64) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + v.getUint32(off + g * 4, true)) >>> 0;
      A = D; D = C; C = B;
      const r = S[(i >> 4) * 4 + (i % 4)];
      B = (B + ((F << r) | (F >>> (32 - r)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16), o = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((x, i) => o.setUint32(i * 4, x, true));
  return out;
}

async function estadoUrl(url: string): Promise<number> {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1" } });
    try { await r.body?.cancel(); } catch (_) { /* nada */ }
    return r.status;
  } catch (_) { return 0; }
}

// Prueba las formas de firma con un archivo real. Devuelve la que funciona y el detalle.
async function probarFirmas(host: string, llaveToken: string, ruta: string) {
  const detalle: Record<string, number> = {};
  for (const t of TIPOS) {
    const st = await estadoUrl((await firmarCon(t, host, llaveToken, ruta)).url);
    detalle[t] = st;
    if (st === 200 || st === 206) return { tipo: t, detalle };
  }
  return { tipo: null as Tipo | null, detalle };
}

async function firmar(host: string, llaveToken: string, ruta: string) {
  const fijo = secreto("BUNNY_AUDIO_TOKEN_TIPO").toLowerCase() as Tipo;
  if (TIPOS.includes(fijo)) return firmarCon(fijo, host, llaveToken, ruta);
  if (!tipoElegido) {
    const r = await probarFirmas(host, llaveToken, ruta);
    if (!r.tipo) {
      const st = Object.values(r.detalle);
      const motivo = st.every((x) => x === 404) ? "el archivo no está en la Pull Zone (revisa que la Pull Zone apunte a tu Storage Zone)"
        : st.every((x) => x === 403 || x === 401) ? "Bunny rechazó la firma (revisa BUNNY_AUDIO_TOKEN_KEY: debe ser la de la Pull Zone de audio)"
        : st.every((x) => x === 0) ? `no se pudo conectar con ${host} (revisa BUNNY_AUDIO_HOST)`
        : `Bunny respondió ${JSON.stringify(r.detalle)}`;
      throw new Error(`No se pudo preparar el audio: ${motivo}.`);
    }
    tipoElegido = r.tipo;
  }
  return firmarCon(tipoElegido, host, llaveToken, ruta);
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

  const consulta = new URL(req.url).searchParams;
  let body: Record<string, unknown> = {};
  if (consulta.get("accion") !== "subir") { try { body = await req.json(); } catch { /* vacío */ } }
  const accion = String(consulta.get("accion") ?? body.accion ?? "url");

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
    let { data: libro, error: errLibro } = await servicio.from("academia_audiolibros").select("archivo, archivos, titulo, duracion_seg").eq("id", id).maybeSingle();
    if (errLibro) ({ data: libro } = await servicio.from("academia_audiolibros").select("archivo, titulo, duracion_seg").eq("id", id).maybeSingle()); // sin paso 6
    if (!libro?.archivo) return json({ error: "Audiolibro no disponible" }, 404);
    const f = await firmar(host, llaveToken, libro.archivo);
    // Libro en varios archivos (uno por capítulo): un link firmado por archivo.
    const lista = Array.isArray(libro.archivos) ? libro.archivos : [];
    const pistas = [];
    for (const a of lista) {
      if (!a?.ruta) continue;
      pistas.push({ url: (await firmar(host, llaveToken, String(a.ruta))).url, dur: Number(a.dur) || 0, titulo: a.titulo ?? null });
    }
    return json({ ...f, pistas, titulo: libro.titulo, duracion_seg: libro.duracion_seg });
  }

  // Lo de abajo es solo para el admin.
  if (!(await esAdmin())) return json({ error: "Solo el administrador" }, 403);

  if (accion === "url_ruta") {
    if (!host || !llaveToken) return json({ error: "Faltan secretos de Bunny para audio" }, 500);
    const ruta = limpiarRuta(String(body.ruta ?? ""));
    if (!ruta) return json({ error: "Ruta vacía" }, 400);
    return json(await firmar(host, llaveToken, ruta));
  }

  // Prueba completa de un archivo: ¿existe en Storage? ¿qué firma acepta la Pull Zone?
  if (accion === "probar") {
    if (!host || !llaveToken) return json({ error: "Faltan BUNNY_AUDIO_HOST o BUNNY_AUDIO_TOKEN_KEY" }, 500);
    const ruta = limpiarRuta(String(body.ruta ?? ""));
    if (!ruta) return json({ error: "Ruta vacía" }, 400);
    let enStorage = 0;
    const z = secreto("BUNNY_STORAGE_ZONE"), c = secreto("BUNNY_STORAGE_KEY"), hs = soloHost(secreto("BUNNY_STORAGE_HOST")) || "storage.bunnycdn.com";
    if (z && c) {
      try { const r = await fetch(`https://${hs}/${encodeURIComponent(z)}${rutaCodificada(ruta)}`, { headers: { AccessKey: c, Range: "bytes=0-1" } }); enStorage = r.status; try { await r.body?.cancel(); } catch (_) { /* nada */ } } catch (_) { enStorage = 0; }
    }
    const sinFirma = await estadoUrl(`https://${host}${rutaCodificada(ruta)}`);
    const r = await probarFirmas(host, llaveToken, ruta);
    if (r.tipo) tipoElegido = r.tipo;
    const huella = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : "(muy corta)") + ` · ${k.length} caracteres`;
    return json({ ruta, host, llave: huella(llaveToken), storage: enStorage, cdn_sin_firma: sinFirma, firmas: r.detalle, funciona: r.tipo });
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

  const zonaSt = secreto("BUNNY_STORAGE_ZONE");
  const claveSt = secreto("BUNNY_STORAGE_KEY");
  const hostStorage = soloHost(secreto("BUNNY_STORAGE_HOST")) || "storage.bunnycdn.com";

  // Solo el navegador del admin recibe estos datos (nunca los empleados).
  if (accion === "credencial_subida") {
    if (!zonaSt || !claveSt) return json({ error: "Faltan secretos de Bunny Storage" }, 500);
    return json({ host: hostStorage, zona: zonaSt, clave: claveSt });
  }

  // Respaldo: el archivo pasa por aquí (para archivos medianos si la subida directa falla).
  if (accion === "subir") {
    if (!zonaSt || !claveSt) return json({ error: "Faltan secretos de Bunny Storage" }, 500);
    const ruta = limpiarRuta(consulta.get("ruta") ?? "");
    if (!ruta || !EXT_AUDIO.test(ruta)) return json({ error: "Ruta de audio inválida" }, 400);
    const datosArchivo = await req.arrayBuffer();
    const r = await fetch(`https://${hostStorage}/${encodeURIComponent(zonaSt)}${rutaCodificada(ruta)}`, {
      method: "PUT", headers: { AccessKey: claveSt, "Content-Type": "application/octet-stream" }, body: datosArchivo,
    });
    if (!r.ok) return json({ error: `Bunny Storage respondió ${r.status} al subir` }, 502);
    return json({ ok: true, ruta });
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
