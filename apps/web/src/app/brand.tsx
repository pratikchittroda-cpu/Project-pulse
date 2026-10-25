import { useId } from "react";

interface ReleaseArcMarkProps {
  size?: number;
}

export function ReleaseArcMark({ size = 38 }: ReleaseArcMarkProps) {
  const gradientId = `releasearc-mark-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className="releasearc-mark"
      height={size}
      viewBox="0 0 48 48"
      width={size}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="6"
          x2="42"
          y1="5"
          y2="43"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9fb4ff" />
          <stop offset="0.55" stopColor="#5c5fe8" />
          <stop offset="1" stopColor="#62d2b5" />
        </linearGradient>
      </defs>
      <rect
        fill={`url(#${gradientId})`}
        height="44"
        rx="14"
        width="44"
        x="2"
        y="2"
      />
      <path
        d="M10.5 29c4.2 0 4-11 8-11 4.1 0 3.7 14.8 7.8 14.8 4.2 0 3.7-12.4 7.8-12.4 3.9 0 3.7 4.8 7.4 4.8"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
      />
      <circle cx="10.5" cy="29" fill="white" r="2.1" />
      <circle cx="41.5" cy="25.2" fill="#a7f3d0" r="2.1" />
      <path
        d="M15.5 12.2A15.6 15.6 0 0 1 36.7 12"
        fill="none"
        opacity="0.5"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}
