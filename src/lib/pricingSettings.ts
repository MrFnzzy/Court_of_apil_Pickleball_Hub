import { prisma } from "./prisma";
import { DEFAULT_PRICING, PricingSettings, SeasonalPriceOverride } from "./pricing";

const SINGLETON_ID = "singleton";

function toSettings(row: {
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
}): Omit<PricingSettings, "overrides"> {
  return {
    weekdayDayPrice: row.weekdayDayPrice,
    weekdayNightPrice: row.weekdayNightPrice,
    weekendPrice: row.weekendPrice,
  };
}

function toOverride(row: {
  id: string;
  label: string;
  months: number[];
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
  active: boolean;
  popupMessage: string | null;
  updatedAt: Date;
}): SeasonalPriceOverride {
  return {
    id: row.id,
    label: row.label,
    months: row.months,
    weekdayDayPrice: row.weekdayDayPrice,
    weekdayNightPrice: row.weekdayNightPrice,
    weekendPrice: row.weekendPrice,
    active: row.active,
    popupMessage: row.popupMessage,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Reads the current pricing settings, creating the singleton row with
// defaults on first use (e.g. right after this feature is deployed).
// Includes every seasonal override (active and inactive) so admin screens
// can show the full picture; priceForSlot() itself only honors active ones.
export async function getPricingSettings(): Promise<PricingSettings> {
  const [row, overrideRows] = await Promise.all([
    prisma.pricingSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...DEFAULT_PRICING },
      update: {},
    }),
    prisma.seasonalPricing.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return { ...toSettings(row), overrides: overrideRows.map(toOverride) };
}

export async function updatePricingSettings(data: Partial<Omit<PricingSettings, "overrides">>): Promise<PricingSettings> {
  await prisma.pricingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...DEFAULT_PRICING, ...data },
    update: data,
  });
  return getPricingSettings();
}

// ---------------------------------------------------------------------
// Seasonal price overrides — "adjusted" rates for specific months
// ---------------------------------------------------------------------

export async function getSeasonalOverrides(): Promise<SeasonalPriceOverride[]> {
  const rows = await prisma.seasonalPricing.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toOverride);
}

export async function createSeasonalOverride(data: {
  label: string;
  months: number[];
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
  active?: boolean;
  // Custom "rates changed" popup text for this override. Omit/null to use
  // the auto-built default message (see defaultSeasonalPopupMessage()).
  popupMessage?: string | null;
}): Promise<SeasonalPriceOverride> {
  const row = await prisma.seasonalPricing.create({
    data: {
      label: data.label.trim(),
      months: data.months,
      weekdayDayPrice: data.weekdayDayPrice,
      weekdayNightPrice: data.weekdayNightPrice,
      weekendPrice: data.weekendPrice,
      active: data.active ?? true,
      popupMessage: data.popupMessage?.trim() || null,
    },
  });
  return toOverride(row);
}

export async function updateSeasonalOverride(
  id: string,
  data: Partial<{
    label: string;
    months: number[];
    weekdayDayPrice: number;
    weekdayNightPrice: number;
    weekendPrice: number;
    active: boolean;
    // Pass "" (or null) to clear a custom message and go back to the
    // auto-built default.
    popupMessage: string | null;
  }>
): Promise<SeasonalPriceOverride> {
  const update: Record<string, unknown> = { ...data };
  if ("label" in update) update.label = (update.label as string).toString().trim();
  if ("popupMessage" in update) update.popupMessage = (update.popupMessage as string | null)?.trim() || null;
  const row = await prisma.seasonalPricing.update({ where: { id }, data: update });
  return toOverride(row);
}

export async function deleteSeasonalOverride(id: string): Promise<void> {
  await prisma.seasonalPricing.delete({ where: { id } });
}
