import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Sprite, Rectangle, FederatedPointerEvent } from "pixi.js";
import { BlockPiece, BOARD_SIZE, canPlacePiece } from "@/features/blockblast/game/blockBlastLogic";
import {
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
  pieceId: string | null;
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
  animationAge: number;
}

export function usePixiPieces(
  app: Application | null,
  piecesLayer: Container | null,
  dragLayer: Container | null,
  boardLayer: Container | null,
  board: GameState["board"],
  pieces: BlockPiece[],
  selectedPieceId: string | null,
  onSelectPiece: (id: string | null) => void,
  onPlacePiece: (id: string, row: number, col: number) => boolean,
  ready: boolean
) {
  const latestRef = useRef({ pieces, selectedPieceId, onPlacePiece, onSelectPiece, board });
  const slotsRef = useRef<SlotObjects[]>([]);
  const previewContainerRef = useRef<Container | null>(null);

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
    animationAge: 0,
  });

  useEffect(() => {
    latestRef.current = { pieces, selectedPieceId, onPlacePiece, onSelectPiece, board };
  }, [pieces, selectedPieceId, onPlacePiece, onSelectPiece, board]);

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
      } else {
        // Just cancel
        cleanupDrag();
      }
    };

    const tick = (ticker: any) => {
      const ctx = dragCtx.current;
      if (ctx.state === "idle") return;

      const dt = ticker.deltaTime;

      if (ctx.state === "pickup") {
          // Lerp position to finger tip
          ctx.dragRenderPosition.x += (ctx.dragTargetPosition.x - ctx.dragRenderPosition.x) * (1 - Math.exp(-dt * 0.4));
          ctx.dragRenderPosition.y += (ctx.dragTargetPosition.y - ctx.dragRenderPosition.y) * (1 - Math.exp(-dt * 0.4));
      } else if (ctx.state === "dragging") {
          // Tight lerp
          ctx.dragRenderPosition.x += (ctx.dragTargetPosition.x - ctx.dragRenderPosition.x) * (1 - Math.exp(-dt * 0.8));
          ctx.dragRenderPosition.y += (ctx.dragTargetPosition.y - ctx.dragRenderPosition.y) * (1 - Math.exp(-dt * 0.8));
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
              // Impact!
              ctx.state = "committing";
              if (ctx.activePieceId && ctx.candidateCell) {
                  const t0 = performance.now();
                  
                  // Double rAF to avoid stuttering on the exact impact frame
                  requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                         latestRef.current.onPlacePiece(ctx.activePieceId!, ctx.candidateCell!.row, ctx.candidateCell!.col);
                         navigator.vibrate?.(10);
                         cleanupDrag();
                      });
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
          
          if (canPlacePiece(current.board, piece, targetRow, targetCol)) {
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

    if (slotsRef.current.length === 0) {
      for (let index = 0; index < 3; index++) {
        const slotX = TRAY_X + index * (PIECE_SLOT_WIDTH + PIECE_SLOT_GAP);
        const container = new Container();
        container.x = slotX;
        container.y = TRAY_Y;
        container.eventMode = "static";
        container.cursor = "pointer";
        container.hitArea = new Rectangle(0, 0, PIECE_SLOT_WIDTH, PIECE_SLOT_HEIGHT);

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
        
        container.addChild(shell, pieceGraphic, mark);
        piecesLayer.addChild(container);

        container.on("pointerdown", (event: FederatedPointerEvent) => {
          const slot = slotsRef.current[index];
          if (!slot || !slot.pieceId) return;

          const current = latestRef.current;
          const piece = current.pieces.find(p => p.id === slot.pieceId);
          if (!piece || piece.placed) return;

          const ctx = dragCtx.current;
          if (ctx.state !== "idle") return;

          ctx.state = "pickup";
          ctx.activePieceId = piece.id;
          ctx.sourceTrayIndex = index;
          ctx.pointerGlobal = { x: event.global.x, y: event.global.y };
          ctx.originalTrayPosition = { x: slotX, y: TRAY_Y };

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

        slotsRef.current.push({ container, shell, pieceGraphic, mark, pieceId: null });
      }
    }

    performance.mark("tray_render_start");
    pieces.forEach((piece, index) => {
      const slot = slotsRef.current[index];
      if (!slot) return;
      
      // Calculate fit
      let canFit = false;
      if (!piece.placed) {
         for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
               if (canPlacePiece(board, piece, r, c)) {
                  canFit = true;
                  break;
               }
            }
            if (canFit) break;
         }
      }

      slot.pieceId = piece.id;
      const isSelected = selectedPieceId === piece.id;
      const ctx = dragCtx.current;

      const isInteractable = canFit && !piece.placed;
      slot.container.eventMode = isInteractable ? "static" : "none";

      const isDraggingThis = ctx.activePieceId === piece.id && ctx.sourceTrayIndex === index && ctx.state !== "idle";
      slot.pieceGraphic.visible = !isDraggingThis;

      slot.shell.clear();
      slot.shell.roundRect(0, 0, PIECE_SLOT_WIDTH, PIECE_SLOT_HEIGHT, 18)
        .fill({ color: piece.placed ? 0xefe3c4 : 0xfdf6ea, alpha: piece.placed ? 0.58 : 0.92 })
        .stroke({
          width: isSelected ? 3 : 1.5,
          color: isSelected ? 0xe87432 : 0x8a7d65,
          alpha: isSelected ? 0.95 : 0.26,
        });

      // Update sprites
      const sprites = slot.pieceGraphic.children as Sprite[];
      sprites.forEach(s => s.visible = false);

      if (!piece.placed) {
        const bounds = pieceBounds(piece);
        const previewCell = Math.min(24, Math.floor((PIECE_SLOT_WIDTH - 24) / bounds.width));
        const previewGap = 2;
        const pieceWidth = bounds.width * previewCell + (bounds.width - 1) * previewGap;
        const pieceHeight = bounds.height * previewCell + (bounds.height - 1) * previewGap;
        const startX = (PIECE_SLOT_WIDTH - pieceWidth) / 2;
        const startY = (PIECE_SLOT_HEIGHT - pieceHeight) / 2;

        const tex = getBlockTexture(app, previewCell, piece.colorId, canFit ? 1 : 0.3);

        let i = 0;
        for (const cell of piece.cells) {
          const s = sprites[i++];
          if (!s) break;
          s.texture = tex;
          s.x = startX + (cell.col - bounds.minCol) * (previewCell + previewGap);
          s.y = startY + (cell.row - bounds.minRow) * (previewCell + previewGap);
          s.visible = true;
        }
      }

      slot.mark.clear();
    });
    
    performance.mark("tray_render_end");
    performance.measure("tray_render", "tray_render_start", "tray_render_end");
    const m = performance.getEntriesByName("tray_render").pop();
    if (m) console.log(`[PERF] tray_render: ${m.duration.toFixed(2)}ms`);

  }, [pieces, selectedPieceId, ready, piecesLayer, dragLayer, board, app]);

  useEffect(() => {
    return () => {
      slotsRef.current.forEach(slot => {
        slot.container.destroy({ children: true });
      });
      slotsRef.current = [];
    };
  }, []);
}
