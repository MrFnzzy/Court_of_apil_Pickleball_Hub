import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// GET /api/admin/feedback
// Every feedback submission, newest first, with just enough booking context
// (name, date, slots) for the admin dashboard's Feedback tab.
export async function GET(_req: NextRequest) {
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
}
