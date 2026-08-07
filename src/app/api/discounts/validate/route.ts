import { NextRequest, NextResponse } from "next/server";
import { findDiscountByCode, checkDiscountUsable } from "@/lib/discounts";

// POST /api/discounts/validate — { code, subtotal }
// Lets the checkout page preview whether a typed-in code is usable and how
// much it would knock off, without committing anything. The booking route
// re-validates and actually claims the redemption at submit time, so this
// is purely a UI convenience.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, subtotal, email } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json({ valid: false, error: "Please enter a promo code." }, { status: 400 });
  }
  if (typeof subtotal !== "number" || subtotal <= 0) {
    return NextResponse.json({ valid: false, error: "Add items to your booking before applying a promo code." }, { status: 400 });
  }

  const discount = await findDiscountByCode(code);
  const result = await checkDiscountUsable(discount, subtotal, typeof email === "string" ? email : null);

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    code: result.discount.code,
    percentage: result.discount.percentage,
    discountAmount: result.discountAmount,
  });
}
