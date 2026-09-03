import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

// The music folder (admin-uploaded site background music) accepts audio
// files instead of images/PDFs, and allows a larger size since audio files
// are naturally bigger than a QR code or receipt photo. The popup-video
// folder accepts a video clip for the popup ad, uploaded as-is (no
// server-side transcoding) — the admin's browser needs to be able to decode
// whatever format they upload for the live preview to work, and visitors'
// browsers need to be able to play it too, so it's restricted to the
// handful of formats virtually every modern browser supports natively
// rather than "any format, converted on the server".
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
// (Chrome, Safari, Firefox, Edge) without server-side conversion. Notably
// excludes MOV/HEVC, AVI, MKV, WMV, FLV — those decode fine in some
// browsers/OSes but not reliably across all visitors.
const allowedVideo = ["video/mp4", "video/webm", "video/ogg"];

// NOTE: this route no longer receives the file itself. It only issues a
// short-lived, scoped upload token — the browser then PUTs the file bytes
// straight to Vercel Blob storage. That's what lets a 25MB music file or a
// 100MB popup video upload successfully at all: routing bytes that large
// through this serverless function would hit the hosting platform's request
// body size limit (~4.5MB) before our own size checks below ever ran,
// producing a non-JSON "Request Entity Too Large" response that crashed the
// client's res.json() call. See src/lib/uploadFile.ts for the client side.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        let folder = "proofs";
        try {
          const parsed = clientPayloadRaw ? JSON.parse(clientPayloadRaw) : {};
          if (typeof parsed.folder === "string" && /^[a-zA-Z0-9_-]+$/.test(parsed.folder)) {
            folder = parsed.folder;
          }
        } catch {
          // malformed payload — fall back to the default "proofs" folder
        }

        const isMusic = folder === "music";
        const isPopupVideo = folder === "popup-video";
        const isCourt360 = folder === "court-360";

        // Site-wide background music, the popup ad video, and the 360
        // court photo can only be uploaded by a signed-in admin — unlike
        // proof-of-payment images, which customers upload while booking.
        if ((isMusic || isPopupVideo || isCourt360) && !(await isAdminAuthed())) {
          throw new Error("Unauthorized.");
        }

        const maximumSizeInBytes = isPopupVideo
          ? 100 * 1024 * 1024
          : isMusic
          ? 25 * 1024 * 1024
          : isCourt360
          ? 20 * 1024 * 1024 // panorama captures run much larger than a typical photo
          : 8 * 1024 * 1024;
        const allowedContentTypes = isPopupVideo ? allowedVideo : isMusic ? allowedAudio : allowedImages;

        return {
          allowedContentTypes,
          maximumSizeInBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ folder }),
        };
      },
      // Fires (via a Vercel-triggered webhook) once the browser has finished
      // uploading directly to Blob storage. Nothing for us to persist here —
      // callers already get the blob URL back from `upload()` on the client
      // and save it themselves — so this is a no-op. Note this webhook can't
      // reach your machine in local dev (no public URL), which is fine: it
      // doesn't block the upload itself.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || "Upload failed. Please try again." }, { status: 400 });
  }
}
