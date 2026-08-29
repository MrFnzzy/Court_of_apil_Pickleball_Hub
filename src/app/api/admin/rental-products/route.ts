import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getRentalProducts, createRentalProduct } from "@/lib/rentalProducts";

const TYPES = ["PADDLE", "BALL"] as const;

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await getRentalProducts();
  return NextResponse.json({ products });
}

// Creates a new rental tier (e.g. "3 Paddles" for ₱200). Shows up
// immediately on the homepage pricing cards, the customer booking wizard,
// and the admin add/edit booking form — none of those hardcode which
// quantities exist, they all read this table live.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, quantity, price, label, active } = body;

  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "Type must be PADDLE or BALL." }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
    return NextResponse.json({ error: "Quantity must be a whole number between 1 and 999." }, { status: 400 });
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return NextResponse.json({ error: "Price must be zero or a positive number." }, { status: 400 });
  }

  try {
    const product = await createRentalProduct({
      type,
      quantity: qty,
      price: priceNum,
      label: typeof label === "string" ? label : null,
      active: active ?? true,
    });
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `A ${type === "PADDLE" ? "paddle" : "ball"} tier for quantity ${qty} already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create rental product." }, { status: 500 });
  }
}
