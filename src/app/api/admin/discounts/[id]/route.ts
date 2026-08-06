import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { normalizeCode } from "@/lib/discounts";

// Toggle active/inactive, or edit percentage/limit/note. Redemption count
// and code itself are intentionally left alone here (changing a code that's
// already been shared would break links/screenshots customers may have).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.active === "boolean") data.active = body.active;
  if (body.percentage !== undefined) {
    const pct = Number(body.percentage);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      return NextResponse.json({ error: "Percentage must be between 1 and 100." }, { status: 400 });
    }
    data.percentage = pct;
  }
  if (body.maxRedemptions !== undefined) {
    if (body.maxRedemptions === null || body.maxRedemptions === "") {
      data.maxRedemptions = null;
    } else {
      const max = Number(body.maxRedemptions);
      if (!Number.isInteger(max) || max < 1) {
        return NextResponse.json({ error: "Redemption limit must be a positive whole number, or blank for unlimited." }, { status: 400 });
      }
      data.maxRedemptions = max;
    }
  }
  if (body.maxPerCustomer !== undefined) {
    const maxPer = Number(body.maxPerCustomer);
    if (!Number.isInteger(maxPer) || maxPer < 1) {
      return NextResponse.json({ error: "Max uses per customer must be a positive whole number." }, { status: 400 });
    }
    data.maxPerCustomer = maxPer;
  }
  if (body.startDate !== undefined || body.endDate !== undefined) {
    const start = body.startDate !== undefined ? new Date(body.startDate) : undefined;
    const end = body.endDate !== undefined ? new Date(body.endDate) : undefined;
    if (start && Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
    }
    if (end && Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
    }
    if (start) data.startDate = start;
    if (end) data.endDate = end;
    if (start && end && start >= end) {
      return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
    }
  }
  if (typeof body.note === "string") data.note = body.note.slice(0, 300);
  if (typeof body.code === "string") {
    const code = normalizeCode(body.code);
    if (!code || !/^[A-Z0-9\-]{3,32}$/.test(code)) {
      return NextResponse.json({ error: "Code must be 3-32 characters, letters/numbers/dashes only." }, { status: 400 });
    }
    data.code = code;
  }

  try {
    const discount = await prisma.discount.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, discount });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That code already exists — pick a different one." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to update promo code." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const discount = await prisma.discount.findUnique({ where: { id: params.id }, select: { redemptionCount: true } });
  if (!discount) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (discount.redemptionCount > 0) {
    return NextResponse.json(
      { error: "This code has already been redeemed at least once — deactivate it instead of deleting, so past bookings keep their record." },
      { status: 400 }
    );
  }

  await prisma.discount.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
