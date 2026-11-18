// Rafiq - Client-Side App & SSE Stream Reader
const MAKS_RIWAYAT = 6;
const SAPAAN =
  "Assalamu'alaikum! Saya Rafiq, asisten info Halaqah Ilmu Al-Hikmah. " +
  "Silakan tanya jadwal kajian, cara mendaftar kelas tahsin, link rekaman materi, atau kontak admin.";

const chat = document.getElementById("chat");
const input = document.getElementById("input");
const form = document.getElementById("form");
const tombolKirim = document.getElementById("kirim");
const tombolHapus = document.getElementById("hapus");
const tombolCepat = document.querySelectorAll("#cepat button");

let riwayat = [];
let sedangMenjawab = false;

function scrollKeBawah() {
  chat.scrollTop = chat.scrollHeight;
}

function tambahBalon(teks, kelas) {
  const div = document.createElement("div");
  div.className = `balon ${kelas}`;
  div.textContent = teks;
  chat.appendChild(div);
  scrollKeBawah();
  return div;
}

function aturTinggiTextarea() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

async function kirim(teks) {
  teks = String(teks || "").trim();
  if (!teks || sedangMenjawab) return;

  sedangMenjawab = true;
  tombolKirim.disabled = true;

  // Tampilkan pesan pengguna
  tambahBalon(teks, "saya");
  input.value = "";
  aturTinggiTextarea();

  // Balon untuk bot yang akan diisi secara streaming
  const balonBot = tambahBalon("", "bot mengetik");

  let teksJawabanLengkap = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pesan: teks, riwayat }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      balonBot.classList.remove("mengetik");
      balonBot.classList.add("error");
      balonBot.textContent =
        errData.error || `Terjadi kesalahan (Kode: ${res.status}). Silakan coba lagi.`;
      sedangMenjawab = false;
      tombolKirim.disabled = false;
      input.focus();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const baris = buffer.split("\n");
      buffer = baris.pop() || "";

      for (const line of baris) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        if (trimmed.startsWith("data:")) {
          const payload = trimmed.replace(/^data:\s*/, "");
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            const token = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? "";
            if (token) {
              teksJawabanLengkap += token;
              balonBot.textContent = teksJawabanLengkap;
              scrollKeBawah();
            }
          } catch {
            // Abaikan chunk non-JSON jika ada
          }
        }
      }
    }

    balonBot.classList.remove("mengetik");

    if (!teksJawabanLengkap.trim()) {
      balonBot.textContent = "Maaf, Rafiq belum dapat memberikan jawaban. Silakan ulangi pertanyaan.";
    } else {
      riwayat.push({ role: "user", content: teks });
      riwayat.push({ role: "assistant", content: teksJawabanLengkap });
      riwayat = riwayat.slice(-MAKS_RIWAYAT);
    }
  } catch (err) {
    console.error("Gagal terhubung ke API:", err);
    balonBot.classList.remove("mengetik");
    balonBot.classList.add("error");
    balonBot.textContent = "Koneksi bermasalah. Silakan periksa jaringan dan coba lagi.";
  } finally {
    sedangMenjawab = false;
    tombolKirim.disabled = false;
    input.focus();
  }
}

// Event Listeners
form.addEventListener("submit", (e) => {
  e.preventDefault();
  kirim(input.value);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    kirim(input.value);
  }
});

input.addEventListener("input", aturTinggiTextarea);

tombolCepat.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.q) {
      kirim(btn.dataset.q);
    }
  });
});

tombolHapus.addEventListener("click", () => {
  if (confirm("Hapus seluruh percakapan saat ini?")) {
    chat.innerHTML = "";
    riwayat = [];
    tambahBalon(SAPAAN, "bot");
  }
});

// Inisialisasi awal
tambahBalon(SAPAAN, "bot");
input.focus();
