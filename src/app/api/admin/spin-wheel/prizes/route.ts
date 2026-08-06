import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prizes = await prisma.spinPrize.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ prizes });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, percentage = 0, weight = 10, color = "#F46036" } = body;

  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Please give the prize a label." }, { status: 400 });
  }
  if (typeof percentage !== "number" || percentage < 0 || percentage > 100) {
    return NextResponse.json({ error: "Percentage must be between 0 and 100 (0 = no prize)." }, { status: 400 });
  }
  if (typeof weight !== "number" || weight < 1 || weight > 100) {
    return NextResponse.json({ error: "Chance must be between 1 and 100." }, { status: 400 });
  }

  const count = await prisma.spinPrize.count();
  const prize = await prisma.spinPrize.create({
    data: { label: label.trim().slice(0, 60), percentage, weight, color, order: count },
  });

  return NextResponse.json({ success: true, prize });
}
