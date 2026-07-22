/**
 * Court of Apil — pricing rules
 *
 * Mon-Fri 6:00 AM (hour 6) - 4:59 PM (i.e. hours 6..16)  -> 200 / hour
 * Mon-Fri 5:00 PM (hour 17) - 5:59 AM next day            -> 250 / hour
 * Sat & Sun, all 24 hours                                 -> 250 / hour
 *
 * `date` is a plain Date representing the calendar day being booked (local).
 * `hour` is 0-23, the starting hour of the slot.
 */
export function priceForSlot(date: Date, hour: number): number {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return 250;

  // Weekday
  const isDaySlot = hour >= 6 && hour < 17; // 6AM - 4:59PM
  return isDaySlot ? 200 : 250;
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

// Paddle & ball rental packages
export const RENTAL_PACKAGES: Record<number, { price: number; balls: number; label: string }> = {
  0: { price: 0, balls: 0, label: "No rental" },
  1: { price: 100, balls: 2, label: "1 paddle (with 2 balls)" },
  2: { price: 150, balls: 3, label: "2 paddles (with 3 balls)" },
};

export function rentalPrice(paddleCount: number): number {
  return RENTAL_PACKAGES[paddleCount]?.price ?? 0;
}

// Court is open 24 hours: hours 0-23 all bookable (each slot = 1 hour)
export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
