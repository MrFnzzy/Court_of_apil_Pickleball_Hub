"use client";

import { useSky } from "./SkyProvider";
import { PHASE_META } from "@/lib/skyTime";

export default function SkyToggle() {
  const { phase, mode, statusLabel, isAnimating, toggleDayNight, setMode } = useSky();
  const meta = PHASE_META[phase];

  return (
    <div className="sky-toggle" aria-live="polite">
      <button
        type="button"
        onClick={toggleDayNight}
        disabled={isAnimating}
        aria-label={`Preview the opposite time of day (currently ${meta.label})`}
        className="sky-toggle-button"
      >
        <span className={`sky-toggle-icon${isAnimating ? " sky-toggle-icon-spin" : ""}`}>{meta.icon}</span>
      </button>

      <div className="sky-toggle-info">
        <span className="sky-toggle-status">{statusLabel}</span>
        <div className="sky-toggle-mode" role="group" aria-label="Auto or manual sky mode">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`sky-mode-btn${mode === "auto" ? " sky-mode-active" : ""}`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`sky-mode-btn${mode === "manual" ? " sky-mode-active" : ""}`}
          >
            Manual
          </button>
        </div>
      </div>
    </div>
  );
}
