import { useEffect } from "react";
import { BoardGrid, BlockPiece } from "@/features/blockblast/game/blockBlastLogic";
import type {
  ClearAnimation,
  ComboShakeEvent,
  PlacementAnimation,
} from "@/features/blockblast/hooks/useBlockBlastGame";
import {
  BOARD_PIXELS,
  BOARD_X,
  BOARD_Y,
  TRAY_Y,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "@/features/blockblast/game/pixiDrawUtils";
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
  comboShakeEvent: ComboShakeEvent | null;
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
  comboShakeEvent,
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
    viewport,
    layoutMode,
    worldTransform,
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
    worldTransform,
    ready
  );
  
  usePixiAnimations(
    appRef.current,
    animationLayerRef.current,
    clearAnimation,
    placementAnimation,
    comboShakeEvent,
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
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        ref={hostRef}
        aria-label="Bảng chơi Xếp Khối"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}`,
          borderRadius: 24,
          overflow: "hidden",
          touchAction: "none",
          overscrollBehavior: "none",
        }}
      />
      <ViewportDebug
        layoutMode={layoutMode}
        viewport={viewport}
        rendererWidth={appRef.current?.renderer.screen.width ?? 0}
        rendererHeight={appRef.current?.renderer.screen.height ?? 0}
        worldScale={worldTransform.scale}
        worldX={worldTransform.x}
        worldY={worldTransform.y}
      />
    </div>
  );
}

function ViewportDebug({
  layoutMode,
  viewport,
  rendererWidth,
  rendererHeight,
  worldScale,
  worldX,
  worldY,
}: {
  layoutMode: string;
  viewport: { width: number; height: number };
  rendererWidth: number;
  rendererHeight: number;
  worldScale: number;
  worldX: number;
  worldY: number;
}) {
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("viewportDebug") !== "1") return null;

  const visualViewport = window.visualViewport;
  const lines = [
    `layoutMode ${layoutMode}`,
    `container ${viewport.width}x${viewport.height}`,
    `window ${window.innerWidth}x${window.innerHeight}`,
    `visual ${Math.round(visualViewport?.width ?? 0)}x${Math.round(visualViewport?.height ?? 0)}`,
    `dpr ${window.devicePixelRatio}`,
    `renderer ${rendererWidth}x${rendererHeight}`,
    `world s${worldScale.toFixed(3)} x${worldX} y${worldY}`,
    `board ${BOARD_X},${BOARD_Y},${BOARD_PIXELS}`,
    `trayY ${TRAY_Y}`,
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        left: 6,
        zIndex: 30,
        maxWidth: 220,
        padding: "6px 7px",
        borderRadius: 8,
        background: "rgba(42,36,24,0.78)",
        color: "#fff7df",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
        lineHeight: 1.35,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
      }}
    >
      {lines.join("\n")}
    </div>
  );
}
