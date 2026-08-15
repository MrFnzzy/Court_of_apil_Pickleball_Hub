import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  getSiteSettings,
  updateSiteSettings,
  isValidHex,
  EDITABLE_SITE_SETTINGS_FIELDS,
  COLOR_FIELDS,
  normalizeClosedHours,
  SiteSettings,
} from "@/lib/siteSettings";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Partial<SiteSettings> = {};

  for (const field of EDITABLE_SITE_SETTINGS_FIELDS) {
    if (body[field] === undefined) continue;
    const value = body[field];

    if (COLOR_FIELDS.includes(field)) {
      if (typeof value !== "string" || !isValidHex(value)) {
        return NextResponse.json({ error: `Invalid color value for ${field}.` }, { status: 400 });
      }
    }

    if (field === "closedHours") {
      const normalized = normalizeClosedHours(value);
      if (!normalized) {
        return NextResponse.json({ error: "closedHours must be an array of hours 0-23." }, { status: 400 });
      }
      (data as any)[field] = normalized;
      continue;
    }

    if (field === "adminLoginEmail") {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return NextResponse.json({ error: "Please enter a valid 2FA email." }, { status: 400 });
      }
      (data as any)[field] = trimmed;
      continue;
    }

    if (field === "adminNotificationEmail") {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return NextResponse.json({ error: "Please enter a valid notification email." }, { status: 400 });
      }
      (data as any)[field] = trimmed;
      continue;
    }

    (data as any)[field] = value;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  const settings = await updateSiteSettings(data);
  return NextResponse.json({ success: true, settings });
}
