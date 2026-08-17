"use client";

// Uploads a file straight from the browser to Vercel Blob storage, instead
// of routing the bytes through our own /api/upload serverless function.
// That function only issues a short-lived, scoped token now (see
// src/app/api/upload/route.ts) — the actual upload bypasses it entirely,
// which is what lets large files (site music, popup ad videos) succeed at
// all without hitting the hosting platform's ~4.5MB request body limit.
import { upload } from "@vercel/blob/client";

// A few browsers leave File.type blank for formats they're less sure about
// (this shows up for .webm and .ogg fairly often). Fall back to guessing
// from the extension so the upload still gets a real content type instead
// of being rejected.
const EXT_FALLBACK: Record<string, string> = {
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/x-m4a",
  aac: "audio/aac",
  flac: "audio/flac",
};

export async function uploadFile(file: File, folder: string = "proofs"): Promise<{ url: string }> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const contentType = file.type || EXT_FALLBACK[ext];

  try {
    const blob = await upload(`${folder}/${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      clientPayload: JSON.stringify({ folder }),
      ...(contentType ? { contentType } : {}),
    });
    return { url: blob.url };
  } catch (err: any) {
    // Surface the server's validation message (unauthorized, file too
    // large, wrong type) when we have one; otherwise a generic fallback.
    throw new Error(err?.message || "Upload failed. Please try again.");
  }
}
