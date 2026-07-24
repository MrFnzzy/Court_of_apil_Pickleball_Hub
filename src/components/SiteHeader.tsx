"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import PaddleIcon from "./icons/PaddleIcon";

type Branding = {
  siteName: string;
  siteTagline: string;
  logoUrl: string | null;
};

const DEFAULT_BRANDING: Branding = {
  siteName: "Court of Apil",
  siteTagline: "Pickleball Hub",
  logoUrl: null,
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
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-court-cream/90 backdrop-blur border-b-2 border-court-orange/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          {branding.logoUrl ? (
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-court group-hover:animate-bounce-ball">
              <Image src={branding.logoUrl} alt={branding.siteName} fill className="object-cover" />
            </span>
          ) : (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-court-orange text-white shadow-court group-hover:animate-bounce-ball">
              <PaddleIcon className="h-5 w-5" />
            </span>
          )}
          <div className="leading-tight">
            <p className="font-display font-700 text-lg text-court-ink tracking-tight">{branding.siteName}</p>
            <p className="text-[11px] uppercase tracking-widest text-court-orange-dark font-semibold -mt-0.5">
              {branding.siteTagline}
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#schedule"
            className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-lg transition-colors focus-ring"
          >
            Schedule
          </Link>
          <Link
            href="/#pricing"
            className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-lg transition-colors focus-ring"
          >
            Pricing
          </Link>
          <Link
            href="/book"
            className="px-4 py-2.5 text-sm font-semibold bg-court-orange text-white rounded-full shadow-court hover:bg-court-orange-dark transition-colors focus-ring"
          >
            Book Now
          </Link>
        </nav>
      </div>
    </header>
  );
}
