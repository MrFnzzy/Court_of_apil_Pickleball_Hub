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
type Segment = { startHour: number; endHour: number; available: boolean };
type DaySchedule = { date: string; segments: Segment[] };

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

function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  let d = h % 12;
  if (d === 0) d = 12;
  return `${d}:00 ${period}`;
}

function dayHeading(dateStr: string, isToday: boolean): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const label = d.toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });
  return `${isToday ? "Today" : "Tomorrow"} · ${label}`;
}

// Collapses the 24 hourly slots into runs of consecutive
// available/unavailable hours, e.g. hours 6,7,8 (all available) become one
// "6:00 AM – 9:00 AM" row instead of three.
function mergeSegments(grid: SlotInfo[]): Segment[] {
  const sorted = [...grid].sort((a, b) => a.hour - b.hour);
  const segments: Segment[] = [];
  for (const slot of sorted) {
    const available = slot.status === "available";
    const last = segments[segments.length - 1];
    if (last && last.available === available && last.endHour === slot.hour) {
      last.endHour = slot.hour + 1;
    } else {
      segments.push({ startHour: slot.hour, endHour: slot.hour + 1, available });
    }
  }
  return segments;
}

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
    { id: uid(), kind: "schedule", width: 460, x: 40, y: 88, scale: 1, z: 1 },
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
          return { date, segments: mergeSegments(grid) };
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
    setElements((prev) => [...prev, { id, kind: "schedule", width: 460, x: 40, y: 88, scale: 1, z: nextZ.current }]);
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
        <div style={{ width: el.width }} className="rounded-xl bg-white/95 shadow-court p-3.5 space-y-3">
          {scheduleLoading && schedule.length === 0 ? (
            <p className="text-xs text-court-ink/50">Loading schedule…</p>
          ) : schedule.length === 0 ? (
            <p className="text-xs text-court-ink/50">Schedule unavailable — hit refresh above.</p>
          ) : (
            schedule.map((day, i) => (
              <div key={day.date}>
                <p className="font-display font-700 text-court-ink text-sm mb-1.5">{dayHeading(day.date, i === 0)}</p>
                <div className="space-y-1">
                  {day.segments.map((seg, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[12.5px] leading-tight">
                      <span
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${seg.available ? "bg-green-500" : "bg-red-500"}`}
                      />
                      <span className={`font-medium ${seg.available ? "text-court-ink" : "text-court-ink/50"}`}>
                        {formatHour(seg.startHour)} – {formatHour(seg.endHour % 24)}
                      </span>
                      <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${seg.available ? "text-green-600" : "text-red-500"}`}>
                        {seg.available ? "Open" : "Booked"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
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
