import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { normalizeCode } from "@/lib/discounts";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const discounts = await prisma.discount.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json({ discounts });
}

// Admin-typed promo code creation (source is always MANUAL here — codes
// generated from spin wheel wins are created internally, not via this route).
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    code: rawCode,
    percentage,
    maxRedemptions,
    maxPerCustomer,
    startDate,
    endDate,
    active,
    note = "",
  } = body;

  const code = normalizeCode(rawCode || "");
  if (!code || !/^[A-Z0-9\-]{3,32}$/.test(code)) {
    return NextResponse.json(
      { error: "Code must be 3-32 characters, letters/numbers/dashes only." },
      { status: 400 }
    );
  }
  if (typeof percentage !== "number" || percentage < 1 || percentage > 100) {
    return NextResponse.json({ error: "Percentage must be between 1 and 100." }, { status: 400 });
  }
  if (!startDate) {
    return NextResponse.json({ error: "Start date is required." }, { status: 400 });
  }
  if (!endDate) {
    return NextResponse.json({ error: "End date is required." }, { status: 400 });
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid start or end date." }, { status: 400 });
  }
  if (start >= end) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  }
  let normalizedMax: number | null = null;
  if (maxRedemptions !== null && maxRedemptions !== undefined && maxRedemptions !== "") {
    normalizedMax = Number(maxRedemptions);
    if (!Number.isInteger(normalizedMax) || normalizedMax < 1) {
      return NextResponse.json({ error: "Redemption limit must be a positive whole number, or left blank for unlimited." }, { status: 400 });
    }
  }
  let normalizedMaxPerCustomer = 1;
  if (maxPerCustomer !== undefined && maxPerCustomer !== null && maxPerCustomer !== "") {
    normalizedMaxPerCustomer = Number(maxPerCustomer);
    if (!Number.isInteger(normalizedMaxPerCustomer) || normalizedMaxPerCustomer < 1) {
      return NextResponse.json({ error: "Max uses per customer must be a positive whole number." }, { status: 400 });
    }
  }

  try {
    const discount = await prisma.discount.create({
      data: {
        code,
        percentage,
        maxRedemptions: normalizedMax,
        maxPerCustomer: normalizedMaxPerCustomer,
        startDate: start,
        endDate: end,
        active: typeof active === "boolean" ? active : true,
        note: typeof note === "string" ? note.slice(0, 300) : "",
        source: "MANUAL",
      },
    });
    return NextResponse.json({ success: true, discount });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That code already exists — pick a different one." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create promo code." }, { status: 500 });
  }
}
