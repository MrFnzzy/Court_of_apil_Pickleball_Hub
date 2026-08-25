import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { updateSeasonalOverride, deleteSeasonalOverride } from "@/lib/pricingSettings";

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.label !== undefined) {
    if (typeof body.label !== "string" || !body.label.trim()) {
      return NextResponse.json({ error: "Label can't be empty." }, { status: 400 });
    }
    data.label = body.label;
  }
  if (body.months !== undefined) {
    if (!validMonths(body.months)) {
      return NextResponse.json({ error: "Pick at least one month, with no duplicates." }, { status: 400 });
    }
    data.months = body.months;
  }
  for (const field of ["weekdayDayPrice", "weekdayNightPrice", "weekendPrice"] as const) {
    if (body[field] !== undefined) {
      if (!validPrice(body[field])) {
        return NextResponse.json({ error: `Invalid value for ${field}.` }, { status: 400 });
      }
      data[field] = body[field];
    }
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.popupMessage !== undefined) {
    if (body.popupMessage !== null && typeof body.popupMessage !== "string") {
      return NextResponse.json({ error: "Popup message must be text." }, { status: 400 });
    }
    data.popupMessage = body.popupMessage;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  try {
    const override = await updateSeasonalOverride(params.id, data as any);
    return NextResponse.json({ success: true, override });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Pricing override not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update the pricing override." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await deleteSeasonalOverride(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Pricing override not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete the pricing override." }, { status: 500 });
  }
}
