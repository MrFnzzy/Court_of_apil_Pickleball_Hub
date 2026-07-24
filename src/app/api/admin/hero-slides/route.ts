import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Returns every slide (active or not) so the admin can manage the full
// slideshow, unlike the public /api/hero-slides route which only returns
// active ones.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slides = await prisma.heroSlide.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ slides });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { imageUrl, headline, subtext, linkUrl } = body;

  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "An image is required." }, { status: 400 });
  }

  const count = await prisma.heroSlide.count();
  const slide = await prisma.heroSlide.create({
    data: {
      imageUrl,
      headline: headline || null,
      subtext: subtext || null,
      linkUrl: linkUrl || null,
      order: count,
      active: true,
    },
  });

  return NextResponse.json({ success: true, slide });
}
