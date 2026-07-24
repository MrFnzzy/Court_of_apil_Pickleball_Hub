import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/siteSettings";

// GET has no params and reads no cookies/headers, so Next.js can treat it as
// static and cache it at build time — meaning admin edits would only show up
// after a redeploy. Force dynamic rendering so every request hits the DB.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}
