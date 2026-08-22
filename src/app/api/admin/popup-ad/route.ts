import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getPopupAd, updatePopupAd } from "@/lib/popupAd";

export async function GET() {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ad = await getPopupAd();
    return NextResponse.json({ ad });

  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That value is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// PATCH { enabled?, imageUrl?, videoUrl?, headline?, message?, linkUrl?, buttonText? }
// All fields optional/partial — the admin form only sends what changed.
// Pass "" (empty string) for a text field to clear it; imageUrl can't be
// cleared this way since removing the photo entirely just means turning
// the ad off (enabled: false), not leaving an ad with no image live.
// videoUrl CAN be cleared with "" — an admin removing the video should be
// able to fall back to the photo-only popup without touching enabled.
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const data: {
      enabled?: boolean;
      imageUrl?: string;
      videoUrl?: string | null;
      headline?: string | null;
      message?: string | null;
      linkUrl?: string | null;
      buttonText?: string | null;
    } = {};

    if (typeof body.enabled === "boolean") {
      if (body.enabled) {
        const current = await getPopupAd();
        const willHaveImage = body.imageUrl !== undefined ? !!body.imageUrl : !!current.imageUrl;
        if (!willHaveImage) {
          return NextResponse.json({ error: "Add a photo before turning the popup ad on." }, { status: 400 });
        }
      }
      data.enabled = body.enabled;
    }
    if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl;
    if (body.videoUrl !== undefined) data.videoUrl = body.videoUrl || null;
    if (body.headline !== undefined) data.headline = body.headline || null;
    if (body.message !== undefined) data.message = body.message || null;
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl || null;
    if (body.buttonText !== undefined) data.buttonText = body.buttonText || null;

    const ad = await updatePopupAd(data);
    return NextResponse.json({ success: true, ad });

  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That value is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
