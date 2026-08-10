import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getSpinWheelSettings, updateSpinWheelSettings } from "@/lib/spinWheelSettings";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getSpinWheelSettings();
  return NextResponse.json({ settings });
}

// PATCH { enabled?, startDate? } — enabled is the public launch switch;
// startDate (an ISO date string, or null to clear) scopes which bookings'
// completions trigger an invite email. See spinWheelEmail.ts.
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: { enabled?: boolean; startDate?: Date | null } = {};

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

  const settings = await updateSpinWheelSettings(data);
  return NextResponse.json({ success: true, settings });
}
