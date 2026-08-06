import type { LocalStats } from "@/features/blockblast/game/localStats";

export const BADGE_COLORS = [
  { bg: "#f0b840", border: "#c8941a", text: "#2a2418", label: "Vàng" },
  { bg: "#d0c4a0", border: "#a8a080", text: "#2a2418", label: "Bạc"  },
  { bg: "#d99258", border: "#a86e38", text: "#fff8ee", label: "Đồng" },
] as const;

export function getRank(bestScore: number): string {
  if (bestScore >= 50000) return "Huyền Thoại";
  if (bestScore >= 20000) return "Cao Thủ";
  if (bestScore >= 5000)  return "Lãng Tử";
  if (bestScore >= 1000)  return "Tập Sự";
  return "Mầm Non";
}

interface LeaderboardEntry {
  name: string;
  score: number;
  maxCombo: number;
  isLocal?: boolean;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number | null;
}

interface LeaderboardModel {
  topEntries: RankedLeaderboardEntry[];
  currentPlayer: RankedLeaderboardEntry | null;
}

function getBestLocalEntry(stats: LocalStats, playerName: string): LeaderboardEntry | null {
  const bestHistory = stats.history.reduce<LocalStats["history"][number] | null>((best, entry) => {
    if (!best || entry.score > best.score) return entry;
    return best;
  }, null);

  if (!bestHistory && stats.bestScore <= 0) return null;

  return {
    name: playerName || "Người chơi",
    score: Math.max(stats.bestScore, bestHistory?.score ?? 0),
    maxCombo: bestHistory?.metadata?.maxCombo ?? 0,
    isLocal: true,
  };
}

export function buildLeaderboardModel(stats: LocalStats, playerName = "Người chơi"): LeaderboardModel {
  const localBest = getBestLocalEntry(stats, playerName);
  const leaderboardEntries: LeaderboardEntry[] = localBest ? [localBest] : [];
  
  const ranked: RankedLeaderboardEntry[] = leaderboardEntries
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const topEntries = ranked.slice(0, 10);
  const currentPlayer = localBest
    ? ranked.find((entry) => entry.isLocal && entry.score === localBest.score) ?? null
    : { name: playerName || "Người chơi", score: 0, maxCombo: 0, isLocal: true, rank: null };

  return {
    topEntries,
    currentPlayer,
  };
}
