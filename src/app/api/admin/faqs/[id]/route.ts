import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFaq, deleteFaq } from "@/lib/faq";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.question !== undefined) {
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ error: "Question can't be empty." }, { status: 400 });
    }
    data.question = body.question;
  }
  if (body.answer !== undefined) {
    if (typeof body.answer !== "string" || !body.answer.trim()) {
      return NextResponse.json({ error: "Answer can't be empty." }, { status: 400 });
    }
    data.answer = body.answer;
  }
  if (body.link !== undefined) data.link = typeof body.link === "string" ? body.link : null;
  if (body.linkLabel !== undefined) data.linkLabel = typeof body.linkLabel === "string" ? body.linkLabel : null;
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.order !== undefined) {
    const order = Number(body.order);
    if (!Number.isInteger(order)) {
      return NextResponse.json({ error: "Order must be a whole number." }, { status: 400 });
    }
    data.order = order;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  try {
    const faq = await updateFaq(params.id, data as any);
    return NextResponse.json({ success: true, faq });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update FAQ." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const faq = await prisma.faq.findUnique({ where: { id: params.id } });
  if (!faq) return NextResponse.json({ error: "FAQ not found." }, { status: 404 });

  try {
    await deleteFaq(params.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete FAQ." }, { status: 500 });
  }
}
