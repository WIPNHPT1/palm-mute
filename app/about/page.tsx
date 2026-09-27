"use client";

// The About content now lives on the Count In home page. Netlify answers /about/ with a permanent
// redirect (netlify.toml); this page is the fallback for hosts that don't read that file.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AboutMoved() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return (
    <div className="mx-auto w-full max-w-[1440px] px-[20px] py-[48px] tablet:px-[32px] desktop:px-[56px]">
      <p className="font-mono text-[13px] text-text-muted">
        About has moved to the home page.{" "}
        <Link href="/" className="text-accent underline underline-offset-4">
          Go to Count In
        </Link>
      </p>
    </div>
  );
}
