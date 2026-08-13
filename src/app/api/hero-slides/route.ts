import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same reasoning as /api/site-settings — force fresh data on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const slides = await prisma.heroSlide.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ slides });
}
