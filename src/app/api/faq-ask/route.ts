import { NextRequest, NextResponse } from "next/server";
import { FAQ_ENTRIES } from "@/lib/faqData";

export const runtime = "nodejs";

const FALLBACK_MESSAGE =
  "I don't have that one in our FAQ — send us a message on Facebook and our team will get back to you.";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "did", "you", "your", "we", "our", "i", "to", "for", "of", "in",
  "on", "at", "and", "or", "if", "can", "what", "when", "where", "how", "will", "it", "be", "have", "has",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

// Light stemming so "parking" matches "park", "cancellation" matches
// "cancel", etc. — not linguistically rigorous, just enough overlap for a
// small, distinct FAQ set.
function stem(word: string): string {
  for (const suffix of ["ations", "ation", "ing", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      word = word.slice(0, -suffix.length);
      break;
    }
  }
  // Stripping "-ation" often leaves a doubled consonant (e.g.
  // "cancellation" -> "cancell" instead of "cancel") — trim it back down.
  if (word.length > 4 && word[word.length - 1] === word[word.length - 2]) {
    word = word.slice(0, -1);
  }
  return word;
}

// Zero-setup fallback: simple keyword overlap against the FAQ list. No API
// key, no cost, no network call — good enough for the fairly small,
// well-separated set of questions this site actually gets.
function localMatch(question: string): { text: string; matched: boolean } {
  const qWords = new Set(tokenize(question));
  if (qWords.size === 0) return { text: FALLBACK_MESSAGE, matched: false };

  let best = { score: 0, entry: FAQ_ENTRIES[0] };
  for (const entry of FAQ_ENTRIES) {
    const haystack = tokenize(`${entry.q} ${entry.a}`);
    const overlap = haystack.filter((w) => qWords.has(w)).length;
    const score = overlap / qWords.size;
    if (score > best.score) best = { score, entry };
  }

  if (best.score < 0.3) return { text: FALLBACK_MESSAGE, matched: false };
  const text = best.entry.link ? `${best.entry.a}\n${best.entry.linkLabel ?? best.entry.link}` : best.entry.a;
  return { text, matched: true };
}

async function aiMatch(question: string, apiKey: string): Promise<{ text: string; matched: boolean }> {
  const faqBlock = FAQ_ENTRIES.map((e, i) => `${i + 1}. Q: ${e.q}\n   A: ${e.a}${e.link ? ` (${e.linkLabel ?? e.link})` : ""}`).join("\n");

  const system = `You are the FAQ assistant on a pickleball court booking website in Talisay City, Cebu, Philippines. Answer ONLY using the FAQ list below — never invent policies, prices, or details that aren't in it.

Tone: casual and friendly, like a real staff member texting back, not a stiff AI assistant. Still respectful — never use overly casual address terms like "dai", "sis", "bro", etc.

Length: short and straight to the point. Answer only what was actually asked — don't pad with extra unrequested details, disclaimers, or "let me know if you have other questions" filler.

Language: reply in the same language the visitor used. This audience mixes English, Tagalog, and Bisaya/Cebuano (including Taglish/Bislish) — match whichever they wrote in, naturally, the way a local would text.

No markdown formatting.

If the question isn't covered by the FAQ (even if related to pickleball generally), don't guess — respond with exactly: NOT_COVERED

FAQ:
${faqBlock}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: question }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();

  if (!text || text.includes("NOT_COVERED")) {
    return { text: FALLBACK_MESSAGE, matched: false };
  }
  return { text, matched: true };
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ error: "Question is too long." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const result = await aiMatch(question, apiKey);
        return NextResponse.json({ answer: result.text, matched: result.matched });
      } catch {
        // If the AI call fails for any reason (bad key, network, rate
        // limit), fall through to local matching rather than error out —
        // visitors still get a useful answer.
      }
    }

    const result = localMatch(question);
    return NextResponse.json({ answer: result.text, matched: result.matched });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
