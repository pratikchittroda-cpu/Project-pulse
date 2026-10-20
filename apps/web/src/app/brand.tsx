import { useId } from "react";

interface ProjectPulseMarkProps {
  size?: number;
}

export function ProjectPulseMark({ size = 38 }: ProjectPulseMarkProps) {
  const gradientId = `projectpulse-mark-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className="projectpulse-mark"
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
          <stop stopColor="#8e83ff" />
          <stop offset="0.55" stopColor="#6557f5" />
          <stop offset="1" stopColor="#ff9c83" />
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
        d="M11 28.2c4.1 0 3.9-10.4 7.8-10.4 4 0 3.6 16.4 7.6 16.4s3.8-13.3 7.8-13.3c3.9 0 3.5 5.3 6.8 5.3"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
      />
      <circle cx="11" cy="28.2" fill="white" r="2.1" />
      <circle cx="41" cy="26.2" fill="#c9f3db" r="2.1" />
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
