import {
  FaYoutube,
  FaInstagram,
  FaTiktok,
  FaTwitter,
  FaFacebook,
  FaLink,
} from "react-icons/fa";
import type { IconType } from "react-icons";

export type Platform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "facebook"
  | "unknown";

export interface PlatformInfo {
  name: Platform;
  label: string;
  color: string;
  Icon: IconType;
}

const PLATFORM_RULES: { patterns: RegExp[]; info: PlatformInfo }[] = [
  {
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\//,
      /(?:https?:\/\/)?youtu\.be\//,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\//,
    ],
    info: { name: "youtube", label: "YouTube", color: "bg-red-500", Icon: FaYoutube },
  },
  {
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\//,
    ],
    info: { name: "instagram", label: "Instagram", color: "bg-pink-500", Icon: FaInstagram },
  },
  {
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\//,
      /(?:https?:\/\/)?vm\.tiktok\.com\//,
    ],
    info: { name: "tiktok", label: "TikTok", color: "bg-gray-900", Icon: FaTiktok },
  },
  {
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\//,
    ],
    info: { name: "twitter", label: "X/Twitter", color: "bg-blue-500", Icon: FaTwitter },
  },
  {
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\//,
      /(?:https?:\/\/)?fb\.watch\//,
    ],
    info: { name: "facebook", label: "Facebook", color: "bg-blue-600", Icon: FaFacebook },
  },
];

export function detectPlatform(url: string): PlatformInfo {
  for (const { patterns, info } of PLATFORM_RULES) {
    if (patterns.some((p) => p.test(url))) {
      return info;
    }
  }
  return {
    name: "unknown",
    label: "Unknown",
    color: "bg-gray-500",
    Icon: FaLink, // fallback
  };
}

export const SUPPORTED_PLATFORMS: PlatformInfo[] = PLATFORM_RULES.map(
  (r) => r.info
);
