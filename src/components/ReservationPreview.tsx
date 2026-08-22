"use client";

import Link from "next/link";
import { useState } from "react";
import Court360Viewer from "./Court360Viewer";

const slots = ["08:00", "09:30", "11:00", "13:00", "15:30", "17:00", "18:30", "20:00"];

export default function ReservationPreview() {
  const [selected, setSelected] = useState("17:00");
  return (
    <section className="reservation-preview glass-panel rounded-court p-5 sm:p-8 text-court-ink" aria-labelledby="reservation-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><span className="text-xs font-bold uppercase tracking-[.2em] text-court-orange-dark">Plan your rally</span><h2 id="reservation-preview-title" className="font-display font-700 text-2xl sm:text-3xl mt-2">Pick your court time</h2><p className="text-sm text-court-ink/65 mt-2">Preview the court, then continue to the full reservation flow.</p></div>
        <div className="reservation-preview__date rounded-full bg-court-blue-light/60 px-3 py-2 text-xs font-bold text-court-blue-dark">Today · Open 24/7</div>
      </div>
      <div className="mt-7 grid lg:grid-cols-[1.05fr_.95fr] gap-7 items-center">
        <Court360Viewer src="/court-360.jpg" alt="360° photo of Heide's Pickleball Hub court — drag to look around" />
        <div>
          <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold">Available slots</p><p className="text-xs text-court-ink/55">Tap to select</p></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2" role="listbox" aria-label="Available reservation slots">
            {slots.map((slot, index) => <button key={slot} type="button" role="option" aria-selected={selected === slot} onClick={() => setSelected(slot)} className={`reservation-slot ${selected === slot ? "reservation-slot--selected" : ""}`}><span>{slot}</span><small>{index === 2 || index === 5 ? "Popular" : "Open"}</small></button>)}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-court-ink px-4 py-3 text-white"><div><p className="text-[11px] uppercase tracking-widest text-white/55">Selected time</p><p className="font-display text-xl text-court-blue-light">{selected}</p></div><Link href={`/book?time=${encodeURIComponent(selected)}`} className="fx-magnetic rounded-full bg-court-orange px-4 py-2 text-sm font-bold text-white focus-ring">Continue</Link></div>
        </div>
      </div>
    </section>
  );
}
