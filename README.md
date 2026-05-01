# OhMyConverter

Web app untuk **mengonversi dan mengunduh video serta audio** dari tautan platform populer. Antarmuka satu halaman: tempel URL, pilih format (video atau MP3) dan kualitas, lalu unduh hasilnya. Tanpa akun pengguna di sisi aplikasi ini.

## Ringkasan

OhMyConverter adalah aplikasi **Next.js** yang menggabungkan:

- **[Cobalt](https://github.com/imputnet/cobalt)** sebagai jalur utama konversi lewat API self-hosted.
- **yt-dlp** + **ffmpeg** sebagai **fallback** ketika Cobalt gagal atau tidak mengembalikan file yang valid—termasuk untuk beberapa platform (misalnya YouTube, TikTok, Instagram, Facebook, X/Twitter).
- **AI Insight** (opsional) yang menjelaskan error atau memberi tips singkat setelah konversi berhasil, memakai **OpenRouter** bila API key diset.

Alur singkat di browser: URL → deteksi platform → permintaan ke `/api/convert` → unduh lewat `/api/download` atau tautan langsung sesuai respons server.

## Fitur

| Area | Deskripsi |
|------|-----------|
| **Input URL** | Satu kolom untuk tautan; platform dikenali otomatis dari pola URL. |
| **Deteksi platform** | YouTube (termasuk Shorts), Instagram (post/reel/tv), TikTok, X/Twitter, Facebook. |
| **Format** | **Video** atau **audio (MP3)** lewat tab pemilih format. |
| **Kualitas video** | 360p hingga 4K (tergantung ketersediaan sumber). |
| **Kualitas audio** | 128 / 256 / 320 kbps. |
| **Progres & UX** | Indikator progres saat memproses; timeout disesuaikan (misalnya lebih panjang untuk YouTube). |
| **Tema** | Mode terang / gelap (toggle di header). |
| **AI Insight** | Setelah gagal: penjelasan ramah pengguna + langkah yang bisa dicoba. Setelah sukses: tips singkat. Membutuhkan `OPENROUTER_API_KEY` untuk mode model; ada fallback rule-based tanpa key. |
| **Deploy** | **Dockerfile** dengan Next.js `standalone`, **ffmpeg**, dan **yt-dlp** untuk lingkungan production yang mirip lokal. |

Detail menjalankan Cobalt, env, dan Docker ada di **[RUN_APP.MD](./RUN_APP.MD)**.

## Stack teknologi

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4**, komponen UI bergaya **shadcn**
- **Motion** untuk animasi halaman
- **Zod** untuk validasi di API
- **Sonner** untuk toast notifikasi
- Backend route: konversi (`/api/convert`), proxy unduhan (`/api/download`), AI (`/api/ai/explain-error`)

## Prasyarat (development lokal)

- **Node.js** (LTS disarankan) dan **pnpm**
- **Docker** untuk menjalankan **Cobalt** (`docker-compose.yml`, port **9000** secara default)
- Di mesin pengembang (di luar Docker app): **yt-dlp** dan **ffmpeg** di `PATH` agar fallback berjalan seperti di production image

## Mulai cepat

```bash
pnpm install
docker compose up -d    # Cobalt
pnpm run dev            # http://localhost:3000
```

Build production lokal:

```bash
pnpm run build
pnpm run start
```

Panduan lengkap (env, troubleshooting, Docker deploy): **[RUN_APP.MD](./RUN_APP.MD)**.

## Variabel lingkungan

Buat **`.env.local`** di root (jangan commit file ini).

| Variabel | Keterangan |
|----------|------------|
| `COBALT_API_URL` | URL dasar Cobalt. Default pengembangan: `http://localhost:9000` jika tidak di-set. |
| `OPENROUTER_API_KEY` | API key OpenRouter untuk AI Insight berbasis model. |
| `OPENROUTER_MODEL` | Model OpenRouter, mis. `openai/gpt-4o-mini`. |
| `OPENROUTER_SITE_URL` | URL situs untuk metadata OpenRouter (opsional). |
| `YTDLP_COOKIES_BROWSER` | Opsional: `--cookies-from-browser` untuk yt-dlp (biasanya **hanya cocok untuk dev lokal**, bukan pola yang umum di server tanpa browser). |

## Skrip npm

| Perintah | Fungsi |
|----------|--------|
| `pnpm run dev` | Server pengembangan Next.js |
| `pnpm run build` | Build production |
| `pnpm run start` | Jalankan build production |
| `pnpm run lint` | ESLint |
| `pnpm exec tsc --noEmit` | Cek tipe TypeScript |

## Deploy

Image Docker membangun aplikasi mode **standalone** dan menyertakan **ffmpeg** + **yt-dlp**. Cocok untuk platform berbasis container (Railway, Render, Fly.io, VPS, dll.). Ringkasan perintah ada di **[RUN_APP.MD § Deploy](./RUN_APP.MD)**.

Hosting **serverless murni** sering kurang ideal untuk proses panjang dan binary seperti yt-dlp/ffmpeg; deploy sebagai **container** atau **VM** lebih selaras dengan cara kerja app ini.

## Catatan hukum dan etika

Pengunduhan dan penyalinan konten bisa dibatasi oleh **hak cipta** dan **ketentuan layanan** masing-masing platform. Gunakan OhMyConverter hanya untuk konten yang **kamu punya hak** menggunakannya atau yang **secara eksplisit diperbolehkan**. Pengembang tidak bertanggung jawab atas penyalahgunaan.

## Lisensi

Kode dalam repositori ini dilisensikan di bawah **MIT License** — lihat [LICENSE](./LICENSE).
