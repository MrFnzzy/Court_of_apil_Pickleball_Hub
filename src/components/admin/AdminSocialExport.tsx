"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PaddleIcon from "@/components/icons/PaddleIcon";
import BallIcon from "@/components/icons/BallIcon";

// ---------------------------------------------------------------------
// A small drag/resize/text design surface, purpose-built for one job:
// composing a "today & tomorrow's open slots" graphic to post on
// Facebook. It's intentionally not a general design tool — just text,
// uploaded images/graphics, and a live schedule block, all draggable and
// resizable on a fixed-size canvas that exports to PNG in one click.
// ---------------------------------------------------------------------

type FormatKey = "square" | "story";
const FORMATS: Record<FormatKey, { label: string; width: number; height: number }> = {
  square: { label: "Square (1:1)", width: 540, height: 540 },
  story: { label: "Story (9:16)", width: 540, height: 960 },
};

type ElementBase = { id: string; x: number; y: number; scale: number; z: number };
type TextEl = ElementBase & {
  kind: "text";
  text: string;
  color: string;
  fontSize: number;
  fontWeight: 400 | 600 | 700 | 800;
  align: "left" | "center" | "right";
  width: number;
};
type ImageEl = ElementBase & { kind: "image"; src: string; width: number; height: number };
type ScheduleEl = ElementBase & { kind: "schedule"; width: number };
type CanvasElement = TextEl | ImageEl | ScheduleEl;

type SlotStatus = "past" | "available" | "pending" | "booked" | "closed";
type SlotInfo = { hour: number; status: SlotStatus };
type DaySchedule = { date: string; grid: SlotInfo[] };

const DEFAULT_BG = "#173A45";

// Soft brand-colored glow that sits behind the card. Rendered as a plain
// radial-gradient (never CSS `filter: blur`, which html2canvas can drop),
// so it rasterizes reliably and still reads as a glow even against a fully
// transparent export — the card looks intentionally "lit" rather than
// dropped onto nothing.
function CardGlow() {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
      <div
        className="absolute rounded-full"
        style={{
          left: "-18%",
          top: "-14%",
          width: "70%",
          height: "55%",
          background: "radial-gradient(circle, rgba(108,212,255,0.55) 0%, rgba(108,212,255,0) 70%)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          right: "-20%",
          bottom: "-16%",
          width: "75%",
          height: "58%",
          background: "radial-gradient(circle, rgba(244,96,54,0.5) 0%, rgba(244,96,54,0) 70%)",
        }}
      />
    </div>
  );
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Full clock-style axis label for a table row, e.g. "12:00 AM", "1:00 AM"
// ... "11:00 PM" — a real clock time rather than a bare "1A" shorthand.
function formatHourClock(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let d = h % 12;
  if (d === 0) d = 12;
  return `${d}:00 ${period}`;
}

function dateSubLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });
}

// Collapses the admin's 5-state slot status down to the 3 buckets that
// actually matter to someone deciding whether to book: green means you can
// grab it, red means someone already has it, grey means the hour simply
// isn't on offer (already passed, or closed) — no need to expose "pending
// vs confirmed" or "closed vs past" distinctions on a public FB post.
function bucketFor(status: SlotStatus): "available" | "booked" | "unavailable" {
  if (status === "available") return "available";
  if (status === "booked" || status === "pending") return "booked";
  return "unavailable";
}

// Each bucket gets a little gradient + shadow recipe so a cell reads as a
// glossy "bubble" rather than a flat rectangle — a soft radial highlight
// near the top-left (the sheen), a deeper base tone, and a drop shadow.
// Plain CSS (gradients/box-shadow), deliberately not backdrop-filter: the
// export goes through html2canvas, which doesn't rasterize backdrop blur
// reliably, so the "glass" look has to come from layered gradients instead.
//
// Colors: green for "you can grab this" (the one universally-understood
// go/available color, so it reads instantly on a social post) and
// court-orange for "someone already has it" — orange still ties back to
// the site's own accent color, with unavailable hours receding into a
// quiet cream/ink neutral.
const BUCKET_STYLE: Record<
  ReturnType<typeof bucketFor>,
  { base: string; shadow: string; sheen: string; solid: string }
> = {
  available: {
    base: "radial-gradient(120% 140% at 28% 20%, #bbf7d0 0%, #4ade80 45%, #16a34a 100%)",
    shadow: "0 2px 5px rgba(22,163,74,0.5), inset 0 1px 1px rgba(255,255,255,0.75), inset 0 -2px 3px rgba(23,58,69,0.25)",
    sheen: "rgba(255,255,255,0.65)",
    solid: "#15803d",
  },
  booked: {
    base: "radial-gradient(120% 140% at 28% 20%, #ff8c61 0%, #f46036 45%, #d6491f 100%)",
    shadow: "0 2px 5px rgba(214,73,31,0.5), inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -2px 3px rgba(23,58,69,0.3)",
    sheen: "rgba(255,255,255,0.4)",
    solid: "#d6491f",
  },
  unavailable: {
    base: "radial-gradient(120% 140% at 28% 20%, #fbf8f3 0%, #e7ecee 55%, #c7d2d6 100%)",
    shadow: "0 1px 3px rgba(23,58,69,0.18), inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(23,58,69,0.12)",
    sheen: "rgba(255,255,255,0.75)",
    solid: "#6b8894",
  },
};

// The title used to be a separate floating text element sitting right at
// y=28 above the schedule block — on a 2x export that baseline could clip
// against the canvas's own rounded/overflow-hidden edge, which is why old
// exports showed "Open Court Times" cut off at the top. The title now
// lives inside the card's own header banner (see the "schedule" render
// below), so there's nothing left to float, clip, or drift out of place.
//
// x/y/scale are chosen so the *whole* card (header + all 24 hourly rows +
// legend + the mascot sticker poking past the bottom-right corner) fits
// inside the shortest default canvas — the 540x540 Square format — with
// real margin to spare. The card's natural (unscaled) height is ~557px at
// width 460; at scale 0.82 that's ~457px, comfortably inside 540 starting
// at y=20. Switching to the taller Story format just leaves more empty
// space around it — nothing gets cropped either way.
function defaultElements(): CanvasElement[] {
  return [{ id: uid(), kind: "schedule", width: 460, x: 81, y: 20, scale: 0.82, z: 1 }];
}

export default function AdminSocialExport() {
  const [format, setFormat] = useState<FormatKey>("square");
  const [background, setBackground] = useState(DEFAULT_BG);
  const [transparentBg, setTransparentBg] = useState(true);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>(() => defaultElements());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nextZ = useRef(10);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const dragState = useRef<null | { id: string; startX: number; startY: number; origX: number; origY: number }>(null);
  const resizeState = useRef<null | { id: string; startDist: number; origScale: number }>(null);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    const today = manilaToday();
    const tomorrow = addDays(today, 1);
    try {
      const results = await Promise.all(
        [today, tomorrow].map(async (date) => {
          const res = await fetch(`/api/slots?date=${date}`, { cache: "no-store" });
          const data = await res.json();
          const grid: SlotInfo[] = Array.isArray(data.grid) ? data.grid : [];
          return { date, grid: grid.slice().sort((a, b) => a.hour - b.hour) };
        })
      );
      setSchedule(results);
    } catch {
      // keep whatever schedule we last had — the "Refresh" button lets the
      // admin retry without losing their design in progress
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Delete the selected element with Backspace/Delete, but never while
  // actually typing inside a text element.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editingTextId) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        e.preventDefault();
        deleteElement(selectedId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingTextId]);

  const selected = elements.find((e) => e.id === selectedId) || null;

  function updateElement<T extends CanvasElement>(id: string, patch: Partial<T>) {
    setElements((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasElement) : e)));
  }

  function bringToFront(id: string) {
    nextZ.current += 1;
    updateElement(id, { z: nextZ.current });
  }
  function sendToBack(id: string) {
    const minZ = elements.length ? Math.min(...elements.map((e) => e.z)) : 0;
    updateElement(id, { z: minZ - 1 });
  }
  function deleteElement(id: string) {
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setEditingTextId((cur) => (cur === id ? null : cur));
  }
  function duplicateElement(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    nextZ.current += 1;
    const copy: CanvasElement = { ...el, id: uid(), x: el.x + 16, y: el.y + 16, z: nextZ.current };
    setElements((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }

  function addText() {
    const id = uid();
    nextZ.current += 1;
    setElements((prev) => [
      ...prev,
      {
        id,
        kind: "text",
        text: "Double-click to edit",
        color: "#ffffff",
        fontSize: 20,
        fontWeight: 700,
        align: "left",
        width: 280,
        x: 40,
        y: 40,
        scale: 1,
        z: nextZ.current,
      },
    ]);
    setSelectedId(id);
  }

  function addScheduleBlock() {
    const id = uid();
    nextZ.current += 1;
    setElements((prev) => [...prev, { id, kind: "schedule", width: 460, x: 40, y: 64, scale: 0.76, z: nextZ.current }]);
    setSelectedId(id);
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new window.Image();
      img.onload = () => {
        const id = uid();
        nextZ.current += 1;
        const maxDim = 200;
        const ratio = img.width / img.height || 1;
        const width = ratio >= 1 ? maxDim : maxDim * ratio;
        const height = ratio >= 1 ? maxDim / ratio : maxDim;
        setElements((prev) => [...prev, { id, kind: "image", src, width, height, x: 60, y: 60, scale: 1, z: nextZ.current }]);
        setSelectedId(id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleBgImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setBgImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  // ---- drag / resize -----------------------------------------------
  // The canvas is always rendered at a fixed CSS pixel size (see FORMATS),
  // so on-screen pointer deltas map 1:1 to element coordinates — no extra
  // zoom/scroll math needed.

  function onElementPointerDown(e: React.PointerEvent, el: CanvasElement) {
    if (editingTextId === el.id) return;
    e.stopPropagation();
    setSelectedId(el.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
  }

  function onResizeHandlePointerDown(e: React.PointerEvent, el: CanvasElement) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    const anchorX = (rect?.left ?? 0) + el.x;
    const anchorY = (rect?.top ?? 0) + el.y;
    const startDist = Math.hypot(e.clientX - anchorX, e.clientY - anchorY) || 1;
    resizeState.current = { id: el.id, startDist, origScale: el.scale };
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (dragState.current) {
      const { id, startX, startY, origX, origY } = dragState.current;
      updateElement(id, { x: origX + (e.clientX - startX), y: origY + (e.clientY - startY) });
    } else if (resizeState.current) {
      const { id, startDist, origScale } = resizeState.current;
      const el = elements.find((x) => x.id === id);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!el || !rect) return;
      const anchorX = rect.left + el.x;
      const anchorY = rect.top + el.y;
      const dist = Math.hypot(e.clientX - anchorX, e.clientY - anchorY) || 1;
      const nextScale = Math.min(4, Math.max(0.3, origScale * (dist / startDist)));
      updateElement(id, { scale: nextScale });
    }
  }

  function endPointerInteraction() {
    dragState.current = null;
    resizeState.current = null;
  }

  async function handleDownload() {
    if (!canvasRef.current) return;
    setExporting(true);
    setSelectedId(null);
    setEditingTextId(null);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(canvasRef.current, {
        // null tells html2canvas to keep the alpha channel instead of
        // flattening onto a solid fill — the PNG comes out with a real
        // transparent backdrop, ready to drop straight onto Facebook.
        backgroundColor: transparentBg && !bgImage ? null : background,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `schedule-post-${manilaToday()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      alert("Couldn't generate the image. Please try again.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  const dims = FORMATS[format];

  return (
    <div>
      {/* Toolbar */}
      <div className="rounded-court glass-panel p-4 sm:p-5 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(FORMATS) as FormatKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormat(key)}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold border ${
                format === key
                  ? "bg-court-orange text-white border-court-orange"
                  : "bg-white text-court-ink/70 border-court-ink/15 hover:border-court-orange/40"
              }`}
            >
              {FORMATS[key].label}
            </button>
          ))}
          <span className="h-5 w-px bg-court-ink/15 mx-1" />
          <button type="button" onClick={addText} className="toolbar-btn">
            + Text
          </button>
          <button type="button" onClick={() => imageInputRef.current?.click()} className="toolbar-btn">
            + Image / graphic
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageFile(f);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={addScheduleBlock} className="toolbar-btn">
            + Schedule block
          </button>
          <button type="button" onClick={loadSchedule} className="toolbar-btn" disabled={scheduleLoading}>
            {scheduleLoading ? "Refreshing…" : "↻ Refresh schedule"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-court-ink/70">Background</span>
          <button
            type="button"
            onClick={() => {
              setTransparentBg(true);
              setBgImage(null);
            }}
            className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold border ${
              transparentBg && !bgImage
                ? "bg-court-orange text-white border-court-orange"
                : "bg-white text-court-ink/70 border-court-ink/15 hover:border-court-orange/40"
            }`}
          >
            Transparent
          </button>
          <label
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-full pl-1 pr-3 py-1 border cursor-pointer ${
              !transparentBg && !bgImage ? "border-court-orange bg-court-orange/10" : "border-court-ink/15"
            }`}
          >
            <input
              type="color"
              value={background}
              onChange={(e) => {
                setBackground(e.target.value);
                setTransparentBg(false);
                setBgImage(null);
              }}
              className="h-6 w-8 rounded border border-court-ink/15 cursor-pointer"
            />
            Color
          </label>
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            className={`toolbar-btn ${bgImage ? "!bg-court-orange !text-white" : ""}`}
          >
            {bgImage ? "Replace background image" : "+ Background image"}
          </button>
          {bgImage && (
            <button type="button" onClick={() => setBgImage(null)} className="text-xs font-semibold text-red-600 hover:text-red-700">
              Remove background image
            </button>
          )}
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBgImageFile(f);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            className="focus-ring ml-auto rounded-full bg-court-orange text-white px-5 py-2 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-60"
          >
            {exporting ? "Preparing…" : "⬇ Download for Facebook"}
          </button>
        </div>

        {/* Contextual controls for whatever's selected */}
        {selected && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-court-ink/5 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-court-ink/40">
              {selected.kind === "text" ? "Text" : selected.kind === "image" ? "Image" : "Schedule block"}
            </span>
            {selected.kind === "text" && (
              <>
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => updateElement<TextEl>(selected.id, { color: e.target.value })}
                  className="h-7 w-9 rounded border border-court-ink/15 cursor-pointer"
                  title="Text color"
                />
                <button type="button" className="toolbar-btn-sm" onClick={() => updateElement<TextEl>(selected.id, { fontSize: Math.max(10, selected.fontSize - 2) })}>
                  A-
                </button>
                <button type="button" className="toolbar-btn-sm" onClick={() => updateElement<TextEl>(selected.id, { fontSize: Math.min(72, selected.fontSize + 2) })}>
                  A+
                </button>
                <button
                  type="button"
                  className={`toolbar-btn-sm ${selected.fontWeight >= 700 ? "bg-court-ink text-white" : ""}`}
                  onClick={() => updateElement<TextEl>(selected.id, { fontWeight: selected.fontWeight >= 700 ? 400 : 800 })}
                >
                  Bold
                </button>
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`toolbar-btn-sm ${selected.align === a ? "bg-court-ink text-white" : ""}`}
                    onClick={() => updateElement<TextEl>(selected.id, { align: a })}
                  >
                    {a[0].toUpperCase()}
                  </button>
                ))}
              </>
            )}
            <span className="h-5 w-px bg-court-ink/15" />
            <button type="button" className="toolbar-btn-sm" onClick={() => duplicateElement(selected.id)}>
              Duplicate
            </button>
            <button type="button" className="toolbar-btn-sm" onClick={() => bringToFront(selected.id)}>
              Bring to front
            </button>
            <button type="button" className="toolbar-btn-sm" onClick={() => sendToBack(selected.id)}>
              Send to back
            </button>
            <button type="button" className="toolbar-btn-sm text-red-600" onClick={() => deleteElement(selected.id)}>
              Delete
            </button>
          </div>
        )}

        <p className="text-xs text-court-ink/50">
          Drag an element to move it, drag its bottom-right handle to resize. Double-click text to edit it. The
          schedule block always shows today &amp; tomorrow's live open/booked hours — hit refresh if you've made
          changes since opening this tab.
        </p>
      </div>

      {/* Canvas */}
      <div className="overflow-x-auto pb-2">
        {/* Outer wrapper is what's centered/sized on screen. The border,
            rounded corners, and drop shadow live here — as a purely
            decorative, pointer-events-none guide — instead of on the
            captured element below. Previously those lived directly on
            canvasRef, which meant html2canvas baked a visible stroke +
            rounded-corner clip right into the exported PNG, hard-cutting
            the soft glow orbs mid-blend and leaving a rough rectangular
            seam around the card. Since this frame div is a sibling (not a
            child) of canvasRef, html2canvas never sees it — the export
            now fades to transparent exactly like the on-screen glow does. */}
        <div className="relative mx-auto" style={{ width: dims.width, height: dims.height }}>
          <div
            ref={canvasRef}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={endPointerInteraction}
            onPointerLeave={endPointerInteraction}
            onPointerDown={() => setSelectedId(null)}
            className="relative overflow-hidden select-none"
            style={{
              width: dims.width,
              height: dims.height,
              background: bgImage
                ? `center/cover no-repeat url(${bgImage})`
                : transparentBg
                ? // Editor-only checkerboard so it's obvious the canvas is
                  // transparent while you're designing — never exported,
                  // since html2canvas is told to keep alpha (backgroundColor: null).
                  "repeating-conic-gradient(#eef2f3 0% 25%, #ffffff 0% 50%) 0 0 / 20px 20px"
                : background,
            }}
          >
            {elements
            .slice()
            .sort((a, b) => a.z - b.z)
            .map((el) => (
              <CanvasElementView
                key={el.id}
                el={el}
                isSelected={selectedId === el.id}
                isEditing={editingTextId === el.id}
                schedule={schedule}
                scheduleLoading={scheduleLoading}
                onPointerDown={(e) => onElementPointerDown(e, el)}
                onResizePointerDown={(e) => onResizeHandlePointerDown(e, el)}
                onStartEditing={() => setEditingTextId(el.id)}
                onStopEditing={(text) => {
                  updateElement<TextEl>(el.id, { text });
                  setEditingTextId(null);
                }}
              />
            ))}
          </div>

          {/* Decorative frame guide — border, rounded corners, drop shadow.
              Sibling of canvasRef, so it's invisible to html2canvas and
              never appears in the downloaded PNG; it only helps you see
              the canvas edges while designing. */}
          <div
            className="absolute inset-0 rounded-2xl border-2 border-court-ink/15 shadow-court-lg pointer-events-none"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

function RowCells({ hour, schedule }: { hour: number; schedule: DaySchedule[] }) {
  return (
    <>
      <div className="flex items-center justify-end pr-1.5 text-[7.5px] font-bold text-court-ink/50 tracking-tight leading-none whitespace-nowrap">
        {formatHourClock(hour)}
      </div>
      {schedule.map((day) => {
        const status = day.grid.find((s) => s.hour === hour)?.status ?? "past";
        const bucket = bucketFor(status);
        const style = BUCKET_STYLE[bucket];
        return (
          <div
            key={day.date}
            style={{ background: style.base, boxShadow: style.shadow }}
            className="relative h-[16px] rounded-full overflow-hidden"
          >
            {/* glossy "liquid" highlight near the top of the bubble */}
            <div
              className="absolute inset-x-1.5 top-[1.5px] h-[5.5px] rounded-full pointer-events-none"
              style={{ background: `linear-gradient(180deg, ${style.sheen} 0%, transparent 100%)` }}
            />
          </div>
        );
      })}
    </>
  );
}

function LegendBadge({ bucket, label }: { bucket: "available" | "booked" | "unavailable"; label: string }) {
  const style = BUCKET_STYLE[bucket];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-[9.5px] font-bold"
      style={{ background: `${style.solid}1a`, color: style.solid }}
    >
      <span
        className="relative h-2.5 w-2.5 rounded-full flex-shrink-0 overflow-hidden"
        style={{ background: style.base, boxShadow: style.shadow }}
      >
        <span
          className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${style.sheen} 0%, transparent 100%)` }}
        />
      </span>
      {label}
    </span>
  );
}

function CanvasElementView({
  el,
  isSelected,
  isEditing,
  schedule,
  scheduleLoading,
  onPointerDown,
  onResizePointerDown,
  onStartEditing,
  onStopEditing,
}: {
  el: CanvasElement;
  isSelected: boolean;
  isEditing: boolean;
  schedule: DaySchedule[];
  scheduleLoading: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  onStartEditing: () => void;
  onStopEditing: (text: string) => void;
}) {
  const editableRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute ${isSelected ? "outline outline-2 outline-court-orange outline-offset-4" : ""}`}
      style={{
        left: el.x,
        top: el.y,
        zIndex: el.z,
        transform: `scale(${el.scale})`,
        transformOrigin: "top left",
        cursor: isEditing ? "text" : "grab",
        touchAction: "none",
      }}
    >
      {el.kind === "text" &&
        (isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            autoFocus
            onBlur={(e) => onStopEditing(e.currentTarget.textContent || "")}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
            }}
            style={{
              width: el.width,
              fontSize: el.fontSize,
              fontWeight: el.fontWeight,
              color: el.color,
              textAlign: el.align,
              fontFamily: "var(--font-display)",
              outline: "none",
              minWidth: 40,
            }}
          >
            {el.text}
          </div>
        ) : (
          <p
            onDoubleClick={onStartEditing}
            style={{
              width: el.width,
              fontSize: el.fontSize,
              fontWeight: el.fontWeight,
              color: el.color,
              textAlign: el.align,
              fontFamily: "var(--font-display)",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {el.text}
          </p>
        ))}

      {el.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={el.src} alt="" draggable={false} style={{ width: el.width, height: el.height, display: "block", objectFit: "contain" }} />
      )}

      {el.kind === "schedule" && (
        <div className="relative" style={{ width: el.width }}>
          {/* brand-colored glow behind the card — reads even on a fully
              transparent export, so the post never looks like a flat
              screenshot dropped onto nothing */}
          <CardGlow />

          {/* gradient ring: outer div carries an orange→blue gradient as its
              background, inner card sits 2.5px inset on top of it, giving a
              seamless painted border with zero backdrop-filter involved */}
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 26,
              padding: 2.5,
              background: "linear-gradient(135deg, #f46036 0%, #ff8c61 30%, #6cd4ff 70%, #2fa8d9 100%)",
              boxShadow: "0 24px 48px rgba(15,35,42,0.4), 0 4px 14px rgba(15,35,42,0.18)",
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: 24,
                background: "linear-gradient(170deg, #fefcf9 0%, #fbf8f3 55%, #f3ede2 100%)",
              }}
            >
              {/* faint dink-dot texture across the whole card */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.5]"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(23,58,69,0.28) 1px, transparent 1px)",
                  backgroundSize: "10px 10px",
                }}
              />

              {/* ---- header banner: title now lives here, permanently
                  anchored to the card instead of floating loose above it ---- */}
              <div
                className="relative overflow-hidden"
                style={{
                  background: "linear-gradient(120deg, #173a45 0%, #1f4f5f 55%, #2fa8d9 130%)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none opacity-70"
                  style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.22) 45%, transparent 62%)" }}
                />
                {/* dashed "net" line along the bottom edge of the banner */}
                <div
                  className="absolute bottom-0 left-0 right-0 pointer-events-none"
                  style={{ borderBottom: "2px dashed rgba(255,255,255,0.35)" }}
                />
                <BallIcon className="absolute -right-3 -top-3 h-14 w-14 text-white/10 pointer-events-none" />
                <div className="relative flex items-center justify-center gap-2 pt-2.5 pb-2.5 px-4">
                  <PaddleIcon className="h-6 w-6 text-court-orange-light flex-shrink-0 -rotate-12" />
                  <div className="text-center">
                    <p className="font-display font-800 text-white text-[19px] leading-none tracking-wide">
                      OPEN COURT TIMES
                    </p>
                    <p className="text-white/70 text-[9.5px] font-semibold tracking-[0.14em] uppercase mt-1">
                      Heide&rsquo;s Pickleball Hub
                    </p>
                  </div>
                  <PaddleIcon className="h-6 w-6 text-court-orange-light flex-shrink-0 rotate-[195deg] scale-x-[-1]" />
                </div>
              </div>

              <div className="relative">
                {scheduleLoading && schedule.length === 0 ? (
                  <p className="text-xs text-court-ink/50 p-4">Loading schedule…</p>
                ) : schedule.length === 0 ? (
                  <p className="text-xs text-court-ink/50 p-4">Schedule unavailable — hit refresh above.</p>
                ) : (
                  <div
                    className="relative"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1fr 1fr",
                      rowGap: 1.5,
                      columnGap: 3,
                      padding: "7px 8px 3px",
                    }}
                  >
                    {/* "net line" — a dashed divider between the Today and Tomorrow
                        columns, echoing the net down the middle of a real court */}
                    <div
                      className="absolute top-1 bottom-1 pointer-events-none"
                      style={{
                        left: "calc(50% + 26px)",
                        borderLeft: "2px dashed rgba(244,96,54,0.3)",
                      }}
                    />

                    {/* header row */}
                    <div className="flex items-center justify-center">
                      <PaddleIcon className="h-5 w-5 text-court-orange-dark/60" />
                    </div>
                    {schedule.map((day, i) => (
                      <div
                        key={day.date}
                        style={{
                          background: i === 0 ? "linear-gradient(165deg, #2fa8d9 0%, #173a45 100%)" : "linear-gradient(165deg, #f46036 0%, #b93d17 100%)",
                          boxShadow: "0 3px 8px rgba(23,58,69,0.4), inset 0 1px 1px rgba(255,255,255,0.25)",
                        }}
                        className="relative overflow-hidden text-white text-center py-1 px-1 rounded-xl"
                      >
                        <div
                          className="absolute inset-0 pointer-events-none opacity-60"
                          style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.28) 0%, transparent 55%)" }}
                        />
                        <p className="relative font-display font-800 text-[13px] leading-none tracking-wide">
                          {i === 0 ? "TODAY" : "TOMORROW"}
                        </p>
                        <p className="relative text-[9px] leading-none mt-0.5 opacity-80">{dateSubLabel(day.date)}</p>
                      </div>
                    ))}

                    {/* 24 hourly rows */}
                    {Array.from({ length: 24 }, (_, hour) => (
                      <RowCells key={hour} hour={hour} schedule={schedule} />
                    ))}
                  </div>
                )}

                <div className="relative flex flex-wrap items-center gap-1.5 px-3.5 py-2 border-t border-dashed border-court-orange-dark/25">
                  <LegendBadge bucket="available" label="Available" />
                  <LegendBadge bucket="booked" label="Booked" />
                  <LegendBadge bucket="unavailable" label="Unavailable" />
                </div>
              </div>

              {/* paddle mascot sticker, tucked in the corner with its own
                  drop shadow so it reads as a little badge, not clutter */}
              <PaddleIcon
                className="absolute -bottom-2.5 -right-2.5 h-12 w-12 text-court-orange rotate-[18deg] pointer-events-none"
                style={{ filter: "drop-shadow(0 3px 4px rgba(23,58,69,0.35))", opacity: 0.9 }}
              />
            </div>
          </div>
        </div>
      )}

      {isSelected && (
        <div
          onPointerDown={onResizePointerDown}
          className="absolute -bottom-2.5 -right-2.5 h-5 w-5 rounded-full bg-court-orange border-2 border-white shadow-court cursor-nwse-resize"
          style={{ touchAction: "none" }}
        />
      )}
    </div>
  );
}
