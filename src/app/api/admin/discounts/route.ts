import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    code,
    discountPercent,
    active = true,
    startDate,
    endDate,
    maxRedemptions,
    maxPerCustomer = 1,
  } = body;

  if (!code || typeof code !== "string" || !/^[A-Z0-9_-]{2,30}$/.test(code.toUpperCase())) {
    return NextResponse.json(
      { error: "Code must be 2–30 characters (letters, numbers, underscores, dashes)." },
      { status: 400 }
    );
  }
  if (
    typeof discountPercent !== "number" ||
    discountPercent < 1 ||
    discountPercent > 100
  ) {
    return NextResponse.json(
      { error: "Discount percent must be between 1 and 100." },
      { status: 400 }
    );
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 });
  }
  if (new Date(startDate) >= new Date(endDate)) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  }
  if (maxRedemptions !== null && maxRedemptions !== undefined && maxRedemptions < 1) {
    return NextResponse.json({ error: "Max redemptions must be at least 1." }, { status: 400 });
  }
  if (typeof maxPerCustomer !== "number" || maxPerCustomer < 1) {
    return NextResponse.json({ error: "Max per customer must be at least 1." }, { status: 400 });
  }

  const existing = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) {
    return NextResponse.json({ error: "A promo code with this name already exists." }, { status: 409 });
  }

  const created = await prisma.promoCode.create({
    data: {
      code: code.toUpperCase(),
      discountPercent,
      active,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxRedemptions: maxRedemptions ?? null,
      maxPerCustomer,
    },
  });

  return NextResponse.json({ code: created }, { status: 201 });
}
