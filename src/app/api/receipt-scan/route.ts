import { NextRequest, NextResponse } from "next/server";
import { createWorker } from "tesseract.js";

export const runtime = "nodejs";
// OCR can take a few seconds, especially on a cold start (first request
// downloads the ~15MB English language data file). Give it more room than
// the Next.js default. Note: on Vercel's free Hobby plan, function
// duration is capped at 10s regardless of this value — if scans are timing
// out there, that's the plan limit, not something to fix in code.
export const maxDuration = 30;

// Reads a GCash/Maya/BPI payment screenshot with Tesseract.js — a free,
// open-source OCR engine that runs entirely on this server (no external
// API, no account, no cost). It only extracts raw text; the regexes below
// then guess at the reference number and amount from that text. This is
// noticeably less reliable than an AI model at understanding context, so
// treat its output as a rough pre-fill for the customer to double-check —
// never as ground truth.

function extractReferenceNumber(text: string): string | null {
  const labeled = [
    /ref(?:erence)?\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9]{6,20})/i,
    /trace\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Za-z0-9]{6,20})/i,
    /transaction\s*(?:no\.?|number|id)?\s*[:\-]?\s*([A-Za-z0-9]{6,20})/i,
  ];
  for (const pattern of labeled) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, "");
  }
  // Fallback: GCash/Maya reference numbers are usually a long run of digits
  // (often with spaces, e.g. "1234 567 890123") — grab the longest one.
  const runs = text.match(/\d[\d\s]{7,20}\d/g);
  if (runs && runs.length > 0) {
    const longest = runs.reduce((a, b) => (b.replace(/\s/g, "").length > a.replace(/\s/g, "").length ? b : a));
    return longest.replace(/\s+/g, "");
  }
  return null;
}

function extractAmount(text: string): number | null {
  const labeled = [
    /(?:total\s*amount|amount\s*sent|amount)\s*[:\-]?\s*(?:php|₱|p)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:php|₱)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of labeled) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    const { imageBase64, mediaType } = await req.json();
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (typeof imageBase64 !== "string" || !imageBase64 || !allowedTypes.includes(mediaType)) {
      return NextResponse.json({ error: "Unsupported or missing image." }, { status: 400 });
    }
    if (imageBase64.length > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large." }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, "base64");

    // cachePath: "/tmp" — Vercel's serverless functions only allow writes
    // under /tmp; that's where Tesseract stores the downloaded language
    // data so it doesn't fail trying to write to the (read-only) app folder.
    worker = await createWorker("eng", 1, { cachePath: "/tmp" });
    const { data } = await worker.recognize(buffer);
    const text = data.text || "";

    return NextResponse.json({
      referenceNumber: extractReferenceNumber(text),
      amount: extractAmount(text),
    });
  } catch (err) {
    console.error("Receipt scan failed:", err);
    return NextResponse.json({ error: "Couldn't read the receipt." }, { status: 500 });
  } finally {
    if (worker) await worker.terminate();
  }
}
