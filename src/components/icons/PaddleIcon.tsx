import type { CSSProperties } from "react";

export default function PaddleIcon({
  className = "h-6 w-6",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <ellipse cx="22" cy="17" rx="14" ry="16" fill="currentColor" opacity="0.95" />
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 3 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={16 + col * 6}
            cy={9 + row * 5.5}
            r="1.1"
            fill="white"
            opacity="0.75"
          />
        ))
      )}
      <rect x="19.5" y="30" width="5" height="15" rx="2.5" fill="currentColor" />
    </svg>
  );
}
