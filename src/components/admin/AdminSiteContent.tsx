"use client";

import { useState } from "react";
import AdminBranding from "./AdminBranding";
import AdminColors from "./AdminColors";
import AdminHeroSlides from "./AdminHeroSlides";
import AdminHomepageText from "./AdminHomepageText";

type SubTab = "photos" | "text" | "branding" | "colors";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "photos", label: "Photos & slideshow" },
  { key: "text", label: "Homepage text" },
  { key: "branding", label: "Logo & branding" },
  { key: "colors", label: "Colors" },
];

export default function AdminSiteContent() {
  const [subTab, setSubTab] = useState<SubTab>("photos");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              subTab === t.key
                ? "bg-court-ink text-white shadow-court"
                : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-orange/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "photos" && <AdminHeroSlides />}
      {subTab === "text" && <AdminHomepageText />}
      {subTab === "branding" && <AdminBranding />}
      {subTab === "colors" && <AdminColors />}
    </div>
  );
}
