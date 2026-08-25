/**
 * Heide's Pickleball Hub — pricing rules
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
};

// The three per-slot rates that make up a price tier — shared shape between
// the main/default settings and each seasonal override below, so either one
// can be plugged straight into priceForSlot()'s rate lookup.
export type PricingRates = {
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
};

// An admin-defined "adjusted" rate that overrides the main/default rates
// during specific calendar months (1 = Jan .. 12 = Dec). Optional and
// additive — the main rates in PricingSettings always remain the fallback
// for any month not covered by an active override.
export type SeasonalPriceOverride = PricingRates & {
  id: string;
  label: string;
  months: number[];
  active: boolean;
  // Custom text for the "rates changed" popup shown to a customer who picks
  // a date inside this override's months (null/"" -> use
  // defaultSeasonalPopupMessage() below).
  popupMessage: string | null;
  // ISO string of when this override was last saved — used as the
  // sessionStorage key for the popup so editing the override (including
  // just the message) makes it reappear even for visitors who already
  // dismissed the previous version this session.
  updatedAt: string;
};

export type PricingSettings = PricingRates & {
  overrides?: SeasonalPriceOverride[];
};

export function priceForSlot(date: Date, hour: number, settings: PricingSettings = DEFAULT_PRICING): number {
  const rates = ratesForDate(date, settings);
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return rates.weekendPrice;

  // Weekday
  const isDaySlot = hour >= 6 && hour < 17; // 6AM - 4:59PM
  return isDaySlot ? rates.weekdayDayPrice : rates.weekdayNightPrice;
}

// The active seasonal override (if any) covering this date's month, or null
// if the date just uses the main/default rates. Shared by ratesForDate()
// below and by the booking page's "rates changed" popup, so both agree on
// exactly which override applies to a given date.
export function overrideForDate(date: Date, settings: PricingSettings = DEFAULT_PRICING): SeasonalPriceOverride | null {
  const month = date.getMonth() + 1; // 1-12
  return settings.overrides?.find((o) => o.active && o.months.includes(month)) ?? null;
}

// Picks the main rates or, if an active seasonal override covers this
// date's month, that override's adjusted rates instead.
export function ratesForDate(date: Date, settings: PricingSettings = DEFAULT_PRICING): PricingRates {
  return overrideForDate(date, settings) ?? settings;
}

// Auto-built fallback text for the "rates changed" popup when the admin
// hasn't written a custom popupMessage for a seasonal override. Kept
// generic enough to read naturally for both a rate increase (e.g. "soft
// opening" ending) and a rate decrease (e.g. a slow-season discount).
export function defaultSeasonalPopupMessage(override: { label: string }): string {
  return (
    `Dear guest, this date falls outside our soft opening rates. ` +
    `Bookings outside the soft opening period are charged at our regular "${override.label}" rates — see below.`
  );
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

// ---------------------------------------------------------------------
// Rental products — admin-configurable paddle & ball tiers
// ---------------------------------------------------------------------
//
// Paddle and ball rentals used to be two fixed packages each (1/2 paddles,
// 1/3 balls), hardcoded as columns on PricingSettings. They're now rows in
// the RentalProduct table, so the admin can add, relabel, reprice, reorder,
// or deactivate as many tiers as they want per type. Every screen that
// offers a rental derives its options from this same list, so a new tier
// shows up everywhere automatically.

export type RentalProductType = "PADDLE" | "BALL";

export type RentalProduct = {
  id: string;
  type: RentalProductType;
  quantity: number;
  price: number;
  label: string | null;
  active: boolean;
  order: number;
};

// Used as a fallback before the real list has loaded from the API/DB, and
// to seed the table the first time it's read. Mirrors the old hardcoded
// packages so existing pricing doesn't change on upgrade.
export const DEFAULT_RENTAL_PRODUCTS: RentalProduct[] = [
  { id: "default-paddle-1", type: "PADDLE", quantity: 1, price: 100, label: null, active: true, order: 0 },
  { id: "default-paddle-2", type: "PADDLE", quantity: 2, price: 150, label: null, active: true, order: 1 },
  { id: "default-ball-1", type: "BALL", quantity: 1, price: 50, label: null, active: true, order: 0 },
  { id: "default-ball-3", type: "BALL", quantity: 3, price: 120, label: null, active: true, order: 1 },
];

// Auto-generates "1 Paddle" / "3 Balls" etc. when the admin hasn't set a
// custom label for a tier.
export function productLabel(p: { type: RentalProductType; quantity: number; label?: string | null }): string {
  if (p.label && p.label.trim()) return p.label.trim();
  const noun = p.type === "PADDLE" ? "Paddle" : "Ball";
  return `${p.quantity} ${noun}${p.quantity === 1 ? "" : "s"}`;
}

function activeSorted(type: RentalProductType, products: RentalProduct[]): RentalProduct[] {
  return products
    .filter((p) => p.type === type && p.active)
    .sort((a, b) => a.order - b.order || a.quantity - b.quantity);
}

function packagesFor(
  type: RentalProductType,
  products: RentalProduct[],
  noneLabel: string
): Record<number, { price: number; label: string }> {
  const result: Record<number, { price: number; label: string }> = { 0: { price: 0, label: noneLabel } };
  for (const p of activeSorted(type, products)) {
    result[p.quantity] = { price: p.price, label: productLabel(p) };
  }
  return result;
}

// Paddle rental packages, keyed by quantity (0 = none). Balls are a
// separate, paid add-on — see ballPackages()/ballPrice() below.
export function rentalPackages(
  products: RentalProduct[] = DEFAULT_RENTAL_PRODUCTS
): Record<number, { price: number; label: string }> {
  return packagesFor("PADDLE", products, "No rental");
}

export function rentalPrice(paddleCount: number, products: RentalProduct[] = DEFAULT_RENTAL_PRODUCTS): number {
  return rentalPackages(products)[paddleCount]?.price ?? 0;
}

// Ball rental packages, keyed by quantity (0 = none).
export function ballPackages(
  products: RentalProduct[] = DEFAULT_RENTAL_PRODUCTS
): Record<number, { price: number; label: string }> {
  return packagesFor("BALL", products, "No balls");
}

export function ballPrice(ballCount: number, products: RentalProduct[] = DEFAULT_RENTAL_PRODUCTS): number {
  return ballPackages(products)[ballCount]?.price ?? 0;
}

// The set of quantities a customer/admin is currently allowed to pick for
// a given product type (excludes 0 — "none" is always implicitly valid).
export function activeQuantities(type: RentalProductType, products: RentalProduct[] = DEFAULT_RENTAL_PRODUCTS): number[] {
  return activeSorted(type, products).map((p) => p.quantity);
}

// Court is open 24 hours: hours 0-23 all bookable (each slot = 1 hour)
export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
