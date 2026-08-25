import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// GET /api/admin/feedback
// Every feedback submission, newest first, with just enough booking context
// (name, date, slots) for the admin dashboard's Feedback tab.
export async function GET(_req: NextRequest) {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            customerName: true,
            date: true,
            startHours: true,
          },
        },
      },
    });

    return NextResponse.json({ feedback });

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
