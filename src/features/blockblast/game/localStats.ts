export const STORAGE_KEY = "xep-khoi-bo-lac";

export interface LocalStatsEntry {
  score: number;
  date: string;
  metadata?: {
    maxCombo?: number;
    linesCleared?: number;
    piecesPlaced?: number;
  };
}

export interface LocalStats {
  bestScore: number;
  lastScore: number;
  totalGames: number;
  history: LocalStatsEntry[];
}

export function createDefaultStats(): LocalStats {
  return { bestScore: 0, lastScore: 0, totalGames: 0, history: [] };
}

function normalizeHistory(history: unknown): LocalStatsEntry[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((entry): entry is LocalStatsEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<LocalStatsEntry>;
      return typeof item.score === "number" && Number.isFinite(item.score) && typeof item.date === "string";
    })
    .slice(0, 50);
}

function normalizeStats(value: Partial<LocalStats> | null): LocalStats {
  if (!value || typeof value !== "object") return createDefaultStats();

  return {
    bestScore: typeof value.bestScore === "number" && Number.isFinite(value.bestScore) ? value.bestScore : 0,
    lastScore: typeof value.lastScore === "number" && Number.isFinite(value.lastScore) ? value.lastScore : 0,
    totalGames: typeof value.totalGames === "number" && Number.isFinite(value.totalGames) ? value.totalGames : 0,
    history: normalizeHistory(value.history),
  };
}

export function loadStats(): LocalStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeStats(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return createDefaultStats();
}

export function saveStats(stats: LocalStats): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}
