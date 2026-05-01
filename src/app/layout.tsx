import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OhMyConverter — Convert Video & Audio dari Mana Saja",
  description:
    "Convert video dan audio dari YouTube, Instagram, TikTok, Twitter, dan platform lainnya. Gratis, cepat, tanpa registrasi.",
  keywords: [
    "video converter",
    "mp3 converter",
    "youtube downloader",
    "instagram downloader",
    "tiktok downloader",
  ],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-background text-foreground antialiased`}
      >
        <ThemeProvider>
          {/* Header with theme toggle */}
          <header className="fixed top-0 right-0 z-50 p-4">
            <ThemeToggle />
          </header>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
