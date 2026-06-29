import { useState, useCallback, useEffect, useRef, useReducer } from "react";
import {
  createEmptyBoard,
  createSmartPieces,
  canPlacePiece,
  placePiece,
  clearLines,
  isGameOver,
  calculatePlacementScore,
  calculateClearScore,
  BoardGrid,
  BlockPiece,
} from "@/features/blockblast/game/blockBlastLogic";
import { blockBlastAudio } from "@/features/blockblast/audio/blockBlastAudio";
import { DEBUG_BLOCK_BLAST_PERF } from "@/features/blockblast/game/debugPerf";
import type { GameResult } from "@/features/blockblast/lib/localScores";

export interface FeedbackItem {
  id: string;
  text: string;
  type: "clear-row" | "clear-col" | "combo" | "invalid" | "placement" | "boom";
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

export interface BoomEvent {
  id: string;
  combo: number;
  clearedCount: number;
  clearedCells: number;
  remainingCells: number;
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
  status: "playing" | "resolving" | "gameOver";
  feedback: FeedbackItem[];
  piecesPlaced: number;
  linesCleared: number;
  maxCombo: number;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation | null;
  boomEvent: BoomEvent | null;
  reserveUnlocked: boolean;
  reservePiece: BlockPiece | null;
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
  unlockReserveSlot: () => void;
  useReserveSlot: () => boolean;
  toggleSfx: () => void;
  toggleMusic: () => void;
  dismissFeedback: (id: string) => void;
}

export interface UseBlockBlastGameOptions {
  bestScore?: number;
  sfxEnabled?: boolean;
  musicEnabled?: boolean;
  onGameOver?: (result: GameResult) => void;
}

type GameCoreState = Omit<GameState, "sfxEnabled" | "musicEnabled">;

interface PlacePiecePayload {
  board: BoardGrid;
  pieces: BlockPiece[];
  score: number;
  bestScore: number;
  combo: number;
  status: GameCoreState["status"];
  feedbackItems: FeedbackItem[];
  piecesPlaced: number;
  linesCleared: number;
  maxCombo: number;
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation;
  boomEvent: BoomEvent | null;
}

type GameAction =
  | { type: "syncBestScore"; bestScore: number }
  | { type: "selectPiece"; id: string | null }
  | { type: "startDrag"; id: string }
  | { type: "endDrag" }
  | { type: "setHoverAnchor"; anchor: { row: number; col: number } | null }
  | { type: "placePiece"; payload: PlacePiecePayload }
  | { type: "generateNextTray"; pieces: BlockPiece[]; status: GameCoreState["status"] }
  | {
      type: "useReserveSlot";
      pieces: BlockPiece[];
      reservePiece: BlockPiece | null;
      status: GameCoreState["status"];
    }
  | { type: "unlockReserveSlot" }
  | { type: "reset"; bestScore: number }
  | { type: "clearPlacementAnimation"; id: string }
  | { type: "clearClearAnimation"; id: string }
  | { type: "dismissFeedback"; id: string };

function createInitialCoreState(bestScore: number): GameCoreState {
  const board = createEmptyBoard();

  return {
    board,
    pieces: createSmartPieces(board, 0, Date.now()),
    selectedPieceId: null,
    draggingPieceId: null,
    hoverAnchor: null,
    score: 0,
    bestScore,
    combo: 0,
    status: "playing",
    feedback: [],
    piecesPlaced: 0,
    linesCleared: 0,
    maxCombo: 0,
    clearAnimation: null,
    placementAnimation: null,
    boomEvent: null,
    reserveUnlocked: false,
    reservePiece: null,
  };
}

function gameReducer(state: GameCoreState, action: GameAction): GameCoreState {
  switch (action.type) {
    case "syncBestScore":
      return { ...state, bestScore: Math.max(state.bestScore, action.bestScore) };
    case "selectPiece":
      return { ...state, selectedPieceId: action.id, draggingPieceId: null };
    case "startDrag":
      return { ...state, draggingPieceId: action.id, selectedPieceId: null };
    case "endDrag":
      return { ...state, draggingPieceId: null, hoverAnchor: null };
    case "setHoverAnchor":
      return { ...state, hoverAnchor: action.anchor };
    case "placePiece": {
      const { payload } = action;
      return {
        ...state,
        board: payload.board,
        pieces: payload.pieces,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
        score: payload.score,
        bestScore: payload.bestScore,
        combo: payload.combo,
        status: payload.status,
        feedback:
          payload.feedbackItems.length > 0
            ? [...state.feedback, ...payload.feedbackItems]
            : state.feedback,
        piecesPlaced: payload.piecesPlaced,
        linesCleared: payload.linesCleared,
        maxCombo: payload.maxCombo,
        clearAnimation: payload.clearAnimation ?? state.clearAnimation,
        placementAnimation: payload.placementAnimation,
        boomEvent: payload.boomEvent ?? state.boomEvent,
      };
    }
    case "generateNextTray":
      return {
        ...state,
        pieces: action.pieces,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
        status: action.status,
      };
    case "useReserveSlot":
      return {
        ...state,
        pieces: action.pieces,
        reservePiece: action.reservePiece,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
        status: action.status,
      };
    case "unlockReserveSlot":
      return { ...state, reserveUnlocked: true };
    case "reset":
      return createInitialCoreState(action.bestScore);
    case "clearPlacementAnimation":
      return {
        ...state,
        placementAnimation:
          state.placementAnimation?.id === action.id ? null : state.placementAnimation,
      };
    case "clearClearAnimation":
      return {
        ...state,
        clearAnimation: state.clearAnimation?.id === action.id ? null : state.clearAnimation,
      };
    case "dismissFeedback":
      return { ...state, feedback: state.feedback.filter((item) => item.id !== action.id) };
    default:
      return state;
  }
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

function countFilledCells(board: BoardGrid): number {
  return board.reduce(
    (total, row) => total + row.filter((cell) => cell.filled).length,
    0
  );
}

export function useBlockBlastGame({
  bestScore: externalBestScore = 0,
  sfxEnabled: controlledSfxEnabled,
  musicEnabled: controlledMusicEnabled,
  onGameOver,
}: UseBlockBlastGameOptions = {}): GameState & GameActions {
  const [gameState, dispatch] = useReducer(
    gameReducer,
    externalBestScore,
    createInitialCoreState
  );
  const [internalSfxEnabled, setInternalSfxEnabled] = useState(controlledSfxEnabled ?? true);
  const [internalMusicEnabled, setInternalMusicEnabled] = useState(controlledMusicEnabled ?? false);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const clearAnimationTimers = useRef<number[]>([]);
  const placementAnimationTimers = useRef<number[]>([]);
  const generationRafRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const sfxEnabled = controlledSfxEnabled ?? internalSfxEnabled;
  const musicEnabled = controlledMusicEnabled ?? internalMusicEnabled;

  const cancelPendingTrayGeneration = useCallback(() => {
    if (generationRafRef.current === null) return;
    cancelAnimationFrame(generationRafRef.current);
    generationRafRef.current = null;
  }, []);

  useEffect(() => {
    dispatch({ type: "syncBestScore", bestScore: externalBestScore });
  }, [externalBestScore]);

  useEffect(() => {
    if (controlledSfxEnabled !== undefined) setInternalSfxEnabled(controlledSfxEnabled);
  }, [controlledSfxEnabled]);

  useEffect(() => {
    if (controlledMusicEnabled !== undefined) setInternalMusicEnabled(controlledMusicEnabled);
  }, [controlledMusicEnabled]);

  useEffect(() => {
    blockBlastAudio.setMusicEnabled(musicEnabled);
    return () => blockBlastAudio.setMusicEnabled(false);
  }, [musicEnabled]);

  useEffect(
    () => () => {
      clearAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
      clearAnimationTimers.current = [];
      placementAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
      placementAnimationTimers.current = [];
      cancelPendingTrayGeneration();
    },
    [cancelPendingTrayGeneration]
  );

  const scheduleFeedbackDismissal = useCallback((items: FeedbackItem[]) => {
    items.forEach((item) => {
      setTimeout(() => {
        dispatch({ type: "dismissFeedback", id: item.id });
      }, 1800);
    });
  }, []);

  const scheduleDeferredTrayGeneration = useCallback(
    ({
      board,
      score,
      maxCombo,
      linesCleared,
      piecesPlaced,
    }: {
      board: BoardGrid;
      score: number;
      maxCombo: number;
      linesCleared: number;
      piecesPlaced: number;
    }) => {
      cancelPendingTrayGeneration();
      const capturedRunId = runIdRef.current;
      generationRafRef.current = requestAnimationFrame(() => {
        generationRafRef.current = null;
        if (capturedRunId !== runIdRef.current) return;
        if (gameStateRef.current.status !== "resolving") return;

        const genStart = DEBUG_BLOCK_BLAST_PERF ? performance.now() : 0;
        const generatedPieces = createSmartPieces(board, score, Date.now());
        if (DEBUG_BLOCK_BLAST_PERF) {
          console.log(`[PERF] createSmartPieces_deferred: ${(performance.now() - genStart).toFixed(2)}ms`);
        }

        const reservePiece = gameStateRef.current.reservePiece;
        const piecesToCheck = reservePiece ? [...generatedPieces, reservePiece] : generatedPieces;
        const generatedGameOver = isGameOver(board, piecesToCheck);
        dispatch({
          type: "generateNextTray",
          pieces: generatedPieces,
          status: generatedGameOver ? "gameOver" : "playing",
        });

        if (generatedGameOver) {
          if (sfxEnabled) blockBlastAudio.playGameOver();
          onGameOver?.({
            score,
            maxCombo,
            linesCleared,
            piecesPlaced,
          });
        }
      });
    },
    [cancelPendingTrayGeneration, onGameOver, sfxEnabled]
  );

  const doPlace = useCallback(
    (pieceId: string, row: number, col: number): boolean => {
      const state = gameStateRef.current;
      if (state.status !== "playing") return false;

      const piece = state.pieces.find((p) => p.id === pieceId && !p.placed);
      if (!piece) return false;

      if (!canPlacePiece(state.board, piece, row, col)) {
        if (sfxEnabled) blockBlastAudio.playInvalid();
        return false;
      }
      
      const placeStart = DEBUG_BLOCK_BLAST_PERF ? performance.now() : 0;

      const newBoard = placePiece(state.board, piece, row, col);
      const nextPlacementAnimation = makePlacementAnimation(piece, row, col);
      const placementScore = calculatePlacementScore(piece);
      const {
        board: clearedBoard,
        clearedRows,
        clearedCols,
        clearedCount,
        clearedCells,
      } = clearLines(newBoard);
      const nextClearAnimation = makeClearAnimation(newBoard, clearedRows, clearedCols);

      const newCombo = clearedCount > 0 ? state.combo + 1 : 0;
      const clearScore =
        clearedCount > 0 ? calculateClearScore(clearedCount, newCombo, clearedCells) : 0;
      const totalAdded = placementScore + clearScore;
      const remainingCells = countFilledCells(clearedBoard);
      const cleanSweepBoom = clearedCount > 0 && remainingCells === 0 && newCombo >= 2;
      const nextBoomEvent =
        cleanSweepBoom
          ? {
              id: `${Date.now()}-${Math.random()}`,
              combo: newCombo,
              clearedCount,
              clearedCells,
              remainingCells,
            }
          : null;

      const newScore = state.score + totalAdded;
      const newBest = Math.max(state.bestScore, newScore);
      const newPiecesPlaced = state.piecesPlaced + 1;
      const newLinesCleared = state.linesCleared + clearedCount;
      const newMaxCombo = Math.max(state.maxCombo, newCombo);

      const feedbackItems: FeedbackItem[] = [];
      if (totalAdded > placementScore) feedbackItems.push(makeFeedback(`+${totalAdded}`, "placement"));
      if (newCombo > 1) feedbackItems.push(makeFeedback(`x${newCombo} COMBO`, "combo"));
      if (nextBoomEvent) feedbackItems.push(makeFeedback("FULL CLEAR", "boom"));

      const newPieces = state.pieces.map((p) =>
        p.id === pieceId ? { ...p, placed: true } : p
      );
      const allPlaced = newPieces.every((p) => p.placed);

      // When all 3 placed, defer smart generation to next frame.
      // For now, use newPieces (all marked placed) so the tray shows empty.
      // gameOver check uses newPieces — if allPlaced, no unplaced remain,
      // so isGameOver would return true. We handle this after generation.
      const nextPieces = newPieces;

      // Only check game over if not all placed (deferred generation handles it later)
      const gameOverPieces = state.reservePiece
        ? [...nextPieces.filter((p) => !p.placed), state.reservePiece]
        : nextPieces.filter((p) => !p.placed);
      const gameOver = allPlaced ? false : isGameOver(clearedBoard, gameOverPieces);
      const nextStatus = allPlaced ? "resolving" : gameOver ? "gameOver" : "playing";

      dispatch({
        type: "placePiece",
        payload: {
          board: clearedBoard,
          pieces: nextPieces,
          score: newScore,
          bestScore: newBest,
          combo: newCombo,
          status: nextStatus,
          feedbackItems,
          piecesPlaced: newPiecesPlaced,
          linesCleared: newLinesCleared,
          maxCombo: newMaxCombo,
          clearAnimation: nextClearAnimation,
          placementAnimation: nextPlacementAnimation,
          boomEvent: nextBoomEvent,
        },
      });

      // Defer smart piece generation to next frame when all 3 placed
      if (allPlaced) {
        scheduleDeferredTrayGeneration({
          board: clearedBoard,
          score: newScore,
          maxCombo: newMaxCombo,
          linesCleared: newLinesCleared,
          piecesPlaced: newPiecesPlaced,
        });
      }

      const placementTimer = window.setTimeout(() => {
        dispatch({ type: "clearPlacementAnimation", id: nextPlacementAnimation.id });
      }, 520);
      placementAnimationTimers.current.push(placementTimer);
      if (feedbackItems.length > 0) scheduleFeedbackDismissal(feedbackItems);
      if (nextClearAnimation) {
        const timer = window.setTimeout(() => {
          dispatch({ type: "clearClearAnimation", id: nextClearAnimation.id });
        }, 650);
        clearAnimationTimers.current.push(timer);
      }

      if (sfxEnabled) {
        if (clearedCount > 0) {
          if (nextBoomEvent) {
            blockBlastAudio.playBoom();
          } else {
            blockBlastAudio.playLineClear(clearedRows.length, clearedCols.length, newCombo);
            if (newCombo > 1) blockBlastAudio.playCombo(newCombo);
          }
        } else {
          blockBlastAudio.playPlace();
        }
      }

      // Game over check for non-allPlaced case (allPlaced handled in deferred rAF)
      if (!allPlaced && gameOver) {
        if (sfxEnabled) blockBlastAudio.playGameOver();
        onGameOver?.({
          score: newScore,
          maxCombo: newMaxCombo,
          linesCleared: newLinesCleared,
          piecesPlaced: newPiecesPlaced,
        });
      }
      
      if (DEBUG_BLOCK_BLAST_PERF) {
        console.log(`[PERF] onPlacePiece_logic: ${(performance.now() - placeStart).toFixed(2)}ms (allPlaced=${allPlaced})`);
        (globalThis as any).__lastPlacePieceTime = performance.now();
      }

      return true;
    },
    [sfxEnabled, scheduleDeferredTrayGeneration, scheduleFeedbackDismissal, onGameOver]
  );

  const selectPiece = useCallback((id: string | null) => {
    if (gameStateRef.current.status !== "playing") return;
    dispatch({ type: "selectPiece", id });
  }, []);

  const startDrag = useCallback((id: string) => {
    if (gameStateRef.current.status !== "playing") return;
    dispatch({ type: "startDrag", id });
  }, []);

  const endDrag = useCallback(() => {
    if (gameStateRef.current.status !== "playing") return;
    dispatch({ type: "endDrag" });
  }, []);

  const setHoverAnchorAction = useCallback((anchor: { row: number; col: number } | null) => {
    if (gameStateRef.current.status !== "playing") return;
    dispatch({ type: "setHoverAnchor", anchor });
  }, []);

  const placePieceAction = useCallback(
    (id: string, row: number, col: number): boolean => doPlace(id, row, col),
    [doPlace]
  );

  const placeSelectedPiece = useCallback(
    (row: number, col: number): boolean => {
      const selectedPieceId = gameStateRef.current.selectedPieceId;
      if (!selectedPieceId) return false;
      return doPlace(selectedPieceId, row, col);
    },
    [doPlace]
  );

  const placeDraggingPiece = useCallback(
    (row: number, col: number): boolean => {
      const draggingPieceId = gameStateRef.current.draggingPieceId;
      if (!draggingPieceId) return false;
      return doPlace(draggingPieceId, row, col);
    },
    [doPlace]
  );

  const resetGame = useCallback(() => {
    runIdRef.current += 1;
    cancelPendingTrayGeneration();
    dispatch({ type: "reset", bestScore: externalBestScore });
  }, [cancelPendingTrayGeneration, externalBestScore]);

  const unlockReserveSlot = useCallback(() => {
    if (gameStateRef.current.status !== "playing") return;
    dispatch({ type: "unlockReserveSlot" });
  }, []);

  const useReserveSlot = useCallback((): boolean => {
    const state = gameStateRef.current;
    if (state.status !== "playing" || !state.reserveUnlocked) return false;

    let nextPieces = state.pieces;
    let nextReservePiece = state.reservePiece;

    if (state.selectedPieceId) {
      const selectedIndex = state.pieces.findIndex(
        (piece) => piece.id === state.selectedPieceId && !piece.placed
      );
      if (selectedIndex < 0) return false;

      const selectedPiece = { ...state.pieces[selectedIndex], placed: false };
      nextPieces = state.pieces.map((piece, index) => {
        if (index !== selectedIndex) return piece;
        return state.reservePiece
          ? { ...state.reservePiece, placed: false }
          : { ...piece, placed: true };
      });
      nextReservePiece = selectedPiece;
    } else if (state.reservePiece) {
      const emptyIndex = state.pieces.findIndex((piece) => piece.placed);
      if (emptyIndex < 0) return false;

      nextPieces = state.pieces.map((piece, index) =>
        index === emptyIndex ? { ...state.reservePiece!, placed: false } : piece
      );
      nextReservePiece = null;
    } else {
      return false;
    }

    const allInactive = nextPieces.every((piece) => piece.placed);
    dispatch({
      type: "useReserveSlot",
      pieces: nextPieces,
      reservePiece: nextReservePiece,
      status: allInactive ? "resolving" : "playing",
    });

    if (allInactive) {
      scheduleDeferredTrayGeneration({
        board: state.board,
        score: state.score,
        maxCombo: state.maxCombo,
        linesCleared: state.linesCleared,
        piecesPlaced: state.piecesPlaced,
      });
    }

    if (sfxEnabled) blockBlastAudio.playPlace();
    return true;
  }, [scheduleDeferredTrayGeneration, sfxEnabled]);

  const toggleSfx = useCallback(() => setInternalSfxEnabled((v) => !v), []);
  const toggleMusic = useCallback(() => setInternalMusicEnabled((v) => !v), []);

  const dismissFeedback = useCallback((id: string) => {
    dispatch({ type: "dismissFeedback", id });
  }, []);

  return {
    ...gameState,
    sfxEnabled,
    musicEnabled,
    selectPiece,
    startDrag,
    endDrag,
    setHoverAnchor: setHoverAnchorAction,
    placePiece: placePieceAction,
    placeSelectedPiece,
    placeDraggingPiece,
    resetGame,
    unlockReserveSlot,
    useReserveSlot,
    toggleSfx,
    toggleMusic,
    dismissFeedback,
  };
}
