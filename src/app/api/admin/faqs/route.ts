import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getFaqs, createFaq } from "@/lib/faq";

// GET /api/admin/faqs — every FAQ (active and inactive), for the admin
// dashboard's FAQ tab.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const faqs = await getFaqs();
  return NextResponse.json({ faqs });
}

// Adds a new FAQ entry. Shows up immediately in the homepage FAQ accordion
// and the Ask AI assistant's knowledge — neither hardcodes the list, they
// both read this table live.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { question, answer, link, linkLabel, active } = body;

  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }
  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "Answer is required." }, { status: 400 });
  }

  try {
    const faq = await createFaq({
      question,
      answer,
      link: typeof link === "string" ? link : null,
      linkLabel: typeof linkLabel === "string" ? linkLabel : null,
      active: active ?? true,
    });
    return NextResponse.json({ success: true, faq });
  } catch {
    return NextResponse.json({ error: "Failed to create FAQ." }, { status: 500 });
  }
}
