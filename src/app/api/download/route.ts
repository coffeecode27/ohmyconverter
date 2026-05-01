import { NextRequest } from "next/server";

export const maxDuration = 300;
const DOWNLOAD_TIMEOUT_MS = 120_000;

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("timed out"));
}

function safeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tunnelUrl = searchParams.get("tunnel");
  const filename = searchParams.get("filename") || "download.mp4";

  if (!tunnelUrl) {
    return new Response(JSON.stringify({ error: "tunnel URL required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const fileRes = await fetch(tunnelUrl, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));

    if (!fileRes.ok || !fileRes.body) {
      return new Response(
        JSON.stringify({ error: `Gagal mendownload file (HTTP ${fileRes.status}). Coba format lain atau link berbeda.` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const upstreamType = fileRes.headers.get("content-type");

    if (upstreamType?.includes("application/json")) {
      const upstreamText = await fileRes.text();
      return new Response(
        JSON.stringify({
          error: `Sumber download tidak mengirim file media. Respons: ${upstreamText.slice(0, 200)}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const contentType = upstreamType || (filename.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream");
    const upstreamLength = fileRes.headers.get("content-length");
    const parsedLength = upstreamLength ? Number.parseInt(upstreamLength, 10) : Number.NaN;
    const shouldSendLength = Number.isFinite(parsedLength) && parsedLength > 0;

    if (upstreamLength === "0") {
      console.error("Download proxy received empty media stream from upstream tunnel:", tunnelUrl);
      return new Response(
        JSON.stringify({
          error:
            "Server sumber mengirim file kosong (0 byte). Biasanya terjadi pada link YouTube tertentu. Coba kualitas lain atau ulangi beberapa saat.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const upstreamDisposition = fileRes.headers.get("content-disposition");
    const safeName = safeFilename(filename);
    const encodedName = encodeURIComponent(filename);

    // Stream directly — don't buffer entire file into memory
    return new Response(fileRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(shouldSendLength ? { "Content-Length": String(parsedLength) } : {}),
        "Cache-Control": "no-store",
        "Content-Disposition":
          upstreamDisposition || `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      return new Response(
        JSON.stringify({ error: "Download timeout. Coba ulangi atau pilih kualitas lebih rendah." }),
        { status: 504, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("Download proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan saat download." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
