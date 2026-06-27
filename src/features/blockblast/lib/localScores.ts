import {
  createDefaultStats,
  loadStats,
  saveStats,
  type LocalStats,
  type LocalStatsEntry,
} from "@/features/blockblast/game/localStats";

export interface GameResult {
  score: number;
  maxCombo: number;
  linesCleared: number;
  piecesPlaced: number;
}

export interface ScoreSaveOutcome {
  saved: boolean;
  stats: LocalStats;
  error?: "invalid-score" | "storage-unavailable";
}

export function getLocalScoreData(): LocalStats {
  return loadStats();
}

export function createEmptyScoreData(): LocalStats {
  return createDefaultStats();
}

function normalizeGameResult(result: GameResult): GameResult | null {
  if (!Number.isFinite(result.score) || result.score < 0) return null;

  return {
    score: Math.floor(result.score),
    maxCombo: Number.isFinite(result.maxCombo) ? Math.max(0, Math.floor(result.maxCombo)) : 0,
    linesCleared: Number.isFinite(result.linesCleared) ? Math.max(0, Math.floor(result.linesCleared)) : 0,
    piecesPlaced: Number.isFinite(result.piecesPlaced) ? Math.max(0, Math.floor(result.piecesPlaced)) : 0,
  };
}

export function saveLocalGameResult(result: GameResult): ScoreSaveOutcome {
  const normalized = normalizeGameResult(result);
  const current = loadStats();

  if (!normalized) {
    return { saved: false, stats: current, error: "invalid-score" };
  }

  const entry: LocalStatsEntry = {
    score: normalized.score,
    date: new Date().toISOString(),
    metadata: {
      maxCombo: normalized.maxCombo,
      linesCleared: normalized.linesCleared,
      piecesPlaced: normalized.piecesPlaced,
    },
  };

  const next: LocalStats = {
    bestScore: Math.max(current.bestScore, normalized.score),
    lastScore: normalized.score,
    totalGames: current.totalGames + 1,
    history: [entry, ...current.history].slice(0, 50),
  };

  const saved = saveStats(next);
  return saved ? { saved, stats: next } : { saved, stats: current, error: "storage-unavailable" };
}
