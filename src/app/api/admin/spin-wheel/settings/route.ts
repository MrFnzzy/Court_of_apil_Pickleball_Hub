import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getSpinWheelSettings, updateSpinWheelSettings } from "@/lib/spinWheelSettings";

export async function GET() {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const settings = await getSpinWheelSettings();
    return NextResponse.json({ settings });

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

// PATCH { enabled?, startDate?, minHoursForSpin?, inviteExpiryDays? } —
// enabled is the public launch switch; startDate (an ISO date string, or
// null to clear) scopes which bookings' completions trigger an invite
// email; minHoursForSpin is the eligibility condition (a visit needs at
// least this many total booked hours to earn a spin); inviteExpiryDays is
// how many days a sent invite stays spinnable before it expires (null =
// never expires) — see spinWheelEmail.ts and spinInviteExpiryEmail.ts.
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const data: { enabled?: boolean; startDate?: Date | null; minHoursForSpin?: number; inviteExpiryDays?: number | null } = {};

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
    if (body.inviteExpiryDays !== undefined) {
      if (body.inviteExpiryDays === null) {
        data.inviteExpiryDays = null;
      } else {
        const v = Number(body.inviteExpiryDays);
        if (!Number.isInteger(v) || v < 1 || v > 365) {
          return NextResponse.json({ error: "Invite expiry must be a whole number of days between 1 and 365, or left blank for never." }, { status: 400 });
        }
        data.inviteExpiryDays = v;
      }
    }

    const settings = await updateSpinWheelSettings(data);
    return NextResponse.json({ success: true, settings });

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
