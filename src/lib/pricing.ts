/**
 * Court of Apil — pricing rules
 *
 * Mon-Fri day slots  -> weekdayDayPrice   (6:00 AM - 4:59 PM, hours 6..16)
 * Mon-Fri night slots -> weekdayNightPrice (5:00 PM - 5:59 AM, hours 17..23 & 0..5)
 * Sat & Sun, all 24 hours -> weekendPrice
 *
 * All prices are admin-editable (stored in the PricingSettings DB table).
 * This file only contains pure, isomorphic logic — safe to import from both
 * client and server code. It never touches the database directly; server
 * routes fetch the current settings via `getPricingSettings()` in
 * `@/lib/pricingSettings` and pass them in here.
 *
 * `date` is a plain Date representing the calendar day being booked (local).
 * `hour` is 0-23, the starting hour of the slot.
 */

export const DEFAULT_PRICING = {
  weekdayDayPrice: 200,
  weekdayNightPrice: 250,
  weekendPrice: 250,
  rental1Price: 100,
  rental2Price: 150,
};

export type PricingSettings = typeof DEFAULT_PRICING;

export function priceForSlot(date: Date, hour: number, settings: PricingSettings = DEFAULT_PRICING): number {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return settings.weekendPrice;

  // Weekday
  const isDaySlot = hour >= 6 && hour < 17; // 6AM - 4:59PM
  return isDaySlot ? settings.weekdayDayPrice : settings.weekdayNightPrice;
}

export function labelForSlot(hour: number): string {
  const start = formatHour(hour);
  const end = formatHour((hour + 1) % 24);
  return `${start} - ${end}`;
}

function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let displayHour = h % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:00 ${period}`;
}

// Paddle & ball rental packages. Ball counts and labels are fixed; prices
// come from admin-editable settings (falls back to defaults if omitted).
export function rentalPackages(
  settings: PricingSettings = DEFAULT_PRICING
): Record<number, { price: number; balls: number; label: string }> {
  return {
    0: { price: 0, balls: 0, label: "No rental" },
    1: { price: settings.rental1Price, balls: 2, label: "1 paddle (with 2 balls)" },
    2: { price: settings.rental2Price, balls: 3, label: "2 paddles (with 3 balls)" },
  };
}

export function rentalPrice(paddleCount: number, settings: PricingSettings = DEFAULT_PRICING): number {
  return rentalPackages(settings)[paddleCount]?.price ?? 0;
}

// Court is open 24 hours: hours 0-23 all bookable (each slot = 1 hour)
export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
