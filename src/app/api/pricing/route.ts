import { NextResponse } from "next/server";
import { getPricingSettings } from "@/lib/pricingSettings";

// Same reasoning as /api/site-settings — force fresh data on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPricingSettings();
  return NextResponse.json({ settings });
}
