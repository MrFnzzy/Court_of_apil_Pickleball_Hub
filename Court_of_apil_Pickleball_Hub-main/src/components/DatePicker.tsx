"use client";

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

export default function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const min = manilaToday();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const max = maxDate.toISOString().slice(0, 10);

  const dateObj = new Date(value + "T00:00:00");
  const label = dateObj.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function shift(days: number) {
    const d = new Date(value + "T00:00:00");
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().slice(0, 10);
    if (iso >= min && iso <= max) onChange(iso);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={value <= min}
        className="focus-ring h-10 w-10 rounded-full border-2 border-court-blue-dark/30 disabled:opacity-30 flex items-center justify-center hover:bg-court-blue-light/40 transition"
        aria-label="Previous day"
      >
        ‹
      </button>

      <div className="flex-1 min-w-[220px]">
        <label className="sr-only" htmlFor="booking-date">Choose date</label>
        <div className="relative">
          <input
            id="booking-date"
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            className="focus-ring w-full rounded-xl border-2 border-court-blue-dark/30 px-4 py-2.5 font-display font-600 text-court-ink bg-white"
          />
        </div>
        <p className="text-xs text-court-ink/60 mt-1 pl-1">{label}</p>
      </div>

      <button
        type="button"
        onClick={() => shift(1)}
        disabled={value >= max}
        className="focus-ring h-10 w-10 rounded-full border-2 border-court-blue-dark/30 disabled:opacity-30 flex items-center justify-center hover:bg-court-blue-light/40 transition"
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  );
}
