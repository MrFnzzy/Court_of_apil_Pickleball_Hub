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
  const isToday = value === min;
  const dayNum = dateObj.getDate();
  const monthShort = dateObj.toLocaleDateString("en-PH", { month: "short" });

  function shift(days: number) {
    const d = new Date(value + "T00:00:00");
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().slice(0, 10);
    if (iso >= min && iso <= max) {
      onChange(iso);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={value <= min}
        className="nav-orb focus-ring"
        aria-label="Previous day"
      >
        <svg
          className="nav-orb-icon-prev h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex-1 min-w-[240px]">
        <label className="sr-only" htmlFor="booking-date">Choose date</label>
        <div className="relative group">
          <div
            className="flex items-center gap-3 rounded-2xl border-2 border-court-blue-dark/30 bg-white px-3 py-2 transition-all focus-within:border-court-orange focus-within:shadow-court group-hover:border-court-blue-dark/50"
          >
            <div
              key={value + "-badge"}
              className="date-pop-in flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-court-orange to-court-orange-dark text-white leading-none shadow-court"
            >
              <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">{monthShort}</span>
              <span className="font-display font-700 text-base">{dayNum}</span>
            </div>

            <div className="flex-1 min-w-0">
              <input
                id="booking-date"
                type="date"
                value={value}
                min={min}
                max={max}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent font-display font-600 text-court-ink focus:outline-none [color-scheme:light]"
              />
              <p key={value} className="date-pop-in text-xs text-court-ink/60 truncate">
                {label}
                {isToday && (
                  <span className="ml-1.5 inline-block rounded-full bg-court-blue-light text-court-blue-dark px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide align-middle">
                    Today
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => shift(1)}
        disabled={value >= max}
        className="nav-orb focus-ring"
        aria-label="Next day"
      >
        <svg
          className="nav-orb-icon-next h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
