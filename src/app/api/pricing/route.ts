import { NextResponse } from "next/server";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getActiveRentalProducts } from "@/lib/rentalProducts";

// Same reasoning as /api/site-settings — force fresh data on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, products] = await Promise.all([getPricingSettings(), getActiveRentalProducts()]);
    return NextResponse.json({ settings, products });

  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That value is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
