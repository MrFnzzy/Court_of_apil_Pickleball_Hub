import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getSeasonalOverrides, createSeasonalOverride } from "@/lib/pricingSettings";

function validMonths(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((m) => Number.isInteger(m) && m >= 1 && m <= 12) &&
    new Set(value).size === value.length
  );
}

function validPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// GET /api/admin/pricing/seasonal — every seasonal override (active and
// inactive), for the admin dashboard's pricing tab.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const overrides = await getSeasonalOverrides();
  return NextResponse.json({ overrides });
}

// Adds a new seasonal/monthly price override. The main rates in
// PricingSettings stay untouched — this is an additive "adjusted" rate that
// only applies during the selected months.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, months, weekdayDayPrice, weekdayNightPrice, weekendPrice, active, popupMessage } = body;

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "A label is required (e.g. \"Holiday season\")." }, { status: 400 });
  }
  if (!validMonths(months)) {
    return NextResponse.json({ error: "Pick at least one month, with no duplicates." }, { status: 400 });
  }
  if (!validPrice(weekdayDayPrice) || !validPrice(weekdayNightPrice) || !validPrice(weekendPrice)) {
    return NextResponse.json({ error: "All three rates must be valid, non-negative numbers." }, { status: 400 });
  }
  if (popupMessage !== undefined && popupMessage !== null && typeof popupMessage !== "string") {
    return NextResponse.json({ error: "Popup message must be text." }, { status: 400 });
  }

  try {
    const override = await createSeasonalOverride({
      label,
      months,
      weekdayDayPrice,
      weekdayNightPrice,
      weekendPrice,
      active: active ?? true,
      popupMessage: popupMessage ?? null,
    });
    return NextResponse.json({ success: true, override });
  } catch {
    return NextResponse.json({ error: "Failed to create the pricing override." }, { status: 500 });
  }
}
