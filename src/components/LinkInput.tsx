"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectPlatform, type PlatformInfo } from "@/lib/platform-detect";
import { Link2, Loader2, ArrowRight } from "lucide-react";

interface LinkInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function LinkInput({ onSubmit, isLoading }: LinkInputProps) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    if (value.trim()) {
      setPlatform(detectPlatform(value));
    } else {
      setPlatform(null);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-3">
      <div className="relative flex items-center gap-2">
        <motion.div
          className="relative flex-1"
          whileFocus={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste link video dari YouTube, Instagram, TikTok..."
            className="pl-10 pr-8 h-12 text-base bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary transition-all"
            disabled={isLoading}
          />
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => { setUrl(""); setPlatform(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </motion.div>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            type="submit"
            size="lg"
            className="h-12 px-6 font-semibold"
            disabled={!url.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                Convert
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      </div>

      {platform && platform.name !== "unknown" && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex items-center gap-2"
        >
          <Badge
            variant="secondary"
            className={`${platform.color} text-white border-0 gap-1.5`}
          >
            <platform.Icon className="h-3 w-3" />
            {platform.label} terdeteksi
          </Badge>
        </motion.div>
      )}
    </form>
  );
}
