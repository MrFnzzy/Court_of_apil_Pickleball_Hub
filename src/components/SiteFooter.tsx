"use client";

import { useEffect, useState } from "react";
import BallIcon from "./icons/BallIcon";
import FacebookIcon from "./icons/FacebookIcon";

type FooterSettings = {
  siteName: string;
  footerTagline: string;
  footerLocationText: string;
  footerMapUrl: string;
  footerHoursText: string;
};

const DEFAULT_FOOTER: FooterSettings = {
  siteName: "Heide's",
  footerTagline:
    "An exclusive outdoor pickleball court in Talisay City, Cebu. Open 20/7, with paddle & ball rentals and free parking.",
  footerLocationText: "Talisay City, Cebu, Philippines",
  footerMapUrl: "https://maps.app.goo.gl/5cj5BP3vJSMy94p48?g_st=afm",
  footerHoursText: "Open 24 hours a day, every day.",
};

export default function SiteFooter() {
  const [settings, setSettings] = useState<FooterSettings>(DEFAULT_FOOTER);

  useEffect(() => {
    fetch("/api/site-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings) {
          setSettings({
            siteName: d.settings.siteName,
            footerTagline: d.settings.footerTagline,
            footerLocationText: d.settings.footerLocationText,
            footerMapUrl: d.settings.footerMapUrl,
            footerHoursText: d.settings.footerHoursText,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="mt-20 relative bg-court-ink text-court-cream/90 overflow-hidden">
      <div className="glass-orb glass-orb--blue h-72 w-72 -bottom-32 -right-20 opacity-50" />
      <div className="relative z-[1] max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-5 sm:grid-cols-3">
        <div className="glass-panel-dark rounded-court p-5">
          <div className="flex items-center gap-2 mb-2">
            <BallIcon className="h-6 w-6 text-court-blue" />
            <p className="font-display font-700 text-lg text-white">{settings.siteName}</p>
          </div>
          <p className="text-sm text-court-cream/70">{settings.footerTagline}</p>
          <a
            href="https://www.facebook.com/profile.php?id=61591992821734"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-court-blue hover:underline mt-2 focus-ring"
          >
            <FacebookIcon className="h-4 w-4" />
            Follow us on Facebook
          </a>
        </div>
        <div className="glass-panel-dark rounded-court p-5">
          <p className="font-semibold text-white mb-2 text-sm uppercase tracking-wide">Location</p>
          <p className="text-sm text-court-cream/70">{settings.footerLocationText}</p>
          <a
            href={settings.footerMapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-court-blue hover:underline inline-block mt-1 focus-ring"
          >
            Open in Google Maps →
          </a>
        </div>
        <div className="glass-panel-dark rounded-court p-5">
          <p className="font-semibold text-white mb-2 text-sm uppercase tracking-wide">Hours</p>
          <p className="text-sm text-court-cream/70">{settings.footerHoursText}</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 px-4 sm:px-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-court-cream/50">
        <span>
          © {new Date().getFullYear()} {settings.siteName} Pickleball Hub. All rights reserved.
        </span>
        <span className="hidden sm:inline text-court-cream/20">·</span>
        <span>
          Built by{" "}
          <a
            href="https://www.facebook.com/nio.satuito"
            target="_blank"
            rel="noreferrer"
            className="text-court-cream/70 hover:text-court-blue hover:underline focus-ring"
          >
            Niño Satuito
          </a>
        </span>
      </div>
    </footer>
  );
}
