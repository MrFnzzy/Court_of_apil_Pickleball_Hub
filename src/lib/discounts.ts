import { prisma } from "./prisma";

// Characters chosen to avoid visual ambiguity when a customer types a code
// by hand (no 0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCodeSuffix(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

// Generates a unique promo code for a spin-wheel win, retrying on the rare
// collision. Prefixed SPIN- so these are recognizable at a glance in the
// Discounts tab and separate from admin-typed codes.
export async function generateSpinDiscountCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `SPIN-${randomCodeSuffix(6)}`;
    const existing = await prisma.discount.findUnique({ where: { code } });
    if (!existing) return code;
  }
  // Extremely unlikely fallback — widen the suffix.
  return `SPIN-${randomCodeSuffix(10)}`;
}

export type DiscountLookup = {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  startDate: Date;
  endDate: Date | null;
  maxPerCustomer: number;
};

export type ValidateResult =
  | { valid: true; discount: DiscountLookup; discountAmount: number }
  | { valid: false; error: string };

// Validation against an already-fetched Discount row + a subtotal (+ the
// customer's email, so per-customer limits can be enforced) — used both by
// the public /api/discounts/validate preview endpoint and by the booking
// route right before it commits the redemption, so the two never disagree
// about whether a code is usable.
export async function checkDiscountUsable(
  discount: DiscountLookup | null,
  subtotal: number,
  email?: string | null
): Promise<ValidateResult> {
  if (!discount) {
    return { valid: false, error: "That promo code doesn't exist." };
  }
  if (!discount.active) {
    return { valid: false, error: "That promo code is no longer active." };
  }
  const now = new Date();
  if (now < discount.startDate) {
    return { valid: false, error: "That promo code isn't active yet." };
  }
  if (discount.endDate && now > discount.endDate) {
    return { valid: false, error: "That promo code has expired." };
  }
  if (discount.maxRedemptions !== null && discount.redemptionCount >= discount.maxRedemptions) {
    return { valid: false, error: "That promo code has already been fully redeemed." };
  }
  if (email && email.trim()) {
    const customerRedemptions = await prisma.discountRedemption.count({
      where: { discountId: discount.id, email: email.toLowerCase().trim() },
    });
    if (customerRedemptions >= discount.maxPerCustomer) {
      return {
        valid: false,
        error:
          discount.maxPerCustomer === 1
            ? "You've already used this promo code."
            : `You've reached the maximum uses (${discount.maxPerCustomer}) for this promo code.`,
      };
    }
  }
  if (subtotal <= 0) {
    return { valid: false, error: "Add items to your booking before applying a promo code." };
  }
  const discountAmount = Math.min(subtotal, Math.round((subtotal * discount.percentage) / 100));
  return { valid: true, discount, discountAmount };
}

export async function findDiscountByCode(rawCode: string): Promise<DiscountLookup | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  return prisma.discount.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      percentage: true,
      active: true,
      maxRedemptions: true,
      redemptionCount: true,
      startDate: true,
      endDate: true,
      maxPerCustomer: true,
    },
  });
}
