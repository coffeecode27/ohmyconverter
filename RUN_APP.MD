# Cara menjalankan OhMyConverter (lokal)

Dokumen ini merangkum perintah yang sering dipakai untuk development. Aplikasi ini memakai **Next.js (UI + API routes)**, **Cobalt (Docker)**, dan opsional **yt-dlp** + **ffmpeg** untuk fallback konversi.

## Prasyarat

- **Node.js** (disarankan LTS) dan **pnpm**
- **Docker Desktop** (untuk service Cobalt)
- Di Mac, biasanya butuh di PATH:
  - **yt-dlp** (fallback YouTube/TikTok, dll)
  - **ffmpeg** (normalisasi video hasil `yt-dlp`)
- (Opsional) **OpenRouter API key** untuk fitur **AI Insight** (bisa diletakkan di `.env.local`)

## 1) Install dependensi project

Dari root folder project:

```bash
pnpm install
```

## 2) Jalankan Cobalt (Docker)

File: `docker-compose.yml` (service `cobalt`, port **9000**).

Jalankan di background:

```bash
docker compose up -d
```

Cek service hidup (contoh):

```bash
curl -I http://localhost:9000
```

Stop service:

```bash
docker compose down
```

> Catatan: `COBALT_API_URL` di backend default ke `http://localhost:9000` kalau tidak di-set.

## 3) Jalankan aplikasi Next.js (development)

```bash
pnpm run dev
```

Buka browser:

- `http://localhost:3000`

Jika port `3000` sedang dipakai proses lain, Next bisa otomatis memilih port lain—ikut URL yang tercetak di terminal.

## 4) Variabel lingkungan (opsional)

Buat file **`.env.local`** di root project (file ini biasanya tidak ikut commit).

Contoh isi (gunakan nilai kamu sendiri):

```env
# Cobalt (opsional, default sudah localhost:9000)
# COBALT_API_URL=http://localhost:9000

# OpenRouter (AI Insight)
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_SITE_URL=http://localhost:3000

# yt-dlp cookies dari browser (OPSIONAL, biasanya untuk dev lokal saja)
# YTDLP_COOKIES_BROWSER=chrome
```

Setelah mengubah `.env.local`, restart `pnpm run dev`.

## 5) Build production (lokal)

```bash
pnpm run build
pnpm run start
```

## 6) Deploy production (Docker)

Project menyediakan **`Dockerfile`** yang membangun Next.js mode **`standalone`** dan menginstal **`ffmpeg`** + **`yt-dlp`** di image runtime (dibutuhkan route `/api/convert`).

### Build image

Dari root project:

```bash
docker build -t ohmyconverter:latest .
```

### Jalankan container

```bash
docker run --rm -p 3000:3000 \
  -e COBALT_API_URL=https://cobalt-url-kamu \
  -e OPENROUTER_API_KEY=opsional \
  ohmyconverter:latest
```

Lalu buka `http://localhost:3000`.

### Cobalt di production

- **Opsi A — Cobalt terpisah**: deploy Cobalt (misalnya container lain / VPS) dan set **`COBALT_API_URL`** ke URL itu.
- **Opsi B — Satu host**: jalankan Cobalt + app dengan **docker compose** di server (sesuaikan URL internal, misalnya `http://cobalt:9000`).

### Platform yang cocok

Karena app ini membutuhkan **proses panjang**, **binary sistem** (`yt-dlp`, `ffmpeg`), dan **filesystem temp**, lebih cocok dipasang sebagai **container** atau **VM** (misalnya **Railway**, **Render**, **Fly.io**, **VPS**). Hosting **serverless murni** sering tidak cocok untuk pola kerja ini.

### Variabel lingkungan di server

Set sama seperti `.env.local`, lewat panel provider atau secret manager:

- **`COBALT_API_URL`** — URL Cobalt yang bisa dijangkau dari container app.
- **`OPENROUTER_*`** — untuk AI Insight (opsional).
- **`YTDLP_COOKIES_BROWSER`** — biasanya **tidak** dipakai di server production (butuh browser/profile); untuk konten yang butuh login, pertimbangkan strategi cookies file terpisah jika kamu menambahkan dukungan itu.

## Perintah berguna

```bash
pnpm run lint
pnpm exec tsc --noEmit
```

## Troubleshooting cepat

- **Convert gagal / Cobalt error**: pastikan Cobalt jalan (`docker compose up -d`) dan port **9000** tidak bentrok.
- **YouTube/TikTok lewat yt-dlp gagal**: pastikan `yt-dlp` dan `ffmpeg` terpasang dan bisa dijalankan dari terminal (`yt-dlp --version`, `ffmpeg -version`).
- **Port Next bentrok**: tutup instance dev lain atau pakai URL/port yang ditampilkan Next di terminal.
- **AI Insight tidak pakai model**: pastikan `OPENROUTER_API_KEY` ada di `.env.local` dan dev server sudah di-restart.
