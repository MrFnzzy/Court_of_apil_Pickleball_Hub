// Purely decorative, very low-opacity background layer: a faint court outline
// with a kitchen line, plus a couple of oversized paddle/ball silhouettes.
// Fixed + pointer-events-none so it never interferes with scrolling or clicks,
// and it sits behind everything (z-index -10) so page content is unaffected.
export default function PickleballBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none"
    >
      <svg
        className="absolute -top-10 -left-16 h-[420px] w-[420px] text-court-orange opacity-[0.05] rotate-[-12deg]"
        viewBox="0 0 48 48"
        fill="currentColor"
      >
        <ellipse cx="22" cy="17" rx="14" ry="16" />
        <rect x="19.5" y="30" width="5" height="15" rx="2.5" />
      </svg>

      <svg
        className="absolute top-1/3 -right-20 h-[360px] w-[360px] text-court-blue-dark opacity-[0.05] rotate-[18deg]"
        viewBox="0 0 48 48"
        fill="currentColor"
      >
        <circle cx="24" cy="24" r="20" />
      </svg>

      <svg
        className="absolute bottom-[-80px] left-1/4 h-[300px] w-[300px] text-court-orange-dark opacity-[0.04] rotate-[8deg]"
        viewBox="0 0 48 48"
        fill="currentColor"
      >
        <ellipse cx="22" cy="17" rx="14" ry="16" />
        <rect x="19.5" y="30" width="5" height="15" rx="2.5" />
      </svg>

      {/* Faint court outline with a kitchen (non-volley) line, echoing the real court */}
      <svg
        className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 text-court-ink opacity-[0.025]"
        viewBox="0 0 200 400"
        fill="none"
      >
        <rect x="10" y="10" width="180" height="380" rx="4" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="200" x2="190" y2="200" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="130" x2="190" y2="130" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="270" x2="190" y2="270" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="10" x2="100" y2="130" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="270" x2="100" y2="390" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}
