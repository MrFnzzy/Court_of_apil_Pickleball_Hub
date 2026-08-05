import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const rawFolder = (formData.get("folder") as string) || "proofs";
    const folder = /^[a-zA-Z0-9_-]+$/.test(rawFolder) ? rawFolder : "proofs";

    // Site-wide background music can only be uploaded by a signed-in admin —
    // unlike proof-of-payment images, which customers upload while booking.
    if (folder === "music" && !(await isAdminAuthed())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // The "music" folder (admin-uploaded site background music) accepts audio
    // files instead of images/PDFs, and allows a larger size since audio
    // files are naturally bigger than a QR code or receipt photo.
    const isMusic = folder === "music";
    const maxSize = isMusic ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (max ${isMusic ? "25MB" : "8MB"}).` },
        { status: 400 }
      );
    }

    const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    const allowedAudio = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
      "audio/aac",
      "audio/mp4",
      "audio/x-m4a",
      "audio/flac",
    ];
    const allowed = isMusic ? allowedAudio : allowedImages;
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: isMusic ? "Only audio files are allowed (mp3, wav, ogg, m4a, aac, flac)." : "Only image or PDF files are allowed." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "dat";
    const filename = `${folder}/${randomUUID()}.${ext}`;

    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
