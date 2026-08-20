"use client";

/** Rally Rhythm styling only: this component preserves the supplied slideshow
 * timing, slide order, links, and controls; CSS adds visual motion only. */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import PaddleIcon from "./icons/PaddleIcon";

export type HeroSlide = {
  id: string;
  imageUrl: string;
  headline: string | null;
  subtext: string | null;
  linkUrl: string | null;
};

export default function HeroSlideshow({
  slides,
  cardTitle,
  cardSubtitle,
}: {
  slides: HeroSlide[];
  cardTitle: string;
  cardSubtitle: string;
}) {
  const [index, setIndex] = useState(0);
  const hasSlides = slides.length > 0;

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="hero-slideshow relative">
      <div className="rounded-court overflow-hidden shadow-court-lg border border-white/70 ring-4 ring-white/40 relative aspect-[4/3] bg-gradient-to-br from-court-blue via-court-blue-light to-court-orange-light">
        {hasSlides ? (
          <>
            {slides.map((slide, slideIndex) => {
              const isActive = slideIndex === index;
              const content = (
                <div className="absolute inset-0">
                  <Image
                    src={slide.imageUrl}
                    alt={slide.headline || "Court photo"}
                    fill
                    className="hero-slide__image object-cover"
                    priority={slideIndex === 0}
                  />
                  {(slide.headline || slide.subtext) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 py-4">
                      {slide.headline && <p className="font-display font-700 text-white text-lg">{slide.headline}</p>}
                      {slide.subtext && <p className="text-white/85 text-sm">{slide.subtext}</p>}
                    </div>
                  )}
                </div>
              );

              return (
                <div
                  key={slide.id}
                  className={`hero-slide absolute inset-0 transition-opacity duration-700 ${isActive ? "hero-slide--active" : ""}`}
                  style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none" }}
                >
                  {slide.linkUrl ? (
                    <Link href={slide.linkUrl} className="block h-full w-full focus-ring">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })}

            {slides.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {slides.map((slide, slideIndex) => (
                  <button
                    key={slide.id}
                    aria-label={`Show slide ${slideIndex + 1}`}
                    onClick={() => setIndex(slideIndex)}
                    className={`h-2 rounded-full transition-all focus-ring ${slideIndex === index ? "w-6 bg-white" : "w-2 bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
              <rect width="400" height="300" fill="#2FA8D9" />
              <rect x="30" y="30" width="340" height="240" rx="6" fill="#3FBEEF" stroke="white" strokeWidth="4" />
              <line x1="200" y1="30" x2="200" y2="270" stroke="white" strokeWidth="4" />
              <rect x="115" y="30" width="170" height="240" fill="none" stroke="white" strokeWidth="3" strokeDasharray="1 0" />
              <line x1="115" y1="30" x2="115" y2="270" stroke="white" strokeWidth="3" />
              <line x1="285" y1="30" x2="285" y2="270" stroke="white" strokeWidth="3" />
              <line x1="30" y1="150" x2="370" y2="150" stroke="white" strokeWidth="4" />
              <circle cx="200" cy="150" r="14" fill="#F46036" opacity="0.9" />
            </svg>
            <div className="absolute inset-0 bg-court-ink/10" />
          </>
        )}
      </div>
      <div className="hero-float-card glass-panel absolute -bottom-5 -left-5 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="h-9 w-9 rounded-full bg-court-orange/10 flex items-center justify-center">
          <PaddleIcon className="h-5 w-5 text-court-orange" />
        </span>
        <div>
          <p className="text-xs text-court-ink/60 leading-none">{cardTitle}</p>
          <p className="font-display font-600 text-sm text-court-ink">{cardSubtitle}</p>
        </div>
      </div>
    </div>
  );
}
