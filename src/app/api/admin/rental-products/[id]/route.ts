import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRentalProduct, deleteRentalProduct } from "@/lib/rentalProducts";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.quantity !== undefined) {
    const qty = Number(body.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      return NextResponse.json({ error: "Quantity must be a whole number between 1 and 999." }, { status: 400 });
    }
    data.quantity = qty;
  }
  if (body.price !== undefined) {
    const priceNum = Number(body.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: "Price must be zero or a positive number." }, { status: 400 });
    }
    data.price = priceNum;
  }
  if (body.label !== undefined) data.label = typeof body.label === "string" ? body.label : null;
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.order !== undefined) {
    const order = Number(body.order);
    if (!Number.isInteger(order)) {
      return NextResponse.json({ error: "Order must be a whole number." }, { status: 400 });
    }
    data.order = order;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  try {
    const product = await updateRentalProduct(params.id, data as any);
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A tier for that type & quantity already exists." }, { status: 409 });
    }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Rental product not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update rental product." }, { status: 500 });
  }
}

// Bookings store their own paddleCount/ballCount + computed totals rather
// than a reference to this row, so deleting a tier never breaks a past
// booking's numbers — it only removes the tier as an option going forward.
// Prefer PATCH { active: false } instead if the admin just wants to retire
// a tier without losing its history in this table.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const product = await prisma.rentalProduct.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Rental product not found." }, { status: 404 });

  try {
    await deleteRentalProduct(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete rental product." }, { status: 500 });
  }
}
