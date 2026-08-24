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
