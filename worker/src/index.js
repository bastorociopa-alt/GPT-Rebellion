const ORIGIN = "https://bastorociopa-alt.github.io";
const OWNER = "bastorociopa-alt";
const REPO = "GPT-Rebellion";
const BRANCH = "main";
const RAW = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/" + BRANCH + "/";

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin === ORIGIN || origin === "http://localhost:5500" ? origin : ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});
const json = (data, status, origin) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" }
});
const validName = (name) => /^[\p{L}\p{M}][\p{L}\p{M} '\u2019-]{1,31}$/u.test(name);

function detectImage(bytes) {
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", ext: "jpg" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
async function uploadToGitHub(env, path, bytes, message) {
  const response = await fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "GPT-Rebellion-Worker"
    },
    body: JSON.stringify({ message, content: toBase64(bytes), branch: BRANCH })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error("GitHub upload failed (" + response.status + "): " + detail.slice(0, 300));
  }
  return response.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
      if (!env.DB) return json({ error: "Falta conectar la base de datos D1." }, 503, origin);

      if (url.pathname === "/api/members" && request.method === "GET") {
        const result = await env.DB.prepare(
          "SELECT nickname, avatar_key, joined_at FROM members ORDER BY joined_at DESC LIMIT 200"
        ).all();
        return json({
          members: (result.results || []).map((member) => ({
            nickname: member.nickname,
            joinedAt: member.joined_at,
            avatarUrl: member.avatar_key ? RAW + member.avatar_key : null
          }))
        }, 200, origin);
      }

      if (url.pathname === "/api/register" && request.method === "POST") {
        if (!env.GITHUB_TOKEN) return json({ error: "El Worker todavía no tiene configurado el secreto de GitHub." }, 503, origin);
        const length = Number(request.headers.get("Content-Length") || 0);
        if (length > 2800000) return json({ error: "Solicitud demasiado grande." }, 413, origin);

        let form;
        try { form = await request.formData(); }
        catch { return json({ error: "Formulario no válido." }, 400, origin); }

        const nickname = String(form.get("nickname") || "").trim();
        if (!validName(nickname)) return json({ error: "Nombre no válido (2-32 caracteres)." }, 400, origin);
        const normalized = nickname.normalize("NFKC").toLocaleLowerCase("es");
        const exists = await env.DB.prepare(
          "SELECT 1 FROM members WHERE nickname_normalized = ?"
        ).bind(normalized).first();
        if (exists) return json({ error: "Ese nombre ya está registrado." }, 409, origin);

        let avatarPath = null;
        const avatar = form.get("avatar");
        if (avatar && avatar.size) {
          if (avatar.size > 2 * 1024 * 1024) return json({ error: "La imagen supera 2 MB." }, 413, origin);
          const bytes = new Uint8Array(await avatar.arrayBuffer());
          const image = detectImage(bytes);
          if (!image) return json({ error: "Imagen JPG, PNG o WEBP no válida." }, 400, origin);
          avatarPath = "avatars/" + crypto.randomUUID() + "." + image.ext;
          try {
            await uploadToGitHub(env, avatarPath, bytes, "Add GPT Rebellion member avatar");
          } catch (error) {
            console.error(error);
            return json({ error: "GitHub no pudo guardar la imagen. Comprueba el token y los permisos del repositorio." }, 502, origin);
          }
        }

        const joinedAt = new Date().toISOString();
        try {
          await env.DB.prepare(
            "INSERT INTO members (nickname, nickname_normalized, avatar_key, joined_at) VALUES (?, ?, ?, ?)"
          ).bind(nickname, normalized, avatarPath, joinedAt).run();
        } catch (error) {
          if (String(error).includes("UNIQUE")) return json({ error: "Ese nombre ya está registrado." }, 409, origin);
          throw error;
        }
        return json({ ok: true, joinedAt }, 201, origin);
      }

      return json({ error: "Ruta no encontrada." }, 404, origin);
    } catch (error) {
      console.error(error);
      return json({ error: "Error interno del servidor." }, 500, origin);
    }
  }
};
