import { useCallback, useEffect, useState } from "react";
import type { GameResult } from "@/features/blockblast/lib/localScores";
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
  updateLatestGameResult: (result: GameResult) => boolean;
  refreshStats: () => void;
}

export function useScoreData(winkBestScore = 0): ScoreData {
  const [stats, setStats] = useState<LocalStats>({
    bestScore: winkBestScore,
    lastScore: 0,
    totalGames: 0,
    history: [],
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingScore, setSavingScore] = useState(false);

  const refreshStats = useCallback(() => {
    setStats((current) => ({ ...current, bestScore: winkBestScore, history: [] }));
  }, [winkBestScore]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const handleGameOver = useCallback((result: GameResult) => {
    setSavingScore(true);
    const valid = Number.isFinite(result.score) && result.score >= 0;
    setSavingScore(false);
    if (!valid) {
      setSaveError("Điểm không hợp lệ nên chưa được gửi lên Wink.");
      return false;
    }
    setStats((current) => ({
      ...current,
      bestScore: winkBestScore,
      lastScore: result.score,
      totalGames: current.totalGames + 1,
      history: [],
    }));
    setSaveError(null);
    return true;
  }, [winkBestScore]);

  const updateLatestGameResult = useCallback((result: GameResult) => {
    setSavingScore(true);
    const valid = Number.isFinite(result.score) && result.score >= 0;
    setSavingScore(false);
    if (!valid) {
      setSaveError("Điểm không hợp lệ nên chưa được gửi lên Wink.");
      return false;
    }
    setStats((current) => ({
      ...current,
      bestScore: winkBestScore,
      lastScore: result.score,
      history: [],
    }));
    setSaveError(null);
    return true;
  }, [winkBestScore]);

  return {
    stats,
    bestScore: stats.bestScore,
    lastScore: stats.lastScore,
    totalGamesPlayed: stats.totalGames,
    saveError,
    savingScore,
    leaderboard: stats.history,
    handleGameOver,
    updateLatestGameResult,
    refreshStats,
  };
}
