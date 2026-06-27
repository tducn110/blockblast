export function Mascot({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ animation: "mascot-breathe 3s ease-in-out infinite" }}
    >
      <style>{`
        @keyframes mascot-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes mascot-breathe { 0%, 100% { transform: none; } }
        }
      `}</style>
      {/* Body - peanut shape */}
      <ellipse cx="24" cy="30" rx="12" ry="14" fill="#f0b840" stroke="#c8920c" strokeWidth="1.5" />
      {/* Head */}
      <ellipse cx="24" cy="15" rx="9" ry="9" fill="#f0b840" stroke="#c8920c" strokeWidth="1.5" />
      {/* Peanut groove */}
      <path d="M12 28 Q24 24 36 28" stroke="#c8920c" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Eyes */}
      <circle cx="21" cy="13" r="1.8" fill="#2a2418" />
      <circle cx="27" cy="13" r="1.8" fill="#2a2418" />
      {/* Eye shine */}
      <circle cx="21.7" cy="12.3" r="0.7" fill="white" />
      <circle cx="27.7" cy="12.3" r="0.7" fill="white" />
      {/* Smile */}
      <path d="M21 17 Q24 19.5 27 17" stroke="#c8920c" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* Cheeks */}
      <ellipse cx="19" cy="16" rx="2" ry="1.2" fill="#e87432" opacity="0.5" />
      <ellipse cx="29" cy="16" rx="2" ry="1.2" fill="#e87432" opacity="0.5" />
      {/* Tiny arms */}
      <path d="M12 28 Q8 26 7 23" stroke="#c8920c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M36 28 Q40 26 41 23" stroke="#c8920c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
