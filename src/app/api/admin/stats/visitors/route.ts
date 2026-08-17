import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Philippines is UTC+8 — same conversion used everywhere else in the app.
function manilaDateStr(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

// Converts a Manila calendar date (e.g. "2026-08-06") into the matching
// UTC instant range, since SiteVisit.createdAt is stored as a real UTC
// timestamp.
function manilaDayRangeUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - 8);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStr = manilaDateStr();
  const { start, end } = manilaDayRangeUtc(todayStr);

  const [totalVisits, distinctVisitors, todayVisitorRows] = await Promise.all([
    prisma.siteVisit.count(),
    prisma.siteVisit.findMany({ distinct: ["visitorId"], select: { visitorId: true } }),
    prisma.siteVisit.findMany({
      where: { createdAt: { gte: start, lt: end } },
      distinct: ["visitorId"],
      select: { visitorId: true },
    }),
  ]);

  return NextResponse.json({
    totalVisitors: distinctVisitors.length,
    totalVisits,
    todayVisitors: todayVisitorRows.length,
  });
}
