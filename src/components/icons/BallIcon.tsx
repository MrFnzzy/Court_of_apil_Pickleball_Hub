export default function BallIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="currentColor" />
      <g stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <circle cx="16" cy="14" r="1.4" fill="white" stroke="none" />
        <circle cx="30" cy="10" r="1.4" fill="white" stroke="none" />
        <circle cx="38" cy="20" r="1.4" fill="white" stroke="none" />
        <circle cx="36" cy="34" r="1.4" fill="white" stroke="none" />
        <circle cx="22" cy="40" r="1.4" fill="white" stroke="none" />
        <circle cx="10" cy="30" r="1.4" fill="white" stroke="none" />
        <circle cx="12" cy="20" r="1.4" fill="white" stroke="none" />
        <circle cx="24" cy="24" r="1.4" fill="white" stroke="none" />
        <circle cx="28" cy="30" r="1.4" fill="white" stroke="none" />
        <circle cx="20" cy="8" r="1.4" fill="white" stroke="none" />
        <circle cx="40" cy="28" r="1.4" fill="white" stroke="none" />
        <circle cx="28" cy="18" r="1.4" fill="white" stroke="none" />
      </g>
    </svg>
  );
}
