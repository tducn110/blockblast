import { useEffect } from "react";
import { BoardGrid, BlockPiece } from "@/features/blockblast/game/blockBlastLogic";
import type { ClearAnimation, PlacementAnimation } from "@/features/blockblast/hooks/useBlockBlastGame";
import { VIEW_WIDTH, VIEW_HEIGHT } from "@/features/blockblast/game/pixiDrawUtils";
import { DEBUG_BLOCK_BLAST_PERF } from "@/features/blockblast/game/debugPerf";
import { usePixiApp } from "@/features/blockblast/render/usePixiApp";
import { usePixiBoard } from "@/features/blockblast/render/usePixiBoard";
import { usePixiPieces } from "@/features/blockblast/render/usePixiPieces";
import { usePixiAnimations } from "@/features/blockblast/render/usePixiAnimations";

interface PixiBlockBlastCanvasProps {
  board: BoardGrid;
  pieces: BlockPiece[];
  selectedPieceId: string | null;
  reserveUnlocked: boolean;
  reservePiece: BlockPiece | null;
  showMobileReserveSlot: boolean;
  status: "playing" | "resolving" | "gameOver";
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation | null;
  paused: boolean;
  onSelectPiece: (id: string | null) => void;
  onPlacePiece: (id: string, row: number, col: number) => boolean;
  onUnlockReserve: () => void | Promise<void>;
  onUseReserveSlot: () => boolean;
}

export function PixiBlockBlastCanvas({
  board,
  pieces,
  selectedPieceId,
  reserveUnlocked,
  reservePiece,
  showMobileReserveSlot,
  status,
  clearAnimation,
  placementAnimation,
  paused,
  onSelectPiece,
  onPlacePiece,
  onUnlockReserve,
  onUseReserveSlot,
}: PixiBlockBlastCanvasProps) {
  const {
    hostRef,
    appRef,
    boardLayerRef,
    piecesLayerRef,
    animationLayerRef,
    dragLayerRef,
    ready,
  } = usePixiApp();

  usePixiBoard(appRef.current!, boardLayerRef.current, board, ready);
  
  usePixiPieces(
    appRef.current,
    piecesLayerRef.current,
    dragLayerRef.current,
    boardLayerRef.current,
    board,
    pieces,
    selectedPieceId,
    reserveUnlocked,
    reservePiece,
    showMobileReserveSlot,
    status,
    onSelectPiece,
    onPlacePiece,
    onUnlockReserve,
    onUseReserveSlot,
    ready
  );
  
  usePixiAnimations(
    appRef.current,
    animationLayerRef.current,
    clearAnimation,
    placementAnimation,
    ready
  );

  useEffect(() => {
    if (!ready || !appRef.current) return;

    if (paused) {
      appRef.current.ticker.stop();
      return;
    }

    appRef.current.ticker.start();
    appRef.current.render();
  }, [paused, ready]);

  useEffect(() => {
    if (!DEBUG_BLOCK_BLAST_PERF || !appRef.current) return;
    const ticker = appRef.current.ticker;
    let lastTime = performance.now();
    
    const monitor = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 24) {
        console.warn(`[PERF] ticker_spike: ${delta.toFixed(2)}ms`);
      }
    };
    
    ticker.add(monitor);
    return () => { ticker.remove(monitor); };
  }, [ready]);

  useEffect(() => {
    if (!appRef.current || !appRef.current.canvas) return;
    appRef.current.canvas.style.filter = status === "gameOver" ? "saturate(0.7)" : "none";
  }, [status, ready]);

  return (
    <div
      ref={hostRef}
      aria-label="Bảng chơi Xếp Khối"
      style={{
        width: "100%",
        aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}`,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgba(138,125,101,0.24)",
      }}
    />
  );
}
