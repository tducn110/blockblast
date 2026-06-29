import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Sprite, Rectangle, FederatedPointerEvent, Ticker, Text } from "pixi.js";
import { BlockPiece, BOARD_SIZE, canPlacePiece } from "@/features/blockblast/game/blockBlastLogic";
import { DEBUG_BLOCK_BLAST_PERF } from "@/features/blockblast/game/debugPerf";
import {
  VIEW_WIDTH,
  PIECE_SLOT_WIDTH,
  TRAY_Y,
  TRAY_X,
  PIECE_SLOT_GAP,
  PIECE_SLOT_HEIGHT,
  pieceBounds,
  CELL,
  GAP,
  BOARD_X,
  BOARD_Y,
  getBlockTexture
} from "@/features/blockblast/game/pixiDrawUtils";
import { GameState } from "@/features/blockblast/hooks/useBlockBlastGame";

interface SlotObjects {
  container: Container;
  shell: Graphics;
  pieceGraphic: Container; // Changed to Container containing Sprites
  mark: Graphics;
  label: Text;
  pieceId: string | null;
}

interface TrayLayout {
  slotCount: number;
  slotWidth: number;
  slotHeight: number;
  slotGap: number;
  trayX: number;
  trayY: number;
  slotRadius: number;
  slotPaddingX: number;
  slotPaddingY: number;
  previewGap: number;
  previewMinCell: number;
  previewMaxCell: number;
}

const MOBILE_RESERVE_SLOT_WIDTH = 84;
const MOBILE_RESERVE_SLOT_HEIGHT = 92;
const MOBILE_RESERVE_SLOT_GAP = 8;
const MOBILE_RESERVE_TOTAL_WIDTH =
  MOBILE_RESERVE_SLOT_WIDTH * 4 + MOBILE_RESERVE_SLOT_GAP * 3;

function getTrayLayout(showMobileReserveSlot: boolean): TrayLayout {
  if (showMobileReserveSlot) {
    return {
      slotCount: 4,
      slotWidth: MOBILE_RESERVE_SLOT_WIDTH,
      slotHeight: MOBILE_RESERVE_SLOT_HEIGHT,
      slotGap: MOBILE_RESERVE_SLOT_GAP,
      trayX: (VIEW_WIDTH - MOBILE_RESERVE_TOTAL_WIDTH) / 2,
      trayY: TRAY_Y,
      slotRadius: 13,
      slotPaddingX: 8,
      slotPaddingY: 8,
      previewGap: 2,
      previewMinCell: 10,
      previewMaxCell: 19,
    };
  }

  return {
    slotCount: 3,
    slotWidth: PIECE_SLOT_WIDTH,
    slotHeight: PIECE_SLOT_HEIGHT,
    slotGap: PIECE_SLOT_GAP,
    trayX: TRAY_X,
    trayY: TRAY_Y,
    slotRadius: 18,
    slotPaddingX: 16,
    slotPaddingY: 14,
    previewGap: 3,
    previewMinCell: 14,
    previewMaxCell: 22,
  };
}

type DragState = "idle" | "pickup" | "dragging" | "snapping" | "committing";

interface DragContext {
  state: DragState;
  activePieceId: string | null;
  sourceTrayIndex: number;
  pointerGlobal: { x: number; y: number };
  originalTrayPosition: { x: number; y: number };
  ghostContainer: Container | null;
  shadowGraphics: Graphics | null; // Keep shadow as Graphics for now
  pieceGraphics: Container | null; // Use Container + Sprites for piece
  pickupOffset: { x: number; y: number };
  dragTargetPosition: { x: number; y: number };
  dragRenderPosition: { x: number; y: number };
  candidateCell: { row: number; col: number } | null;
  lastPreviewKey: string | null;
  animationAge: number;
}

function boardOccupancyKey(board: GameState["board"]): string {
  let key = "";
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      key += board[row][col].filled ? "1" : "0";
    }
  }
  return key;
}

function canPieceFitBoard(
  board: GameState["board"],
  piece: BlockPiece,
  boardKey: string,
  fitCache: Map<string, boolean>
): boolean {
  if (piece.placed) return false;

  const cacheKey = `${boardKey}:${piece.id}`;
  const cached = fitCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let canFit = false;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (canPlacePiece(board, piece, row, col)) {
        canFit = true;
        break;
      }
    }
    if (canFit) break;
  }

  fitCache.set(cacheKey, canFit);
  return canFit;
}

function drawPiecePreview(
  app: Application,
  pieceGraphic: Container,
  piece: BlockPiece,
  layout: TrayLayout,
  alpha: number
) {
  const sprites = pieceGraphic.children as Sprite[];
  sprites.forEach((sprite) => {
    sprite.visible = false;
  });

  if (piece.placed) return;

  const bounds = pieceBounds(piece);
  const availableWidth = layout.slotWidth - layout.slotPaddingX * 2;
  const availableHeight = layout.slotHeight - layout.slotPaddingY * 2;
  const widthGaps = Math.max(0, bounds.width - 1) * layout.previewGap;
  const heightGaps = Math.max(0, bounds.height - 1) * layout.previewGap;
  const cellByWidth = Math.floor((availableWidth - widthGaps) / bounds.width);
  const cellByHeight = Math.floor((availableHeight - heightGaps) / bounds.height);
  const previewCell = Math.max(
    layout.previewMinCell,
    Math.min(layout.previewMaxCell, cellByWidth, cellByHeight)
  );
  const pieceWidth = bounds.width * previewCell + (bounds.width - 1) * layout.previewGap;
  const pieceHeight = bounds.height * previewCell + (bounds.height - 1) * layout.previewGap;
  const startX = (layout.slotWidth - pieceWidth) / 2;
  const startY = (layout.slotHeight - pieceHeight) / 2;
  const texture = getBlockTexture(app, previewCell, piece.colorId, alpha);

  let spriteIndex = 0;
  for (const cell of piece.cells) {
    const sprite = sprites[spriteIndex++];
    if (!sprite) break;
    sprite.texture = texture;
    sprite.x = startX + (cell.col - bounds.minCol) * (previewCell + layout.previewGap);
    sprite.y = startY + (cell.row - bounds.minRow) * (previewCell + layout.previewGap);
    sprite.visible = true;
  }
}

function drawLockIcon(graphics: Graphics, x: number, y: number, color: number, alpha: number) {
  graphics
    .roundRect(x + 3, y + 15, 22, 20, 5)
    .fill({ color, alpha })
    .roundRect(x + 8, y + 3, 12, 17, 7)
    .stroke({ width: 4, color, alpha, alignment: 0.5 })
    .circle(x + 14, y + 24, 2.5)
    .fill({ color: 0xfdf6ea, alpha: 0.85 });
}

function clearSlot(slot: SlotObjects) {
  slot.pieceId = null;
  slot.container.eventMode = "none";
  slot.pieceGraphic.visible = true;
  (slot.pieceGraphic.children as Sprite[]).forEach((sprite) => {
    sprite.visible = false;
  });
  slot.shell.clear();
  slot.mark.clear();
  slot.label.visible = false;
}

function destroySlots(slots: SlotObjects[]) {
  slots.forEach((slot) => {
    slot.container.parent?.removeChild(slot.container);
    slot.container.destroy({ children: true });
  });
}

export function usePixiPieces(
  app: Application | null,
  piecesLayer: Container | null,
  dragLayer: Container | null,
  boardLayer: Container | null,
  board: GameState["board"],
  pieces: BlockPiece[],
  selectedPieceId: string | null,
  reserveUnlocked: boolean,
  reservePiece: BlockPiece | null,
  showMobileReserveSlot: boolean,
  status: GameState["status"],
  onSelectPiece: (id: string | null) => void,
  onPlacePiece: (id: string, row: number, col: number) => boolean,
  onUnlockReserve: () => void | Promise<void>,
  onUseReserveSlot: () => boolean,
  ready: boolean
) {
  const latestRef = useRef({
    pieces,
    selectedPieceId,
    reserveUnlocked,
    reservePiece,
    status,
    onPlacePiece,
    onSelectPiece,
    onUnlockReserve,
    onUseReserveSlot,
    board,
  });
  const slotsRef = useRef<SlotObjects[]>([]);
  const slotModeRef = useRef<boolean | null>(null);
  const previewContainerRef = useRef<Container | null>(null);
  const fitCacheRef = useRef<Map<string, boolean>>(new Map());

  const dragCtx = useRef<DragContext>({
    state: "idle",
    activePieceId: null,
    sourceTrayIndex: -1,
    pointerGlobal: { x: 0, y: 0 },
    originalTrayPosition: { x: 0, y: 0 },
    ghostContainer: null,
    shadowGraphics: null,
    pieceGraphics: null,
    pickupOffset: { x: 0, y: 0 },
    dragTargetPosition: { x: 0, y: 0 },
    dragRenderPosition: { x: 0, y: 0 },
    candidateCell: null,
    lastPreviewKey: null,
    animationAge: 0,
  });

  useEffect(() => {
    latestRef.current = {
      pieces,
      selectedPieceId,
      reserveUnlocked,
      reservePiece,
      status,
      onPlacePiece,
      onSelectPiece,
      onUnlockReserve,
      onUseReserveSlot,
      board,
    };
  }, [
    pieces,
    selectedPieceId,
    reserveUnlocked,
    reservePiece,
    status,
    onPlacePiece,
    onSelectPiece,
    onUnlockReserve,
    onUseReserveSlot,
    board,
  ]);

  // Global Drag Pipeline
  useEffect(() => {
    if (!ready || !app || !dragLayer || !boardLayer) return;

    // Create preview container
    const previewContainer = new Container();
    previewContainer.eventMode = "none";
    boardLayer.addChild(previewContainer);
    previewContainerRef.current = previewContainer;
    
    // We pool 25 sprites for the preview
    const previewCells: Sprite[] = [];
    for (let i = 0; i < 25; i++) {
        const s = new Sprite();
        s.visible = false;
        previewCells.push(s);
        previewContainer.addChild(s);
    }

    const onGlobalMove = (event: FederatedPointerEvent) => {
      const ctx = dragCtx.current;
      if (ctx.state === "idle" || ctx.state === "snapping" || ctx.state === "committing") return;

      ctx.pointerGlobal = { x: event.global.x, y: event.global.y };
      ctx.state = "dragging";
      
      ctx.dragTargetPosition = {
        x: ctx.pointerGlobal.x + ctx.pickupOffset.x,
        y: ctx.pointerGlobal.y + ctx.pickupOffset.y,
      };
    };

    const cleanupDrag = () => {
      const ctx = dragCtx.current;
      if (ctx.ghostContainer) {
        dragLayer.removeChild(ctx.ghostContainer);
        ctx.ghostContainer.destroy({ children: true });
      }
      previewCells.forEach(s => s.visible = false);
      
      // Reset state
      ctx.state = "idle";
      ctx.activePieceId = null;
      ctx.ghostContainer = null;
      ctx.shadowGraphics = null;
      ctx.pieceGraphics = null;
      ctx.candidateCell = null;
      ctx.lastPreviewKey = null;
      
      // Re-show tray
      if (ctx.sourceTrayIndex >= 0 && slotsRef.current[ctx.sourceTrayIndex]) {
          slotsRef.current[ctx.sourceTrayIndex].pieceGraphic.visible = true;
      }
      ctx.sourceTrayIndex = -1;
    };

    const onPointerUp = (event: FederatedPointerEvent) => {
      const ctx = dragCtx.current;
      if (ctx.state === "idle" || ctx.state === "snapping" || ctx.state === "committing") return;

      if (ctx.candidateCell) {
        // Snap to board!
        const piece = latestRef.current.pieces.find(p => p.id === ctx.activePieceId);
        if (!piece) {
            cleanupDrag();
            return;
        }
        const bounds = pieceBounds(piece);
        const pieceWidth = bounds.width * CELL + (bounds.width - 1) * GAP;
        const pieceHeight = bounds.height * CELL + (bounds.height - 1) * GAP;

        ctx.state = "snapping";
        ctx.animationAge = 0;
        ctx.dragTargetPosition = {
          x: BOARD_X + ctx.candidateCell.col * (CELL + GAP) + pieceWidth / 2,
          y: BOARD_Y + ctx.candidateCell.row * (CELL + GAP) + pieceHeight / 2,
        };
        // Remove scale/shadow immediately for crisp impact
        if (ctx.ghostContainer) ctx.ghostContainer.scale.set(1.0);
        if (ctx.shadowGraphics) ctx.shadowGraphics.visible = false;
        previewCells.forEach(s => s.visible = false);
        ctx.lastPreviewKey = null;
      } else {
        // Just cancel
        cleanupDrag();
      }
    };

    const tick = (ticker: Ticker) => {
      const ctx = dragCtx.current;
      if (ctx.state === "idle") return;

      const dt = ticker.deltaTime;

      if (ctx.state === "pickup") {
          // Lerp position to finger tip
          ctx.dragRenderPosition.x += (ctx.dragTargetPosition.x - ctx.dragRenderPosition.x) * (1 - Math.exp(-dt * 0.4));
          ctx.dragRenderPosition.y += (ctx.dragTargetPosition.y - ctx.dragRenderPosition.y) * (1 - Math.exp(-dt * 0.4));
      } else if (ctx.state === "dragging") {
          ctx.dragRenderPosition.x = ctx.dragTargetPosition.x;
          ctx.dragRenderPosition.y = ctx.dragTargetPosition.y;
      } else if (ctx.state === "snapping") {
          // Snap fast
          ctx.dragRenderPosition.x += (ctx.dragTargetPosition.x - ctx.dragRenderPosition.x) * (1 - Math.exp(-dt * 0.95));
          ctx.dragRenderPosition.y += (ctx.dragTargetPosition.y - ctx.dragRenderPosition.y) * (1 - Math.exp(-dt * 0.95));
          ctx.animationAge += ticker.elapsedMS;

          const dist = Math.hypot(
              ctx.dragTargetPosition.x - ctx.dragRenderPosition.x,
              ctx.dragTargetPosition.y - ctx.dragRenderPosition.y
          );

          if (dist < 1 || ctx.animationAge > 100) {
              // Impact! Visual snap first, logic deferred.
              ctx.state = "committing";

              // Snap ghost to exact board position immediately (visual)
              ctx.dragRenderPosition.x = ctx.dragTargetPosition.x;
              ctx.dragRenderPosition.y = ctx.dragTargetPosition.y;
              if (ctx.ghostContainer) {
                ctx.ghostContainer.x = ctx.dragRenderPosition.x;
                ctx.ghostContainer.y = ctx.dragRenderPosition.y;
              }

              if (ctx.activePieceId && ctx.candidateCell) {
                  const capturedPieceId = ctx.activePieceId;
                  const capturedRow = ctx.candidateCell.row;
                  const capturedCol = ctx.candidateCell.col;

                  // Defer logic to after this render frame
                  requestAnimationFrame(() => {
                    const placed = latestRef.current.onPlacePiece(
                      capturedPieceId,
                      capturedRow,
                      capturedCol
                    );
                    if (placed) {
                      navigator.vibrate?.(10);
                      // Keep the ghost block visible for a few frames while React/Pixi update the board.
                      // Since it perfectly overlaps the final board block, this prevents any 1-frame flicker.
                      setTimeout(() => {
                        cleanupDrag();
                      }, 50);
                    } else {
                      cleanupDrag();
                    }
                  });
              } else {
                  cleanupDrag();
              }
          }
      }

      if (ctx.ghostContainer) {
          ctx.ghostContainer.x = ctx.dragRenderPosition.x;
          ctx.ghostContainer.y = ctx.dragRenderPosition.y;
      }

      // Preview logic during drag
      if ((ctx.state === "pickup" || ctx.state === "dragging") && ctx.ghostContainer) {
          const current = latestRef.current;
          const piece = current.pieces.find(p => p.id === ctx.activePieceId);
          if (!piece) return;

          const bounds = pieceBounds(piece);
          const pieceWidth = bounds.width * CELL + (bounds.width - 1) * GAP;
          const pieceHeight = bounds.height * CELL + (bounds.height - 1) * GAP;

          const pieceLeft = ctx.dragRenderPosition.x - pieceWidth / 2;
          const pieceTop = ctx.dragRenderPosition.y - pieceHeight / 2;
          
          const targetCol = Math.round((pieceLeft - BOARD_X) / (CELL + GAP));
          const targetRow = Math.round((pieceTop - BOARD_Y) / (CELL + GAP));
          const valid = canPlacePiece(current.board, piece, targetRow, targetCol);
          const previewKey = `${piece.id}:${targetRow}:${targetCol}:${valid ? 1 : 0}`;

          if (previewKey === ctx.lastPreviewKey) return;

          ctx.lastPreviewKey = previewKey;
          
          if (valid) {
              ctx.candidateCell = { row: targetRow, col: targetCol };
              const bounds = pieceBounds(piece);
              const tex = getBlockTexture(app, CELL, piece.colorId, 0.4);
              
              previewCells.forEach(s => s.visible = false);
              let i = 0;
              for (const cell of piece.cells) {
                  const s = previewCells[i++];
                  s.texture = tex;
                  s.x = BOARD_X + (targetCol + cell.col - bounds.minCol) * (CELL + GAP);
                  s.y = BOARD_Y + (targetRow + cell.row - bounds.minRow) * (CELL + GAP);
                  s.visible = true;
              }
          } else {
              ctx.candidateCell = null;
              previewCells.forEach(s => s.visible = false);
          }
      }
    };

    app.stage.on("globalpointermove", onGlobalMove);
    app.stage.on("pointerup", onPointerUp);
    app.stage.on("pointerupoutside", onPointerUp);
    app.ticker.add(tick);

    return () => {
      app.stage.off("globalpointermove", onGlobalMove);
      app.stage.off("pointerup", onPointerUp);
      app.stage.off("pointerupoutside", onPointerUp);
      app.ticker.remove(tick);
      cleanupDrag();

      boardLayer.removeChild(previewContainer);
      previewContainer.destroy({ children: true });
    };
  }, [ready, app, dragLayer, boardLayer]);

  // Setup and update tray pieces
  useEffect(() => {
    if (!ready || !app || !piecesLayer || !dragLayer) return;

    const layout = getTrayLayout(showMobileReserveSlot);
    const reserveSlotIndex = layout.slotCount - 1;

    if (
      slotModeRef.current !== showMobileReserveSlot ||
      slotsRef.current.length !== layout.slotCount
    ) {
      destroySlots(slotsRef.current);
      slotsRef.current = [];
      slotModeRef.current = showMobileReserveSlot;
    }

    if (slotsRef.current.length === 0) {
      for (let index = 0; index < layout.slotCount; index++) {
        const slotX = layout.trayX + index * (layout.slotWidth + layout.slotGap);
        const container = new Container();
        container.x = slotX;
        container.y = layout.trayY;
        container.eventMode = "static";
        container.cursor = "pointer";
        container.hitArea = new Rectangle(0, 0, layout.slotWidth, layout.slotHeight);

        const shell = new Graphics();
        shell.eventMode = "none";
        
        const pieceGraphic = new Container();
        pieceGraphic.eventMode = "none";
        // Pre-fill 25 sprites
        for (let i = 0; i < 25; i++) {
           const s = new Sprite();
           s.visible = false;
           pieceGraphic.addChild(s);
        }
        
        const mark = new Graphics();
        mark.eventMode = "none";

        const label = new Text({
          text: "",
          style: {
            fontFamily: "Be Vietnam Pro, Arial, sans-serif",
            fontSize: 11,
            fontWeight: "800",
            fill: 0x8a7d65,
            align: "center",
          },
        });
        label.anchor.set(0.5);
        label.eventMode = "none";
        label.visible = false;
        
        container.addChild(shell, pieceGraphic, mark, label);
        piecesLayer.addChild(container);

        container.on("pointerdown", (event: FederatedPointerEvent) => {
          const current = latestRef.current;
          if (current.status !== "playing") return;

          const isReserveSlot = showMobileReserveSlot && index === reserveSlotIndex;
          if (isReserveSlot) {
            const hasSelectedPiece =
              current.selectedPieceId !== null &&
              current.pieces.some((piece) => piece.id === current.selectedPieceId && !piece.placed);
            const hasPlacedTraySlot = current.pieces.some((piece) => piece.placed);
            const actionable =
              !current.reserveUnlocked ||
              hasSelectedPiece ||
              (current.reservePiece !== null && hasPlacedTraySlot);

            if (!actionable || dragCtx.current.state !== "idle") return;
            if (!current.reserveUnlocked) {
              void current.onUnlockReserve();
            } else {
              current.onUseReserveSlot();
            }
            return;
          }

          const slot = slotsRef.current[index];
          if (!slot || !slot.pieceId) return;

          const piece = current.pieces.find(p => p.id === slot.pieceId);
          if (!piece || piece.placed) return;

          const ctx = dragCtx.current;
          if (ctx.state !== "idle") return;

          ctx.state = "pickup";
          ctx.activePieceId = piece.id;
          ctx.sourceTrayIndex = index;
          ctx.pointerGlobal = { x: event.global.x, y: event.global.y };
          ctx.originalTrayPosition = { x: slotX, y: layout.trayY };

          const bounds = pieceBounds(piece);
          const pieceWidth = bounds.width * CELL + (bounds.width - 1) * GAP;
          const pieceHeight = bounds.height * CELL + (bounds.height - 1) * GAP;

          ctx.ghostContainer = new Container();
          ctx.ghostContainer.eventMode = "none";

          ctx.shadowGraphics = new Graphics();
          ctx.shadowGraphics.eventMode = "none";

          ctx.pieceGraphics = new Container();
          ctx.pieceGraphics.eventMode = "none";

          // Center pivot for scaling
          ctx.ghostContainer.pivot.set(pieceWidth / 2, pieceHeight / 2);

          const tex = getBlockTexture(app, CELL, piece.colorId, 1);

          for (const cell of piece.cells) {
            const cx = (cell.col - bounds.minCol) * (CELL + GAP);
            const cy = (cell.row - bounds.minRow) * (CELL + GAP);
            
            ctx.shadowGraphics.roundRect(cx + 8, cy + 12, CELL, CELL, 10).fill({ color: 0x000000, alpha: 0.22 });
            
            const s = new Sprite(tex);
            s.x = cx;
            s.y = cy;
            ctx.pieceGraphics.addChild(s);
          }

          ctx.ghostContainer.addChild(ctx.shadowGraphics);
          ctx.ghostContainer.addChild(ctx.pieceGraphics);
          dragLayer.addChild(ctx.ghostContainer);

          ctx.pickupOffset = { x: 0, y: -pieceHeight/2 - 20 };
          
          const startTargetX = ctx.pointerGlobal.x + ctx.pickupOffset.x;
          const startTargetY = ctx.pointerGlobal.y + ctx.pickupOffset.y;
          
          ctx.dragTargetPosition = { x: startTargetX, y: startTargetY };
          ctx.dragRenderPosition = { x: startTargetX, y: startTargetY };

          ctx.ghostContainer.x = ctx.dragRenderPosition.x;
          ctx.ghostContainer.y = ctx.dragRenderPosition.y;
          
          ctx.ghostContainer.scale.set(1.15);

          current.onSelectPiece(piece.id);
          slot.pieceGraphic.visible = false;
        });

        slotsRef.current.push({ container, shell, pieceGraphic, mark, label, pieceId: null });
      }
    }

    const trayRenderStart = DEBUG_BLOCK_BLAST_PERF ? performance.now() : 0;
    const boardKey = boardOccupancyKey(board);
    const fitCache = fitCacheRef.current;
    if (fitCache.size > 256) fitCache.clear();

    slotsRef.current.forEach(clearSlot);

    pieces.slice(0, 3).forEach((piece, index) => {
      const slot = slotsRef.current[index];
      if (!slot) return;

      const canFit = canPieceFitBoard(board, piece, boardKey, fitCache);

      slot.pieceId = piece.id;
      const isSelected = selectedPieceId === piece.id;
      const ctx = dragCtx.current;

      const isInteractable = status === "playing" && canFit && !piece.placed;
      slot.container.eventMode = isInteractable ? "static" : "none";
      slot.container.cursor = isInteractable ? "pointer" : "default";

      const isDraggingThis = ctx.activePieceId === piece.id && ctx.sourceTrayIndex === index && ctx.state !== "idle";
      slot.pieceGraphic.visible = !isDraggingThis;

      slot.shell.clear();
      slot.shell.roundRect(0, 0, layout.slotWidth, layout.slotHeight, layout.slotRadius)
        .fill({ color: piece.placed ? 0xefe3c4 : 0xfdf6ea, alpha: piece.placed ? 0.58 : 0.92 })
        .stroke({
          width: 1.5,
          color: isSelected ? 0xd66a2f : 0x8a7d65,
          alpha: isSelected ? 0.38 : 0.26,
        });
      if (isSelected) {
        slot.shell.roundRect(4, 4, layout.slotWidth - 8, layout.slotHeight - 8, layout.slotRadius - 4)
          .fill({ color: 0xf0b840, alpha: 0.08 })
          .stroke({ width: 2, color: 0xd66a2f, alpha: 0.72, alignment: 1 });
      }

      if (!piece.placed) {
        drawPiecePreview(app, slot.pieceGraphic, piece, layout, canFit ? 1 : 0.3);
      }

      slot.mark.clear();
    });

    if (showMobileReserveSlot) {
      const slot = slotsRef.current[reserveSlotIndex];
      if (slot) {
        const hasSelectedPiece =
          selectedPieceId !== null &&
          pieces.some((piece) => piece.id === selectedPieceId && !piece.placed);
        const hasPlacedTraySlot = pieces.some((piece) => piece.placed);
        const canUseReserve =
          status === "playing" &&
          (!reserveUnlocked ||
            hasSelectedPiece ||
            (reservePiece !== null && hasPlacedTraySlot));
        const isActiveTarget = reserveUnlocked && hasSelectedPiece;

        slot.pieceId = reservePiece?.id ?? null;
        slot.container.eventMode = canUseReserve ? "static" : "none";
        slot.container.cursor = canUseReserve ? "pointer" : "default";
        slot.shell.clear();
        slot.mark.clear();
        slot.label.visible = false;
        slot.pieceGraphic.visible = true;

        const borderColor = !reserveUnlocked
          ? 0xd66a2f
          : isActiveTarget
            ? 0x6b8e3d
            : 0x93ad72;

        slot.shell.roundRect(0, 0, layout.slotWidth, layout.slotHeight, layout.slotRadius)
          .fill({ color: 0xfdf6ea, alpha: reserveUnlocked ? 0.92 : 0.82 })
          .stroke({
            width: isActiveTarget ? 2 : 1.5,
            color: borderColor,
            alpha: isActiveTarget ? 0.82 : 0.58,
          });

        if (!reserveUnlocked) {
          slot.mark
            .roundRect(0, 0, layout.slotWidth, layout.slotHeight, layout.slotRadius)
            .fill({ color: 0xf5ecd7, alpha: 0.5 });
          drawLockIcon(slot.mark, layout.slotWidth / 2 - 14, 18, 0x7c6c55, 0.82);
          slot.label.text = "Xem QC";
          slot.label.style.fill = 0x5f5241;
          slot.label.x = layout.slotWidth / 2;
          slot.label.y = layout.slotHeight - 22;
          slot.label.visible = true;
        } else if (reservePiece) {
          const canFit = canPieceFitBoard(board, reservePiece, boardKey, fitCache);
          drawPiecePreview(app, slot.pieceGraphic, reservePiece, layout, canFit ? 1 : 0.35);
        } else {
          slot.mark
            .moveTo(layout.slotWidth / 2 - 7, 36)
            .lineTo(layout.slotWidth / 2 + 7, 36)
            .stroke({ width: 4, color: 0x93ad72, alpha: hasSelectedPiece ? 0.86 : 0.44, cap: "round" })
            .moveTo(layout.slotWidth / 2, 29)
            .lineTo(layout.slotWidth / 2, 43)
            .stroke({ width: 4, color: 0x93ad72, alpha: hasSelectedPiece ? 0.86 : 0.44, cap: "round" });
          slot.label.text = "Cất";
          slot.label.style.fill = hasSelectedPiece ? 0x6b8e3d : 0x9ba883;
          slot.label.x = layout.slotWidth / 2;
          slot.label.y = layout.slotHeight - 24;
          slot.label.visible = true;
        }
      }
    }
    
    if (DEBUG_BLOCK_BLAST_PERF) {
      console.log(`[PERF] tray_render: ${(performance.now() - trayRenderStart).toFixed(2)}ms`);
    }

  }, [
    pieces,
    selectedPieceId,
    reserveUnlocked,
    reservePiece,
    showMobileReserveSlot,
    status,
    ready,
    piecesLayer,
    dragLayer,
    board,
    app,
  ]);

  useEffect(() => {
    return () => {
      destroySlots(slotsRef.current);
      slotsRef.current = [];
    };
  }, []);
}
