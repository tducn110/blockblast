import { useEffect } from "react";
import { BoardGrid, BlockPiece } from "../../utils/blockBlastLogic";
import type { ClearAnimation, PlacementAnimation } from "../../hooks/useBlockBlastGame";
import { VIEW_WIDTH, VIEW_HEIGHT } from "../../utils/pixiDrawUtils";
import { usePixiApp } from "../../hooks/pixi/usePixiApp";
import { usePixiBoard } from "../../hooks/pixi/usePixiBoard";
import { usePixiPieces } from "../../hooks/pixi/usePixiPieces";
import { usePixiAnimations } from "../../hooks/pixi/usePixiAnimations";

interface PixiBlockBlastCanvasProps {
  board: BoardGrid;
  pieces: BlockPiece[];
  selectedPieceId: string | null;
  status: "playing" | "gameOver";
  clearAnimation: ClearAnimation | null;
  placementAnimation: PlacementAnimation | null;
  onSelectPiece: (id: string | null) => void;
  onPlacePiece: (id: string, row: number, col: number) => boolean;
}

export function PixiBlockBlastCanvas({
  board,
  pieces,
  selectedPieceId,
  status,
  clearAnimation,
  placementAnimation,
  onSelectPiece,
  onPlacePiece,
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

  usePixiBoard(boardLayerRef.current, board, ready);
  
  usePixiPieces(
    appRef.current,
    piecesLayerRef.current,
    dragLayerRef.current,
    boardLayerRef.current,
    pieces,
    selectedPieceId,
    onSelectPiece,
    onPlacePiece,
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
