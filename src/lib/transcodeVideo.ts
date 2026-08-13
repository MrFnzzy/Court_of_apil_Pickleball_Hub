import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { randomUUID } from "crypto";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
}

/**
 * Transcodes an arbitrary uploaded video (mov/HEVC, mkv, avi, whatever a
 * phone or camera produced) into a standard H.264/AAC MP4 with
 * "+faststart" so it always plays inline in every browser, instead of
 * depending on the visitor's browser being able to decode whatever codec
 * the admin happened to upload.
 *
 * Runs via a temp-file pair (fluent-ffmpeg needs real file paths, not
 * in-memory streams) in the OS tmp dir, which on Vercel's serverless
 * functions is a writable /tmp. Both temp files are always cleaned up.
 */
export async function transcodeToMp4(input: Buffer, originalExt: string): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "popup-video-"));
  const safeExt = /^[a-zA-Z0-9]+$/.test(originalExt) ? originalExt : "dat";
  const inputPath = path.join(workDir, `in-${randomUUID()}.${safeExt}`);
  const outputPath = path.join(workDir, `out-${randomUUID()}.mp4`);

  try {
    await writeFile(inputPath, input);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .audioBitrate("128k")
        // Cap resolution so oversized phone footage doesn't produce a huge
        // file — only ever scales DOWN (the min() guards against upscaling
        // small videos), keeps aspect ratio, and forces even dimensions
        // (required by libx264, hence the "-2").
        .videoFilters("scale='min(1280,iw)':'-2'")
        .outputOptions([
          "-preset veryfast",
          "-crf 23",
          "-movflags +faststart", // metadata up front so playback can start before the file fully downloads
          "-pix_fmt yuv420p", // widest compatibility (some sources use 10-bit/4:2:2 which not all decoders handle)
        ])
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(outputPath);
    });

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
