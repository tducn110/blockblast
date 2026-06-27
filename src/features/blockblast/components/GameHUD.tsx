interface GameHUDProps {
  score: number;
  bestScore: number;
  combo: number;
  piecesLeft: number;
}

export function GameHUD({ score, bestScore, combo, piecesLeft }: GameHUDProps) {
  return (
    <div className="flex items-center justify-between w-full gap-2 px-1">
      <StatBox label="Điểm" value={score.toLocaleString()} accent />
      <StatBox label="Tốt nhất" value={bestScore.toLocaleString()} />
      <StatBox label="Combo" value={combo > 0 ? `×${combo}` : "—"} highlight={combo > 1} />
      <StatBox label="Khối còn" value={piecesLeft.toString()} />
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center min-w-0 flex-1"
      style={{
        background: "rgba(253,246,234,0.85)",
        border: "1.5px solid rgba(138,125,101,0.3)",
        borderRadius: 12,
        padding: "4px 6px",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#8a7d65",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: highlight ? "#e87432" : accent ? "#2a2418" : "#4a4232",
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
    </div>
  );
}
