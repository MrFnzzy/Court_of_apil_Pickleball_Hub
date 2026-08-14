"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import PaddleIcon from "./icons/PaddleIcon";

type Branding = {
  siteName: string;
  siteTagline: string;
  logoUrl: string | null;
  wordmarkLogoUrl: string | null;
};

const DEFAULT_BRANDING: Branding = {
  siteName: "Heide's",
  siteTagline: "Pickleball Hub",
  logoUrl: null,
  wordmarkLogoUrl: "/heides-wordmark.png",
};

export default function SiteHeader() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  useEffect(() => {
    fetch("/api/site-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings) {
          setBranding({
            siteName: d.settings.siteName,
            siteTagline: d.settings.siteTagline,
            logoUrl: d.settings.logoUrl,
            wordmarkLogoUrl: d.settings.wordmarkLogoUrl,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-4">
      <div className="glass-nav max-w-6xl mx-auto rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          {/* The small icon/ball on the left. Uses whatever logo is set in
              /admin → Branding; falls back to the paddle icon when none is
              set. The site name + tagline are always rendered as real text
              beside it, so they never disappear even if the logo image is
              missing, still loading, or fails to load. */}
          {branding.logoUrl ? (
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden ring-2 ring-white/70 shadow-court group-hover:animate-bounce-ball">
              <Image src={branding.logoUrl} alt={branding.siteName} fill className="object-cover" />
            </span>
          ) : (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-court-orange text-white ring-2 ring-white/70 shadow-court group-hover:animate-bounce-ball">
              <PaddleIcon className="h-5 w-5" />
            </span>
          )}
          {branding.wordmarkLogoUrl ? (
            <span className="relative inline-block h-9 w-[150px] sm:h-10 sm:w-[168px] shrink-0">
              <Image
                src={branding.wordmarkLogoUrl}
                alt={`${branding.siteName} ${branding.siteTagline}`}
                fill
                className="object-contain object-left"
                priority
              />
            </span>
          ) : (
            <div className="leading-tight">
              <p className="font-display font-700 text-lg text-court-ink tracking-tight">{branding.siteName}</p>
              <p className="text-[11px] uppercase tracking-widest text-court-orange-dark font-semibold -mt-0.5">
                {branding.siteTagline}
              </p>
            </div>
          )}
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#schedule"
            className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-full hover:bg-white/50 transition-colors focus-ring"
          >
            Schedule
          </Link>
          <Link
            href="/#pricing"
            className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-full hover:bg-white/50 transition-colors focus-ring"
          >
            Pricing
          </Link>
          <Link
            href="/book"
            className="glass-btn-primary px-4 py-2.5 text-sm font-semibold text-white rounded-full transition-shadow focus-ring"
          >
            Book Now
          </Link>
        </nav>
      </div>
    </header>
  );
}
