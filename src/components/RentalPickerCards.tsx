"use client";

import { useState } from "react";
import PaddleIcon from "@/components/icons/PaddleIcon";
import BallIcon from "@/components/icons/BallIcon";
import { productLabel, RentalProduct, RentalProductType } from "@/lib/pricing";

const MAX_STACKED_ICONS = 3;

// Selectable grid of rental tiers for one product type (paddles or balls).
// Tiers come entirely from the admin-configured `products` list — adding a
// new tier in the admin dashboard makes it appear here automatically, no
// code change needed. Collapses to `initialCount` cards with a "See all"
// toggle once there are more tiers than that.
export default function RentalPickerCards({
  type,
  products,
  selected,
  onSelect,
  initialCount = 4,
}: {
  type: RentalProductType;
  products: RentalProduct[];
  selected: number;
  onSelect: (quantity: number) => void;
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = type === "PADDLE" ? PaddleIcon : BallIcon;
  const items = products.filter((p) => p.type === type);
  const visible = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - visible.length;

  if (items.length === 0) {
    return (
      <p className="text-sm text-court-ink/50">
        No {type === "PADDLE" ? "paddle" : "ball"} rentals available right now.
      </p>
    );
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-3">
        {visible.map((product) => {
          const isSelected = selected === product.quantity;
          const iconCount = Math.min(product.quantity, MAX_STACKED_ICONS);
          return (
            <button
              type="button"
              key={product.id}
              onClick={() => onSelect(isSelected ? 0 : product.quantity)}
              aria-pressed={isSelected}
              className={`relative focus-ring rounded-court border-2 p-6 text-left transition-all ${
                isSelected
                  ? "border-court-orange bg-court-orange/5 shadow-court-lg"
                  : "border-court-blue-dark/20 bg-white hover:border-court-blue-dark/40 hover:shadow-court"
              }`}
            >
              {isSelected && (
                <span className="slot-check-in absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-court-orange text-white shadow-court">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <div className={`flex ${iconCount > 1 ? "-space-x-2" : ""} mb-3`}>
                {Array.from({ length: iconCount }).map((_, idx) => (
                  <Icon
                    key={idx}
                    className={`h-8 w-8 transition-transform ${
                      isSelected
                        ? `${idx % 2 === 0 ? "text-court-orange" : "text-court-orange-dark"} animate-bounce-ball`
                        : idx % 2 === 0
                        ? "text-court-blue-dark"
                        : "text-court-blue"
                    }`}
                    style={isSelected ? { animationDelay: `${idx * 0.15}s` } : undefined}
                  />
                ))}
              </div>
              <p className="font-display font-600 text-lg text-court-ink">{productLabel(product)}</p>
              <p className="font-display font-700 text-2xl text-court-orange">₱{product.price}</p>
            </button>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="focus-ring mt-3 text-sm font-semibold text-court-orange-dark hover:underline underline-offset-4"
        >
          See all ({items.length})
        </button>
      )}
      {expanded && items.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="focus-ring mt-3 ml-4 text-sm font-medium text-court-ink/50 hover:text-court-ink/80"
        >
          Show less
        </button>
      )}
    </div>
  );
}
