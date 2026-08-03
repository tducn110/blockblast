import { useState, useCallback, useEffect, useRef, useReducer } from "react";
import {
  createEmptyBoard,
  createSmartPieces,
  createRevivePieces,
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
import type { GameResult } from "@/features/blockblast/lib/localScores";

export interface FeedbackItem {
  id: string;
  text: string;
  type: "clear-row" | "clear-col" | "combo" | "invalid" | "placement" | "boom";
}

interface ClearingCell {
  row: number;
  col: number;
  colorId?: string;
}

export interface ClearAnimation {
  id: string;
  cells: ClearingCell[];
  clearedRows: number[];
  clearedCols: number[];
  accentColorId?: string;
}

export interface PlacementAnimation {
  id: string;
  cells: ClearingCell[];
  score: number;
  clearedCount: number;
}

export interface BoomEvent {
  id: string;
  combo: number;
  clearedCount: number;
  clearedCells: number;
  remainingCells: number;
}

export interface ComboShakeEvent {
  id: string;
  combo: number;
  intensity: number;
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
  status: "playing" | "resolving" | "reviveOffer" | "gameOver";
  feedback: FeedbackItem[];
  piecesPlaced: number;
  linesCleared: number;
  maxCombo: number;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation | null;
  boomEvent: BoomEvent | null;
  comboShakeEvent: ComboShakeEvent | null;
  reserveUnlocked: boolean;
  reservePiece: BlockPiece | null;
  reviveUsed: boolean;
  adPending: boolean;
}

export type MockAdRewardKind = "reserve" | "revive";

type GameActions = {
  selectPiece: (id: string | null) => void;
  startDrag: (id: string) => void;
  endDrag: () => void;
  setHoverAnchor: (anchor: { row: number; col: number } | null) => void;
  placePiece: (id: string, row: number, col: number) => boolean;
  placeSelectedPiece: (row: number, col: number) => boolean;
  placeDraggingPiece: (row: number, col: number) => boolean;
  resetGame: () => void;
  revive: () => boolean;
  declineRevive: () => void;
  beginMockAd: (kind: MockAdRewardKind) => boolean;
  completeMockAd: (kind: MockAdRewardKind, granted: boolean) => boolean;
  unlockReserveSlot: () => void;
  useReserveSlot: () => boolean;
  toggleSfx: () => void;
  toggleMusic: () => void;
  dismissFeedback: (id: string) => void;
  doubleScore: () => void;
}

interface UseBlockBlastGameOptions {
  bestScore?: number;
  sfxEnabled?: boolean;
  musicEnabled?: boolean;
  paused?: boolean;
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
  comboShakeEvent: ComboShakeEvent | null;
  reservePiece: BlockPiece | null;
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
  | { type: "beginMockAd" }
  | { type: "cancelMockAd" }
  | { type: "completeReserveAd"; granted: boolean }
  | { type: "completeReviveAd"; granted: boolean; pieces: BlockPiece[] | null }
  | { type: "revive"; pieces: BlockPiece[] }
  | { type: "declineRevive" }
  | { type: "reset"; bestScore: number }
  | { type: "clearPlacementAnimation"; id: string }
  | { type: "clearClearAnimation"; id: string }
  | { type: "dismissFeedback"; id: string }
  | { type: "doubleScore" };

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
    comboShakeEvent: null,
    reserveUnlocked: false,
    reservePiece: null,
    reviveUsed: false,
    adPending: false,
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
        comboShakeEvent: payload.comboShakeEvent ?? state.comboShakeEvent,
        reservePiece: payload.reservePiece,
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
    case "revive":
      return {
        ...state,
        pieces: action.pieces,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
        combo: 0,
        status: "playing",
        feedback: [],
        clearAnimation: null,
        placementAnimation: null,
        boomEvent: null,
        comboShakeEvent: null,
        reservePiece: null,
        reviveUsed: true,
      };
    case "declineRevive":
      return state.status === "reviveOffer" ? { ...state, status: "gameOver" } : state;
    case "unlockReserveSlot":
      return { ...state, reserveUnlocked: true };
    case "beginMockAd":
      return {
        ...state,
        adPending: true,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
      };
    case "cancelMockAd":
      return {
        ...state,
        adPending: false,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
      };
    case "completeReserveAd":
      return {
        ...state,
        adPending: false,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
        reserveUnlocked:
          action.granted && state.status === "playing" ? true : state.reserveUnlocked,
      };
    case "completeReviveAd":
      if (!action.granted || !action.pieces) {
        return { ...state, adPending: false };
      }
      return {
        ...state,
        pieces: action.pieces,
        selectedPieceId: null,
        draggingPieceId: null,
        hoverAnchor: null,
        combo: 0,
        status: "playing",
        feedback: [],
        clearAnimation: null,
        placementAnimation: null,
        boomEvent: null,
        comboShakeEvent: null,
        reservePiece: null,
        reviveUsed: true,
        adPending: false,
      };
    case "doubleScore": {
      const newScore = state.score * 2;
      return {
        ...state,
        score: newScore,
        bestScore: Math.max(state.bestScore, newScore),
      };
    }
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
  clearedCols: number[],
  accentColorId?: string
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
    accentColorId,
  };
}

function makePlacementAnimation(
  piece: BlockPiece,
  row: number,
  col: number,
  score: number,
  clearedCount: number
): PlacementAnimation {
  return {
    id: `${Date.now()}-${Math.random()}`,
    cells: piece.cells.map((cell) => ({
      row: row + cell.row,
      col: col + cell.col,
      colorId: piece.colorId,
    })),
    score,
    clearedCount,
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
  paused = false,
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
  const mockAdSessionRef = useRef<{ kind: MockAdRewardKind; runId: number } | null>(null);
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
    blockBlastAudio.setSfxEnabled(sfxEnabled);
  }, [sfxEnabled]);

  useEffect(() => {
    blockBlastAudio.setMusicEnabled(musicEnabled);
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
        if (gameStateRef.current.adPending || mockAdSessionRef.current) return;

        const generatedPieces = createSmartPieces(board, score, Date.now());

        const reservePiece = gameStateRef.current.reservePiece;
        const piecesToCheck = reservePiece ? [...generatedPieces, reservePiece] : generatedPieces;
        const generatedGameOver = isGameOver(board, piecesToCheck);
        const reviveUsed = gameStateRef.current.reviveUsed;
        dispatch({
          type: "generateNextTray",
          pieces: generatedPieces,
          status: generatedGameOver ? (reviveUsed ? "gameOver" : "reviveOffer") : "playing",
        });

        if (generatedGameOver && reviveUsed) {
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
      if (paused || state.status !== "playing" || state.adPending || mockAdSessionRef.current) return false;

      const trayPiece = state.pieces.find((p) => p.id === pieceId && !p.placed);
      const reservePiece =
        !trayPiece && state.reservePiece?.id === pieceId && !state.reservePiece.placed
          ? state.reservePiece
          : null;
      const piece = trayPiece ?? reservePiece;
      if (!piece) return false;

      if (!canPlacePiece(state.board, piece, row, col)) {
        if (sfxEnabled) blockBlastAudio.playInvalid();
        return false;
      }
      

      const newBoard = placePiece(state.board, piece, row, col);
      const placementScore = calculatePlacementScore(piece);
      const {
        board: clearedBoard,
        clearedRows,
        clearedCols,
        clearedCount,
        clearedCells,
      } = clearLines(newBoard);
      const nextClearAnimation = makeClearAnimation(
        newBoard,
        clearedRows,
        clearedCols,
        piece.colorId
      );

      const newCombo = clearedCount > 0 ? state.combo + 1 : 0;
      const clearScore =
        clearedCount > 0 ? calculateClearScore(clearedCount, newCombo, clearedCells) : 0;
      const totalAdded = placementScore + clearScore;
      const nextPlacementAnimation = makePlacementAnimation(
        piece,
        row,
        col,
        totalAdded,
        clearedCount
      );
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
      const nextComboShakeEvent =
        newCombo >= 2
          ? {
              id: `${Date.now()}-${Math.random()}`,
              combo: newCombo,
              intensity: Math.min(18, 6 + newCombo * 2.2 + clearedCount * 1.2),
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

      const newPieces = trayPiece
        ? state.pieces.map((p) => (p.id === pieceId ? { ...p, placed: true } : p))
        : state.pieces;
      const nextReservePiece = reservePiece ? null : state.reservePiece;
      const allPlaced = newPieces.every((p) => p.placed);

      // When all 3 placed, defer smart generation to next frame.
      // For now, use newPieces (all marked placed) so the tray shows empty.
      // gameOver check uses newPieces — if allPlaced, no unplaced remain,
      // so isGameOver would return true. We handle this after generation.
      const nextPieces = newPieces;

      // Only check game over if not all placed (deferred generation handles it later)
      const gameOverPieces = nextReservePiece
        ? [...nextPieces.filter((p) => !p.placed), nextReservePiece]
        : nextPieces.filter((p) => !p.placed);
      const gameOver = allPlaced ? false : isGameOver(clearedBoard, gameOverPieces);
      const nextStatus = allPlaced
        ? "resolving"
        : gameOver
          ? state.reviveUsed
            ? "gameOver"
            : "reviveOffer"
          : "playing";

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
          comboShakeEvent: nextComboShakeEvent,
          reservePiece: nextReservePiece,
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
      if (!allPlaced && gameOver && state.reviveUsed) {
        if (sfxEnabled) blockBlastAudio.playGameOver();
        onGameOver?.({
          score: newScore,
          maxCombo: newMaxCombo,
          linesCleared: newLinesCleared,
          piecesPlaced: newPiecesPlaced,
        });
      }
      

      return true;
    },
    [sfxEnabled, scheduleDeferredTrayGeneration, scheduleFeedbackDismissal, onGameOver]
  );

  const selectPiece = useCallback((id: string | null) => {
    if (
      paused ||
      gameStateRef.current.status !== "playing" ||
      gameStateRef.current.adPending ||
      mockAdSessionRef.current
    ) {
      return;
    }
    dispatch({ type: "selectPiece", id });
  }, []);

  const startDrag = useCallback((id: string) => {
    if (
      paused ||
      gameStateRef.current.status !== "playing" ||
      gameStateRef.current.adPending ||
      mockAdSessionRef.current
    ) {
      return;
    }
    dispatch({ type: "startDrag", id });
  }, []);

  const endDrag = useCallback(() => {
    if (
      paused ||
      gameStateRef.current.status !== "playing" ||
      gameStateRef.current.adPending ||
      mockAdSessionRef.current
    ) {
      return;
    }
    dispatch({ type: "endDrag" });
  }, []);

  const setHoverAnchorAction = useCallback((anchor: { row: number; col: number } | null) => {
    if (
      paused ||
      gameStateRef.current.status !== "playing" ||
      gameStateRef.current.adPending ||
      mockAdSessionRef.current
    ) {
      return;
    }
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
    mockAdSessionRef.current = null;
    cancelPendingTrayGeneration();
    dispatch({ type: "reset", bestScore: externalBestScore });
  }, [cancelPendingTrayGeneration, externalBestScore]);

  const revive = useCallback((): boolean => {
    const state = gameStateRef.current;
    if (state.status !== "reviveOffer" || state.reviveUsed || state.adPending || mockAdSessionRef.current) {
      return false;
    }

    const rescuePieces = createRevivePieces(state.board, state.score, Date.now());
    if (!rescuePieces) return false;

    runIdRef.current += 1;
    cancelPendingTrayGeneration();
    clearAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
    clearAnimationTimers.current = [];
    placementAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
    placementAnimationTimers.current = [];
    dispatch({ type: "revive", pieces: rescuePieces });
    if (sfxEnabled) blockBlastAudio.playPlace();
    return true;
  }, [cancelPendingTrayGeneration, sfxEnabled]);

  const declineRevive = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== "reviveOffer" || state.adPending || mockAdSessionRef.current) return;

    dispatch({ type: "declineRevive" });
    if (sfxEnabled) blockBlastAudio.playGameOver();
    onGameOver?.({
      score: state.score,
      maxCombo: state.maxCombo,
      linesCleared: state.linesCleared,
      piecesPlaced: state.piecesPlaced,
    });
  }, [onGameOver, sfxEnabled]);

  const beginMockAd = useCallback(
    (kind: MockAdRewardKind): boolean => {
      const state = gameStateRef.current;
      if (state.adPending || mockAdSessionRef.current) return false;

      if (kind === "reserve") {
        if (state.status !== "playing" || state.reserveUnlocked) return false;
      } else if (state.status !== "reviveOffer" || state.reviveUsed) {
        return false;
      }

      cancelPendingTrayGeneration();
      mockAdSessionRef.current = { kind, runId: runIdRef.current };
      dispatch({ type: "beginMockAd" });
      return true;
    },
    [cancelPendingTrayGeneration]
  );

  const completeMockAd = useCallback(
    (kind: MockAdRewardKind, granted: boolean): boolean => {
      const session = mockAdSessionRef.current;
      if (!session || session.kind !== kind) return false;

      mockAdSessionRef.current = null;
      const state = gameStateRef.current;
      if (session.runId !== runIdRef.current || !granted) {
        dispatch({ type: "cancelMockAd" });
        return false;
      }

      if (kind === "reserve") {
        const canUnlock = state.status === "playing" && !state.reserveUnlocked;
        dispatch({ type: "completeReserveAd", granted: canUnlock });
        return canUnlock;
      }

      if (state.status !== "reviveOffer" || state.reviveUsed) {
        dispatch({ type: "completeReviveAd", granted: false, pieces: null });
        return false;
      }

      const rescuePieces = createRevivePieces(state.board, state.score, Date.now());
      if (!rescuePieces) {
        dispatch({ type: "completeReviveAd", granted: false, pieces: null });
        return false;
      }

      runIdRef.current += 1;
      cancelPendingTrayGeneration();
      clearAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
      clearAnimationTimers.current = [];
      placementAnimationTimers.current.forEach((timer) => window.clearTimeout(timer));
      placementAnimationTimers.current = [];
      dispatch({ type: "completeReviveAd", granted: true, pieces: rescuePieces });
      if (sfxEnabled) blockBlastAudio.playPlace();
      return true;
    },
    [cancelPendingTrayGeneration, sfxEnabled]
  );

  const unlockReserveSlot = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== "playing" || state.adPending || mockAdSessionRef.current) return;
    dispatch({ type: "unlockReserveSlot" });
  }, []);

  const useReserveSlot = useCallback((): boolean => {
    const state = gameStateRef.current;
    if (state.status !== "playing" || !state.reserveUnlocked || state.adPending || mockAdSessionRef.current) {
      return false;
    }

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
      const targetIndex =
        emptyIndex >= 0 ? emptyIndex : state.pieces.findIndex((piece) => !piece.placed);
      if (targetIndex < 0) return false;

      const outgoingPiece = state.pieces[targetIndex];
      nextPieces = state.pieces.map((piece, index) =>
        index === targetIndex ? { ...state.reservePiece!, placed: false } : piece
      );
      nextReservePiece = emptyIndex >= 0 ? null : { ...outgoingPiece, placed: false };
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

  const doubleScore = useCallback(() => {
    dispatch({ type: "doubleScore" });
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
    revive,
    declineRevive,
    beginMockAd,
    completeMockAd,
    unlockReserveSlot,
    useReserveSlot,
    toggleSfx,
    toggleMusic,
    dismissFeedback,
    doubleScore,
  };
}
