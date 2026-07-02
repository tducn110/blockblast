import { Trophy } from "lucide-react";
import type { LocalStats } from "@/features/blockblast/game/localStats";
import { Button } from "@/components/ui/Button";
import { BADGE_COLORS, buildLeaderboardModel, getRank, type RankedLeaderboardEntry } from "@/features/blockblast/lib/dashboardHelpers";

interface DashboardProps {
  bestScore: number;
  stats: LocalStats;
  onPlay: () => void;
}

export function DashboardScreen({ bestScore, stats, onPlay }: DashboardProps) {
  // Use "Người chơi" since we don't have username input yet
  const { topEntries, currentPlayer } = buildLeaderboardModel(stats, "Người chơi");
  const playerInTopTen = topEntries.find((entry) => entry.isLocal) ?? null;
  const playerRow = playerInTopTen ?? currentPlayer;

  return (
    <div
      className="bg-[#fdf6ea] rounded-[32px] p-[32px_24px] border-[2px] border-[#8a7d65]/15 shadow-[0_14px_40px_rgba(42,36,24,0.18),0_2px_0_rgba(255,255,255,0.6)_inset] flex flex-col gap-[24px] relative w-full max-h-[92vh] box-border text-center font-['Be_Vietnam_Pro',sans-serif]"
    >
      <div className="bg-[#8a7d65]/10 p-[24px_24px] rounded-[20px] flex flex-col items-center gap-[8px]">
        <div className="text-[14px] text-[#8a7d65] font-bold uppercase tracking-[0.05em]">Kỷ Lục Của Bạn</div>
        <div className="text-[40px] leading-[1.05] font-extrabold text-[#e87432]">
          {bestScore.toLocaleString("vi-VN")}
        </div>
        <div className="text-[11px] text-[#2a2418] font-extrabold">
          Danh hiệu: {getRank(bestScore)}
        </div>
      </div>

      <section className="flex flex-col gap-[14px] text-left flex-1 min-h-0">
        <div className="flex items-center justify-between gap-[12px] shrink-0">
          <div className="flex items-center gap-[8px]">
            <Trophy size={22} className="text-[#e87432]" />
            <h2 className="m-0 text-[18px] leading-[1.2] text-[#2a2418] font-extrabold">
              Ranking 1-10
            </h2>
          </div>
          <span className="text-[12px] font-extrabold text-[#8a7d65] uppercase tracking-[0.08em]">
            Top điểm
          </span>
        </div>

        <div className="flex flex-col gap-[10px] overflow-y-auto pr-1">
          {topEntries.map((entry) => (
            <RankingRow key={`${entry.name}-${entry.rank}`} entry={entry} highlight={entry.isLocal} />
          ))}
        </div>
      </section>

      {playerRow && (
        <section
          className="flex flex-col gap-[12px] text-left shrink-0 p-[16px] rounded-[20px] border-[2px]"
          style={{
            background: "linear-gradient(180deg, rgba(232,116,50,0.14) 0%, rgba(240,184,64,0.12) 100%)",
            borderColor: "rgba(232,116,50,0.28)",
            boxShadow: "0 2px 0 rgba(255,255,255,0.5) inset"
          }}
        >
          <div className="text-[12px] font-extrabold text-[#e87432] uppercase tracking-[0.06em]">
            Bảng xếp hạng của bạn
          </div>
          <RankingRow entry={playerRow} highlight label={playerInTopTen ? "Đang ở top 10" : "Hạng của bạn"} />
        </section>
      )}

      <Button onClick={onPlay} size="md" variant="secondary" className="mt-2">
        ← Quay lại
      </Button>
    </div>
  );
}

export function RankingRow({
  entry,
  highlight = false,
  label,
}: {
  entry: RankedLeaderboardEntry;
  highlight?: boolean;
  label?: string;
}) {
  const isTopThree = entry.rank != null && entry.rank <= 3;
  const medal = isTopThree ? BADGE_COLORS[entry.rank! - 1] : null;

  return (
    <div
      className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-[12px] rounded-[16px] p-[12px_16px]"
      style={{
        background: highlight
          ? "rgba(232,116,50,0.16)"
          : medal 
            ? `linear-gradient(90deg, ${medal.bg}30 0%, rgba(255,255,255,0.18) 100%)` 
            : "rgba(138,125,101,0.08)",
        border: highlight
          ? "2px solid rgba(232,116,50,0.45)"
          : medal 
            ? `2px solid ${medal.border}55` 
            : "2px solid transparent",
        boxShadow: isTopThree ? "0 2px 0 rgba(255,255,255,0.52) inset" : "none",
      }}
    >
      <div
        className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-[12px] font-extrabold"
        style={{
          background: medal?.bg ?? "rgba(42,36,24,0.1)",
          border: `2px solid ${medal?.border ?? "rgba(42,36,24,0.08)"}`,
          color: medal?.text ?? "var(--pencil-gray)",
        }}
      >
        {entry.rank ? `#${entry.rank}` : "--"}
      </div>

      <div className="min-w-0">
        <div className="flex flex-col gap-1 w-full flex-1">
          <span className="text-[13px] font-bold text-[#4a4232] truncate leading-tight">
            {entry.name}
          </span>
          {entry.maxCombo > 0 && (
            <span
              className="text-[11px] font-extrabold p-[2px_6px] rounded-[6px] bg-[#e87432] text-white w-max"
            >
              Combo {entry.maxCombo}
            </span>
          )}
        </div>
        
        {label && (
          <div className="mt-1">
            <span className="text-[#e87432] text-[10px] font-extrabold">
              {label}
            </span>
          </div>
        )}
      </div>

      <div className="text-[#e87432] text-[13px] font-extrabold text-right">
        {entry.score > 0 ? entry.score.toLocaleString("vi-VN") : "Chưa có"}
      </div>
    </div>
  );
}
