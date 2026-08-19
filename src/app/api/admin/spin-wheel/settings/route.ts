import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getSpinWheelSettings, updateSpinWheelSettings } from "@/lib/spinWheelSettings";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getSpinWheelSettings();
  return NextResponse.json({ settings });
}

// PATCH { enabled?, startDate?, minHoursForSpin? } — enabled is the public
// launch switch; startDate (an ISO date string, or null to clear) scopes
// which bookings' completions trigger an invite email; minHoursForSpin is
// the eligibility condition (a visit needs at least this many total booked
// hours to earn a spin). See spinWheelEmail.ts.
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: { enabled?: boolean; startDate?: Date | null; minHoursForSpin?: number } = {};

  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.startDate !== undefined) {
    if (body.startDate === null || body.startDate === "") {
      data.startDate = null;
    } else {
      const d = new Date(body.startDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
      }
      data.startDate = d;
    }
  }
  if (body.minHoursForSpin !== undefined) {
    const v = Number(body.minHoursForSpin);
    if (!Number.isInteger(v) || v < 1 || v > 24) {
      return NextResponse.json({ error: "Minimum hours must be a whole number between 1 and 24." }, { status: 400 });
    }
    data.minHoursForSpin = v;
  }

  const settings = await updateSpinWheelSettings(data);
  return NextResponse.json({ success: true, settings });
}
