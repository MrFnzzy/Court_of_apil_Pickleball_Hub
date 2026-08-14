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

    // Site-wide background music and the popup ad video can only be
    // uploaded by a signed-in admin — unlike proof-of-payment images, which
    // customers upload while booking.
    if ((folder === "music" || folder === "popup-video") && !(await isAdminAuthed())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // The "music" folder (admin-uploaded site background music) accepts audio
    // files instead of images/PDFs, and allows a larger size since audio
    // files are naturally bigger than a QR code or receipt photo. The
    // "popup-video" folder accepts a video clip for the popup ad, uploaded
    // as-is (no server-side transcoding) — the admin's browser needs to be
    // able to decode whatever format they upload for the live preview to
    // work, and visitors' browsers need to be able to play it too, so it's
    // restricted to the handful of formats virtually every modern browser
    // supports natively rather than "any format, converted on the server".
    const isMusic = folder === "music";
    const isPopupVideo = folder === "popup-video";
    const maxSize = isPopupVideo ? 100 * 1024 * 1024 : isMusic ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (max ${isPopupVideo ? "100MB" : isMusic ? "25MB" : "8MB"}).` },
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
    // Only formats that play natively in virtually every modern browser
    // (Chrome, Safari, Firefox, Edge) without server-side conversion.
    // Notably excludes MOV/HEVC, AVI, MKV, WMV, FLV — those decode fine in
    // some browsers/OSes but not reliably across all visitors.
    const allowedVideo = ["video/mp4", "video/webm", "video/ogg"];
    const allowedVideoExt = ["mp4", "webm", "ogg", "ogv"];

    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (isPopupVideo) {
      if (!allowedVideo.includes(file.type) && !allowedVideoExt.includes(ext)) {
        return NextResponse.json(
          { error: "Please upload an MP4 or WebM video — other formats aren't guaranteed to play for every visitor. Most editing apps and phones can export/share as MP4." },
          { status: 400 }
        );
      }
    } else {
      const allowed = isMusic ? allowedAudio : allowedImages;
      if (!allowed.includes(file.type)) {
        return NextResponse.json(
          { error: isMusic ? "Only audio files are allowed (mp3, wav, ogg, m4a, aac, flac)." : "Only image or PDF files are allowed." },
          { status: 400 }
        );
      }
    }

    const filename = `${folder}/${randomUUID()}.${ext || "dat"}`;
    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
