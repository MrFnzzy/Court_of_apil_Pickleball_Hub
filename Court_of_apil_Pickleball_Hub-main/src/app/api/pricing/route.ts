import { NextResponse } from "next/server";
import { getPricingSettings } from "@/lib/pricingSettings";

export async function GET() {
  const settings = await getPricingSettings();
  return NextResponse.json({ settings });
}
