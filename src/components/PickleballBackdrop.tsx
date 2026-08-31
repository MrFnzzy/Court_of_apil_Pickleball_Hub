/** Rally Motion Graphics backdrop: decorative, non-interactive pickleball
 * geometry only. It remains behind content and cannot affect any user flow. */
export default function PickleballBackdrop() {
  return (
    <div aria-hidden="true" className="rally-backdrop fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      <div className="rally-backdrop__scan" />
      <svg className="rally-backdrop__paddle rally-backdrop__paddle--one absolute -top-10 -left-16 h-[420px] w-[420px] text-court-orange" viewBox="0 0 48 48" fill="currentColor">
        <ellipse cx="22" cy="17" rx="14" ry="16" />
        <rect x="19.5" y="30" width="5" height="15" rx="2.5" />
      </svg>
      <svg className="rally-backdrop__ball absolute top-1/3 -right-20 h-[360px] w-[360px] text-court-blue-dark" viewBox="0 0 48 48" fill="currentColor">
        <circle cx="24" cy="24" r="20" />
        <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.72">
          <circle cx="18" cy="15" r="2" /><circle cx="29" cy="15" r="2" /><circle cx="15" cy="24" r="2" /><circle cx="24" cy="24" r="2" /><circle cx="33" cy="25" r="2" /><circle cx="19" cy="33" r="2" /><circle cx="29" cy="33" r="2" />
        </g>
      </svg>
      <svg className="rally-backdrop__paddle rally-backdrop__paddle--two absolute bottom-[-80px] left-1/4 h-[300px] w-[300px] text-court-orange-dark" viewBox="0 0 48 48" fill="currentColor">
        <ellipse cx="22" cy="17" rx="14" ry="16" />
        <rect x="19.5" y="30" width="5" height="15" rx="2.5" />
      </svg>
      <svg className="rally-backdrop__court absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 text-court-ink" viewBox="0 0 200 400" fill="none">
        <rect x="10" y="10" width="180" height="380" rx="4" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="200" x2="190" y2="200" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="130" x2="190" y2="130" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="270" x2="190" y2="270" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="10" x2="100" y2="130" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="270" x2="100" y2="390" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="rally-backdrop__trail rally-backdrop__trail--one" />
      <span className="rally-backdrop__trail rally-backdrop__trail--two" />
    </div>
  );
}
