import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Label can't be empty." }, { status: 400 });
    data.label = body.label.trim().slice(0, 60);
  }
  if (body.percentage !== undefined) {
    const pct = Number(body.percentage);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: "Percentage must be between 0 and 100." }, { status: 400 });
    }
    data.percentage = pct;
  }
  if (body.weight !== undefined) {
    const w = Number(body.weight);
    if (!Number.isInteger(w) || w < 1 || w > 100) {
      return NextResponse.json({ error: "Chance must be between 1 and 100." }, { status: 400 });
    }
    data.weight = w;
  }
  if (typeof body.color === "string") data.color = body.color;
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.order === "number") data.order = body.order;
  if (body.validityDays === null) {
    data.validityDays = null;
  } else if (body.validityDays !== undefined) {
    const v = Number(body.validityDays);
    if (!Number.isInteger(v) || v < 1 || v > 3650) {
      return NextResponse.json({ error: "Expiry must be between 1 and 3650 days, or left blank for never." }, { status: 400 });
    }
    data.validityDays = v;
  }

  const prize = await prisma.spinPrize.update({ where: { id: params.id }, data });
  return NextResponse.json({ success: true, prize });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.spinPrize.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
