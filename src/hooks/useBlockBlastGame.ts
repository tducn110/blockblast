import { useState, useCallback, useEffect, useRef } from "react";
import {
  createEmptyBoard,
  createPieces,
  canPlacePiece,
  placePiece,
  clearLines,
  isGameOver,
  calculatePlacementScore,
  calculateClearScore,
  BoardGrid,
  BlockPiece,
} from "../utils/blockBlastLogic";
import type { GameResult } from "../lib/localScores";

export interface FeedbackItem {
  id: string;
  text: string;
  type: "clear-row" | "clear-col" | "combo" | "invalid" | "placement";
}

export interface ClearingCell {
  row: number;
  col: number;
  colorId?: string;
}

export interface ClearAnimation {
  id: string;
  cells: ClearingCell[];
  clearedRows: number[];
  clearedCols: number[];
}

export interface PlacementAnimation {
  id: string;
  cells: ClearingCell[];
}

export interface GameState {
  board: BoardGrid;
  pieces: BlockPiece[];
  selectedPieceId: string | null;
  draggingPieceId: string | null;
  hoverAnchor: { row: number; col: number } | null;
  score: number;
  bestScore: number;
  combo: number;
  status: "playing" | "gameOver";
  feedback: FeedbackItem[];
  piecesPlaced: number;
  linesCleared: number;
  maxCombo: number;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation | null;
}

export interface GameActions {
  selectPiece: (id: string | null) => void;
  startDrag: (id: string) => void;
  endDrag: () => void;
  setHoverAnchor: (anchor: { row: number; col: number } | null) => void;
  placePiece: (id: string, row: number, col: number) => boolean;
  placeSelectedPiece: (row: number, col: number) => boolean;
  placeDraggingPiece: (row: number, col: number) => boolean;
  resetGame: () => void;
  toggleSfx: () => void;
  toggleMusic: () => void;
  dismissFeedback: (id: string) => void;
}

export interface UseBlockBlastGameOptions {
  bestScore?: number;
  onGameOver?: (result: GameResult) => void;
}

function makeFeedback(text: string, type: FeedbackItem["type"]): FeedbackItem {
  return { id: `${Date.now()}-${Math.random()}`, text, type };
}

function makeClearAnimation(
  board: BoardGrid,
  clearedRows: number[],
  clearedCols: number[]
): ClearAnimation | null {
  if (clearedRows.length === 0 && clearedCols.length === 0) return null;

  const seen = new Set<string>();
  const cells: ClearingCell[] = [];

  clearedRows.forEach((row) => {
    for (let col = 0; col < board[row].length; col += 1) {
      const key = `${row}-${col}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push({ row, col, colorId: board[row][col].colorId });
      }
    }
  });

  clearedCols.forEach((col) => {
    for (let row = 0; row < board.length; row += 1) {
      const key = `${row}-${col}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push({ row, col, colorId: board[row][col].colorId });
      }
    }
  });

  return {
    id: `${Date.now()}-${Math.random()}`,
    cells,
    clearedRows,
    clearedCols,
  };
}

function makePlacementAnimation(
  piece: BlockPiece,
  row: number,
  col: number
): PlacementAnimation {
  return {
    id: `${Date.now()}-${Math.random()}`,
    cells: piece.cells.map((cell) => ({
      row: row + cell.row,
      col: col + cell.col,
      colorId: piece.colorId,
    })),
  };
}

export function useBlockBlastGame({
  bestScore: externalBestScore = 0,
  onGameOver,
}: UseBlockBlastGameOptions = {}): GameState & GameActions {
  const [board, setBoard] = useState<BoardGrid>(createEmptyBoard);
  const [pieces, setPieces] = useState<BlockPiece[]>(() => createPieces(Date.now()));
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<{ row: number; col: number } | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(externalBestScore);
  const [combo, setCombo] = useState(0);
  const [status, setStatus] = useState<"playing" | "gameOver">("playing");
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [piecesPlaced, setPiecesPlaced] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [clearAnimation, setClearAnimation] = useState<ClearAnimation | null>(null);
  const [placementAnimation, setPlacementAnimation] = useState<PlacementAnimation | null>(null);
  const clearAnimationTimers = useRef<number[]>([]);
  const placementAnimationTimers = useRef<number[]>([]);

  useEffect(() => {
    setBestScore((current) => Math.max(current, externalBestScore));
  }, [externalBestScore]);

  useEffect(
    () => () => {
      clearAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
      clearAnimationTimers.current = [];
      placementAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
      placementAnimationTimers.current = [];
    },
    []
  );

  const addFeedback = useCallback((items: FeedbackItem[]) => {
    setFeedback((prev) => [...prev, ...items]);
    items.forEach((item) => {
      setTimeout(() => {
        setFeedback((prev) => prev.filter((f) => f.id !== item.id));
      }, 1800);
    });
  }, []);

  const doPlace = useCallback(
    (pieceId: string, row: number, col: number): boolean => {
      if (status !== "playing") return false;

      const piece = pieces.find((p) => p.id === pieceId && !p.placed);
      if (!piece) return false;

      if (!canPlacePiece(board, piece, row, col)) {
        return false;
      }
      
      const t0 = performance.now();

      const newBoard = placePiece(board, piece, row, col);
      const nextPlacementAnimation = makePlacementAnimation(piece, row, col);
      const placementScore = calculatePlacementScore(piece);
      const { board: clearedBoard, clearedRows, clearedCols, clearedCount } = clearLines(newBoard);
      const nextClearAnimation = makeClearAnimation(newBoard, clearedRows, clearedCols);

      const newCombo = clearedCount > 0 ? combo + 1 : 0;
      const clearScore = clearedCount > 0 ? calculateClearScore(clearedCount, newCombo) : 0;
      const totalAdded = placementScore + clearScore;

      const newScore = score + totalAdded;
      const newBest = Math.max(bestScore, newScore);
      const newPiecesPlaced = piecesPlaced + 1;
      const newLinesCleared = linesCleared + clearedCount;
      const newMaxCombo = Math.max(maxCombo, newCombo);

      const feedbackItems: FeedbackItem[] = [];
      clearedRows.forEach(() => feedbackItems.push(makeFeedback("Dọn hàng!", "clear-row")));
      clearedCols.forEach(() => feedbackItems.push(makeFeedback("Dọn cột!", "clear-col")));
      if (newCombo > 1) feedbackItems.push(makeFeedback(`Combo x${newCombo}!`, "combo"));

      const newPieces = pieces.map((p) =>
        p.id === pieceId ? { ...p, placed: true } : p
      );
      const allPlaced = newPieces.every((p) => p.placed);
      const nextPieces = allPlaced ? createPieces(Date.now()) : newPieces;

      const gameOver = isGameOver(clearedBoard, nextPieces.filter((p) => !p.placed));

      setBoard(clearedBoard);
      setPieces(nextPieces);
      setSelectedPieceId(null);
      setDraggingPieceId(null);
      setHoverAnchor(null);
      setScore(newScore);
      setBestScore(newBest);
      setCombo(newCombo);
      setPiecesPlaced(newPiecesPlaced);
      setLinesCleared(newLinesCleared);
      setMaxCombo(newMaxCombo);
      setPlacementAnimation(nextPlacementAnimation);
      const placementTimer = window.setTimeout(() => {
        setPlacementAnimation((current) =>
          current?.id === nextPlacementAnimation.id ? null : current
        );
      }, 520);
      placementAnimationTimers.current.push(placementTimer);
      if (feedbackItems.length > 0) addFeedback(feedbackItems);
      if (nextClearAnimation) {
        setClearAnimation(nextClearAnimation);
        const timer = window.setTimeout(() => {
          setClearAnimation((current) =>
            current?.id === nextClearAnimation.id ? null : current
          );
        }, 650);
        clearAnimationTimers.current.push(timer);
      }

      if (gameOver) {
        setStatus("gameOver");
        onGameOver?.({
          score: newScore,
          maxCombo: newMaxCombo,
          linesCleared: newLinesCleared,
          piecesPlaced: newPiecesPlaced,
        });
      }
      
      const t1 = performance.now();
      console.log(`[PERF] onPlacePiece_logic: ${(t1-t0).toFixed(2)}ms`);
      // Expose to global for board render delay measurement
      (globalThis as any).__lastPlacePieceTime = performance.now();

      return true;
    },
    [board, pieces, score, bestScore, combo, status, piecesPlaced, linesCleared, maxCombo, addFeedback, onGameOver]
  );

  const selectPiece = useCallback((id: string | null) => {
    setSelectedPieceId(id);
    setDraggingPieceId(null);
  }, []);

  const startDrag = useCallback((id: string) => {
    setDraggingPieceId(id);
    setSelectedPieceId(null);
  }, []);

  const endDrag = useCallback(() => {
    setDraggingPieceId(null);
    setHoverAnchor(null);
  }, []);

  const placePieceAction = useCallback(
    (id: string, row: number, col: number): boolean => doPlace(id, row, col),
    [doPlace]
  );

  const placeSelectedPiece = useCallback(
    (row: number, col: number): boolean => {
      if (!selectedPieceId) return false;
      return doPlace(selectedPieceId, row, col);
    },
    [selectedPieceId, doPlace]
  );

  const placeDraggingPiece = useCallback(
    (row: number, col: number): boolean => {
      if (!draggingPieceId) return false;
      return doPlace(draggingPieceId, row, col);
    },
    [draggingPieceId, doPlace]
  );

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setPieces(createPieces(Date.now()));
    setSelectedPieceId(null);
    setDraggingPieceId(null);
    setHoverAnchor(null);
    setScore(0);
    setCombo(0);
    setStatus("playing");
    setFeedback([]);
    setClearAnimation(null);
    setPlacementAnimation(null);
    setPiecesPlaced(0);
    setLinesCleared(0);
    setMaxCombo(0);
    setBestScore(externalBestScore);
  }, [externalBestScore]);

  const toggleSfx = useCallback(() => setSfxEnabled((v) => !v), []);
  const toggleMusic = useCallback(() => setMusicEnabled((v) => !v), []);

  const dismissFeedback = useCallback((id: string) => {
    setFeedback((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return {
    board,
    pieces,
    selectedPieceId,
    draggingPieceId,
    hoverAnchor,
    score,
    bestScore,
    combo,
    status,
    feedback,
    piecesPlaced,
    linesCleared,
    maxCombo,
    sfxEnabled,
    musicEnabled,
    clearAnimation,
    placementAnimation,
    selectPiece,
    startDrag,
    endDrag,
    setHoverAnchor,
    placePiece: placePieceAction,
    placeSelectedPiece,
    placeDraggingPiece,
    resetGame,
    toggleSfx,
    toggleMusic,
    dismissFeedback,
  };
}
