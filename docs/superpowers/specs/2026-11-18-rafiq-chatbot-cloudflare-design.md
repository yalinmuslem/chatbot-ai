# Design Spec: Rafiq Chatbot Cloudflare Deployment

- **Date:** 2026-11-18
- **Topic:** Rafiq Chatbot (Info Halaqah) Deployment on Cloudflare Workers & Static Assets
- **Status:** Approved by User

---

## 1. Overview & Goals

Proyek ini bertujuan mematangkan prototype monolitik chatbot "Rafiq" (Asisten Info Halaqah Ilmu Al-Hikmah) menjadi aplikasi web modern siap produksi yang di-deploy ke platform Cloudflare.

Aplikasi ini menggunakan:
- **Cloudflare Workers AI** dengan model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` untuk inferensi LLM berbiaya efisien dengan kuota gratis harian.
- **Cloudflare Static Assets** untuk menyajikan aset antarmuka statis (*zero-build*, CDN edge global).
- **Server-Sent Events (SSE)** untuk respons streaming karakter demi karakter agar interaksi terasa instan dan responsif.
- **Konfigurasi Lokal Berbasis File**: Manajemen pengetahuan dan persona via `SYSTEM_PROMPT.txt` yang dapat diperbarui secara cepat melalui `wrangler deploy`.

---

## 2. Architecture & File Structure

Struktur proyek dirancang bersih dengan pemisahan tegas antara aset antarmuka pengguna statis dan backend worker API:

```text
chatbot-ai/
├── public/                 # Static Assets (Cloudflare edge CDN)
│   ├── index.html          # Halaman web UI chat
│   ├── style.css           # Desain WhatsApp-style hijau halaqah & tata letak responsif
│   └── app.js              # Interaktivitas UI & SSE Stream reader
├── src/
│   └── index.js            # Cloudflare Worker entry point (/api/chat)
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-11-18-rafiq-chatbot-cloudflare-design.md
├── SYSTEM_PROMPT.txt       # Persona bot & knowledge base info halaqah
├── wrangler.jsonc          # Konfigurasi Workers, Workers AI binding, & Static Assets
├── package.json            # Script CLI dev & deploy
└── .gitignore              # Mengabaikan .wrangler, node_modules, dll.
```

---

## 3. Configuration Specification

### 3.1 `wrangler.jsonc`
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "rafiq-chatbot",
  "main": "src/index.js",
  "compatibility_date": "2024-11-01",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },
  "ai": {
    "binding": "AI"
  },
  "rules": [
    {
      "type": "Text",
      "globs": ["**/*.txt"],
      "fallthrough": true
    }
  ],
  "observability": {
    "enabled": true
  }
}
```

### 3.2 `package.json`
```json
{
  "name": "rafiq-chatbot",
  "version": "1.0.0",
  "description": "Asisten Info Halaqah di Cloudflare Workers AI",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.90.0"
  }
}
```

---

## 4. Backend Worker Specification (`src/index.js`)

### 4.1 Routing & Endpoints
1. `POST /api/chat`:
   - Validasi header dan body JSON:
     - `pesan`: Wajib berupa string non-kosong, dipangkas (`trim()`), dan dibatasi maksimal 500 karakter.
     - `riwayat`: Array riwayat percakapan. Hanya mengambil objek dengan `role` valid (`user` atau `assistant`), maksimal 6 entri terakhir, tiap pesan dibatasi 500 karakter.
   - Jika validasi gagal, kembalikan HTTP `400 Bad Request` dengan payload JSON `{ error: "<pesan kesalahan>" }`.
2. Selain `POST /api/chat`:
   - Jika URL mengarah ke `/api/chat` dengan metode selain `POST`, kembalikan HTTP `405 Method Not Allowed`.
   - Untuk route lain, serahkan ke `env.ASSETS.fetch(request)` agar aset statis di `public/` disajikan langsung.

### 4.2 Injeksi Prompt & Model AI
- `SYSTEM_PROMPT.txt` di-import sebagai teks langsung ke worker:
  ```javascript
  import defaultPrompt from "../SYSTEM_PROMPT.txt";
  ```
- Priority resolusi prompt: `env.SYSTEM_PROMPT || defaultPrompt`.
- Model AI yang digunakan: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Parameter `env.AI.run`:
  - `messages`: Gabungan system prompt, riwayat pesan terdahulu, dan pesan pengguna saat ini.
  - `max_tokens`: 400.
  - `stream`: true.

### 4.3 Streaming SSE & Error Handling
- Response dikembalikan dengan header:
  - `Content-Type: text/event-stream; charset=utf-8`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- Tangani galat (error handling):
  - Jika terjadi error limit/kuota harian (kode 429 atau indikator neuron limit), kirimkan respons bersahabat: *"Kuota harian Rafiq sedang habis. Silakan coba lagi besok, atau hubungi admin."*
  - Jika terjadi kendala internal lainnya, kembalikan HTTP 503 dengan format JSON atau teks pesan ramah.

---

## 5. Frontend Client Specification (`public/`)

### 5.1 Struktur & Visual UI (`index.html` & `style.css`)
- **Header**:
  - Avatar lingkaran berisi inisial "R".
  - Judul "Rafiq" dan subjudul "Asisten info halaqah".
  - Status indikator aktif/online.
- **Area Pesan (`#chat`)**:
  - Balon pesan pengguna: Mengambang di kanan dengan latar hijau muda (`#d9fdd3`).
  - Balon pesan bot: Mengambang di kiri dengan latar putih (`#ffffff`).
  - Auto-scroll otomatis setiap ada token teks baru.
- **Quick Buttons (Pintasan Cepat)**:
  - 4 tombol chip: "Jadwal Kajian", "Cara Daftar", "Link Rekaman", "Kontak Admin".
  - Menekan tombol langsung mengeksekusi pengiriman pesan otomatis.
- **Input Bar**:
  - Textarea fleksibel dengan placeholder "Ketik pertanyaan seputar kajian...".
  - `Enter` langsung mengirim pesan, `Shift+Enter` membuat baris baru.
  - Tombol kirim berbentuk lingkaran dengan ikon panah.
- **Footer**:
  - Disclaimer teks: *"Jawaban dibuat AI dan bisa keliru. Jangan mengetik data pribadi."*
  - Tombol *"Hapus percakapan"* untuk mereset tampilan dan riwayat chat ke salam awal.

### 5.2 Alur Logika Streaming (`app.js`)
1. Pesan pengguna divalidasi tidak boleh kosong.
2. Tambahkan balon pengguna ke layar, kosongkan input, dan nonaktifkan tombol kirim.
3. Buat balon respons bot kosong dengan kelas indikator mengetik.
4. Kirim request `POST /api/chat` dengan body `{ pesan, riwayat }`.
5. Konsumsi `response.body.getReader()` menggunakan `TextDecoder`:
   - Parsing event data chunk bertipe SSE `data: {"response":"..."}`.
   - Tambahkan potongan teks ke balon secara progresif via properti `.textContent` (mencegah XSS).
6. Setelah stream selesai (`done: true`), simpan interaksi ke array `riwayat` (maksimal 6 entri).
7. Aktifkan kembali tombol kirim dan fokuskan kursor ke input textarea.

---

## 6. Testing Strategy

1. **Uji Fungsional Lokal**:
   - Jalankan `npm run dev`.
   - Buka `http://localhost:8787` di browser.
   - Coba kirim pesan pertanyaan: "Kajian tematik Ahad jam berapa?".
   - Pastikan teks mengalir (*streaming*) secara mulus tanpa jeda kaku.
2. **Uji Tombol Cepat**:
   - Klik masing-masing tombol chip ("Jadwal", "Daftar", "Rekaman", "Kontak Admin") dan verifikasi respons bot sesuai data di `SYSTEM_PROMPT.txt`.
3. **Uji Validasi & Batasan**:
   - Kirim pesan spasi kosong: pastikan sistem menolak pengiriman di client.
   - Kirim pesan panjang: verifikasi sistem memotong pesan ke 500 karakter dengan aman.
4. **Uji Fitur Hapus Riwayat**:
   - Klik "Hapus percakapan": pastikan chat kembali bersih ke salam pembuka dan array `riwayat` kembali kosong.

---

## 7. Deployment Workflow

1. Login ke akun Cloudflare melalui CLI:
   ```bash
   npx wrangler login
   ```
2. Jalankan perintah deploy:
   ```bash
   npm run deploy
   ```
3. Cloudflare secara otomatis:
   - Mengunggah berkas di folder `public/` ke Cloudflare Global CDN.
   - Mempublikasikan Worker `src/index.js` dengan binding Workers AI.
   - Menghasilkan URL publik: `https://rafiq-chatbot.<subdomain>.workers.dev`.
4. Untuk memperbarui materi kajian atau kontak admin di kemudian hari:
   - Edit isi file `SYSTEM_PROMPT.txt`.
   - Jalankan kembali `npm run deploy`.
