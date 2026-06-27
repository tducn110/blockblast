export function CountrysideBackdrop() {
  return (
    <svg
      viewBox="0 0 800 500"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <rect width="800" height="500" fill="#f5ecd7" />

      <circle cx="680" cy="80" r="38" fill="#f8c860" opacity="0.5" />
      <circle cx="680" cy="80" r="28" fill="#f8c860" opacity="0.7" />

      <path
        d="M0 280 Q80 180 160 220 Q240 160 320 200 Q400 140 480 185 Q560 150 640 175 Q720 145 800 180 L800 300 L0 300 Z"
        fill="#e6d8b2"
        opacity="0.55"
        stroke="#8a7d65"
        strokeWidth="0.8"
        strokeOpacity="0.25"
      />
      <path
        d="M0 310 Q100 260 200 285 Q300 255 400 270 Q500 245 600 268 Q700 250 800 260 L800 320 L0 320 Z"
        fill="#c8d68a"
        opacity="0.5"
      />
      <path
        d="M0 320 Q50 315 100 320 Q150 325 200 320 Q250 315 300 320 Q350 325 400 320 Q450 315 500 320 Q550 325 600 320 Q650 315 700 320 Q750 325 800 320 L800 350 L0 350 Z"
        fill="#c8d68a"
        opacity="0.35"
      />

      {[20, 30, 38, 46, 54].map((x, i) => (
        <g key={`left-bamboo-${x}`}>
          <line
            x1={x}
            y1={330 - i * 8}
            x2={x}
            y2={420}
            stroke="#6b8e3d"
            strokeWidth="3"
            strokeOpacity="0.45"
            strokeLinecap="round"
          />
          <ellipse cx={x} cy={330 - i * 8} rx="6" ry="4" fill="#6b8e3d" opacity="0.35" />
        </g>
      ))}

      {[760, 770, 778, 786, 792].map((x, i) => (
        <g key={`right-bamboo-${x}`}>
          <line
            x1={x}
            y1={325 - i * 7}
            x2={x}
            y2={420}
            stroke="#6b8e3d"
            strokeWidth="2.5"
            strokeOpacity="0.4"
            strokeLinecap="round"
          />
          <ellipse cx={x} cy={325 - i * 7} rx="5" ry="3.5" fill="#6b8e3d" opacity="0.3" />
        </g>
      ))}

      <path d="M150 120 Q154 115 158 120" stroke="#8a7d65" strokeWidth="1.2" fill="none" strokeOpacity="0.55" strokeLinecap="round" />
      <path d="M165 112 Q169 107 173 112" stroke="#8a7d65" strokeWidth="1.2" fill="none" strokeOpacity="0.55" strokeLinecap="round" />
      <path d="M178 118 Q182 113 186 118" stroke="#8a7d65" strokeWidth="1.2" fill="none" strokeOpacity="0.5" strokeLinecap="round" />
      <path d="M580 95 Q584 90 588 95" stroke="#8a7d65" strokeWidth="1.1" fill="none" strokeOpacity="0.45" strokeLinecap="round" />
      <path d="M593 88 Q597 83 601 88" stroke="#8a7d65" strokeWidth="1.1" fill="none" strokeOpacity="0.45" strokeLinecap="round" />

      <path d="M350 60 L358 75 L350 90 L342 75 Z" fill="#f0b840" opacity="0.6" stroke="#c8920c" strokeWidth="0.8" />
      <path d="M350 90 Q355 110 348 130" stroke="#8a7d65" strokeWidth="0.8" fill="none" strokeOpacity="0.45" strokeLinecap="round" />

      {Array.from({ length: 30 }, (_, i) => (
        <line
          key={`rice-${i}`}
          x1={80 + i * 22}
          y1={345}
          x2={80 + i * 22 + (i % 3 - 1) * 2}
          y2={330}
          stroke="#8a7d65"
          strokeWidth="0.8"
          strokeOpacity="0.3"
          strokeLinecap="round"
        />
      ))}

      <rect x="0" y="380" width="800" height="120" fill="url(#grassGrad)" />
      <rect width="800" height="500" fill="url(#paperTex)" opacity="0.06" />

      <defs>
        <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b8e3d" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4c6630" stopOpacity="0.6" />
        </linearGradient>
        <pattern id="paperTex" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="none" />
          <circle cx="1" cy="1" r="0.5" fill="#8a7d65" />
          <circle cx="3" cy="3" r="0.5" fill="#8a7d65" />
        </pattern>
      </defs>
    </svg>
  );
}
