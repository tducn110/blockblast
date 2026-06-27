import { X } from "lucide-react";
import type { LocalStats } from "../../utils/localStats";
import { IconButton } from "../ui/IconButton";
import { GAME_TEXT } from "../../constants/gameText";

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
      aria-label={GAME_TEXT.LEADERBOARD_TITLE}
      className="absolute inset-0 bg-[#2a2418]/58 rounded-[28px] flex items-center justify-center z-30 animate-[fadeScaleIn_0.2s_ease]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#fdf6ea] border-[1.5px] border-[#8a7d65]/35 rounded-[22px] p-[18px] w-[88%] max-h-[80%] overflow-y-auto shadow-[0_18px_40px_rgba(42,36,24,0.22)]">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[18px] font-black text-[#2a2418] m-0">
            {GAME_TEXT.LEADERBOARD_TITLE}
          </h2>
          <IconButton label={GAME_TEXT.BTN_CLOSE} onClick={onClose} size={32}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <MiniStat label={GAME_TEXT.STAT_BEST} value={stats.bestScore.toLocaleString()} />
          <MiniStat label={GAME_TEXT.STAT_LAST} value={stats.lastScore.toLocaleString()} />
          <MiniStat label={GAME_TEXT.STAT_TOTAL} value={stats.totalGames.toString()} />
          <MiniStat label={GAME_TEXT.STAT_COMBO} value={maxCombo > 0 ? `x${maxCombo}` : "-"} />
        </div>

        <div className="text-[12px] font-extrabold text-[#8a7d65] mb-[6px] uppercase">
          {GAME_TEXT.RECENT_HISTORY}
        </div>
        {stats.history.length === 0 ? (
          <p className="text-[#8a7d65] italic text-center py-[12px]">
            {GAME_TEXT.NO_GAMES}
          </p>
        ) : (
          stats.history.slice(0, 10).map((entry, i) => (
            <div
              key={`${entry.date}-${i}`}
              className="grid grid-cols-[40px_1fr_auto] gap-2 items-center py-[7px] border-b border-dashed border-[#8a7d65]/20 text-[13px] text-[#4a4232]"
            >
              <span className="font-black" style={{ color: rankColor(i) }}>#{i + 1}</span>
              <span className="font-black">{entry.score.toLocaleString()}</span>
              <span className="text-[#8a7d65]">
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
    <div className="bg-[#f5ecd7]/72 border-[1.5px] border-[#8a7d65]/24 rounded-[12px] py-[8px] px-[10px] text-center">
      <div className="text-[9px] font-extrabold tracking-[0.8px] uppercase text-[#8a7d65]">
        {label}
      </div>
      <div className="text-[20px] font-black text-[#2a2418] leading-[1.1]">
        {value}
      </div>
    </div>
  );
}
