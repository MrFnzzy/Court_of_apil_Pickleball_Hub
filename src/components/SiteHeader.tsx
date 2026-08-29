"use client";

/** Rally Rhythm styling only: navigation destinations and booking flow remain
 * exactly as supplied; visual feedback is handled entirely in global CSS. */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PaddleIcon from "./icons/PaddleIcon";

type Branding = {
  siteName: string;
  siteTagline: string;
  logoUrl: string | null;
  wordmarkLogoUrl: string | null;
  navScheduleLabel: string;
  navPricingLabel: string;
  navFaqLabel: string;
  navTrackLabel: string;
  navBookNowLabel: string;
};

const DEFAULT_BRANDING: Branding = {
  siteName: "Heide's",
  siteTagline: "Pickleball Hub",
  logoUrl: null,
  wordmarkLogoUrl: "/heides-wordmark.png",
  navScheduleLabel: "Schedule",
  navPricingLabel: "Pricing",
  navFaqLabel: "FAQ",
  navTrackLabel: "Track booking",
  navBookNowLabel: "Book Now",
};

export default function SiteHeader() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/site-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.settings) {
          setBranding({
            siteName: data.settings.siteName,
            siteTagline: data.settings.siteTagline,
            logoUrl: data.settings.logoUrl,
            wordmarkLogoUrl: data.settings.wordmarkLogoUrl,
            navScheduleLabel: data.settings.navScheduleLabel,
            navPricingLabel: data.settings.navPricingLabel,
            navFaqLabel: data.settings.navFaqLabel,
            navTrackLabel: data.settings.navTrackLabel,
            navBookNowLabel: data.settings.navBookNowLabel,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className={`site-header sticky top-3 z-40 px-3 sm:px-4 ${scrolled ? "site-header--scrolled" : ""}`}>
      <div className="site-nav-shell glass-nav max-w-6xl mx-auto rounded-full px-4 sm:px-6 py-2.5"> 
        <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
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
              <p className="text-[11px] uppercase tracking-widest text-court-orange-dark font-semibold -mt-0.5">{branding.siteTagline}</p>
            </div>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-1 sm:gap-2" aria-label="Primary navigation">
          <Link href="/#schedule" className="site-nav-link hidden md:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-full hover:bg-white/50 transition-colors focus-ring">
            {branding.navScheduleLabel}
          </Link>
          <Link href="/#pricing" className="site-nav-link hidden md:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-full hover:bg-white/50 transition-colors focus-ring">
            {branding.navPricingLabel}
          </Link>
          <Link href="/#faq" className="site-nav-link hidden md:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-full hover:bg-white/50 transition-colors focus-ring">
            {branding.navFaqLabel}
          </Link>
          <Link href="/track" className="site-nav-link hidden md:inline-block px-3 py-2 text-sm font-medium text-court-ink/80 hover:text-court-orange-dark rounded-full hover:bg-white/50 transition-colors focus-ring">
            {branding.navTrackLabel}
          </Link>
          <Link href="/book" className="fx-magnetic glass-btn-primary px-4 py-2.5 text-sm font-semibold text-white rounded-full transition-shadow focus-ring">
            {branding.navBookNowLabel}
          </Link>
        </nav>
        <div className="flex md:hidden items-center gap-2">
          <Link href="/book" className="glass-btn-primary px-3.5 py-2.5 text-xs font-semibold text-white rounded-full focus-ring">Book</Link>
          <button type="button" className="focus-ring rounded-full bg-white/60 p-2 text-court-ink" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? "Close navigation" : "Open navigation"}>
            {menuOpen ? <span className="text-lg leading-none">×</span> : <span className="text-lg leading-none">☰</span>}
          </button>
        </div>
        </div>
        <div className="mobile-menu md:hidden absolute left-3 right-3 top-[calc(100%+10px)] rounded-3xl bg-white/95 p-2 shadow-2xl backdrop-blur-xl" data-open={menuOpen}>
          <Link href="/#schedule" className="block rounded-2xl px-4 py-3 text-sm font-semibold text-court-ink hover:bg-court-blue-light/50">{branding.navScheduleLabel}</Link>
          <Link href="/#pricing" className="block rounded-2xl px-4 py-3 text-sm font-semibold text-court-ink hover:bg-court-blue-light/50">{branding.navPricingLabel}</Link>
          <Link href="/#faq" className="block rounded-2xl px-4 py-3 text-sm font-semibold text-court-ink hover:bg-court-blue-light/50">{branding.navFaqLabel}</Link>
          <Link href="/track" className="block rounded-2xl px-4 py-3 text-sm font-semibold text-court-ink hover:bg-court-blue-light/50">{branding.navTrackLabel}</Link>
        </div>
        <div className="site-nav-progress" aria-hidden="true" />
      </div>
    </header>
  );
}
