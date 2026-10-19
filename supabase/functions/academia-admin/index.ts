// =====================================================================
//  ACADEMIA DEL BUEN CAFÉ · Función "academia-admin"
//  Solo la puede usar el administrador (Gustavo).
//
//  Acciones (se mandan en el body como { accion: "...", ...datos }):
//    crear_empleado      → da de alta usuario + PIN
//    importar_empleados  → alta en lote (genera PINs si no se dan)
//    cambiar_pin         → nuevo PIN para un empleado
//    actualizar_empleado → cambia nombre/área/sede/turno o lo activa/desactiva
//    listar_colecciones  → colecciones (cursos) de tu biblioteca Bunny
//    listar_videos       → videos de Bunny (opcional: de una colección)
//
//  Secretos que necesita (Edge Functions → Secrets):
//    BUNNY_LIBRARY_ID, BUNNY_API_KEY
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const DOMINIO = "academia.mozzafiato.app"; // correo interno: usuario@DOMINIO (nunca se envía nada)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function llaveSecreta(): string {
  try {
    const dict = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const v = Object.values(dict)[0];
    if (typeof v === "string" && v) return v;
  } catch (_) { /* usa la llave clásica */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const USUARIO_OK = /^[a-z0-9][a-z0-9._-]{2,29}$/;

function pinValido(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "El PIN debe tener 6 dígitos";
  if (/^(\d)\1{5}$/.test(pin)) return "El PIN no puede ser el mismo número repetido";
  if ("0123456789".includes(pin) || "9876543210".includes(pin)) return "El PIN no puede ser una escalera (123456)";
  return null;
}

function pinAleatorio(): string {
  while (true) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const pin = n.toString().padStart(6, "0");
    if (!pinValido(pin)) return pin;
  }
}

function normalizarUsuario(u: string): string {
  return u.normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase().trim().replace(/\s+/g, ".");
}

const correoDe = (usuario: string) => `${usuario}@${DOMINIO}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, llaveSecreta(), { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. ¿Quién llama? Debe ser un admin activo.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien, error: errQuien } = await admin.auth.getUser(jwt);
  if (errQuien || !quien?.user) return json({ error: "Sesión no válida" }, 401);
  const { data: perfilAdmin } = await admin.from("academia_perfiles")
    .select("rol, activo").eq("user_id", quien.user.id).maybeSingle();
  if (!perfilAdmin || perfilAdmin.rol !== "admin" || !perfilAdmin.activo) {
    return json({ error: "Solo el administrador puede hacer esto" }, 403);
  }

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Body inválido" }, 400); }

  // ---------------------------------------------------------------
  async function crearUno(e: Record<string, any>) {
    const usuario = normalizarUsuario(String(e.usuario ?? ""));
    const nombre = String(e.nombre ?? "").trim();
    if (!USUARIO_OK.test(usuario)) {
      return { ok: false, usuario, error: "Usuario inválido (3-30 letras, números, punto o guion)" };
    }
    if (!nombre) return { ok: false, usuario, error: "Falta el nombre" };
    const pin = e.pin ? String(e.pin) : pinAleatorio();
    const errPin = pinValido(pin);
    if (errPin) return { ok: false, usuario, error: errPin };

    const { data: existe } = await admin.from("academia_perfiles")
      .select("user_id").eq("usuario", usuario).maybeSingle();
    if (existe) return { ok: false, usuario, error: "Ese usuario ya existe" };

    const { data: creado, error } = await admin.auth.admin.createUser({
      email: correoDe(usuario),
      password: pin,
      email_confirm: true,
      user_metadata: { usuario, nombre, app: "academia" },
    });
    if (error || !creado?.user) return { ok: false, usuario, error: error?.message ?? "No se pudo crear" };

    const { error: errPerfil } = await admin.from("academia_perfiles").insert({
      user_id: creado.user.id,
      usuario,
      nombre,
      area: e.area ?? null,
      sede: e.sede ?? null,
      turno: e.turno ?? null,
      gestor_id: e.gestor_id != null ? String(e.gestor_id) : null,
      rol: "empleado",
    });
    if (errPerfil) {
      await admin.auth.admin.deleteUser(creado.user.id); // no dejar cuentas a medias
      return { ok: false, usuario, error: errPerfil.message };
    }
    return { ok: true, usuario, nombre, pin, user_id: creado.user.id };
  }

  async function bunny(path: string) {
    const lib = Deno.env.get("BUNNY_LIBRARY_ID");
    const key = Deno.env.get("BUNNY_API_KEY");
    if (!lib || !key) throw new Error("Faltan los secretos BUNNY_LIBRARY_ID / BUNNY_API_KEY");
    const r = await fetch(`https://video.bunnycdn.com/library/${lib}${path}`, {
      headers: { AccessKey: key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Bunny respondió ${r.status}`);
    return await r.json();
  }

  // ---------------------------------------------------------------
  try {
    switch (body.accion) {
      case "crear_empleado": {
        const r = await crearUno(body);
        return json(r, r.ok ? 200 : 400);
      }

      case "importar_empleados": {
        const lista: Record<string, any>[] = Array.isArray(body.empleados) ? body.empleados : [];
        if (lista.length === 0) return json({ error: "Lista vacía" }, 400);
        if (lista.length > 100) return json({ error: "Máximo 100 por vez" }, 400);
        const resultados = [];
        for (const e of lista) resultados.push(await crearUno(e)); // uno por uno (límites de Auth)
        return json({
          creados: resultados.filter((r) => r.ok).length,
          con_error: resultados.filter((r) => !r.ok).length,
          resultados,
        });
      }

      case "cambiar_pin": {
        const pin = body.pin ? String(body.pin) : pinAleatorio();
        const errPin = pinValido(pin);
        if (errPin) return json({ error: errPin }, 400);
        const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { password: pin });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, pin });
      }

      case "actualizar_empleado": {
        const cambios: Record<string, unknown> = {};
        for (const k of ["nombre", "area", "sede", "turno", "gestor_id"]) {
          if (k in body) cambios[k] = body[k];
        }
        if (typeof body.activo === "boolean") {
          cambios.activo = body.activo;
          // Desactivado = no puede iniciar sesión (sus avances se conservan).
          await admin.auth.admin.updateUserById(String(body.user_id), {
            ban_duration: body.activo ? "none" : "876000h",
          });
        }
        const { error } = await admin.from("academia_perfiles").update(cambios)
          .eq("user_id", String(body.user_id)).eq("rol", "empleado");
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "listar_colecciones": {
        const d = await bunny(`/collections?page=1&itemsPerPage=100&orderBy=date`);
        return json((d.items ?? []).map((c: any) => ({
          id: c.guid, nombre: c.name, videos: c.videoCount,
        })));
      }

      case "listar_videos": {
        const col = body.coleccion ? `&collection=${encodeURIComponent(body.coleccion)}` : "";
        const items: any[] = [];
        for (let page = 1; page <= 20; page++) {
          const d = await bunny(`/videos?page=${page}&itemsPerPage=100&orderBy=title${col}`);
          items.push(...(d.items ?? []));
          if (items.length >= (d.totalItems ?? 0) || (d.items ?? []).length === 0) break;
        }
        return json(items.map((v) => ({
          id: v.guid,
          titulo: v.title,
          duracion_seg: v.length,
          coleccion: v.collectionId || null,
          listo: v.status === 4, // 4 = procesado y listo para ver
          miniatura: v.thumbnailFileName ?? null,
        })));
      }

      default:
        return json({ error: "Acción desconocida" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
