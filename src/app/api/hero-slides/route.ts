import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same reasoning as /api/site-settings — force fresh data on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ slides });

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
