// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · Función "academia-video"
//  Entrega el link firmado del video de una lección, solo si la persona
//  tiene ese curso asignado. El link caduca en 6 horas: aunque alguien lo
//  copie y lo comparta, deja de funcionar.
//
//  Body: { leccion_id: "<uuid>" }
//  Secretos que necesita (Edge Functions → Secrets):
//    BUNNY_LIBRARY_ID, BUNNY_TOKEN_KEY  (la "Token authentication key" de Bunny)
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const VIGENCIA_SEG = 6 * 60 * 60;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function llavePublica(): string {
  try {
    const dict = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const v = Object.values(dict)[0];
    if (typeof v === "string" && v) return v;
  } catch (_) { /* usa la llave clásica */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const libreria = Deno.env.get("BUNNY_LIBRARY_ID");
  const llaveToken = Deno.env.get("BUNNY_TOKEN_KEY");
  if (!libreria || !llaveToken) return json({ error: "Faltan secretos de Bunny" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "Sesión no válida" }, 401);

  // Cliente con la sesión del empleado: las reglas de seguridad (RLS) deciden
  // si puede ver la lección. Si no la tiene asignada, simplemente no aparece.
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, llavePublica(), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let leccionId = "";
  try { leccionId = String((await req.json()).leccion_id ?? ""); } catch { /* vacío */ }
  if (!/^[0-9a-f-]{36}$/i.test(leccionId)) return json({ error: "leccion_id inválido" }, 400);

  const { data: leccion, error } = await sb.from("academia_lecciones")
    .select("id, titulo, bunny_video_id, duracion_seg").eq("id", leccionId).maybeSingle();
  if (error) return json({ error: "Sesión no válida" }, 401);
  if (!leccion) return json({ error: "Lección no disponible" }, 404);
  if (!leccion.bunny_video_id) return json({ error: "Esta lección aún no tiene video" }, 409);

  const { data: avance } = await sb.from("academia_progreso")
    .select("segundo_actual, completado").eq("leccion_id", leccionId).maybeSingle();

  const expires = Math.floor(Date.now() / 1000) + VIGENCIA_SEG;
  const token = await sha256Hex(llaveToken + leccion.bunny_video_id + expires);
  const params = new URLSearchParams({
    token,
    expires: String(expires),
    autoplay: "false",
    preload: "true",
    responsive: "true",
  });

  return json({
    embed_url: `https://player.mediadelivery.net/embed/${libreria}/${leccion.bunny_video_id}?${params}`,
    expira: expires,
    titulo: leccion.titulo,
    duracion_seg: leccion.duracion_seg,
    segundo_inicio: avance?.completado ? 0 : (avance?.segundo_actual ?? 0),
  });
});
