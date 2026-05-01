"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Film, Music } from "lucide-react";

export type Format = "video" | "audio";
export type Quality = "360" | "480" | "720" | "1080" | "4k" | "128kbps" | "256kbps" | "320kbps";

interface FormatSelectorProps {
  onFormatChange: (format: Format) => void;
  onQualityChange: (quality: Quality) => void;
}

const VIDEO_QUALITIES: { value: Quality; label: string; desc: string }[] = [
  { value: "360", label: "360p", desc: "Hemat kuota" },
  { value: "480", label: "480p", desc: "Standar" },
  { value: "720", label: "720p", desc: "HD" },
  { value: "1080", label: "1080p", desc: "Full HD" },
  { value: "4k", label: "4K", desc: "Ultra HD" },
];

const AUDIO_QUALITIES: { value: Quality; label: string; desc: string }[] = [
  { value: "128kbps", label: "128 kbps", desc: "Standar" },
  { value: "256kbps", label: "256 kbps", desc: "Bagus" },
  { value: "320kbps", label: "320 kbps", desc: "Terbaik" },
];

export function FormatSelector({
  onFormatChange,
  onQualityChange,
}: FormatSelectorProps) {
  const [format, setFormat] = useState<Format>("video");
  const [quality, setQuality] = useState<Quality>("720");

  const qualities = format === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES;

  const handleFormatChange = (value: string) => {
    const newFormat = value as Format;
    setFormat(newFormat);
    onFormatChange(newFormat);
    const newQualities = newFormat === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES;
    const defaultQuality = newQualities[2]?.value ?? newQualities[0].value;
    setQuality(defaultQuality);
    onQualityChange(defaultQuality);
  };

  const handleQualityChange = (v: Quality | null) => {
    if (!v) return;
    setQuality(v);
    onQualityChange(v);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      {/* Format tabs */}
      <Tabs value={format} onValueChange={handleFormatChange}>
        <TabsList className="h-10">
          <TabsTrigger value="video" className="gap-1.5 px-4">
            <Film className="h-4 w-4" />
            Video
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-1.5 px-4">
            <Music className="h-4 w-4" />
            MP3
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Quality selector */}
      <Select
        value={quality}
        onValueChange={handleQualityChange}
      >
        <SelectTrigger className="w-[180px] h-10">
          <SelectValue placeholder="Pilih kualitas" />
        </SelectTrigger>
        <SelectContent>
          {qualities.map((q) => (
            <SelectItem key={q.value} value={q.value}>
              <span className="font-medium inline-block w-16">{q.label}</span>
              <span className="text-muted-foreground text-xs">
                {q.desc}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
