import type { Metadata } from "next";

// The live site (palmmute.ai, hosted on Netlify). Canonical URLs, the sitemap and share images resolve against it.
export const SITE_URL = "https://palmmute.ai";
export const SITE_NAME = "Palm/Mute";

/**
 * A page's description, canonical URL and share cards. Next replaces (doesn't merge) a parent's
 * openGraph/twitter objects, so every page sets them in full; the share images come from app/.
 */
export function pageMetadata({ title, shareTitle, description, path }: { title?: Metadata["title"]; shareTitle: string; description: string; path: string }): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url: path, title: shareTitle, description },
    twitter: { card: "summary_large_image", title: shareTitle, description },
  };
}
