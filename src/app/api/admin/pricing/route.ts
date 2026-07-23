import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getPricingSettings, updatePricingSettings } from "@/lib/pricingSettings";

const EDITABLE_FIELDS = [
  "weekdayDayPrice",
  "weekdayNightPrice",
  "weekendPrice",
  "rental1Price",
  "rental2Price",
] as const;

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getPricingSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, number> = {};

  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    const num = Number(body[field]);
    if (!Number.isFinite(num) || num < 0) {
      return NextResponse.json({ error: `Invalid value for ${field}.` }, { status: 400 });
    }
    data[field] = num;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid pricing fields provided." }, { status: 400 });
  }

  const settings = await updatePricingSettings(data);
  return NextResponse.json({ success: true, settings });
}
