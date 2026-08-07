import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// Philippines is UTC+8 — same conversion used everywhere else in the app.
function manilaDateStr(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

const VISITOR_COOKIE = "cop_vid";
const LAST_VISIT_COOKIE = "cop_lv";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Called once per page load from the public (non-admin) site. Logs at most
 * one SiteVisit row per anonymous visitor per Manila calendar day — the
 * visitor is identified by a long-lived random cookie, not by anything the
 * customer typed in, so this never touches personal data.
 *
 * Analytics must never break the site: any failure here is swallowed and
 * still returns 200, so a DB hiccup can't take down page loads.
 */
export async function POST(req: NextRequest) {
  try {
    const today = manilaDateStr();
    const existingVisitorId = req.cookies.get(VISITOR_COOKIE)?.value;
    const visitorId = existingVisitorId || randomUUID();
    const lastVisit = req.cookies.get(LAST_VISIT_COOKIE)?.value;

    if (lastVisit !== today) {
      await prisma.siteVisit.create({ data: { visitorId } });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
      sameSite: "lax",
    });
    res.cookies.set(LAST_VISIT_COOKIE, today, {
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (e) {
    console.error("track-visit failed:", e);
    return NextResponse.json({ ok: false });
  }
}
