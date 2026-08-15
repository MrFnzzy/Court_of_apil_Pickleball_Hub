import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/siteSettings";

// GET has no params and reads no cookies/headers, so Next.js can treat it as
// static and cache it at build time — meaning admin edits would only show up
// after a redeploy. Force dynamic rendering so every request hits the DB.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  // Strip internal operations fields (closed hours, notification email) —
  // this endpoint is public and only ever used for branding (header/footer).
  const { closedHours, adminNotificationEmail, ...publicSettings } = settings;
  return NextResponse.json({ settings: publicSettings });
}
