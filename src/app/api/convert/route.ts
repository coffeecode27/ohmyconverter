import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

export const maxDuration = 300;
export const runtime = "nodejs";
const COBALT_TIMEOUT_MS = 45_000;
const YTDLP_TIMEOUT_MS = 240_000;
const FFMPEG_TIMEOUT_MS = 180_000;
type ConvertPath = "cobalt" | "yt-dlp";

function getYtDlpCookieArgs(): string[] {
  const browser = process.env.YTDLP_COOKIES_BROWSER?.trim();
  if (!browser) return [];
  return ["--cookies-from-browser", browser];
}

function detectPlatform(url: string): string {
  if (isYouTubeUrl(url)) return "youtube";
  if (isTikTokUrl(url)) return "tiktok";
  if (isInstagramUrl(url)) return "instagram";
  if (isTwitterUrl(url)) return "twitter";
  if (isFacebookUrl(url)) return "facebook";
  return "unknown";
}

function logConvertEvent(params: {
  status: "start" | "success" | "error";
  platform: string;
  path: ConvertPath;
  format: string;
  quality: string;
  elapsedMs?: number;
  detail?: string;
}) {
  const { status, platform, path, format, quality, elapsedMs, detail } = params;
  console.info(
    `[convert] status=${status} platform=${platform} path=${path} format=${format} quality=${quality}${elapsedMs !== undefined ? ` elapsed_ms=${elapsedMs}` : ""}${detail ? ` detail="${detail}"` : ""}`
  );
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("timed out"));
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "error.api.fail": "Gagal menghubungi server.",
    "error.content.video.unavailable": "Video tidak tersedia atau dibatasi.",
    "error.content.post.unavailable": "Konten tidak tersedia.",
    "error.content.audio.unavailable": "Audio tidak tersedia.",
    "error.link": "Link tidak valid. Coba periksa kembali.",
    "error.api.key": "API key tidak valid.",
    "error.api.rate": "Terlalu banyak request. Coba lagi nanti.",
    "error.api.youtube.decaptcha": "YouTube meminta CAPTCHA. Coba lagi nanti.",
    "error.api.youtube.apikey": "Gagal mengakses YouTube.",
    "error.content.video.live": "Video sedang live, tidak bisa didownload.",
    "error.content.post.private": "Konten bersifat private.",
    "error.content.post.age": "Konten dibatasi usia.",
    "error.content.video.region": "Konten diblokir di region Anda.",
  };
  return messages[code] || `Gagal mengkonversi (${code}). Coba lagi.`;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/i.test(url);
}

function isInstagramUrl(url: string): boolean {
  return /instagram\.com/i.test(url);
}

function isFacebookUrl(url: string): boolean {
  return /(facebook\.com|fb\.watch)/i.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /(twitter\.com|x\.com)/i.test(url);
}

function shouldForceYtDlp(url: string): boolean {
  return isYouTubeUrl(url) || isTikTokUrl(url);
}

function shouldFallbackToYtDlp(url: string): boolean {
  return isYouTubeUrl(url) || isTikTokUrl(url) || isInstagramUrl(url) || isFacebookUrl(url) || isTwitterUrl(url);
}

function isRecoverableCobaltError(message: string): boolean {
  return /(error\.api\.fetch\.empty|error\.api\.fetch\.fail)/i.test(message);
}

function mapYtDlpErrorToUserMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("instagram sent an empty media response")) {
    return "Konten Instagram tidak bisa diakses tanpa login. Coba konten lain yang benar-benar publik.";
  }
  if (lower.includes("requested format is not available")) {
    return "Format yang diminta tidak tersedia untuk konten ini. Coba format lain atau kualitas lebih rendah.";
  }
  if (lower.includes("cannot parse data")) {
    return "Sumber platform sedang berubah dan belum bisa diproses saat ini. Coba lagi beberapa saat.";
  }
  if (lower.includes("video unavailable")) {
    return "Video tidak tersedia atau dibatasi oleh platform.";
  }
  return "Gagal mengambil media dari sumber. Coba link lain atau ulangi beberapa saat.";
}

function getAudioBitrate(quality: string): string {
  return quality.replace("kbps", "") || "256";
}

function getMaxVideoHeight(quality: string): string {
  if (quality === "4k") return "2160";
  return quality || "720";
}

function toAsciiHeaderFilename(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\r\n"]/g, "_");
}

function runCommand(command: string, args: string[], timeoutMs: number, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderrOutput = "";
    let finished = false;

    const timeoutId = setTimeout(() => {
      if (!finished) {
        child.kill("SIGKILL");
        reject(new Error(`${label} timeout`));
      }
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    child.on("error", (error) => {
      finished = true;
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      finished = true;
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderrOutput.trim() || `${label} gagal dengan exit code ${code}`));
    });
  });
}

async function hasFfmpeg(): Promise<boolean> {
  try {
    await runCommand("ffmpeg", ["-version"], 5_000, "ffmpeg");
    return true;
  } catch {
    return false;
  }
}

async function normalizeVideoWithFfmpeg(inputPath: string, tempDir: string): Promise<string> {
  const normalizedPath = join(tempDir, "normalized.mp4");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      normalizedPath,
    ],
    FFMPEG_TIMEOUT_MS,
    "ffmpeg"
  );
  return normalizedPath;
}

async function tryYtDlp(url: string, format: string, quality: string): Promise<Response> {
  const tempDir = await mkdtemp(join(tmpdir(), "ohmyconverter-"));
  const outputTemplate = join(tempDir, "%(title)s.%(ext)s");

  const args = ["--no-playlist", "--no-warnings", ...getYtDlpCookieArgs(), "-o", outputTemplate];

  if (format === "audio") {
    // Some platforms may not expose standalone audio tracks.
    const audioSelector = isTikTokUrl(url) || isInstagramUrl(url) || isFacebookUrl(url) ? "b/bv+ba" : "bestaudio";
    args.push("-f", audioSelector, "-x", "--audio-format", "mp3", "--audio-quality", getAudioBitrate(quality));
  } else {
    const maxHeight = getMaxVideoHeight(quality);
    args.push(
      "-f",
      `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best`,
      "--merge-output-format",
      "mp4"
    );
  }

  args.push(url);

  try {
    await runCommand("yt-dlp", args, YTDLP_TIMEOUT_MS, "yt-dlp");
    const files = await readdir(tempDir);
    const outputFile = files[0];

    if (!outputFile) {
      throw new Error("yt-dlp tidak menghasilkan file output.");
    }

    let streamPath = join(tempDir, outputFile);
    let downloadFilename = outputFile;

    if (format === "video" && (await hasFfmpeg())) {
      try {
        streamPath = await normalizeVideoWithFfmpeg(streamPath, tempDir);
        const parsed = parse(outputFile);
        downloadFilename = `${parsed.name}.mp4`;
      } catch (ffmpegError) {
        console.error("ffmpeg normalization gagal, lanjut dengan file asli:", ffmpegError);
      }
    }

    const fileStat = await stat(streamPath);
    const nodeStream = createReadStream(streamPath);
    const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const safeName = toAsciiHeaderFilename(downloadFilename);
    const encodedName = encodeURIComponent(downloadFilename);
    const contentType = format === "audio" ? "audio/mpeg" : "video/mp4";

    const cleanup = async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Gagal membersihkan file sementara yt-dlp:", cleanupError);
      }
    };

    nodeStream.once("close", () => {
      void cleanup();
    });
    nodeStream.once("error", () => {
      void cleanup();
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gagal convert via yt-dlp: ${message}`);
  }
}

async function tryCobalt(url: string, format: string, quality: string) {
  const cobaltBody: Record<string, unknown> = {
    url,
    downloadMode: format === "audio" ? "audio" : "auto",
  };

  if (format === "audio") {
    cobaltBody.audioFormat = "mp3";
    cobaltBody.audioBitrate = getAudioBitrate(quality);
  } else {
    cobaltBody.videoQuality = quality || "720";
  }

  const API_URL = process.env.COBALT_API_URL || "http://localhost:9000";

  let cobaltRes;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COBALT_TIMEOUT_MS);

  try {
    cobaltRes = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(cobaltBody),
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (isTimeoutError(fetchError)) {
      throw new Error(
        "Proses konversi terlalu lama (timeout). Untuk YouTube, coba kualitas lebih rendah seperti 360p/480p atau coba lagi beberapa saat."
      );
    }
    console.error("Cobalt fetch error:", fetchError);
    throw new Error("Gagal terhubung ke Cobalt API.");
  } finally {
    clearTimeout(timeoutId);
  }

  const cobaltData = await cobaltRes.json();

  if (cobaltData.status === "error" || cobaltData.error) {
    const errorCode = cobaltData.error?.code || cobaltData.error || "error.api.fail";
    throw new Error(getErrorMessage(errorCode));
  }

  if (cobaltData.filename) {
    const ext = cobaltData.filename.split(".").pop()?.toLowerCase();
    if (format === "audio" && ext && !["mp3", "m4a", "ogg", "wav"].includes(ext)) {
      throw new Error(`Konten ini adalah ${ext.toUpperCase()}, bukan video/audio.`);
    }
    if (format === "video" && ext && !["mp4", "webm", "mkv", "mov"].includes(ext)) {
      throw new Error(`Konten ini adalah ${ext.toUpperCase()}, bukan video.`);
    }
  }

  if (!cobaltData.url) {
    throw new Error("Gagal mendapatkan link download dari Cobalt.");
  }

  return {
    downloadUrl: cobaltData.url,
    filename: cobaltData.filename || `download.${format === "audio" ? "mp3" : "mp4"}`,
  };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let logPlatform = "unknown";
  let logPath: ConvertPath = "cobalt";
  let logFormat = "unknown";
  let logQuality = "unknown";
  try {
    const body = await req.json();
    const { url, format, quality } = body;
    const targetFormat = format || "video";
    const targetQuality = quality || "720";
    logFormat = targetFormat;
    logQuality = targetQuality;

    if (!url) {
      return NextResponse.json({ error: "URL wajib diisi." }, { status: 400 });
    }
    const platform = detectPlatform(url);
    logPlatform = platform;

    if (shouldForceYtDlp(url)) {
      logPath = "yt-dlp";
      logConvertEvent({
        status: "start",
        platform,
        path: "yt-dlp",
        format: targetFormat,
        quality: targetQuality,
      });
      try {
        const ytResponse = await tryYtDlp(url, targetFormat, targetQuality);
        logConvertEvent({
          status: "success",
          platform,
          path: "yt-dlp",
          format: targetFormat,
          quality: targetQuality,
          elapsedMs: Date.now() - startedAt,
        });
        return ytResponse;
      } catch (ytError) {
        console.error("yt-dlp fallback error:", ytError);
      }
    }

    logPath = "cobalt";
    try {
      logConvertEvent({
        status: "start",
        platform,
        path: "cobalt",
        format: targetFormat,
        quality: targetQuality,
      });
      const result = await tryCobalt(url, targetFormat, targetQuality);
      logConvertEvent({
        status: "success",
        platform,
        path: "cobalt",
        format: targetFormat,
        quality: targetQuality,
        elapsedMs: Date.now() - startedAt,
      });
      return NextResponse.json(result, { status: 200 });
    } catch (cobaltError) {
      const cobaltMessage = cobaltError instanceof Error ? cobaltError.message : String(cobaltError);
      if (shouldFallbackToYtDlp(url) && isRecoverableCobaltError(cobaltMessage)) {
        logPath = "yt-dlp";
        logConvertEvent({
          status: "start",
          platform,
          path: "yt-dlp",
          format: targetFormat,
          quality: targetQuality,
          detail: "fallback_after_cobalt_error",
        });
        try {
          const ytResponse = await tryYtDlp(url, targetFormat, targetQuality);
          logConvertEvent({
            status: "success",
            platform,
            path: "yt-dlp",
            format: targetFormat,
            quality: targetQuality,
            elapsedMs: Date.now() - startedAt,
            detail: "fallback_after_cobalt_error",
          });
          return ytResponse;
        } catch (ytError) {
          console.error("yt-dlp secondary fallback error:", ytError);
          const detail = ytError instanceof Error ? ytError.message : String(ytError);
          throw new Error(mapYtDlpErrorToUserMessage(detail));
        }
      }
      throw cobaltError;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    console.error("Convert error:", message);
    logConvertEvent({
      status: "error",
      platform: logPlatform,
      path: logPath,
      format: logFormat,
      quality: logQuality,
      elapsedMs: Date.now() - startedAt,
      detail: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
