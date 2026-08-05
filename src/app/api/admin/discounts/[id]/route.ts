import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json();
  const { code, discountPercent, active, startDate, endDate, maxRedemptions, maxPerCustomer } = body;

  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Promo code not found." }, { status: 404 });

  if (code && code.toUpperCase() !== existing.code) {
    const conflict = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (conflict) return NextResponse.json({ error: "A promo code with this name already exists." }, { status: 409 });
  }
  if (discountPercent !== undefined && (discountPercent < 1 || discountPercent > 100)) {
    return NextResponse.json({ error: "Discount percent must be between 1 and 100." }, { status: 400 });
  }
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  }

  const updated = await prisma.promoCode.update({
    where: { id },
    data: {
      ...(code !== undefined && { code: code.toUpperCase() }),
      ...(discountPercent !== undefined && { discountPercent }),
      ...(active !== undefined && { active }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(maxRedemptions !== undefined && { maxRedemptions: maxRedemptions ?? null }),
      ...(maxPerCustomer !== undefined && { maxPerCustomer }),
    },
  });

  return NextResponse.json({ code: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;
  await prisma.promoCode.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
