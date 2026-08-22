// Shrinks large proof-of-payment screenshots client-side before upload.
//
// Why this exists: phone screenshots are routinely 3-8MB, and hosting
// platforms (Vercel included) enforce a request body size limit
// (~4.5MB) at the platform level, *before* the request ever reaches our
// /api/upload route. When that limit is hit, the platform returns its
// own plain-text/HTML error page instead of JSON, which crashes
// `res.json()` on the client with an error like:
//   "Unexpected token 'R', "Request En"... is not valid JSON"
// Compressing to well under that ceiling avoids the crash entirely, and
// as a bonus makes the upload noticeably faster on mobile data.
const TARGET_MAX_BYTES = 2 * 1024 * 1024; // 2MB — safely under any platform limit
const MAX_DIMENSION = 1920; // proof-of-payment screenshots never need to be bigger than this

export async function compressImageIfNeeded(file: File): Promise<File> {
  // Only compress image types we can decode via <img>/canvas; leave PDFs
  // and anything else untouched.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  if (file.size <= TARGET_MAX_BYTES) {
    return file;
  }

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Step quality down until we're under the target size, or give up
    // and use the smallest attempt after a few tries.
    let quality = 0.85;
    let blob: Blob | null = null;
    for (let i = 0; i < 5; i++) {
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob || blob.size <= TARGET_MAX_BYTES) break;
      quality -= 0.15;
    }
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // If anything about compression fails, fall back to the original file
    // — the upload might still succeed, and if not, the server-side error
    // handling now shows a clear message instead of crashing.
    return file;
  }
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = width > height ? max / width : max / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
