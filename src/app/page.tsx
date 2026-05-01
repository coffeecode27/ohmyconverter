"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";
import { LinkInput } from "@/components/LinkInput";
import { FormatSelector } from "@/components/FormatSelector";
import { PlatformBadges } from "@/components/PlatformBadges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Shield,
  Zap,
  Sparkles,
  Link as LinkIcon,
  ClipboardList,
  CircleDot,
  ArrowDownToLine,
  Scale,
  CheckCircle2,
} from "lucide-react";
import type { Format, Quality } from "@/components/FormatSelector";

type AiInsight = {
  title: string;
  explanation: string;
  steps: string[];
};

// Animation variants
const heroContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, when: "beforeChildren" },
  },
};

const heroItem: Variants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", damping: 15, stiffness: 100 },
  },
};

const guideStep: Variants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", damping: 15, stiffness: 80 },
  },
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{
    stage: string;
    percent: number;
  } | null>(null);
  const [format, setFormat] = useState<Format>("video");
  const [quality, setQuality] = useState<Quality>("720");
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"error" | "success">("error");

  const fetchAiInsight = async (
    mode: "error" | "success",
    message: string,
    url: string,
  ) => {
    try {
      setAiMode(mode);
      setIsAiLoading(true);
      const res = await fetch("/api/ai/explain-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          error: message,
          url,
          format,
          quality,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { insight?: AiInsight };
      if (data.insight) {
        setAiInsight(data.insight);
      }
    } catch {
      // best effort only
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConvert = async (url: string) => {
    setIsLoading(true);
    setAiInsight(null);
    const isYoutube = isYouTubeUrl(url);

    try {
      // Step 1: Get download info or direct file
      setProgress({
        stage: isYoutube
          ? "Menganalisis link YouTube (bisa 1-3 menit)..."
          : "Menganalisis link...",
        percent: 20,
      });
      const res = await fetchWithTimeout(
        "/api/convert",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, format, quality }),
        },
        isYoutube ? 300_000 : 50_000,
      );

      // Check if response is direct file (yt-dlp fallback)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("video/") || contentType.includes("audio/")) {
        setProgress({
          stage: isYoutube
            ? "Menormalkan format video (yt-dlp + ffmpeg)..."
            : "Menyiapkan file hasil konversi...",
          percent: 55,
        });
        setProgress({ stage: "Mengunduh file ke perangkat...", percent: 80 });
        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") || "";
        const fnameMatch = disposition.match(/filename="?([^"]+)"?/);
        const filename = fnameMatch
          ? decodeURIComponent(fnameMatch[1])
          : `download.${format === "audio" ? "mp3" : "mp4"}`;

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        setProgress({ stage: "Selesai!", percent: 100 });
        setTimeout(() => setProgress(null), 2000);
        void fetchAiInsight("success", "Konversi berhasil", url);
        return;
      }

      // JSON response (Cobalt tunnel)
      setProgress({ stage: "Sumber ditemukan, menyiapkan link download...", percent: 45 });
      const data = await res.json();

      if (!res.ok || data.error) {
        setProgress(null);
        const errMessage = data.error || "Gagal mengkonversi. Coba lagi.";
        toast.error(errMessage, {
          description: "Coba link lain atau format berbeda.",
          duration: 5000,
        });
        void fetchAiInsight("error", errMessage, url);
        return;
      }

      // Download via proxy with streaming
      setProgress({ stage: "Menghubungkan ke server file...", percent: 65 });
      const proxyUrl = `/api/download?tunnel=${encodeURIComponent(data.downloadUrl)}&filename=${encodeURIComponent(data.filename)}`;
      setProgress({ stage: "Menyiapkan unduhan di browser...", percent: 85 });

      // Let browser download stream directly to disk.
      const a = document.createElement("a");
      a.href = proxyUrl;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Step 4: Done!
      setProgress({ stage: "Selesai!", percent: 100 });
      setTimeout(() => setProgress(null), 2000);
      void fetchAiInsight("success", "Konversi berhasil", url);
    } catch (error) {
      setProgress(null);
      if (error instanceof Error && error.name === "AbortError") {
        const errMessage = isYoutube
          ? "Proses YouTube timeout. Coba kualitas lebih rendah (360p/480p) atau coba lagi."
          : "Proses terlalu lama (timeout). Coba kualitas lebih rendah.";
        toast.error(
          errMessage,
        );
        void fetchAiInsight("error", errMessage, url);
      } else {
        const errMessage = "Terjadi kesalahan. Pastikan server berjalan.";
        toast.error(errMessage);
        void fetchAiInsight("error", errMessage, url);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-16 bg-dot-pattern min-h-screen">
      {/* Animated hero */}
      <motion.div
        className="text-center space-y-4 mb-10 max-w-2xl flex flex-col items-center"
        variants={heroContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={heroItem}
          className="flex items-center justify-center gap-3 mb-2"
        >
          <Image
            src="/logo.png"
            alt="OhMyConverter"
            width={320}
            height={160}
            className="h-16 md:h-20 w-auto logo-glow"
            priority
          />
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            Oh<span className="text-primary">My</span>Converter
          </h1>
        </motion.div>

        <motion.p
          variants={heroItem}
          className="text-lg text-muted-foreground max-w-md mx-auto"
        >
          Convert video & audio dari mana saja.
        </motion.p>
        <motion.p
          variants={heroItem}
          className="text-sm text-muted-foreground/70"
        >
          YouTube • Instagram • TikTok • Twitter • Facebook
        </motion.p>
      </motion.div>

      {/* Features — trust signal */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6 mb-8 max-w-xl">
        {[
          { icon: <Zap className="h-4 w-4" />, title: "Cepat" },
          { icon: <Shield className="h-4 w-4" />, title: "Aman" },
          { icon: <Download className="h-4 w-4" />, title: "Gratis" },
          { icon: <Sparkles className="h-4 w-4" />, title: "AI Insight" },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground px-1"
          >
            <span className="text-primary">{feature.icon}</span>
            {feature.title}
          </motion.div>
        ))}
      </div>

      {/* Main converter card */}
      <motion.div
        className="w-full max-w-2xl glow-violet"
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 80, delay: 0.5 }}
      >
        <Card className="glass border-0 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Paste link di bawah</CardTitle>
            <CardDescription>
              Tempel link video atau audio dari platform manapun
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LinkInput onSubmit={handleConvert} isLoading={isLoading} />
            <Separator className="opacity-50" />
            <FormatSelector
              onFormatChange={setFormat}
              onQualityChange={setQuality}
            />

            {/* Progress bar */}
            {progress && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  {progress.percent === 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                  <span
                    className={`text-sm ${progress.percent === 100 ? "text-green-500 font-medium" : "text-muted-foreground"}`}
                  >
                    {progress.stage}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${progress.percent === 100 ? "bg-green-500" : "bg-primary"}`}
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            )}

            {(isAiLoading || aiInsight) && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-primary/25 bg-primary/5 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  AI Insight
                </div>
                {isAiLoading && (
                  <p className="text-xs text-muted-foreground">
                    {aiMode === "error"
                      ? "AI sedang menganalisis error..."
                      : "AI sedang menyiapkan insight hasil konversi..."}
                  </p>
                )}
                {aiInsight && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{aiInsight.title}</p>
                    <p className="text-xs text-muted-foreground">{aiInsight.explanation}</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      {aiInsight.steps.map((step, idx) => (
                        <li key={`${step}-${idx}`}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Supported platforms */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <PlatformBadges />
      </motion.div>

      {/* Guide Steps */}
      <div className="w-full max-w-2xl mt-14">
        <motion.h2
          className="text-center text-lg font-semibold mb-6 text-foreground"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Cara Menggunakan
        </motion.h2>
        <div className="space-y-4">
          {[
            {
              step: "1",
              icon: <LinkIcon className="h-5 w-5" />,
              title: "Salin Link",
              desc: "Buka YouTube, Instagram, TikTok, atau platform lain. Salin link video yang ingin dikonversi.",
            },
            {
              step: "2",
              icon: <ClipboardList className="h-5 w-5" />,
              title: "Tempel Link",
              desc: "Paste link di kolom input di atas. Platform akan terdeteksi secara otomatis.",
            },
            {
              step: "3",
              icon: <CircleDot className="h-5 w-5" />,
              title: "Pilih Format",
              desc: "Pilih format Video atau MP3, lalu pilih kualitas yang diinginkan (360p hingga 4K).",
            },
            {
              step: "4",
              icon: <ArrowDownToLine className="h-5 w-5" />,
              title: "Convert & Download",
              desc: "Klik tombol Convert, tunggu proses selesai, lalu download hasilnya.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              variants={guideStep}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass border-0">
                <CardContent className="flex items-start gap-4 py-4 px-5">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                      <span className="text-primary mr-1">
                        Step {item.step}:
                      </span>
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <motion.div
        className="w-full max-w-2xl mt-14"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <Card className="border border-muted-foreground/10 bg-muted/20">
          <CardContent className="py-5 px-6 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Scale className="h-4 w-4" />
              <h3 className="font-semibold text-sm">Disclaimer</h3>
            </div>
            <ul className="text-xs text-muted-foreground/80 space-y-1.5 list-disc list-inside">
              <li>
                OhMyConverter adalah alat konversi media. Pengguna bertanggung
                jawab penuh atas konten yang dikonversi dan penggunaannya.
              </li>
              <li>
                Konversi konten berhak cipta tanpa izin pemilik dapat melanggar
                hukum yang berlaku.
              </li>
              <li>
                Gunakan layanan ini hanya untuk konten yang Anda miliki,
                berlisensi bebas, atau telah mendapat izin dari pemilik hak
                cipta.
              </li>
              <li>
                Kami tidak menyimpan, mendistribusikan, atau menghosting file
                yang dikonversi.
              </li>
              <li>
                Dengan menggunakan layanan ini, Anda menyetujui untuk mematuhi
                semua hukum dan regulasi yang berlaku.
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer */}
      <motion.footer
        className="mt-16 text-center text-xs text-muted-foreground/50 space-y-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <p>
          OhMyConverter © 2026 — Made with ❤️ by{" "}
          <a
            href="https://nocturnal-instinct-space-kum3.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Teuku Imam Suranda
          </a>
        </p>
      </motion.footer>
    </main>
  );
}
