import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, email } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Promo code is required." }, { status: 400 });
    }
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required to validate a promo code." }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { _count: { select: { redemptions: true } } },
    });

    if (!promo) {
      return NextResponse.json({ error: "Invalid promo code." }, { status: 404 });
    }

    if (!promo.active) {
      return NextResponse.json({ error: "This promo code is currently inactive." }, { status: 400 });
    }

    const now = new Date();
    if (now < promo.startDate) {
      return NextResponse.json({ error: "This promo code is not yet active." }, { status: 400 });
    }
    if (now > promo.endDate) {
      return NextResponse.json({ error: "This promo code has expired." }, { status: 400 });
    }

    if (promo.maxRedemptions !== null && promo._count.redemptions >= promo.maxRedemptions) {
      return NextResponse.json(
        { error: "This promo code has reached its redemption limit." },
        { status: 400 }
      );
    }

    // Check per-customer limit
    const customerRedemptions = await prisma.promoRedemption.count({
      where: { promoCodeId: promo.id, email: email.toLowerCase().trim() },
    });
    if (customerRedemptions >= promo.maxPerCustomer) {
      return NextResponse.json(
        {
          error:
            promo.maxPerCustomer === 1
              ? "You have already used this promo code."
              : `You have reached the maximum uses (${promo.maxPerCustomer}) for this promo code.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      discountPercent: promo.discountPercent,
      promoCodeId: promo.id,
      message: `${promo.discountPercent}% discount applied!`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
