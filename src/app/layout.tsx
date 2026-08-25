import type { Metadata } from "next";
// Rally Rhythm reminder: this root shell hosts the site-wide motion controller;
// keep navigation feedback purposeful and always honor reduced-motion settings.
// Self-hosted fonts avoid build-time network dependency.
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { getSiteSettings, COLOR_FIELDS, hexToRgbChannels } from "@/lib/siteSettings";
import InteractionFX from "@/components/InteractionFX";
import MotionDirector from "@/components/MotionDirector";
import PickleballBackdrop from "@/components/PickleballBackdrop";
import PickleballShader from "@/components/PickleballShader";
import AmbientCourtMusic from "@/components/AmbientCourtMusic";
import VisitTracker from "@/components/VisitTracker";
import PendingBookingLock from "@/components/PendingBookingLock";

// The site's branding and content are admin-managed, so this shell must use
// request-time data rather than a stale build-time snapshot.
export const dynamic = "force-dynamic";

const CSS_VAR_BY_FIELD: Record<string, string> = {
  colorOrange: "--color-orange",
  colorOrangeDark: "--color-orange-dark",
  colorOrangeLight: "--color-orange-light",
  colorBlue: "--color-blue",
  colorBlueDark: "--color-blue-dark",
  colorBlueLight: "--color-blue-light",
  colorInk: "--color-ink",
  colorCream: "--color-cream",
  colorEnergyCyan: "--color-energy-cyan",
  colorEnergyRed: "--color-energy-red",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: `${settings.siteName} ${settings.siteTagline} | Talisay City, Cebu`,
    description:
      "Book your pickleball court at Heide's Pickleball Hub — open 20/7 in Talisay City, Cebu. Paddle & ball rentals, free parking. Reserve your slot online in minutes.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const overrides = COLOR_FIELDS.map((field) => {
    const cssVar = CSS_VAR_BY_FIELD[field];
    const value = (settings as any)[field] as string;
    return `${cssVar}: ${hexToRgbChannels(value)};`;
  }).join(" ");

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --font-display: 'Fredoka', sans-serif; --font-body: 'Inter', sans-serif; ${overrides} }`,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <PickleballBackdrop />
        <PickleballShader />
        <div className="glass-ambient-bg" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <VisitTracker />
        <PendingBookingLock />
        {children}
        <MotionDirector />
        <InteractionFX />
        <AmbientCourtMusic
          musicUrl={settings.musicUrl}
          musicTitle={settings.musicTitle}
          autoplayDefault={settings.musicAutoplay}
        />
      </body>
    </html>
  );
}
