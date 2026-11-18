# Rafiq · Asisten Info Halaqah (Cloudflare Workers AI)

Aplikasi chatbot modern info halaqah berbasis **Cloudflare Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) dan **Cloudflare Static Assets**.

## 🌟 Fitur Utama

- **Realtime Streaming (SSE)**: Jawaban AI mengalir kata per kata secara instan.
- **WhatsApp UI Style**: Tampilan ramah pengguna dengan tombol pintasan cepat (*quick chips*).
- **Knowledge Base Lokal**: Persona dan data kajian terpusat di `SYSTEM_PROMPT.txt`.
- **Zero-Build Assets**: Frontend vanilla JS (< 20KB) disajikan langsung oleh CDN global Cloudflare.

---

## 📁 Struktur Direktori

```text
chatbot-ai/
├── public/                 # Static Assets (Frontend)
│   ├── index.html          # Struktur UI chat
│   ├── style.css           # Desain WhatsApp green & responsif
│   └── app.js              # Client-side SSE Stream reader
├── src/
│   └── index.js            # Backend Worker & endpoint /api/chat
├── docs/superpowers/specs/ # Dokumen arsitektur & desain
├── SYSTEM_PROMPT.txt       # Persona & data kajian halaqah
├── wrangler.jsonc          # Konfigurasi Cloudflare Workers & Assets
├── package.json            # Script CLI dev & deploy
└── .gitignore
```

---

## 🚀 Panduan Penggunaan

### 1. Menjalankan di Lokal (Development)

Pastikan Node.js sudah terpasang, lalu jalankan:

```bash
npm run dev
```

Buka peramban di `http://localhost:8787`.

---

### 2. Publikasi ke Cloudflare (Deploy)

1. **Login ke akun Cloudflare**:
   ```bash
   npx wrangler login
   ```
2. **Deploy aplikasi**:
   ```bash
   npm run deploy
   ```
   Wrangler akan otomatis mengunggah file statis di `public/` dan mendeploy Worker ke edge network Cloudflare. Anda akan mendapatkan URL publik seperti:
   `https://rafiq-chatbot.<subdomain>.workers.dev`

---

### 3. Cara Memperbarui Jadwal / Materi Kajian

Jika ada perubahan tema pekanan, waktu kajian, atau kontak admin:
1. Buka dan edit file `SYSTEM_PROMPT.txt`.
2. Jalankan perintah:
   ```bash
   npm run deploy
   ```
   Pembaruan langsung aktif seketika di seluruh dunia tanpa perlu merombak kode aplikasi.
