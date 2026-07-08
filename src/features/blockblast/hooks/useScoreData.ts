import { useCallback, useEffect, useState } from "react";
import {
  getLocalScoreData,
  saveLocalGameResult,
  type GameResult,
} from "@/features/blockblast/lib/localScores";
import type { LocalStats } from "@/features/blockblast/game/localStats";

export interface ScoreData {
  stats: LocalStats;
  bestScore: number;
  lastScore: number;
  totalGamesPlayed: number;
  saveError: string | null;
  savingScore: boolean;
  leaderboard: LocalStats["history"];
  handleGameOver: (result: GameResult) => boolean;
  refreshStats: () => void;
}

export function useScoreData(): ScoreData {
  const [stats, setStats] = useState<LocalStats>(() => getLocalScoreData());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingScore, setSavingScore] = useState(false);

  const refreshStats = useCallback(() => {
    setStats(getLocalScoreData());
  }, []);

  useEffect(() => {
    const onStorageChange = (event: StorageEvent) => {
      if (!event.key || event.key === "xep-khoi-bo-lac") refreshStats();
    };

    window.addEventListener("focus", refreshStats);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener("focus", refreshStats);
      window.removeEventListener("storage", onStorageChange);
    };
  }, [refreshStats]);

  const handleGameOver = useCallback((result: GameResult) => {
    setSavingScore(true);
    const outcome = saveLocalGameResult(result);
    setSavingScore(false);
    setStats(outcome.stats);

    if (!outcome.saved) {
      setSaveError(
        outcome.error === "invalid-score"
          ? "Điểm không hợp lệ nên chưa được lưu."
          : "Không thể lưu điểm trên thiết bị này."
      );
      return false;
    }

    setSaveError(null);
    return true;
  }, []);

  return {
    stats,
    bestScore: stats.bestScore,
    lastScore: stats.lastScore,
    totalGamesPlayed: stats.totalGames,
    saveError,
    savingScore,
    leaderboard: stats.history,
    handleGameOver,
    refreshStats,
  };
}
