import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Returns every slide (active or not) so the admin can manage the full
// slideshow, unlike the public /api/hero-slides route which only returns
// active ones.
export async function GET() {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const slides = await prisma.heroSlide.findMany({ orderBy: { order: "asc" } });
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

export async function POST(req: NextRequest) {
  try {
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
