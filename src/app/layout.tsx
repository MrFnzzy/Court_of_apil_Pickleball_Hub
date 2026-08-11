import type { Metadata } from "next";
// Self-hosted fonts (npm-bundled font files) instead of next/font/google.
// next/font/google fetches font CSS from Google's servers at *build* time —
// when that request is slow, blocked, or Google returns an unexpected
// response shape, the whole production build fails outright (this is what
// caused the "Cannot read properties of null (reading '1')" build error).
// @fontsource ships the actual font files in the npm package itself, so
// there's zero network dependency at build time — it can't fail this way.
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
import PickleballBackdrop from "@/components/PickleballBackdrop";
import AmbientCourtMusic from "@/components/AmbientCourtMusic";
import VisitTracker from "@/components/VisitTracker";

// This app reads branding, copy, and pricing from the database on every
// request (via the admin dashboard). Without this line, Next.js can
// prerender these pages as static HTML at build time, so admin edits would
// only show up after a fresh redeploy. Forcing dynamic rendering means every
// visit reflects whatever was last saved in /admin — no redeploy needed.
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
      "Book your pickleball court at Heide's Pickleball Hub — open 24/7 in Talisay City, Cebu. Paddle & ball rentals, free parking. Reserve your slot online in minutes.",
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
        {/* Admin-controlled brand colors, plus the font-family CSS vars that
            next/font used to generate automatically — now pointing at the
            self-hosted @fontsource files imported above. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --font-display: 'Fredoka', sans-serif; --font-body: 'Inter', sans-serif; ${overrides} }`,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <PickleballBackdrop />
        <VisitTracker />
        {children}
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
