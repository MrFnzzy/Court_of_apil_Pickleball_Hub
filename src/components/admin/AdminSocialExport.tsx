"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
const BUCKET_STYLE: Record<
  ReturnType<typeof bucketFor>,
  { base: string; shadow: string; sheen: string }
> = {
  available: {
    base: "radial-gradient(120% 140% at 28% 20%, #86efac 0%, #22c55e 45%, #15803d 100%)",
    shadow: "0 2px 5px rgba(21,128,61,0.45), inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(21,128,61,0.35)",
    sheen: "rgba(255,255,255,0.55)",
  },
  booked: {
    base: "radial-gradient(120% 140% at 28% 20%, #fca5a5 0%, #ef4444 45%, #b91c1c 100%)",
    shadow: "0 2px 5px rgba(185,28,28,0.45), inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -2px 3px rgba(185,28,28,0.35)",
    sheen: "rgba(255,255,255,0.45)",
  },
  unavailable: {
    base: "radial-gradient(120% 140% at 28% 20%, #f1f5f9 0%, #cbd5e1 55%, #94a3b8 100%)",
    shadow: "0 1px 3px rgba(71,85,105,0.3), inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -2px 3px rgba(100,116,139,0.25)",
    sheen: "rgba(255,255,255,0.7)",
  },
};

function defaultElements(): CanvasElement[] {
  return [
    {
      id: uid(),
      kind: "text",
      text: "Open Court Times",
      color: "#ffffff",
      fontSize: 26,
      fontWeight: 800,
      align: "center",
      width: 460,
      x: 40,
      y: 28,
      scale: 1,
      z: 2,
    },
    { id: uid(), kind: "schedule", width: 460, x: 40, y: 64, scale: 0.76, z: 1 },
  ];
}

export default function AdminSocialExport() {
  const [format, setFormat] = useState<FormatKey>("square");
  const [background, setBackground] = useState(DEFAULT_BG);
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
        backgroundColor: background,
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
          <label className="flex items-center gap-1.5 text-xs font-semibold text-court-ink/70">
            Background
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="h-7 w-9 rounded border border-court-ink/15 cursor-pointer"
            />
          </label>
          <button type="button" onClick={() => bgInputRef.current?.click()} className="toolbar-btn">
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
        <div
          ref={canvasRef}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={endPointerInteraction}
          onPointerLeave={endPointerInteraction}
          onPointerDown={() => setSelectedId(null)}
          className="relative mx-auto overflow-hidden rounded-2xl border-2 border-court-ink/15 shadow-court-lg select-none"
          style={{
            width: dims.width,
            height: dims.height,
            background: bgImage ? `center/cover no-repeat url(${bgImage})` : background,
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
            className="relative h-[20px] rounded-full overflow-hidden"
          >
            {/* glossy "liquid" highlight near the top of the bubble */}
            <div
              className="absolute inset-x-1.5 top-[2px] h-[7px] rounded-full pointer-events-none"
              style={{ background: `linear-gradient(180deg, ${style.sheen} 0%, transparent 100%)` }}
            />
          </div>
        );
      })}
    </>
  );
}

function LegendDot({ bucket, label }: { bucket: "available" | "booked" | "unavailable"; label: string }) {
  const style = BUCKET_STYLE[bucket];
  return (
    <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold text-court-ink/60">
      <span
        className="relative h-3.5 w-3.5 rounded-full flex-shrink-0 overflow-hidden"
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
        <div
          style={{
            width: el.width,
            background: "linear-gradient(165deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 100%)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 10px 30px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
            backdropFilter: "blur(6px)",
          }}
          className="rounded-2xl overflow-hidden"
        >
          {scheduleLoading && schedule.length === 0 ? (
            <p className="text-xs text-court-ink/50 p-3.5">Loading schedule…</p>
          ) : schedule.length === 0 ? (
            <p className="text-xs text-court-ink/50 p-3.5">Schedule unavailable — hit refresh above.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", gap: 2, padding: 6 }}>
              {/* header row */}
              <div />
              {schedule.map((day, i) => (
                <div
                  key={day.date}
                  style={{
                    background: "linear-gradient(165deg, #1f4653 0%, #0f2c36 100%)",
                    boxShadow: "0 2px 5px rgba(15,44,54,0.4), inset 0 1px 1px rgba(255,255,255,0.15)",
                  }}
                  className="text-white text-center py-1.5 px-1 rounded-lg"
                >
                  <p className="font-display font-800 text-[13px] leading-none tracking-wide">
                    {i === 0 ? "TODAY" : "TOMORROW"}
                  </p>
                  <p className="text-[9px] leading-none mt-0.5 opacity-70">{dateSubLabel(day.date)}</p>
                </div>
              ))}

              {/* 24 hourly rows */}
              {Array.from({ length: 24 }, (_, hour) => (
                <RowCells key={hour} hour={hour} schedule={schedule} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 px-3 py-2 border-t border-court-ink/10">
            <LegendDot bucket="available" label="Available" />
            <LegendDot bucket="booked" label="Booked" />
            <LegendDot bucket="unavailable" label="Unavailable" />
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
