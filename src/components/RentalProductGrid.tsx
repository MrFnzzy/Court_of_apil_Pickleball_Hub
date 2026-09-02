"use client";

import { useState } from "react";
import BallIcon from "@/components/icons/BallIcon";
import PaddleIcon from "@/components/icons/PaddleIcon";
import { productLabel, RentalProduct } from "@/lib/pricing";

// Safety cap so a wildly large tier quantity can't overflow the card —
// in practice every real tier (1-4ish paddles) shows its true count.
const MAX_STACKED_ICONS = 8;

// Shows every active tier for one product type (paddles or balls) as a
// card grid. Cards are driven entirely by whatever tiers the admin has
// added — no hardcoded "1 or 2" / "1 or 3" — so a new tier just shows up
// here on its own. Collapses to the first `initialCount` cards with a
// "See all" toggle once the admin has added more than that.
export default function RentalProductGrid({
  products,
  initialCount = 4,
}: {
  products: RentalProduct[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (products.length === 0) {
    return <p className="text-sm text-white/60">No rentals available right now.</p>;
  }

  const visible = expanded ? products : products.slice(0, initialCount);
  const hiddenCount = products.length - visible.length;
  const Icon = products[0].type === "PADDLE" ? PaddleIcon : BallIcon;

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
        {visible.map((product, i) => {
          const iconCount = Math.min(product.quantity, MAX_STACKED_ICONS);
          const featured = i === 1; // second card gets the same subtle highlight the old fixed layout used
          return (
            <div
              key={product.id}
              className={`glass-panel rounded-court p-6 ${featured ? "ring-1 ring-court-orange/25" : ""}`}
            >
              <div className={`flex ${iconCount > 1 ? "-space-x-2" : ""} mb-3`}>
                {Array.from({ length: iconCount }).map((_, idx) => (
                  <Icon
                    key={idx}
                    className={`h-8 w-8 ${
                      idx % 2 === 0 ? "text-court-orange" : "text-court-blue-dark"
                    }`}
                  />
                ))}
              </div>
              <p className="font-display font-600 text-lg text-court-ink">{productLabel(product)}</p>
              <p className="font-display font-700 text-2xl text-court-orange">₱{product.price}</p>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="focus-ring mt-4 text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4"
        >
          See all ({products.length})
        </button>
      )}
      {expanded && products.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="focus-ring mt-4 ml-4 text-sm font-medium text-white/50 hover:text-white/80"
        >
          Show less
        </button>
      )}
    </div>
  );
}
