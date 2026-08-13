import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { isAdminAuthed } from "@/lib/auth";
import { transcodeToMp4 } from "@/lib/transcodeVideo";

export const runtime = "nodejs";
// Video transcoding can take a while for larger clips — give this route
// more headroom than the default (Vercel Hobby caps this at 60s regardless;
// Pro/Enterprise can go higher).
export const maxDuration = 60;

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
    // "popup-video" folder accepts video clips for the popup ad — any
    // common format, since it gets transcoded to a universally-playable
    // MP4 below rather than relying on the visitor's browser to decode
    // whatever the admin happened to upload.
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
    // Broad on purpose: browsers report inconsistent/generic MIME types for
    // less-common containers (some report "application/octet-stream" for
    // .mkv, .avi, etc). We lean on the file extension as a fallback check
    // below rather than rejecting anything not on this exact list.
    const allowedVideoMime = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/3gpp",
      "video/3gpp2",
      "video/mpeg",
      "video/x-flv",
      "video/x-ms-wmv",
    ];
    const allowedVideoExt = ["mp4", "webm", "ogg", "ogv", "mov", "avi", "mkv", "3gp", "3g2", "mpeg", "mpg", "flv", "wmv", "m4v"];

    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (isPopupVideo) {
      const looksLikeVideo = file.type.startsWith("video/") || allowedVideoMime.includes(file.type) || allowedVideoExt.includes(ext);
      if (!looksLikeVideo) {
        return NextResponse.json({ error: "That doesn't look like a video file." }, { status: 400 });
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

    if (isPopupVideo) {
      let mp4Buffer: Buffer;
      try {
        const inputBuffer = Buffer.from(await file.arrayBuffer());
        mp4Buffer = await transcodeToMp4(inputBuffer, ext || "mp4");
      } catch (err) {
        console.error("Video transcode failed:", err);
        return NextResponse.json(
          { error: "Couldn't process that video file. Try a different file or export it as MP4 first." },
          { status: 400 }
        );
      }
      // Always store as .mp4 — that's the normalized output regardless of
      // whatever format came in.
      const filename = `popup-video/${randomUUID()}.mp4`;
      const blob = await put(filename, mp4Buffer, { access: "public", contentType: "video/mp4" });
      return NextResponse.json({ url: blob.url });
    }

    const filename = `${folder}/${randomUUID()}.${ext || "dat"}`;
    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
