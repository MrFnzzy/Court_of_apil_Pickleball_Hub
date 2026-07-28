"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Branding = {
  siteName: string;
  siteTagline: string;
  logoUrl: string | null;
};

// Bundled wordmark used whenever no custom logo has been uploaded in
// /admin → Branding. This keeps the header logo fixed/consistent instead
// of falling back to a generic icon.
const DEFAULT_LOGO_URL = "/heides-logo.png";

const DEFAULT_BRANDING: Branding = {
  siteName: "Heide's",
  siteTagline: "Pickleball Hub",
  logoUrl: DEFAULT_LOGO_URL,
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
            // Fall back to the bundled wordmark whenever no custom logo has
            // been uploaded in /admin, instead of showing no logo at all.
            logoUrl: d.settings.logoUrl || DEFAULT_LOGO_URL,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-court-cream/90 backdrop-blur border-b-2 border-court-orange/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          {/* Fixed-size wordmark logo: a set height with auto width keeps the
              full graphic (paddle, balls, and "Heide's Pickleball Hub" text)
              visible without cropping it into a circle. */}
          <span className="relative h-9 sm:h-11 w-[150px] sm:w-[184px] shrink-0 group-hover:animate-bounce-ball">
            <Image
              src={branding.logoUrl || DEFAULT_LOGO_URL}
              alt={`${branding.siteName} ${branding.siteTagline}`}
              fill
              priority
              className="object-contain object-left"
            />
          </span>
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
