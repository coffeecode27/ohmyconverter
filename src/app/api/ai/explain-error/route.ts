import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type InsightPayload = {
  title: string;
  explanation: string;
  steps: string[];
};

type RequestPayload = {
  mode?: "error" | "success";
  error?: string;
  url?: string;
  format?: string;
  quality?: string;
};

function buildFallbackInsight(mode: "error" | "success", errorText: string): InsightPayload {
  if (mode === "success") {
    return {
      title: "Konversi berhasil",
      explanation: "File berhasil diproses. Berikut tips agar hasil tetap optimal.",
      steps: [
        "Untuk ukuran lebih kecil, pilih kualitas 480p atau 360p.",
        "Untuk audio saja, gunakan format MP3 agar lebih hemat storage.",
        "Jika playback lambat, coba putar ulang setelah file selesai terunduh penuh.",
      ],
    };
  }

  const lower = errorText.toLowerCase();

  if (lower.includes("video unavailable")) {
    return {
      title: "Video tidak tersedia",
      explanation: "Platform menandai video ini tidak tersedia untuk diunduh saat ini.",
      steps: [
        "Pastikan link bisa dibuka normal di browser.",
        "Coba video lain yang benar-benar publik.",
        "Jika tetap gagal, coba lagi beberapa saat.",
      ],
    };
  }

  if (lower.includes("fetch.empty") || lower.includes("empty media response")) {
    return {
      title: "Sumber media kosong",
      explanation: "Server sumber tidak mengirim stream file media yang valid.",
      steps: [
        "Pastikan konten publik (tidak private / butuh login).",
        "Coba ulang dengan kualitas lebih rendah.",
        "Coba link lain pada platform yang sama.",
      ],
    };
  }

  if (lower.includes("timeout")) {
    return {
      title: "Proses terlalu lama",
      explanation: "Proses convert melebihi batas waktu yang diizinkan.",
      steps: [
        "Pilih kualitas lebih rendah (360p/480p).",
        "Coba format audio jika hanya butuh suara.",
        "Ulangi beberapa saat lagi saat trafik platform turun.",
      ],
    };
  }

  return {
    title: "Konversi gagal",
    explanation: "Terjadi kendala saat mengambil media dari platform sumber.",
    steps: [
      "Periksa apakah URL masih valid dan bisa dibuka.",
      "Coba kualitas atau format berbeda.",
      "Jika berulang, coba lagi beberapa saat.",
    ],
  };
}

function parseModelInsight(raw: string): InsightPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<InsightPayload>;
    if (!parsed.title || !parsed.explanation || !Array.isArray(parsed.steps)) return null;
    return {
      title: String(parsed.title),
      explanation: String(parsed.explanation),
      steps: parsed.steps.map((s) => String(s)).slice(0, 3),
    };
  } catch {
    return null;
  }
}

async function askOpenRouter(input: RequestPayload): Promise<InsightPayload | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const mode = input.mode || "error";
  const errorText = input.error || "Unknown error";
  const taskLine =
    mode === "success"
      ? "Berikan insight singkat pasca-konversi agar user bisa memilih format/kualitas lebih tepat."
      : "Berikan analisis penyebab error konversi dan langkah perbaikan yang actionable.";

  const prompt = [
    "Kamu adalah asisten converter media.",
    "Berikan jawaban ringkas dalam bahasa Indonesia dalam format JSON valid.",
    'Format wajib: {"title":"...","explanation":"...","steps":["...","...","..."]}',
    "Maksimal 3 langkah, kalimat singkat dan actionable.",
    taskLine,
    `Mode: ${mode}`,
    `Error: ${errorText}`,
    `URL: ${input.url || "-"}`,
    `Format: ${input.format || "-"}`,
    `Quality: ${input.quality || "-"}`,
  ].join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": "OhMyConverter",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Selalu jawab JSON valid sesuai format yang diminta." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  return parseModelInsight(content);
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as RequestPayload;
    const mode = payload.mode || "error";
    const fallback = buildFallbackInsight(mode, payload.error || "Unknown error");
    const aiInsight = await askOpenRouter(payload);
    return NextResponse.json({ insight: aiInsight || fallback });
  } catch {
    return NextResponse.json({
      insight: buildFallbackInsight("error", "Unknown error"),
    });
  }
}
