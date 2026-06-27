import { X } from "lucide-react";
import type { LocalStats } from "../../utils/localStats";
import { IconButton } from "../ui/IconButton";

interface LeaderboardPanelProps {
  stats: LocalStats;
  maxCombo: number;
  onClose: () => void;
}

export function LeaderboardPanel({ stats, maxCombo, onClose }: LeaderboardPanelProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bảng điểm"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(42,36,24,0.58)",
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        animation: "fadeScaleIn 0.2s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fdf6ea",
          border: "1.5px solid rgba(138,125,101,0.35)",
          borderRadius: 22,
          padding: 18,
          width: "88%",
          maxHeight: "80%",
          overflowY: "auto",
          boxShadow: "0 18px 40px rgba(42,36,24,0.22)",
        }}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#2a2418", margin: 0 }}>
            Bảng Điểm
          </h2>
          <IconButton label="Đóng" onClick={onClose} size={32}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <MiniStat label="Tốt nhất" value={stats.bestScore.toLocaleString()} />
          <MiniStat label="Lần trước" value={stats.lastScore.toLocaleString()} />
          <MiniStat label="Tổng ván" value={stats.totalGames.toString()} />
          <MiniStat label="Combo cao" value={maxCombo > 0 ? `x${maxCombo}` : "-"} />
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: "#8a7d65", marginBottom: 6 }}>
          LỊCH SỬ GẦN ĐÂY
        </div>
        {stats.history.length === 0 ? (
          <p style={{ color: "#8a7d65", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>
            Chưa có ván nào
          </p>
        ) : (
          stats.history.slice(0, 10).map((entry, i) => (
            <div
              key={`${entry.date}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "7px 0",
                borderBottom: "1px dashed rgba(138,125,101,0.2)",
                fontSize: 13,
                color: "#4a4232",
              }}
            >
              <span style={{ color: rankColor(i), fontWeight: 900 }}>#{i + 1}</span>
              <span style={{ fontWeight: 900 }}>{entry.score.toLocaleString()}</span>
              <span style={{ color: "#8a7d65" }}>
                {new Date(entry.date).toLocaleDateString("vi-VN")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function rankColor(index: number) {
  if (index === 0) return "#f0b840";
  if (index === 1) return "#8a7d65";
  if (index === 2) return "#c09060";
  return "#8a7d65";
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(245,236,215,0.72)",
        border: "1.5px solid rgba(138,125,101,0.24)",
        borderRadius: 12,
        padding: "8px 10px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "#8a7d65" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#2a2418", lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}
