"use client";

import ScheduleGrid from "./ScheduleGrid";

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

export default function HomeScheduleSection() {
  const today = manilaToday();
  return (
    <div className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
      <ScheduleGrid date={today} mode="view" />
    </div>
  );
}
