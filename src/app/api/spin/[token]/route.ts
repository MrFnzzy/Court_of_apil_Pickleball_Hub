import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpinWheelSettings } from "@/lib/spinWheelSettings";
import { generateSpinDiscountCode } from "@/lib/discounts";
import { sendSpinResultEmail } from "@/lib/email";

// GET /api/spin/[token]
// Returns enough for the spin page to render: the wheel's current active
// prizes (so it can draw the wedges before anyone clicks anything), plus
// whether this invite has already been used and — if so — what it won.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.spinInvite.findUnique({
    where: { token: params.token },
    include: {
      prize: { select: { label: true } },
      discount: { select: { code: true, percentage: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "This spin link is invalid or has expired." }, { status: 404 });
  }

  const settings = await getSpinWheelSettings();
  const prizes = await prisma.spinPrize.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, label: true, color: true },
  });

  // Test invites (sent by the admin to try the flow end-to-end) always work,
  // even while the feature is switched off for real customers — otherwise
  // there'd be no way to test it before going live.
  const isLive = settings.enabled || invite.isTest;

  return NextResponse.json({
    customerName: invite.customerName,
    alreadySpun: !!invite.spunAt,
    enabled: isLive,
    isTest: invite.isTest,
    prizes,
    result: invite.spunAt
      ? {
          // prizeId lets the frontend point the wheel graphic at the wedge
          // that was actually won when the page is loaded/reloaded after a
          // spin already happened (e.g. a customer revisiting their link).
          // Without this the wheel had no way to know which wedge to show
          // and just rendered its default resting position instead.
          prizeId: invite.prizeId ?? null,
          prizeLabel: invite.prize?.label ?? "No prize",
          won: !!invite.discount,
          discountCode: invite.discount?.code ?? null,
          discountPercentage: invite.discount?.percentage ?? null,
        }
      : null,
  });
}

// POST /api/spin/[token]
// The one and only spin. Picks a weighted-random active prize, generates a
// one-time discount code if the customer won one, records the result, and
// emails it to them.
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.spinInvite.findUnique({ where: { token: params.token } });
  if (!invite) {
    return NextResponse.json({ error: "This spin link is invalid or has expired." }, { status: 404 });
  }

  const settings = await getSpinWheelSettings();
  if (!settings.enabled && !invite.isTest) {
    return NextResponse.json({ error: "The spin wheel isn't available right now. Please check back later." }, { status: 403 });
  }

  // Atomically claim this invite's one spin — a concurrent double-click or
  // a duplicate request can never both succeed.
  const claim = await prisma.spinInvite.updateMany({
    where: { id: invite.id, spunAt: null },
    data: { spunAt: new Date() },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "This invite has already been used — you only get one spin." }, { status: 409 });
  }

  const prizes = await prisma.spinPrize.findMany({ where: { active: true } });
  if (prizes.length === 0) {
    return NextResponse.json({ error: "No prizes are configured right now. Please try again later." }, { status: 500 });
  }

  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  let landed = prizes[prizes.length - 1];
  for (const p of prizes) {
    if (roll < p.weight) {
      landed = p;
      break;
    }
    roll -= p.weight;
  }

  let discountId: string | null = null;
  let discountCode: string | null = null;
  if (landed.percentage > 0) {
    const code = await generateSpinDiscountCode();
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 90); // spin-wheel wins are good for 90 days
    const discount = await prisma.discount.create({
      data: {
        code,
        percentage: landed.percentage,
        maxRedemptions: 1,
        maxPerCustomer: 1,
        startDate: now,
        endDate: expires,
        source: "SPIN_WHEEL",
        note: `Won on the spin wheel by ${invite.email}`,
      },
    });
    discountId = discount.id;
    discountCode = discount.code;
  }

  await prisma.spinInvite.update({
    where: { id: invite.id },
    data: { prizeId: landed.id, discountId },
  });

  try {
    await sendSpinResultEmail({
      email: invite.email,
      customerName: invite.customerName,
      prizeLabel: landed.label,
      won: !!discountCode,
      discountCode: discountCode ?? undefined,
      discountPercentage: landed.percentage || undefined,
    });
  } catch (e) {
    console.error("Spin result email failed:", e);
  }

  return NextResponse.json({
    success: true,
    prizeId: landed.id,
    prizeLabel: landed.label,
    won: !!discountCode,
    discountCode,
    discountPercentage: landed.percentage || null,
  });
}
