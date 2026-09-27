import type { Metadata } from "next";

// /about/ only redirects to the home page: keep it out of search results.
export const metadata: Metadata = { title: "About", robots: { index: false, follow: true }, alternates: { canonical: "/" } };

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
