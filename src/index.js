import defaultPrompt from "../SYSTEM_PROMPT.txt";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAKS_KARAKTER = 500;
const MAKS_RIWAYAT = 6;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/chat") {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Metode tidak diizinkan. Gunakan metode POST." },
          { status: 405 }
        );
      }
      return handleChat(req, env);
    }

    // Mengalihkan request aset statis ke binding ASSETS jika tersedia
    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleChat(req, env) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Format request tidak valid (wajib JSON)." },
      { status: 400 }
    );
  }

  const pesan = String(body?.pesan || "").trim().slice(0, MAKS_KARAKTER);
  if (!pesan) {
    return Response.json(
      { error: "Pesan tidak boleh kosong." },
      { status: 400 }
    );
  }

  // Riwayat percakapan untuk konteks multi-turn
  const riwayat = Array.isArray(body?.riwayat) ? body.riwayat : [];
  const pesanSebelumnya = riwayat
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-MAKS_RIWAYAT)
    .map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, MAKS_KARAKTER),
    }));

  const systemPrompt = env.SYSTEM_PROMPT || defaultPrompt;

  const messages = [
    { role: "system", content: systemPrompt },
    ...pesanSebelumnya,
    { role: "user", content: pesan },
  ];

  try {
    const stream = await env.AI.run(MODEL, {
      messages,
      max_tokens: 400,
      stream: true,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("Workers AI Error:", err?.message || err);
    const isQuotaExceeded = /429|limit|neuron/i.test(String(err?.message || ""));

    return Response.json(
      {
        error: isQuotaExceeded
          ? "Kuota harian Rafiq sedang habis. Silakan coba lagi besok, atau hubungi admin."
          : "Maaf, sistem Rafiq sedang gangguan. Silakan coba beberapa saat lagi.",
      },
      { status: isQuotaExceeded ? 429 : 503 }
    );
  }
}
