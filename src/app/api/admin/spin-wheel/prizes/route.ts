import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prizes = await prisma.spinPrize.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json({ prizes });

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
    const { label, percentage = 0, weight = 10, color = "#F46036", validityDays } = body;

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "Please give the prize a label." }, { status: 400 });
    }
    if (typeof percentage !== "number" || percentage < 0 || percentage > 100) {
      return NextResponse.json({ error: "Percentage must be between 0 and 100 (0 = no prize)." }, { status: 400 });
    }
    if (typeof weight !== "number" || weight < 1 || weight > 100) {
      return NextResponse.json({ error: "Chance must be between 1 and 100." }, { status: 400 });
    }
    let validity: number | null = 90;
    if (validityDays === null) {
      validity = null;
    } else if (validityDays !== undefined) {
      const v = Number(validityDays);
      if (!Number.isInteger(v) || v < 1 || v > 3650) {
        return NextResponse.json({ error: "Expiry must be between 1 and 3650 days, or left blank for never." }, { status: 400 });
      }
      validity = v;
    }

    const count = await prisma.spinPrize.count();
    const prize = await prisma.spinPrize.create({
      data: { label: label.trim().slice(0, 60), percentage, weight, color, order: count, validityDays: validity },
    });

    return NextResponse.json({ success: true, prize });

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
