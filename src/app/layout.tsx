import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { getSiteSettings, COLOR_FIELDS, hexToRgbChannels } from "@/lib/siteSettings";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const CSS_VAR_BY_FIELD: Record<string, string> = {
  colorOrange: "--color-orange",
  colorOrangeDark: "--color-orange-dark",
  colorOrangeLight: "--color-orange-light",
  colorBlue: "--color-blue",
  colorBlueDark: "--color-blue-dark",
  colorBlueLight: "--color-blue-light",
  colorInk: "--color-ink",
  colorCream: "--color-cream",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: `${settings.siteName} ${settings.siteTagline} | Talisay City, Cebu`,
    description:
      "Book your pickleball court at Court of Apil — open 24/7 in Talisay City, Cebu. Paddle & ball rentals, free parking. Reserve your slot online in minutes.",
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
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`}>
      <head>
        {/* Admin-controlled brand colors, generated from Site Settings */}
        <style dangerouslySetInnerHTML={{ __html: `:root { ${overrides} }` }} />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
