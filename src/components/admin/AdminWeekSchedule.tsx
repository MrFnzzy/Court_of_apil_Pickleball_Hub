"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { labelForSlot } from "@/lib/pricing";

type SlotStatus = "past" | "available" | "pending" | "booked" | "closed";

type SlotBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  customerName: string;
  contactNumber: string;
  email: string;
  startHours: number[];
  grandTotal: number;
  paymentMethod: string;
  referenceNumber: string;
  isDownpayment: boolean;
  downpaymentNote: string | null;
};

type SlotInfo = { hour: number; status: SlotStatus; price: number; booking?: SlotBooking; isPast?: boolean };

type DayColumn = { date: string; grid: SlotInfo[] | null; loading: boolean };

// ---- Colors follow the admin's own legend: --------------------------------
// grey = unavailable (already past / closed), green = available,
// red = booked (confirmed), yellow = pending verification.
const CELL_CLASS: Record<SlotStatus, string> = {
  available: "bg-green-500 hover:bg-green-600 border-green-700",
  booked: "bg-red-500 hover:bg-red-600 border-red-700 cursor-pointer",
  pending: "bg-yellow-400 hover:bg-yellow-500 border-yellow-600 cursor-pointer",
  past: "bg-gray-300 border-gray-400",
  closed: "bg-orange-200 border-orange-400 [background-image:repeating-linear-gradient(135deg,rgba(217,119,6,0.35)_0_4px,transparent_4px_8px)]",
};

const DIMMED_CLASS: Record<SlotStatus, string> = {
  available: "bg-green-500 hover:bg-green-600 border-green-700",
  booked: "bg-gray-200 border-gray-400",
  pending: "bg-gray-200 border-gray-400",
  past: "bg-gray-200 border-gray-400",
  closed: "bg-gray-200 border-gray-400",
};

// Detects the specific "silent failure" mode of html2canvas where it
// doesn't throw but paints nothing — sampling a grid of pixels across the
// canvas is enough to tell a real schedule capture (full of colored cells,
// borders, and text) apart from an accidentally blank one, without the
// cost of reading every pixel.
function isBlankCanvas(canvas: HTMLCanvasElement): boolean {
  if (canvas.width === 0 || canvas.height === 0) return true;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false; // can't tell — assume it's fine rather than false-reject
  const cols = 12;
  const rows = 12;
  let first: string | null = null;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = Math.floor((canvas.width * (i + 0.5)) / cols);
      const y = Math.floor((canvas.height * (j + 0.5)) / rows);
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      const px = `${r},${g},${b},${a}`;
      if (first === null) {
        first = px;
      } else if (px !== first) {
        return false; // found variation — there's real content here
      }
    }
  }
  return true;
}

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

function isoFromParts(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

// Monday of the week containing `dateStr` (ISO week, Mon..Sun).
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayHeaderLabel(dateStr: string): { weekday: string; dayNum: string; month: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  return {
    weekday: d.toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "short" }),
    dayNum: d.toLocaleDateString("en-PH", { timeZone: "UTC", day: "numeric" }),
    month: d.toLocaleDateString("en-PH", { timeZone: "UTC", month: "short" }),
  };
}

function weekRangeLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const start = new Date(monday + "T00:00:00Z");
  const end = new Date(sunday + "T00:00:00Z");
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = start.toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-PH", {
    timeZone: "UTC",
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

// Short row label e.g. "12–1 AM", "1–2 PM"
function hourRowLabel(hour: number): string {
  const period = (h: number) => (h < 12 ? "AM" : "PM");
  const disp = (h: number) => {
    const v = h % 12;
    return v === 0 ? 12 : v;
  };
  const end = (hour + 1) % 24;
  if (period(hour) === period(end) || end === 0) {
    return `${disp(hour)}–${disp(end)} ${period(end)}`;
  }
  return `${disp(hour)} ${period(hour)}–${disp(end)} ${period(end)}`;
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&apos;" }[character] ?? character));
}

function buildWeekSvg({ monday, weekDates, days, availableOnly, todayStr }: { monday: string; weekDates: string[]; days: DayColumn[]; availableOnly: boolean; todayStr: string }): string {
  // Match the compact schedule-card composition used in the admin UI.
  // Keeping these dimensions fixed also makes every download predictable.
  const width = 820;
  const height = 648;
  const cardX = 14;
  const cardY = 18;
  const cardWidth = width - 28;
  const cardHeight = height - 36;
  const gridX = 30;
  const gridY = 62;
  const labelWidth = 42;
  const gridWidth = 707;
  const columnWidth = gridWidth / 7;
  const headerHeight = 32;
  const rowHeight = 21.5;
  const colors: Record<SlotStatus, string> = { available: "#20c56a", booked: "#f04449", pending: "#facc15", past: "#d6d9df", closed: "url(#closedStripe)" };
  const ink = "#173a45";
  const gridStroke = "#aeb9bd";
  const parts: string[] = [
    `<defs><pattern id="closedStripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><rect width="8" height="8" fill="#ffd9a4"/><path d="M0 0V8" stroke="#e5a64f" stroke-width="2"/></pattern></defs>`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="14" fill="#f4f8f7" stroke="#d8e0df" stroke-width="1.5"/>`,
  ];
  const text = (x: number, y: number, value: string, size: number, weight = 500, fill = ink, anchor = "start") => parts.push(`<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}">${escapeSvg(value)}</text>`);
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = "none", strokeWidth = 1) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);

  text(29, 42, `Weekly schedule — ${weekRangeLabel(monday)}`, 13, 700);
  if (availableOnly) text(29, 56, "Available slots highlighted", 8.5, 600, "#52727b");

  const legend = ["Available", "Booked", "Pending", "Unavailable", "Closed"];
  const legendKeys: SlotStatus[] = ["available", "booked", "pending", "past", "closed"];
  legend.forEach((label, index) => {
    const x = 450 + index * 67;
    parts.push(`<circle cx="${x}" cy="40" r="5" fill="${colors[legendKeys[index]]}" stroke="#ffffff" stroke-width="1"/>`);
    text(x + 8, 43, label, 8.5, 600, "#52727b");
  });

  rect(gridX, gridY, labelWidth, headerHeight, "#f7fbfc", gridStroke);
  text(gridX + labelWidth / 2, gridY + 20, "TIME", 8.5, 700, "#52727b", "middle");
  weekDates.forEach((date, index) => {
    const x = gridX + labelWidth + index * columnWidth;
    const { dayNum, month } = dayHeaderLabel(date);
    rect(x, gridY, columnWidth, headerHeight, date === todayStr ? "#fff0e9" : "#f7fbfc", gridStroke);
    text(x + columnWidth / 2, gridY + 13, DAY_NAMES[index].toUpperCase(), 8.5, 700, date === todayStr ? "#d6491f" : "#52727b", "middle");
    text(x + columnWidth / 2, gridY + 25, `${dayNum} ${month}`, 7.5, 500, date === todayStr ? "#d6491f" : "#52727b", "middle");
  });

  Array.from({ length: 24 }, (_, hour) => {
    const y = gridY + headerHeight + hour * rowHeight;
    rect(gridX, y, labelWidth, rowHeight, "#f7fbfc", gridStroke);
    text(gridX + labelWidth - 4, y + 14.5, hourRowLabel(hour), 7.2, 600, "#52727b", "end");
    weekDates.forEach((date, index) => {
      const x = gridX + labelWidth + index * columnWidth;
      const day = days.find((entry) => entry.date === date);
      const slot = day?.grid?.find((entry) => entry.hour === hour);
      const actualStatus: SlotStatus = slot?.status ?? "past";
      const displayStatus: SlotStatus = actualStatus === "available" && slot?.isPast ? "past" : actualStatus;
      const dimmed = availableOnly && displayStatus !== "available";
      rect(x, y, columnWidth, rowHeight, dimmed ? "#e5e7eb" : colors[displayStatus], gridStroke);
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
}

export default function AdminWeekSchedule() {
  const [monday, setMonday] = useState(() => mondayOf(manilaToday()));
  const [days, setDays] = useState<DayColumn[]>(
    Array.from({ length: 7 }, (_, i) => ({ date: addDays(mondayOf(manilaToday()), i), grid: null, loading: true }))
  );
  const [selected, setSelected] = useState<{ date: string; slot: SlotInfo } | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);

  const fetchWeek = useCallback(async (dates: string[]) => {
    const results = await Promise.all(
      dates.map(async (date) => {
        try {
          const res = await fetch(`/api/slots?date=${date}&admin=1`, { cache: "no-store" });
          const data = await res.json();
          return { date, grid: Array.isArray(data.grid) ? (data.grid as SlotInfo[]) : [] };
        } catch {
          return { date, grid: null };
        }
      })
    );
    setDays(results.map((r) => ({ date: r.date, grid: r.grid, loading: false })));
  }, []);

  useEffect(() => {
    setDays(weekDates.map((date) => ({ date, grid: null, loading: true })));
    setSelected(null);
    fetchWeek(weekDates);

    intervalRef.current = setInterval(() => fetchWeek(weekDates), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday]);

  const todayStr = manilaToday();

  function findDay(date: string): SlotInfo[] | null {
    return days.find((d) => d.date === date)?.grid ?? null;
  }

  async function handleDownload() {
    if (exporting) return;
    if (days.some((day) => day.loading)) {
      alert("The week is still loading. Please wait a moment and try again.");
      return;
    }

    setExporting(true);
    setSelected(null);
    try {
      // Render the schedule from data instead of screenshotting the DOM.
      // This is deterministic on narrow screens and avoids blank exports
      // caused by html2canvas + sticky/overflow/gradient combinations.
      const canvas = document.createElement("canvas");
      const width = 820;
      const height = 648;
      const scale = Math.min(2, window.devicePixelRatio || 1.5);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported");
      ctx.scale(scale, scale);

      // SVG is the primary export because it is rendered independently of
      // the page's CSS, animation layers, and canvas implementation. Rasterize
      // that known-good SVG only after it has loaded into an image element.
      const svg = buildWeekSvg({ monday, weekDates, days, availableOnly, todayStr });
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const download = (url: string, filename: string) => {
        const link = document.createElement("a");
        link.download = filename;
        link.href = url;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      };
      const downloadSvgFallback = () => {
        download(svgUrl, `schedule-week-of-${monday}${availableOnly ? "-available" : ""}.svg`);
        window.setTimeout(() => URL.revokeObjectURL(svgUrl), 1000);
      };
      const image = new Image();
      image.decoding = "sync";
      try {
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("SVG export could not load")); image.src = svgUrl; });
      } catch {
        // SVG itself is a valid image export, so never fall back to a blank file.
        downloadSvgFallback();
        return;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      const pngLooksBlank = !blob || blob.size < 5000 || isBlankCanvas(canvas);
      if (pngLooksBlank) {
        downloadSvgFallback();
        return;
      }
      URL.revokeObjectURL(svgUrl);
      const url = URL.createObjectURL(blob);
      download(url, `schedule-week-of-${monday}${availableOnly ? "-available" : ""}.png`);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert("Couldn’t generate the weekly schedule image. Please try again.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  }


  return (
    <div>
      {/* Controls (kept OUTSIDE the capture area so downloads stay clean) */}
      <div className="rounded-court glass-panel p-4 sm:p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonday((m) => addDays(m, -7))}
              className="nav-orb focus-ring"
              aria-label="Previous week"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="text-center min-w-[180px]">
              <p className="font-display font-700 text-court-ink leading-tight">Week of {weekRangeLabel(monday)}</p>
              {monday === mondayOf(todayStr) && (
                <span className="inline-block mt-0.5 rounded-full bg-court-blue-light text-court-blue-dark px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  This week
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMonday((m) => addDays(m, 7))}
              className="nav-orb focus-ring"
              aria-label="Next week"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {monday !== mondayOf(todayStr) && (
              <button
                type="button"
                onClick={() => setMonday(mondayOf(todayStr))}
                className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-3 py-1.5 text-xs font-semibold hover:border-court-orange/40"
              >
                Jump to today
              </button>
            )}
            <label className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-3 py-1.5 text-xs font-semibold cursor-pointer select-none hover:border-court-orange/40">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-green-600"
              />
              Highlight available only
            </label>
            <button
              type="button"
              onClick={handleDownload}
              disabled={exporting}
              className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-xs sm:text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-60"
            >
              {exporting ? "Preparing…" : "⬇ Download as image"}
            </button>
          </div>
        </div>
        <p className="text-xs text-court-ink/50 mt-2">
          Tap a booked or pending slot below to see who reserved it. Use “Download as image” to save the whole
          week&apos;s schedule — handy for sending customers a quick look at open slots.
        </p>
      </div>

      {/* ---- Capture area: everything in here goes into the downloaded PNG ---- */}
      <div
        ref={captureRef}
        data-motion-static="true"
        className={`rounded-court p-4 sm:p-5 ${exporting ? "glass-panel--flat" : "glass-panel"}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-display font-700 text-court-ink text-base sm:text-lg">
            Weekly schedule — {weekRangeLabel(monday)}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-court-ink/70">
            <LegendDot className="bg-green-500" label="Available" />
            <LegendDot className="bg-red-500" label="Booked" />
            <LegendDot className="bg-yellow-400" label="Pending" />
            <LegendDot className="bg-gray-300" label="Unavailable" />
            <LegendDot className="bg-orange-200 border border-orange-400" label="Closed by admin" />
          </div>
        </div>

        <div ref={scrollRef} className="overflow-x-auto rounded-xl border-2 border-court-ink/25 shadow-court">
          <div
            className="grid min-w-[720px]"
            style={{ gridTemplateColumns: "64px repeat(7, minmax(90px, 1fr))" }}
          >
            {/* Header row */}
            <div
              className={`bg-court-cream border-b-2 border-r-2 border-court-ink/25 flex items-end justify-center pb-1 ${
                exporting ? "" : "sticky top-0 left-0 z-20"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-court-ink/50">Time</span>
            </div>
            {weekDates.map((date, i) => {
              const { dayNum, month } = dayHeaderLabel(date);
              const isToday = date === todayStr;
              return (
                <div
                  key={date}
                  className={`border-b-2 border-court-ink/25 px-1 py-2 text-center ${exporting ? "" : "sticky top-0 z-10"} ${
                    isToday ? "bg-court-orange/10" : "bg-court-cream"
                  } ${i < 6 ? "border-r-2 border-court-ink/25" : ""}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-court-ink/50">{DAY_NAMES[i]}</p>
                  <p className={`font-display font-700 text-sm ${isToday ? "text-court-orange-dark" : "text-court-ink"}`}>
                    {dayNum} <span className="font-normal text-court-ink/40 text-[10px]">{month}</span>
                  </p>
                </div>
              );
            })}

            {/* 24 hour rows */}
            {Array.from({ length: 24 }, (_, hour) => (
              <RowFragment
                key={hour}
                hour={hour}
                weekDates={weekDates}
                findDay={findDay}
                availableOnly={availableOnly}
                selected={selected}
                onSelect={setSelected}
                exporting={exporting}
              />
            ))}
          </div>
        </div>

        {selected && selected.slot.booking && (
          <div className="mt-4 rounded-court bg-court-blue-light/15 border-2 border-court-blue-dark/20 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-display font-700 text-court-ink">
                  {selected.slot.booking.customerName}{" "}
                  <span className="font-normal text-court-ink/50 text-sm">
                    · {dayHeaderLabel(selected.date).weekday}, {labelForSlot(selected.slot.hour)}
                  </span>
                </p>
                <p className="text-xs text-court-ink/60 mt-0.5">
                  {selected.slot.booking.contactNumber || "—"}
                  {selected.slot.booking.email ? ` · ${selected.slot.booking.email}` : ""}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 flex-shrink-0 ${
                  selected.slot.booking.status === "CONFIRMED"
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-amber-100 text-amber-700 border-amber-300"
                }`}
              >
                {selected.slot.booking.status}
              </span>
            </div>
            {selected.slot.booking.isDownpayment && (
              <span
                className="inline-block mt-2 max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 border-orange-300"
                title={selected.slot.booking.downpaymentNote ? `Downpayment: ${selected.slot.booking.downpaymentNote}` : "Downpayment only"}
              >
                Downpayment{selected.slot.booking.downpaymentNote ? `: ${selected.slot.booking.downpaymentNote}` : ""}
              </span>
            )}
            <div className="mt-2 pt-2 border-t border-court-blue-dark/10 flex flex-wrap items-center justify-between gap-2 text-xs text-court-ink/70">
              <span>
                {selected.slot.booking.paymentMethod} · Ref {selected.slot.booking.referenceNumber || "—"}
              </span>
              <span className="font-display font-700 text-court-orange-dark text-sm">
                ₱{selected.slot.booking.grandTotal}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="focus-ring mt-3 text-xs font-semibold text-court-blue-dark hover:underline"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RowFragment({
  hour,
  weekDates,
  findDay,
  availableOnly,
  selected,
  onSelect,
  exporting,
}: {
  hour: number;
  weekDates: string[];
  findDay: (date: string) => SlotInfo[] | null;
  availableOnly: boolean;
  selected: { date: string; slot: SlotInfo } | null;
  onSelect: (v: { date: string; slot: SlotInfo } | null) => void;
  exporting: boolean;
}) {
  return (
    <>
      <div
        className={`bg-court-cream border-r-2 border-b-2 border-court-ink/20 px-1.5 py-1.5 flex items-center justify-end ${
          exporting ? "" : "sticky left-0 z-10"
        }`}
      >
        <span className="text-[9.5px] sm:text-[10px] font-semibold text-court-ink/50 leading-tight text-right">
          {hourRowLabel(hour)}
        </span>
      </div>
      {weekDates.map((date, i) => {
        const grid = findDay(date);
        const slot = grid?.find((s) => s.hour === hour);
        const status: SlotStatus = slot?.status ?? "past";
        // The API deliberately keeps a genuinely open past hour reading as
        // "available" (not "past") for admin requests, so it can still be
        // clicked into for a manual/walk-in booking elsewhere in the
        // dashboard — but this weekly overview has no such click-to-book
        // action, so there's no reason to show it green here. Display it
        // as the same grey "unavailable" as any other past slot.
        const displayStatus: SlotStatus = status === "available" && slot?.isPast ? "past" : status;
        const isSelected = selected?.date === date && selected.slot.hour === hour;
        const clickable = !!slot?.booking;
        const cls = availableOnly ? DIMMED_CLASS[displayStatus] : CELL_CLASS[displayStatus];

        return (
          <button
            key={date + hour}
            type="button"
            disabled={!clickable}
            onClick={() => (clickable && slot ? onSelect(isSelected ? null : { date, slot }) : undefined)}
            title={slot?.booking ? `${slot.booking.customerName} — ${displayStatus}` : displayStatus}
            className={`h-7 sm:h-8 border-2 transition-colors ${cls} ${
              isSelected ? "ring-2 ring-inset ring-court-ink ring-offset-1" : ""
            }`}
          />
        );
      })}
    </>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded-full inline-block border-2 border-black/10 ${className}`} />
      {label}
    </span>
  );
}
