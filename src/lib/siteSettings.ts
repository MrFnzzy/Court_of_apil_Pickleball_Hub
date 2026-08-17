import { prisma } from "./prisma";

const SINGLETON_ID = "singleton";

export type SiteSettings = {
  siteName: string;
  siteTagline: string;
  logoUrl: string | null;
  wordmarkLogoUrl: string | null;

  colorOrange: string;
  colorOrangeDark: string;
  colorOrangeLight: string;
  colorBlue: string;
  colorBlueDark: string;
  colorBlueLight: string;
  colorInk: string;
  colorCream: string;
  colorEnergyCyan: string;
  colorEnergyRed: string;

  heroBadgeText: string;
  heroHeadlineLine1: string;
  heroHeadlineLine2: string;
  heroSubtext: string;
  heroPrimaryButtonText: string;
  heroSecondaryButtonText: string;
  heroCardTitle: string;
  heroCardSubtitle: string;

  aboutHeading: string;
  aboutText: string;
  aboutBullets: string;

  footerTagline: string;
  footerLocationText: string;
  footerMapUrl: string;
  footerHoursText: string;

  musicUrl: string | null;
  musicTitle: string;
  musicAutoplay: boolean;

  closedHours: number[];
  adminNotificationEmail: string;
  adminLoginEmail: string;

  confirmationEmailSubject: string;
  confirmationEmailHeading: string;
  confirmationEmailBody: string;

  thankYouEmailSubject: string;
  thankYouEmailHeading: string;
  thankYouEmailBody: string;
  thankYouEmailButtonText: string;

  spinInviteEmailSubject: string;
  spinInviteEmailHeading: string;
  spinInviteEmailBody: string;
  spinInviteEmailButtonText: string;
};

export const EDITABLE_SITE_SETTINGS_FIELDS: (keyof SiteSettings)[] = [
  "siteName",
  "siteTagline",
  "logoUrl",
  "wordmarkLogoUrl",
  "colorOrange",
  "colorOrangeDark",
  "colorOrangeLight",
  "colorBlue",
  "colorBlueDark",
  "colorBlueLight",
  "colorInk",
  "colorCream",
  "colorEnergyCyan",
  "colorEnergyRed",
  "heroBadgeText",
  "heroHeadlineLine1",
  "heroHeadlineLine2",
  "heroSubtext",
  "heroPrimaryButtonText",
  "heroSecondaryButtonText",
  "heroCardTitle",
  "heroCardSubtitle",
  "aboutHeading",
  "aboutText",
  "aboutBullets",
  "footerTagline",
  "footerLocationText",
  "footerMapUrl",
  "footerHoursText",
  "musicUrl",
  "musicTitle",
  "musicAutoplay",
  "closedHours",
  "adminNotificationEmail",
  "adminLoginEmail",
  "confirmationEmailSubject",
  "confirmationEmailHeading",
  "confirmationEmailBody",
  "thankYouEmailSubject",
  "thankYouEmailHeading",
  "thankYouEmailBody",
  "thankYouEmailButtonText",
  "spinInviteEmailSubject",
  "spinInviteEmailHeading",
  "spinInviteEmailBody",
  "spinInviteEmailButtonText",
];

// The email address the admin login's two-factor code actually gets sent
// to: adminLoginEmail if the admin has set one in the Security tab,
// otherwise whatever GMAIL_USER the site already sends mail from.
export async function resolveAdminLoginEmail(): Promise<string> {
  const settings = await getSiteSettings();
  if (settings.adminLoginEmail) return settings.adminLoginEmail;
  const { defaultAdminEmail } = await import("./email");
  return defaultAdminEmail() || "";
}

// Hours (0-23) are validated as a set — dedupe + sort so the stored array is
// always in a predictable order for the admin UI and the /api/slots lookup.
export function normalizeClosedHours(hours: unknown): number[] | null {
  if (!Array.isArray(hours)) return null;
  const clean = new Set<number>();
  for (const h of hours) {
    const n = Number(h);
    if (!Number.isInteger(n) || n < 0 || n > 23) return null;
    clean.add(n);
  }
  return Array.from(clean).sort((a, b) => a - b);
}

export const COLOR_FIELDS: (keyof SiteSettings)[] = [
  "colorOrange",
  "colorOrangeDark",
  "colorOrangeLight",
  "colorBlue",
  "colorBlueDark",
  "colorBlueLight",
  "colorInk",
  "colorCream",
  "colorEnergyCyan",
  "colorEnergyRed",
];

// Reads the current site settings, creating the singleton row with schema
// defaults on first use (e.g. right after this feature is deployed).
export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return row;
}

export async function updateSiteSettings(data: Partial<SiteSettings>): Promise<SiteSettings> {
  const row = await prisma.siteSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
  return row;
}

// Splits the newline-separated bullets string into a clean list for rendering.
export function parseBullets(bullets: string): string[] {
  return bullets
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isValidHex(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

// Converts a "#rrggbb" (or "#rgb") hex color into a "r g b" channel triplet,
// the format Tailwind's rgb(var(--x) / <alpha-value>) pattern expects.
export function hexToRgbChannels(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "0 0 0";
  return `${r} ${g} ${b}`;
}
