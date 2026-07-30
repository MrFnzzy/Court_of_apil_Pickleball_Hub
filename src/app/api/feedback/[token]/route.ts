import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/feedback/[token]
// Looks up the booking behind a feedback link (sent in the post-play
// "thanks for playing" email) so the form page can greet the customer by
// name and show what they booked, without exposing the booking to anyone
// who doesn't have the token.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { feedbackToken: params.token },
    select: {
      customerName: true,
      date: true,
      startHours: true,
      feedback: { select: { id: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "This feedback link is invalid or has expired." }, { status: 404 });
  }

  return NextResponse.json({
    customerName: booking.customerName,
    date: booking.date,
    startHours: booking.startHours,
    alreadySubmitted: !!booking.feedback,
  });
}

// POST /api/feedback/[token]
// Records the customer's ratings + comment. One submission per booking —
// the unique constraint on Feedback.bookingId guarantees that even if the
// form is somehow submitted twice.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { feedbackToken: params.token },
    select: { id: true, feedback: { select: { id: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "This feedback link is invalid or has expired." }, { status: 404 });
  }
  if (booking.feedback) {
    return NextResponse.json({ error: "Feedback has already been submitted for this booking." }, { status: 409 });
  }

  const body = await req.json();
  const { overallRating, venueRating, serviceRating, valueRating, comment } = body;

  const ratings = { overallRating, venueRating, serviceRating, valueRating };
  for (const [key, value] of Object.entries(ratings)) {
    if (typeof value !== "number" || value < 1 || value > 5 || !Number.isInteger(value)) {
      return NextResponse.json({ error: `Please provide a valid 1-5 rating for ${key}.` }, { status: 400 });
    }
  }
  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  }
  if (typeof comment === "string" && comment.length > 2000) {
    return NextResponse.json({ error: "Comment is too long." }, { status: 400 });
  }

  try {
    await prisma.feedback.create({
      data: {
        bookingId: booking.id,
        overallRating,
        venueRating,
        serviceRating,
        valueRating,
        comment: comment?.trim() || null,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Feedback has already been submitted for this booking." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
