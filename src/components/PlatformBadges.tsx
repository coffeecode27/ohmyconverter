"use client";

import { Badge } from "@/components/ui/badge";
import { SUPPORTED_PLATFORMS } from "@/lib/platform-detect";

export function PlatformBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm text-muted-foreground mr-1">Support:</span>
      {SUPPORTED_PLATFORMS.map((p) => {
        const Icon = p.Icon;
        return (
          <Badge
            key={p.name}
            variant="outline"
            className="gap-1.5 py-1 px-3 text-xs border-muted-foreground/30 hover:border-primary/50 transition-colors"
          >
            <Icon className="h-3 w-3" />
            {p.label}
          </Badge>
        );
      })}
    </div>
  );
}
