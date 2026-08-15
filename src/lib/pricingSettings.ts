import { prisma } from "./prisma";
import { DEFAULT_PRICING, PricingSettings } from "./pricing";

const SINGLETON_ID = "singleton";

function toSettings(row: {
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
}): PricingSettings {
  return {
    weekdayDayPrice: row.weekdayDayPrice,
    weekdayNightPrice: row.weekdayNightPrice,
    weekendPrice: row.weekendPrice,
  };
}

// Reads the current pricing settings, creating the singleton row with
// defaults on first use (e.g. right after this feature is deployed).
export async function getPricingSettings(): Promise<PricingSettings> {
  const row = await prisma.pricingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...DEFAULT_PRICING },
    update: {},
  });
  return toSettings(row);
}

export async function updatePricingSettings(data: Partial<PricingSettings>): Promise<PricingSettings> {
  const row = await prisma.pricingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...DEFAULT_PRICING, ...data },
    update: data,
  });
  return toSettings(row);
}
