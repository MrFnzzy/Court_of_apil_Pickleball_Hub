import { NextResponse } from "next/server";
import { getActiveFaqs } from "@/lib/faq";

export const dynamic = "force-dynamic";

// GET /api/faqs — public, returns only active FAQs in display order. Used
// by the homepage FAQ accordion and the Ask AI assistant's "how many FAQs"
// footer note.
export async function GET() {
  try {
    const faqs = await getActiveFaqs();
    return NextResponse.json({ faqs });
  } catch {
    return NextResponse.json({ error: "Failed to load FAQs." }, { status: 500 });
  }
}
